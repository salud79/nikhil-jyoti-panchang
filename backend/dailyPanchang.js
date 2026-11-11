
/*
 Nikhil Jyoti Panchang
 backend/dailyPanchang.js

 Approximate daily Panchang engine.

 Features:
 - Sunrise and sunset
 - Moonrise and moonset
 - Tithi transition
 - Nakshatra transition
 - Yoga transition
 - Karana transition
 - Sunrise Panchang
 - Selected-time Panchang
 - Legacy 30-day candidate calendar

 All instants are JavaScript UTC Dates.
 Displayed clock times are IST.

 Compatible with:
 astronomy.js
 vedicCalendar.js
 muhurtaEngine.js
 vratEngine.js
 gujaratiCalendar.js
 panchang.web.js

 NOT a validated ephemeris.
*/

import {
  calculateAstronomy,
  julianDay,
  moonLongitude
} from './astronomy';

const DEG = Math.PI / 180;

const MINUTE = 60000;
const HOUR = 3600000;
const DAY = 86400000;
const IST = 330 * MINUTE;

const sin = x =>
  Math.sin(x * DEG);

const cos = x =>
  Math.cos(x * DEG);

const norm = x =>
  ((x % 360) + 360) % 360;

const clamp = x =>
  Math.max(-1, Math.min(1, x));

function validDate(date) {
  return (
    date instanceof Date &&
    Number.isFinite(date.getTime())
  );
}

function validCoords(latitude, longitude) {

  if (
    latitude === null ||
    latitude === undefined ||
    latitude === '' ||
    longitude === null ||
    longitude === undefined ||
    longitude === ''
  ) {
    return false;
  }

  const lat = Number(latitude);
  const lon = Number(longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 66 &&
    Math.abs(lon) <= 180
  );
}

/*
 Validate a civil calendar date.
*/

export function dateParts(text) {

  if (
    typeof text !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(text)
  ) {
    throw new Error(
      'Invalid date format'
    );
  }

  const [y, m, d] =
    text.split('-').map(Number);

  const check = new Date(
    Date.UTC(y, m - 1, d)
  );

  if (
    y < 1900 ||
    y > 2100 ||
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  ) {
    throw new Error(
      'Invalid calendar date'
    );
  }

  return { y, m, d };
}

/*
 Add calendar days.
*/

export function addDays(text, days) {

  const { y, m, d } =
    dateParts(text);

  if (!Number.isInteger(days)) {
    throw new Error(
      'Invalid day offset'
    );
  }

  return new Date(
    Date.UTC(y, m - 1, d + days)
  ).toISOString().slice(0, 10);
}

/*
 Convert IST civil date/time to UTC.
*/

export function istDate(
  text,
  hour = 0,
  minute = 0
) {

  const { y, m, d } =
    dateParts(text);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error(
      'Invalid IST clock time'
    );
  }

  return new Date(
    Date.UTC(
      y,
      m - 1,
      d,
      hour,
      minute
    ) - IST
  );
}

/*
 Format UTC Date as IST.
*/

export function formatIST(
  date,
  withDate = false
) {

  if (!validDate(date)) {
    return 'उपलब्ध नहीं';
  }

  const t = new Date(
    date.getTime() + IST
  );

  const pad = n =>
    String(n).padStart(2, '0');

  const clock =
    pad(t.getUTCHours()) +
    ':' +
    pad(t.getUTCMinutes());

  if (!withDate) {
    return clock;
  }

  return (
    pad(t.getUTCDate()) +
    '-' +
    pad(t.getUTCMonth() + 1) +
    '-' +
    t.getUTCFullYear() +
    ' ' +
    clock +
    ' IST'
  );
}

/*
 Solar parameters:
 approximate declination and
 equation of time.
*/

