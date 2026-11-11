
/*
 Nikhil Jyoti Panchang
 backend/muhurtaEngine.js

 Day and Night Choghadiya
 24 Planetary Horas
 Local Sunrise/Sunset Based Calculations

 Timezone: Asia/Kolkata (IST)

 IMPORTANT:
 Solar events are approximate.
 Traditional rules can vary by region.
*/

import {
  solarEvent,
  addDays,
  formatIST
} from './dailyPanchang';

/*
 Weekday index:
 Sunday = 0
 Monday = 1
 Tuesday = 2
 Wednesday = 3
 Thursday = 4
 Friday = 5
 Saturday = 6
*/

const WEEKDAY_NAMES = [
  'रविवार',
  'सोमवार',
  'मंगलवार',
  'बुधवार',
  'गुरुवार',
  'शुक्रवार',
  'शनिवार'
];

/*
 Day Choghadiya sequences.

 Each day has eight segments.
*/

const DAY_SEQUENCES = [

  // Sunday
  [
    'उद्वेग',
    'चर',
    'लाभ',
    'अमृत',
    'काल',
    'शुभ',
    'रोग',
    'उद्वेग'
  ],

  // Monday
  [
    'अमृत',
    'काल',
    'शुभ',
    'रोग',
    'उद्वेग',
    'चर',
    'लाभ',
    'अमृत'
  ],

  // Tuesday
  [
    'रोग',
    'उद्वेग',
    'चर',
    'लाभ',
    'अमृत',
    'काल',
    'शुभ',
    'रोग'
  ],

  // Wednesday
  [
    'लाभ',
    'अमृत',
    'काल',
    'शुभ',
    'रोग',
    'उद्वेग',
    'चर',
    'लाभ'
  ],

  // Thursday
  [
    'शुभ',
    'रोग',
    'उद्वेग',
    'चर',
    'लाभ',
    'अमृत',
    'काल',
    'शुभ'
  ],

  // Friday
  [
    'चर',
    'लाभ',
    'अमृत',
    'काल',
    'शुभ',
    'रोग',
    'उद्वेग',
    'चर'
  ],

  // Saturday
  [
    'काल',
    'शुभ',
    'रोग',
    'उद्वेग',
    'चर',
    'लाभ',
    'अमृत',
    'काल'
  ]

];

/*
 Night Choghadiya sequences.
*/

const NIGHT_SEQUENCES = [

  // Sunday night
  [
    'शुभ',
    'अमृत',
    'चर',
    'रोग',
    'काल',
    'लाभ',
    'उद्वेग',
    'शुभ'
  ],

  // Monday night
  [
    'चर',
    'रोग',
    'काल',
    'लाभ',
    'उद्वेग',
    'शुभ',
    'अमृत',
    'चर'
  ],

  // Tuesday night
  [
    'काल',
    'लाभ',
    'उद्वेग',
    'शुभ',
    'अमृत',
    'चर',
    'रोग',
    'काल'
  ],

  // Wednesday night
  [
    'रोग',
    'काल',
    'लाभ',
    'उद्वेग',
    'शुभ',
    'अमृत',
    'चर',
    'रोग'
  ],

  // Thursday night
  [
    'अमृत',
    'चर',
    'रोग',
    'काल',
    'लाभ',
    'उद्वेग',
    'शुभ',
    'अमृत'
  ],

  // Friday night
  [
    'लाभ',
    'उद्वेग',
    'शुभ',
    'अमृत',
    'चर',
    'रोग',
    'काल',
    'लाभ'
  ],

  // Saturday night
  [
    'उद्वेग',
    'शुभ',
    'अमृत',
    'चर',
    'रोग',
    'काल',
    'लाभ',
    'उद्वेग'
  ]

];

/*
 Choghadiya quality classification.
*/

const QUALITY = {

  'अमृत': 'अत्यंत शुभ',

  'शुभ': 'शुभ',

  'लाभ': 'शुभ',

  'चर': 'सामान्य',

  'उद्वेग': 'अशुभ',

  'काल': 'अशुभ',

  'रोग': 'अशुभ'

};

/*
 Traditional Chaldean planetary order.
*/

const HORA_ORDER = [
  'शनि',
  'गुरु',
  'मंगल',
  'सूर्य',
  'शुक्र',
  'बुध',
  'चंद्र'
];

