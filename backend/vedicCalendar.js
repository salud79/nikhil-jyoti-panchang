
/*
 Nikhil Jyoti Panchang
 backend/vedicCalendar.js

 Hindu Calendar Supplementary Engine

 Features:
 - Sunrise and sunset
 - Dinmaan and Ratrimaan
 - Weekday
 - Rahu Kaal
 - Yamaganda
 - Gulika Kaal
 - Brahma Muhurta
 - Abhijit Muhurta
 - Vijaya Muhurta
 - Godhuli
 - Ritu
 - Ayana
 - Surya Rashi
 - Chandra Rashi

 Uses:
 backend/dailyPanchang.js

 Important:
 Approximate astronomical calculations.
 Festival and ritual decisions require
 independent validation.
*/

import {
  solarEvent,
  addDays,
  formatIST,
  dateParts
} from './dailyPanchang';

const MIN = 60000;

const WEEK = [
  'रविवार',
  'सोमवार',
  'मंगलवार',
  'बुधवार',
  'गुरुवार',
  'शुक्रवार',
  'शनिवार'
];

const RASHI = [
  'मेष',
  'वृषभ',
  'मिथुन',
  'कर्क',
  'सिंह',
  'कन्या',
  'तुला',
  'वृश्चिक',
  'धनु',
  'मकर',
  'कुम्भ',
  'मीन'
];

const RITU = [
  'वसंत',
  'ग्रीष्म',
  'वर्षा',
  'शरद',
  'हेमंत',
  'शिशिर'
];

/*
 Standard weekday-based eighths.

 Weekday index:
 Sunday = 0
 Monday = 1
 ...
 Saturday = 6

 Segment index:
 0 to 7
*/

const RAHU_SEGMENT = [
  7, // Sunday
  1, // Monday
  6, // Tuesday
  4, // Wednesday
  5, // Thursday
  3, // Friday
  2  // Saturday
];

const YAMA_SEGMENT = [
  4, // Sunday
  3, // Monday
  2, // Tuesday
  1, // Wednesday
  0, // Thursday
  6, // Friday
  5  // Saturday
];

const GULIKA_SEGMENT = [
  6, // Sunday
  5, // Monday
  4, // Tuesday
  3, // Wednesday
  2, // Thursday
  1, // Friday
  0  // Saturday
];

function norm(x) {
  return ((x % 360) + 360) % 360;
}

function isValidDate(value) {
  return (
    value instanceof Date &&
    Number.isFinite(value.getTime())
  );
}

/*
 Format interval in IST.
*/

function span(start, end) {

  if (
    !isValidDate(start) ||
    !isValidDate(end) ||
    end <= start
  ) {
    return 'उपलब्ध नहीं';
  }

  return (
    formatIST(start) +
    ' – ' +
    formatIST(end)
  );
}

/*
 Divide any interval into equal parts.
*/

function interval(
  start,
  end,
  index,
  count
) {

  if (
    !isValidDate(start) ||
    !isValidDate(end) ||
    end <= start ||
    !Number.isInteger(index) ||
    !Number.isInteger(count) ||
    count <= 0 ||
    index < 0 ||
    index >= count
  ) {
    return 'उपलब्ध नहीं';
  }

  const length =
    end.getTime() - start.getTime();

  const a = new Date(
    start.getTime() +
    length * index / count
  );

  const b = new Date(
    start.getTime() +
    length * (index + 1) / count
  );

  return span(a, b);
}

/*
 Duration in hours and minutes.
*/

function duration(ms) {

  if (
    !Number.isFinite(ms) ||
    ms < 0
  ) {
    return 'उपलब्ध नहीं';
  }

  const minutes =
    Math.round(ms / MIN);

  const hours =
    Math.floor(minutes / 60);

  const remaining =
    minutes % 60;

  return (
    hours +
    ' घंटे ' +
    remaining +
    ' मिनट'
  );
}

/*
 Convert sidereal longitude to Rashi.
*/

function getRashi(longitude) {

  if (
    longitude === null ||
    longitude === undefined ||
    longitude === ''
  ) {
    return null;
  }

  const value = Number(longitude);

  if (!Number.isFinite(value)) {
    return null;
  }

  const index =
    Math.floor(norm(value) / 30);

  return RASHI[index];
}

/*
 Ritu convention:

 Sidereal solar months:
 Meena + Mesha = Vasanta
 Vrishabha + Mithuna = Grishma
 Karka + Simha = Varsha
 Kanya + Tula = Sharad
 Vrischika + Dhanu = Hemanta
 Makara + Kumbha = Shishira

 This is a solar-rashi approximation
 and not a lunar-month festival rule.
*/

function getRitu(sunLongitude) {

  if (
    sunLongitude === null ||
    sunLongitude === undefined ||
    sunLongitude === ''
  ) {
    return 'उपलब्ध नहीं';
  }

  const sun = Number(sunLongitude);

  if (!Number.isFinite(sun)) {
    return 'उपलब्ध नहीं';
  }

  const sign =
    Math.floor(norm(sun) / 30);

  const index =
    Math.floor(((sign + 1) % 12) / 2);

  return RITU[index];
}

/*
 Traditional sidereal solar-month
 convention for Ayana.

 Makara through Mithuna:
 Uttarayana

 Karka through Dhanu:
 Dakshinayana

 This is not the same as the exact
 astronomical solstice instant.
*/