function solarParameters(jd) {

  const T =
    (jd - 2451545) / 36525;

  const L = norm(
    280.46646 +
    T * (
      36000.76983 +
      0.0003032 * T
    )
  );

  const M = norm(
    357.52911 +
    T * (
      35999.05029 -
      0.0001537 * T
    )
  );

  const e =
    0.016708634 -
    T * (
      0.000042037 +
      0.0000001267 * T
    );

  const C =
    (
      1.914602 -
      T * (
        0.004817 +
        0.000014 * T
      )
    ) * sin(M) +
    (
      0.019993 -
      0.000101 * T
    ) * sin(2 * M) +
    0.000289 * sin(3 * M);

  const omega =
    125.04 -
    1934.136 * T;

  const lambda =
    L + C -
    0.00569 -
    0.00478 * sin(omega);

  const eps0 =
    23 +
    (
      26 +
      (
        21.448 -
        T * (
          46.815 +
          T * (
            0.00059 -
            T * 0.001813
          )
        )
      ) / 60
    ) / 60;

  const eps =
    eps0 +
    0.00256 * cos(omega);

  const decl =
    Math.asin(
      sin(eps) * sin(lambda)
    ) / DEG;

  const yy =
    Math.tan(
      eps * DEG / 2
    ) ** 2;

  const eq =
    4 / DEG * (
      yy * sin(2 * L) -
      2 * e * sin(M) +
      4 * e * yy *
        sin(M) *
        cos(2 * L) -
      0.5 * yy * yy *
        sin(4 * L) -
      1.25 * e * e *
        sin(2 * M)
    );

  return {
    decl,
    eq
  };
}

/*
 Approximate sunrise/sunset.

 Date is the Indian civil date.
 Returns a UTC Date or null.

 Uses conventional -0.833 degree
 apparent solar altitude.
*/

export function solarEvent(
  dateText,
  latitude,
  longitude,
  rise
) {

  const { y, m, d } =
    dateParts(dateText);

  if (!validCoords(
    latitude,
    longitude
  )) {
    return null;
  }

  const lat =
    Number(latitude);

  const lon =
    Number(longitude);

  const midnightUTC =
    Date.UTC(y, m - 1, d);

  let minutes =
    (rise ? 360 : 1080) -
    lon * 4;

  for (let i = 0; i < 8; i++) {

    const instant = new Date(
      midnightUTC +
      minutes * MINUTE
    );

    const jd =
      julianDay(instant);

    const { decl, eq } =
      solarParameters(jd);

    const denominator =
      cos(lat) * cos(decl);

    if (
      Math.abs(denominator) <
      1e-12
    ) {
      return null;
    }

    const h =
      (
        cos(90.833) -
        sin(lat) * sin(decl)
      ) / denominator;

    if (
      !Number.isFinite(h) ||
      h < -1 ||
      h > 1
    ) {
      return null;
    }

    const hourAngle =
      Math.acos(
        clamp(h)
      ) / DEG;

    const nextMinutes =
      720 -
      4 * lon -
      eq +
      (
        rise ? -4 : 4
      ) * hourAngle;

    if (
      Math.abs(
        nextMinutes - minutes
      ) < 0.00001
    ) {
      minutes =
        nextMinutes;

      break;
    }

    minutes =
      nextMinutes;
  }

  const result = new Date(
    midnightUTC +
    minutes * MINUTE
  );

  if (!validDate(result)) {
    return null;
  }

  /*
   Ensure event belongs to the
   requested IST calendar date.
  */

  const actualDate =
    new Date(
      result.getTime() + IST
    ).toISOString().slice(0, 10);

  return actualDate === dateText
    ? result
    : null;
}

/*
 Approximate lunar equatorial position.

 moonLongitude(jd) from astronomy.js
 returns TROPICAL longitude.

 Therefore it is suitable for
 equatorial conversion here.
*/