/*
 Weekday planetary lords.
*/

const WEEKDAY_LORD = [
  'सूर्य',
  'चंद्र',
  'मंगल',
  'बुध',
  'गुरु',
  'शुक्र',
  'शनि'
];

/*
 Validate YYYY-MM-DD calendar date.
*/

function weekdayIST(dateText) {

  if (
    typeof dateText !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateText)
  ) {
    throw new Error(
      'Date must be YYYY-MM-DD'
    );
  }

  const [y, m, d] =
    dateText.split('-').map(Number);

  const check = new Date(
    Date.UTC(y, m - 1, d)
  );

  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  ) {
    throw new Error(
      'Invalid Muhurta calendar date'
    );
  }

  return check.getUTCDay();
}

/*
 Validate JavaScript Date.
*/

function isValidDate(value) {

  return (
    value instanceof Date &&
    Number.isFinite(value.getTime())
  );
}

/*
 Format start and end times.

 ISO timestamps are retained for
 future API integrations.

 Human-readable text is IST.
*/

function timeInfo(startMs, endMs) {

  const start = new Date(startMs);
  const end = new Date(endMs);

  if (
    !isValidDate(start) ||
    !isValidDate(end) ||
    end <= start
  ) {
    throw new Error(
      'Invalid Muhurta time interval'
    );
  }

  const startText =
    formatIST(start);

  const endText =
    formatIST(end);

  return {

    start:
      start.toISOString(),

    end:
      end.toISOString(),

    startText,

    endText,

    text:
      startText +
      ' – ' +
      endText

  };
}

/*
 Generate equal time segments.

 Shared boundaries prevent small
 gaps or overlaps caused by
 independently rounded durations.
*/

function makeBoundaries(
  start,
  end,
  count
) {

  const startMs =
    start.getTime();

  const endMs =
    end.getTime();

  const length =
    endMs - startMs;

  if (
    !Number.isInteger(count) ||
    count <= 0 ||
    length <= 0
  ) {
    throw new Error(
      'Invalid Muhurta division'
    );
  }

  const boundaries = [];

  for (
    let i = 0;
    i <= count;
    i++
  ) {

    boundaries.push(
      Math.round(
        startMs +
        length * i / count
      )
    );

  }

  /*
   Preserve exact endpoints.
  */

  boundaries[0] =
    startMs;

  boundaries[count] =
    endMs;

  return boundaries;
}

/*
 Choghadiya segments.

 Day:
 sunrise to sunset / 8

 Night:
 sunset to next sunrise / 8
*/

function choghadiyaSegments(
  start,
  end,
  names,
  period
) {

  if (
    !Array.isArray(names) ||
    names.length !== 8
  ) {
    throw new Error(
      'Invalid Choghadiya sequence'
    );
  }

  const boundaries =
    makeBoundaries(
      start,
      end,
      8
    );

  return names.map(
    (name, index) => {

      const startMs =
        boundaries[index];

      const endMs =
        boundaries[index + 1];

      return {

        number:
          index + 1,

        name,

        quality:
          QUALITY[name] ||
          'उपलब्ध नहीं',

        period,

        ...timeInfo(
          startMs,
          endMs
        )

      };

    }
  );
}

/*
 Planetary Hora calculation.

 The weekday lord rules the
 first Hora after sunrise.

 Remaining Horas follow the
 Chaldean planetary order.

 Day:
 12 unequal seasonal Horas,
 each equal to daylight / 12.

 Night:
 12 unequal seasonal Horas,
 each equal to night / 12.
*/

function horaSegments(
  sunrise,
  sunset,
  nextSunrise,
  weekday
) {

  const lord =
    WEEKDAY_LORD[weekday];

  const firstIndex =
    HORA_ORDER.indexOf(lord);

  if (firstIndex < 0) {
    throw new Error(
      'Weekday Hora lord unavailable'
    );
  }

  const dayBoundaries =
    makeBoundaries(
      sunrise,
      sunset,
      12
    );

  const nightBoundaries =
    makeBoundaries(
      sunset,
      nextSunrise,
      12
    );

  const horas = [];

  for (
    let i = 0;
    i < 24;
    i++
  ) {

    const isDay =
      i < 12;

    const localIndex =
      isDay
        ? i
        : i - 12;

    const boundaries =
      isDay
        ? dayBoundaries
        : nightBoundaries;

    const startMs =
      boundaries[localIndex];

    const endMs =
      boundaries[localIndex + 1];

    const planet =
      HORA_ORDER[
        (firstIndex + i) % 7
      ];

    horas.push({

      number:
        i + 1,

      planet,

      period:
        isDay
          ? 'दिन'
          : 'रात्रि',

      ...timeInfo(
        startMs,
        endMs
      )

    });

  }

  return horas;
}