function getAyana(sunLongitude) {

  if (
    sunLongitude === null ||
    sunLongitude === undefined ||
    sunLongitude === ''
  ) {
    return 'उपलब्ध नहीं';
  }

  const sun = Number(sunLongitude);

  if (!Number.isFinite(sun)) {
    return 'उपलब्ध नहीं';
  }

  const value = norm(sun);

  if (
    value >= 270 ||
    value < 90
  ) {
    return 'उत्तरायण';
  }

  return 'दक्षिणायन';
}

/*
 Brahma Muhurta:

 Traditional approximation:
 96 to 48 minutes before sunrise.

 This assumes a fixed 48-minute
 muhurta convention.
*/

function getBrahmaMuhurta(rise) {

  return span(
    new Date(
      rise.getTime() - 96 * MIN
    ),
    new Date(
      rise.getTime() - 48 * MIN
    )
  );
}

/*
 Abhijit Muhurta:

 Daylight divided into 15 equal
 muhurta periods.

 Abhijit = eighth muhurta.
 Zero-based index = 7.
*/

function getAbhijit(rise, set) {

  return interval(
    rise,
    set,
    7,
    15
  );
}

/*
 Vijaya Muhurta:

 Daylight divided into 15 equal
 muhurta periods.

 Vijaya = eleventh muhurta.
 Zero-based index = 10.
*/

function getVijaya(rise, set) {

  return interval(
    rise,
    set,
    10,
    15
  );
}

/*
 Godhuli approximation:
 12 minutes before and after sunset.

 Regional traditions may differ.
*/

function getGodhuli(set) {

  return span(
    new Date(
      set.getTime() - 12 * MIN
    ),
    new Date(
      set.getTime() + 12 * MIN
    )
  );
}

/*
 Main exported function.

 Preserve existing function signature
 for compatibility with panchang.web.js.
*/

export function calculateVedicCalendar(
  dateString,
  latitude,
  longitude,
  sunSiderealLongitude = null,
  moonSiderealLongitude = null,
  riseSet = null
) {

  /*
   Validate date using the existing
   dailyPanchang date parser.
  */

  const {
    y,
    m,
    d
  } = dateParts(dateString);

  const lat = Number(latitude);
  const lon = Number(longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 66 ||
    Math.abs(lon) > 180
  ) {
    throw new Error(
      'Invalid coordinates'
    );
  }

  /*
   Solar events.

   The underlying dailyPanchang
   solarEvent implementation determines
   the accuracy of these values.
  */

  const rise = riseSet ? riseSet.sunrise : solarEvent(dateString, lat, lon, true);
  const set = riseSet ? riseSet.sunset : solarEvent(dateString, lat, lon, false);
  const tomorrow = riseSet
    ? riseSet.nextSunrise
    : solarEvent(addDays(dateString, 1), lat, lon, true);

  if (
    !isValidDate(rise) ||
    !isValidDate(set) ||
    !isValidDate(tomorrow) ||
    set <= rise ||
    tomorrow <= set
  ) {
    throw new Error(
      'Solar events unavailable'
    );
  }

  /*
   Weekday calculation.
  */

  const weekdayIndex =
    new Date(
      Date.UTC(y, m - 1, d)
    ).getUTCDay();

  const weekday =
    WEEK[weekdayIndex];

  /*
   Day and night lengths.
  */

  const dayLength =
    set.getTime() -
    rise.getTime();

  const nightLength =
    tomorrow.getTime() -
    set.getTime();

  /*
   Sidereal solar and lunar
   positions.
  */

  const sun =
    sunSiderealLongitude === null ||
    sunSiderealLongitude === undefined
      ? null
      : Number(sunSiderealLongitude);

  const moon =
    moonSiderealLongitude === null ||
    moonSiderealLongitude === undefined
      ? null
      : Number(moonSiderealLongitude);

  /*
   Muhurta calculations.
  */

  const muhurta = {

    brahma:
      getBrahmaMuhurta(rise),

    abhijit:
      getAbhijit(rise, set),

    vijaya:
      getVijaya(rise, set),

    godhuli:
      getGodhuli(set),

    rahuKaal:
      interval(
        rise,
        set,
        RAHU_SEGMENT[weekdayIndex],
        8
      ),

    yamaGanda:
      interval(
        rise,
        set,
        YAMA_SEGMENT[weekdayIndex],
        8
      ),

    gulikaKaal:
      interval(
        rise,
        set,
        GULIKA_SEGMENT[weekdayIndex],
        8
      )
  };

  /*
   Return fields compatible with
   the existing Panchang API.
  */

  return {

    date: dateString,

    weekday,

    sunrise:
      formatIST(rise),

    sunset:
      formatIST(set),

    nextSunrise:
      formatIST(tomorrow),

    dinmaan:
      duration(dayLength),

    ratrimaan:
      duration(nightLength),

    ritu:
      getRitu(sun),

    ayana:
      getAyana(sun),

    suryaRashi:
      getRashi(sun),

    chandraRashi:
      getRashi(moon),

    muhurta,

    /*
     These fields are calculated
     by lunarCalendar.js and
     gujaratiCalendar.js.
    */

    lunarMonth: null,

    amantaMonth: null,

    purnimantaMonth: null,

    vikramSamvat: null,

    shakaSamvat: null,

    gujaratiSamvat: null,

    brihaspatiSamvatsara: null,

    /*
     Future annual engine.
    */

    grahaMantrimandal: null,

    /*
     Metadata.
    */

    accuracy: 'approximate',

    timezone: 'Asia/Kolkata',

    calculationMethod:
      'Sidereal solar calendar',

    validationRequired: true

  };
}