function moonEquatorial(date) {

  const jd =
    julianDay(date);

  const d =
    jd - 2451545;

  const longitude =
    moonLongitude(jd);

  const F = norm(
    93.272 +
    13.229350 * d
  );

  const M = norm(
    134.963 +
    13.064993 * d
  );

  const A = norm(
    297.850 +
    12.190749 * d
  );

  const latitude =
    5.128 * sin(F) +
    0.280 * sin(M + F) +
    0.277 * sin(M - F) +
    0.173 * sin(2 * A - F) +
    0.055 * sin(2 * A + F - M);

  const T =
    (jd - 2451545) / 36525;

  const obliquity =
    23.439291 -
    0.0130042 * T;

  const x =
    cos(latitude) *
    cos(longitude);

  const y =
    cos(latitude) *
      sin(longitude) *
      cos(obliquity) -
    sin(latitude) *
      sin(obliquity);

  const z =
    cos(latitude) *
      sin(longitude) *
      sin(obliquity) +
    sin(latitude) *
      cos(obliquity);

  const ra = norm(
    Math.atan2(y, x) / DEG
  );

  const dec =
    Math.asin(
      clamp(z)
    ) / DEG;

  return {
    ra,
    dec,
    jd
  };
}

/*
 Approximate geocentric Moon altitude.

 This does not implement a complete
 topocentric parallax/refraction model.
*/

function moonAltitude(
  date,
  latitude,
  longitude
) {

  const lat =
    Number(latitude);

  const lon =
    Number(longitude);

  const moon =
    moonEquatorial(date);

  const T =
    (moon.jd - 2451545) /
    36525;

  const gmst = norm(
    280.46061837 +
    360.98564736629 *
      (
        moon.jd -
        2451545
      ) +
    0.000387933 * T * T -
    T * T * T / 38710000
  );

  const hourAngle = norm(
    gmst +
    lon -
    moon.ra +
    180
  ) - 180;

  return Math.asin(
    clamp(
      sin(lat) *
        sin(moon.dec) +
      cos(lat) *
        cos(moon.dec) *
        cos(hourAngle)
    )
  ) / DEG;
}

/*
 Approximate lunar horizon threshold.

 This is retained for compatibility.
*/

function lunarHorizonValue(
  date,
  lat,
  lon
) {

  return (
    moonAltitude(
      date,
      lat,
      lon
    ) - 0.125
  );
}

/*
 Refine a Moon horizon crossing
 using bisection.
*/