/*
 Main Muhurta Engine.

 Export name and arguments
 remain unchanged.

 Compatible with:
 panchang.web.js
 Panchang HTML Embed
*/

export function calculateMuhurtaEngine(
  dateText,
  latitude,
  longitude
) {

  /*
   Step 1:
   Validate calendar date.
  */

  const weekday =
    weekdayIST(dateText);

  /*
   Step 2:
   Validate coordinates.
  */

  if (
    latitude === null ||
    latitude === undefined ||
    latitude === '' ||
    longitude === null ||
    longitude === undefined ||
    longitude === ''
  ) {
    throw new Error(
      'Muhurta coordinates required'
    );
  }

  const lat =
    Number(latitude);

  const lon =
    Number(longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 66 ||
    Math.abs(lon) > 180
  ) {
    throw new Error(
      'Invalid Muhurta coordinates'
    );
  }

  /*
   Step 3:
   Calculate local solar events.
  */

  const sunrise = solarEvent(
    dateText,
    lat,
    lon,
    true
  );

  const sunset = solarEvent(
    dateText,
    lat,
    lon,
    false
  );

  const nextDate =
    addDays(
      dateText,
      1
    );

  const nextSunrise = solarEvent(
    nextDate,
    lat,
    lon,
    true
  );

  /*
   Step 4:
   Validate solar events.
  */

  if (
    !isValidDate(sunrise) ||
    !isValidDate(sunset) ||
    !isValidDate(nextSunrise) ||
    sunrise >= sunset ||
    sunset >= nextSunrise
  ) {
    throw new Error(
      'Sunrise/sunset data unavailable'
    );
  }

  /*
   Step 5:
   Generate day Choghadiya.
  */

  const dayChoghadiya =
    choghadiyaSegments(
      sunrise,
      sunset,
      DAY_SEQUENCES[weekday],
      'दिन'
    );

  /*
   Step 6:
   Generate night Choghadiya.
  */

  const nightChoghadiya =
    choghadiyaSegments(
      sunset,
      nextSunrise,
      NIGHT_SEQUENCES[weekday],
      'रात्रि'
    );

  /*
   Step 7:
   Generate 24 planetary Horas.
  */

  const horas =
    horaSegments(
      sunrise,
      sunset,
      nextSunrise,
      weekday
    );

  /*
   Step 8:
   Return complete result.
  */

  return {

    date:
      dateText,

    weekday,

    weekdayName:
      WEEKDAY_NAMES[weekday],

    weekdayLord:
      WEEKDAY_LORD[weekday],

    /*
     Solar events in UTC ISO.
    */

    sunrise:
      sunrise.toISOString(),

    sunset:
      sunset.toISOString(),

    nextSunrise:
      nextSunrise.toISOString(),

    /*
     Human-readable IST times.
    */

    sunriseText:
      formatIST(sunrise),

    sunsetText:
      formatIST(sunset),

    nextSunriseText:
      formatIST(nextSunrise),

    /*
     Choghadiya.
    */

    dayChoghadiya,

    nightChoghadiya,

    /*
     Planetary Hora.
    */

    dayHora:
      horas.slice(0, 12),

    nightHora:
      horas.slice(12),

    horas,

    /*
     Counts.
    */

    totalChoghadiya:
      16,

    totalHoras:
      24,

    /*
     Calculation information.
    */

    calculationRule:
      'दिन और रात्रि को चौघड़िया हेतु 8 तथा होरा हेतु 12 समान भागों में विभाजित किया गया है',

    timezone:
      'Asia/Kolkata',

    accuracy:
      'approximate-solar-times',

    validationRequired:
      true

  };

}