function refineLunarCrossing(
  leftTime,
  rightTime,
  latitude,
  longitude
) {

  let lo = leftTime;
  let hi = rightTime;

  const initial =
    lunarHorizonValue(
      new Date(lo),
      latitude,
      longitude
    );

  for (
    let i = 0;
    i < 40;
    i++
  ) {

    const mid =
      Math.floor(
        (lo + hi) / 2
      );

    if (
      mid <= lo ||
      mid >= hi
    ) {
      break;
    }

    const value =
      lunarHorizonValue(
        new Date(mid),
        latitude,
        longitude
      );

    if (
      (initial <= 0 &&
       value <= 0) ||
      (initial > 0 &&
       value > 0)
    ) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return new Date(hi);
}

/*
 Find Moonrise and Moonset
 within the requested IST date.
*/

export function lunarEvents(
  dateText,
  latitude,
  longitude
) {

  dateParts(dateText);

  if (!validCoords(
    latitude,
    longitude
  )) {
    throw new Error(
      'Invalid lunar event coordinates'
    );
  }

  const lat =
    Number(latitude);

  const lon =
    Number(longitude);

  const start =
    istDate(dateText).getTime();

  const finish =
    start + DAY;

  const step =
    10 * MINUTE;

  let rise = null;
  let set = null;

  let previousTime =
    start;

  let previous =
    lunarHorizonValue(
      new Date(start),
      lat,
      lon
    );

  for (
    let currentTime =
      start + step;

    currentTime <= finish;

    currentTime += step
  ) {

    const current =
      lunarHorizonValue(
        new Date(currentTime),
        lat,
        lon
      );

    if (
      rise === null &&
      previous <= 0 &&
      current > 0
    ) {
      rise =
        refineLunarCrossing(
          previousTime,
          currentTime,
          lat,
          lon
        );
    }

    if (
      set === null &&
      previous >= 0 &&
      current < 0
    ) {
      set =
        refineLunarCrossing(
          previousTime,
          currentTime,
          lat,
          lon
        );
    }

    previousTime =
      currentTime;

    previous =
      current;
  }

  return {

    moonrise:
      rise
        ? rise.toISOString()
        : null,

    moonset:
      set
        ? set.toISOString()
        : null,

    moonriseText:
      rise
        ? formatIST(rise)
        : 'इस दिन नहीं',

    moonsetText:
      set
        ? formatIST(set)
        : 'इस दिन नहीं',

    moonriseStatus:
      rise
        ? 'calculated'
        : 'no_crossing_on_local_date',

    moonsetStatus:
      set
        ? 'calculated'
        : 'no_crossing_on_local_date',

    accuracy:
      'approximate'

  };
}

/*
 Find the next change in a
 Panchang numerical index.

 The search is performed from
 the supplied UTC instant.

 Returns a UTC Date or null.
*/

function nextChange(
  start,
  key,
  maxHours = 72
) {

  if (!validDate(start)) {
    return null;
  }

  const startMs =
    start.getTime();

  const original =
    calculateAstronomy(start)[key];

  const step =
    5 * MINUTE;

  const finish =
    startMs +
    maxHours * HOUR;

  let left =
    startMs;

  for (
    let right =
      startMs + step;

    right <= finish;

    right += step
  ) {

    const nextValue =
      calculateAstronomy(
        new Date(right)
      )[key];

    if (
      nextValue !== original
    ) {

      let lo = left;
      let hi = right;

      for (
        let i = 0;
        i < 40;
        i++
      ) {

        const mid =
          Math.floor(
            (lo + hi) / 2
          );

        if (
          mid <= lo ||
          mid >= hi
        ) {
          break;
        }

        const value =
          calculateAstronomy(
            new Date(mid)
          )[key];

        if (
          value === original
        ) {
          lo = mid;
        } else {
          hi = mid;
        }
      }

      return new Date(hi);
    }

    left =
      right;
  }

  return null;
}

/*
 Calculate the ending of:
 - Tithi
 - Nakshatra
 - Yoga
 - Karana
*/

function transitions(start) {

  const keys = {

    tithi:
      'tithiIndex',

    nakshatra:
      'nakshatraIndex',

    yoga:
      'yogaIndex',

    karana:
      'karanaIndex'

  };

  const display = {};
  const iso = {};
  const next = {};

  for (
    const [name, key]
    of Object.entries(keys)
  ) {

    const ending =
      nextChange(
        start,
        key
      );

    display[name] =
      formatIST(
        ending,
        true
      );

    iso[name] =
      ending
        ? ending.toISOString()
        : null;

    next[name] =
      ending
        ? calculateAstronomy(
            new Date(
              ending.getTime() +
              MINUTE
            )
          )[name]
        : null;
  }

  return {
    display,
    iso,
    next
  };
}

/*
 Main daily Panchang response.

 Existing API field names retained.
*/

export function getDailyDetails(
  dateText,
  utcDate,
  latitude,
  longitude
) {

  dateParts(dateText);

  if (!validCoords(
    latitude,
    longitude
  )) {
    throw new Error(
      'Invalid coordinates'
    );
  }

  const selectedDate =
    new Date(utcDate);

  if (!validDate(selectedDate)) {
    throw new Error(
      'Invalid selected time'
    );
  }

  const lat =
    Number(latitude);

  const lon =
    Number(longitude);

  const rise =
    solarEvent(
      dateText,
      lat,
      lon,
      true
    );

  const set =
    solarEvent(
      dateText,
      lat,
      lon,
      false
    );

  const nextRise =
    solarEvent(
      addDays(
        dateText,
        1
      ),
      lat,
      lon,
      true
    );

  const lunar =
    lunarEvents(
      dateText,
      lat,
      lon
    );

  /*
   Panchang transitions for the
   user-selected instant.
  */

  const selected =
    transitions(
      selectedDate
    );

  /*
   Panchang transitions at sunrise.
  */

  const atRise =
    rise
      ? transitions(rise)
      : null;

  return {

    sunrise:
      rise
        ? rise.toISOString()
        : null,

    sunset:
      set
        ? set.toISOString()
        : null,

    nextSunrise:
      nextRise
        ? nextRise.toISOString()
        : null,

    sunriseText:
      formatIST(rise),

    sunsetText:
      formatIST(set),

    nextSunriseText:
      formatIST(
        nextRise,
        true
      ),

    moonrise:
      lunar.moonrise,

    moonset:
      lunar.moonset,

    moonriseText:
      lunar.moonriseText,

    moonsetText:
      lunar.moonsetText,

    moonriseStatus:
      lunar.moonriseStatus,

    moonsetStatus:
      lunar.moonsetStatus,

    /*
     Selected-time Panchang.
    */

    transitions:
      selected.display,

    transitionISO:
      selected.iso,

    next:
      selected.next,

    /*
     Sunrise-based Panchang.
    */

    sunrisePanchang:
      rise
        ? calculateAstronomy(rise)
        : null,

    sunriseTransitions:
      atRise
        ? atRise.display
        : null,

    sunriseTransitionISO:
      atRise
        ? atRise.iso
        : null,

    sunriseNext:
      atRise
        ? atRise.next
        : null,

    /*
     Selected-time astronomy.
    */

    selectedPanchang:
      calculateAstronomy(
        selectedDate
      ),

    sunriseAvailable:
      !!rise,

    sunsetAvailable:
      !!set,

    timezone:
      'Asia/Kolkata',

    accuracy:
      'approximate',

    validationRequired:
      true

  };
}

/*
 Legacy candidate calendar.

 The dedicated vratEngine.js
 should be used for observance
 decisions.
*/

function candidates(a) {

  const events = [];

  function add(name, detail) {

    events.push({
      name,
      detail
    });
  }

  if (
    a.tithiNumber === 11
  ) {
    add(
      'एकादशी तिथि (संभावित)',
      a.paksha
    );
  }

  if (
    a.tithiNumber === 15
  ) {

    add(
      a.pakshaShort === 'शुक्ल'
        ? 'पूर्णिमा तिथि'
        : 'अमावस्या तिथि',
      a.paksha
    );
  }

  if (
    a.tithiNumber === 4
  ) {

    add(
      a.pakshaShort === 'शुक्ल'
        ? 'विनायक चतुर्थी तिथि'
        : 'संकष्टी चतुर्थी तिथि',
      a.paksha
    );
  }

  if (
    a.tithiNumber === 8
  ) {

    add(
      'अष्टमी तिथि',
      a.paksha
    );
  }

  if (
    a.tithiNumber === 13
  ) {

    add(
      'प्रदोष तिथि (संभावित)',
      'निर्णय सूर्यास्त से'
    );
  }

  return events;
}

/*
 Backward-compatible 30-day
 candidate calendar.

 This is not a validated
 festival decision engine.
*/

export function getThirtyDayCalendar(
  dateText,
  latitude = 25.3176,
  longitude = 82.9739
) {

  dateParts(dateText);

  if (!validCoords(
    latitude,
    longitude
  )) {
    throw new Error(
      'Invalid coordinates'
    );
  }

  const rows = [];

  for (
    let i = 0;
    i < 30;
    i++
  ) {

    const day =
      addDays(
        dateText,
        i
      );

    const rise =
      solarEvent(
        day,
        latitude,
        longitude,
        true
      );

    const instant =
      rise ||
      istDate(
        day,
        6
      );

    const a =
      calculateAstronomy(
        instant
      );

    const events =
      candidates(a);

    rows.push({

      date:
        day,

      tithi:
        a.tithi,

      paksha:
        a.paksha,

      nakshatra:
        a.nakshatra,

      events,

      festivals:
        events.map(
          event => event.name
        ),

      observanceStatus:
        'candidate',

      basis:
        rise
          ? 'sunrise'
          : 'fallback',

      accuracy:
        'approximate'

    });
  }

  return rows;
}
