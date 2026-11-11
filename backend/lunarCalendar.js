
/*
 * Nikhil Jyoti Panchang
 * backend/lunarCalendar.js
 *
 * Approximate Hindu lunar calendar.
 *
 * Calculates:
 * - Amanta lunar month
 * - Purnimanta lunar month
 * - Adhika month candidates
 * - Kshaya month candidates
 * - Vikram Samvat (approximate)
 * - Shaka Samvat (approximate)
 * - 60-year Samvatsara (provisional)
 *
 * Public API:
 * calculateLunarCalendar(dateText, utcDate)
 *
 * dateText: YYYY-MM-DD, Indian civil date
 * utcDate: JavaScript Date or ISO instant;
 *          preferably local sunrise.
 *
 * Astronomical inputs are UTC instants.
 *
 * This engine is NOT a validated
 * religious calendar or ephemeris.
 */

import {
  julianDay,
  sunLongitude,
  moonLongitude,
  ayanamsa
} from './astronomy';

const DAY = 86400000;
const HOUR = 3600000;
const MINUTE = 60000;
const IST = 330 * MINUTE;

const MONTHS = [
  'चैत्र',
  'वैशाख',
  'ज्येष्ठ',
  'आषाढ़',
  'श्रावण',
  'भाद्रपद',
  'आश्विन',
  'कार्तिक',
  'मार्गशीर्ष',
  'पौष',
  'माघ',
  'फाल्गुन'
];

const SIGNS = [
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

const SAMVATSARAS = [
  'प्रभव',
  'विभव',
  'शुक्ल',
  'प्रमोदूत',
  'प्रजोत्पत्ति',
  'अंगिरा',
  'श्रीमुख',
  'भाव',
  'युवा',
  'धाता',
  'ईश्वर',
  'बहुधान्य',
  'प्रमाथी',
  'विक्रम',
  'वृष',
  'चित्रभानु',
  'स्वभानु',
  'तारण',
  'पार्थिव',
  'व्यय',
  'सर्वजित',
  'सर्वधारी',
  'विरोधी',
  'विकृति',
  'खर',
  'नन्दन',
  'विजय',
  'जय',
  'मन्मथ',
  'दुर्मुख',
  'हेविलम्बी',
  'विलम्बी',
  'विकारी',
  'शार्वरी',
  'प्लव',
  'शुभकृत',
  'शोभकृत',
  'क्रोधी',
  'विश्वावसु',
  'पराभव',
  'प्लवंग',
  'कीलक',
  'सौम्य',
  'साधारण',
  'विरोधकृत',
  'परिधावी',
  'प्रमादी',
  'आनन्द',
  'राक्षस',
  'नल',
  'पिंगल',
  'कालयुक्त',
  'सिद्धार्थी',
  'रौद्र',
  'दुर्मति',
  'दुन्दुभि',
  'रुधिरोद्गारी',
  'रक्ताक्षी',
  'क्रोधन',
  'अक्षय'
];

const norm = value =>
  ((value % 360) + 360) % 360;

const signed = value =>
  norm(value + 180) - 180;

const mod = (value, base) =>
  ((value % base) + base) % base;

/*
 * Input validation.
 */

function validDateText(text) {

  if (
    typeof text !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(text)
  ) {
    throw new Error(
      'Date must be YYYY-MM-DD'
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
      'Invalid lunar calendar date'
    );
  }

  return { y, m, d };
}

function validTime(value) {

  const date = new Date(value);

  if (
    !Number.isFinite(date.getTime())
  ) {
    throw new Error(
      'Invalid astronomical instant'
    );
  }

  return date.getTime();
}

/*
 * Astronomical quantities.
 *
 * astronomy.js returns tropical
 * longitudes for Sun and Moon.
 */

function jdAt(ms) {
  return julianDay(new Date(ms));
}

function sunSidereal(ms) {

  const jd = jdAt(ms);

  return norm(
    sunLongitude(jd) -
    ayanamsa(jd)
  );
}

function elongation(ms) {

  const jd = jdAt(ms);

  return norm(
    moonLongitude(jd) -
    sunLongitude(jd)
  );
}

function phaseResidual(ms, target) {

  return signed(
    elongation(ms) - target
  );
}

/*
 * Refine a lunar phase crossing.
 *
 * The bracket must represent a
 * negative-to-positive crossing
 * of the signed phase residual.
 */

function refinePhase(
  left,
  right,
  target
) {

  let lo = left;
  let hi = right;

  for (
    let i = 0;
    i < 45;
    i++
  ) {

    if (hi - lo <= 1) {
      break;
    }

    const mid =
      Math.floor((lo + hi) / 2);

    const residual =
      phaseResidual(mid, target);

    if (residual < 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return hi;
}

/*
 * Find New Moon / Full Moon events.
 *
 * target = 0   : New Moon
 * target = 180 : Full Moon
 *
 * Search uses a 3-hour step.
 */

function phaseEvents(
  center,
  target,
  days = 90
) {

  const start =
    center - days * DAY;

  const finish =
    center + days * DAY;

  const step =
    3 * HOUR;

  const events = [];

  let previousTime = start;

  let previous =
    phaseResidual(
      start,
      target
    );

  for (
    let time = start + step;
    time <= finish;
    time += step
  ) {

    const current =
      phaseResidual(
        time,
        target
      );

    /*
     Reject the artificial jump
     at the opposite phase.
    */

    if (
      previous < 0 &&
      current >= 0 &&
      current - previous < 90
    ) {

      const event =
        refinePhase(
          previousTime,
          time,
          target
        );

      if (
        !events.length ||
        event -
          events[events.length - 1] >
          20 * DAY
      ) {
        events.push(event);
      }
    }

    previousTime = time;
    previous = current;
  }

  return events;
}

/*
 * Find a solar sign transition.
 */

function refineSankranti(
  left,
  right,
  oldSign
) {

  let lo = left;
  let hi = right;

  for (
    let i = 0;
    i < 45;
    i++
  ) {

    if (hi - lo <= 1) {
      break;
    }

    const mid =
      Math.floor((lo + hi) / 2);

    const sign =
      Math.floor(
        sunSidereal(mid) / 30
      );

    if (sign === oldSign) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return hi;
}

/*
 * Sankrantis inside a lunation.
 *
 * Interval:
 * [start, end)
 */

function sankrantisBetween(
  start,
  end
) {

  if (!(end > start)) {
    return [];
  }

  const events = [];

  const step =
    6 * HOUR;

  let previousTime = start;

  let previousSign =
    Math.floor(
      sunSidereal(start) / 30
    );

  while (previousTime < end) {

    const currentTime =
      Math.min(
        previousTime + step,
        end
      );

    const currentSign =
      Math.floor(
        sunSidereal(currentTime) / 30
      );

    if (
      currentSign !== previousSign
    ) {

      const crossing =
        refineSankranti(
          previousTime,
          currentTime,
          previousSign
        );

      if (
        crossing >= start &&
        crossing < end
      ) {

        const enteredSign =
          Math.floor(
            sunSidereal(
              crossing + MINUTE
            ) / 30
          );

        events.push({
          time: crossing,
          signIndex: enteredSign,
          signName:
            SIGNS[enteredSign],
          iso:
            new Date(
              crossing
            ).toISOString()
        });
      }
    }

    previousTime =
      currentTime;

    previousSign =
      currentSign;
  }

  return events;
}

/*
 * Month name convention.
 *
 * Meena Sankranti -> Chaitra
 * Mesha Sankranti -> Vaishakha
 */

function nameFromIngress(
  signIndex
) {

  return MONTHS[
    mod(signIndex + 1, 12)
  ];
}

/*
 * Describe an Amanta lunation.
 *
 * 0 Sankrantis: Adhika candidate
 * 1 Sankranti : Normal month
 * 2 Sankrantis: Kshaya candidate
 *
 * Exact religious naming and
 * regional exceptions remain
 * subject to validation.
 */

function describeLunation(
  start,
  end,
  nextEnd = null
) {

  const crossings =
    sankrantisBetween(
      start,
      end
    );

  /*
   Normal month.
  */

  if (
    crossings.length === 1
  ) {

    return {
      name:
        nameFromIngress(
          crossings[0].signIndex
        ),

      type: 'सामान्य',

      count: 1,

      crossings,

      skippedMonth: null,

      needsValidation: true
    };
  }

  /*
   Adhika month candidate.
  */

  if (
    crossings.length === 0
  ) {

    const nextCrossings =
      nextEnd !== null
        ? sankrantisBetween(
            end,
            nextEnd
          )
        : [];

    const nextIngress =
      nextCrossings.length
        ? nextCrossings[0]
        : null;

    return {
      name:
        nextIngress
          ? nameFromIngress(
              nextIngress.signIndex
            )
          : null,

      type: 'अधिक',

      count: 0,

      crossings,

      skippedMonth: null,

      needsValidation: true
    };
  }

  /*
   Possible Kshaya month.

   Two Sankrantis occur within
   the same lunation.

   Do not invent a definitive
   combined month name.
  */

  if (
    crossings.length >= 2
  ) {

    const first =
      crossings[0];

    const second =
      crossings[1];

    return {
      name: null,

      type:
        'क्षय-संभावना',

      count:
        crossings.length,

      crossings,

      firstIngressMonth:
        nameFromIngress(
          first.signIndex
        ),

      secondIngressMonth:
        nameFromIngress(
          second.signIndex
        ),

      skippedMonth:
        nameFromIngress(
          second.signIndex
        ),

      needsValidation: true
    };
  }

  return {
    name: null,
    type: 'अज्ञात',
    count: crossings.length,
    crossings,
    skippedMonth: null,
    needsValidation: true
  };
}

/*
 * Display lunar month.
 */

function formatMonth(info) {

  if (!info) {
    return 'सत्यापन शेष';
  }

  if (!info.name) {

    return info.type ===
      'क्षय-संभावना'
        ? 'क्षय मास (सत्यापन शेष)'
        : 'सत्यापन शेष';
  }

  if (info.type === 'अधिक') {

    return (
      'अधिक ' + info.name
    );
  }

  return info.name;
}

/*
 * Local Indian calendar year.
 */

function localYear(ms) {

  return new Date(
    ms + IST
  ).getUTCFullYear();
}

/*
 * Find approximate Chaitra
 * New Moon boundary.
 *
 * This is NOT necessarily the
 * civil New Year sunrise.
 */

function chaitraBoundary(year) {

  const center =
    Date.UTC(
      year,
      2,
      31,
      12
    );

  const moons =
    phaseEvents(
      center,
      0,
      100
    );

  const windowStart =
    Date.UTC(
      year,
      1,
      15
    );

  const windowEnd =
    Date.UTC(
      year,
      4,
      15
    );

  for (
    let i = 0;
    i + 2 < moons.length;
    i++
  ) {

    const start =
      moons[i];

    if (
      start < windowStart ||
      start >= windowEnd
    ) {
      continue;
    }

    const info =
      describeLunation(
        start,
        moons[i + 1],
        moons[i + 2]
      );

    if (
      info.name === 'चैत्र' &&
      info.type === 'सामान्य'
    ) {
      return start;
    }
  }

  return null;
}

/*
 * Approximate Chaitradi
 * year-number calculations.
 *
 * Important:
 * The New Moon instant is used
 * only as a provisional boundary.
 *
 * Final Chaitra Shukla Pratipada
 * requires location-specific
 * sunrise and tithi rules.
 */

function yearCalculations(ms) {

  const gregorianYear =
    localYear(ms);

  const boundary =
    chaitraBoundary(
      gregorianYear
    );

  if (boundary === null) {

    return {
      vikramSamvat: null,
      shakaSamvat: null,
      samvatsara: null,
      samvatsaraIndex: null,
      yearBoundary: null,
      yearStatus: 'unavailable',
      yearConvention:
        'चैत्रादि; गणना उपलब्ध नहीं'
    };
  }

  const activeYear =
    ms >= boundary
      ? gregorianYear
      : gregorianYear - 1;

  /*
   Conventional approximate
   year-number offsets.
  */

  const vikramSamvat =
    activeYear + 57;

  const shakaSamvat =
    activeYear - 78;

  /*
   Legacy Samvatsara anchor.

   Retained for compatibility.
   This cycle anchor is not
   independently validated.
  */

  const index =
    mod(
      activeYear - 1987,
      60
    );

  return {
    vikramSamvat,
    shakaSamvat,

    samvatsara:
      SAMVATSARAS[index],

    samvatsaraIndex:
      index + 1,

    yearBoundary:
      new Date(
        boundary
      ).toISOString(),

    yearStatus:
      'approximate',

    yearConvention:
      'चैत्रादि चंद्र वर्ष; अमावस्या-आधारित अनुमान, सूर्योदय नियम शेष'
  };
}

/*
 * Main public function.
 *
 * Keep this signature unchanged
 * for panchang.web.js.
 */

export function calculateLunarCalendar(
  dateText,
  utcDate
) {

  validDateText(dateText);

  const ms =
    validTime(utcDate);

  /*
   Find New Moons around the
   selected instant.
  */

  const moons =
    phaseEvents(
      ms,
      0,
      90
    );

  const index =
    moons.findIndex(
      (time, i) =>
        i < moons.length - 1 &&
        time <= ms &&
        ms < moons[i + 1]
    );

  if (
    index < 0 ||
    index + 2 >= moons.length
  ) {
    throw new Error(
      'Lunar boundaries unavailable'
    );
  }

  const previousNewMoon =
    moons[index];

  const nextNewMoon =
    moons[index + 1];

  const followingNewMoon =
    moons[index + 2];

  const fourthNewMoon =
    index + 3 < moons.length
      ? moons[index + 3]
      : null;

  /*
   Current Amanta month.
  */

  const current =
    describeLunation(
      previousNewMoon,
      nextNewMoon,
      followingNewMoon
    );

  /*
   Following Amanta month.
  */

  const following =
    describeLunation(
      nextNewMoon,
      followingNewMoon,
      fourthNewMoon
    );

  /*
   Determine waxing/waning
   from lunar elongation.
  */

  const phase =
    elongation(ms);

  const waxing =
    phase < 180;

  /*
   Purnimanta month naming.

   Shukla Paksha:
   current Amanta month.

   Krishna Paksha:
   following Amanta month.

   Special Adhika/Kshaya cases
   remain provisional.
  */

  const purnimanta =
    waxing
      ? current
      : following;

  /*
   Find nearby Full Moon.
  */

  const fullMoons =
    phaseEvents(
      ms,
      180,
      40
    );

  const nearestFull =
    fullMoons.reduce(
      (best, time) => {

        if (best === null) {
          return time;
        }

        return (
          Math.abs(time - ms) <
          Math.abs(best - ms)
        )
          ? time
          : best;
      },
      null
    );

  /*
   Approximate year numbers.
  */

  const years =
    yearCalculations(ms);

  /*
   Return original field names
   plus useful diagnostics.
  */

  return {

    date:
      dateText,

    /*
     Lunar month names.
    */

    amantaMonth:
      formatMonth(current),

    purnimantaMonth:
      formatMonth(purnimanta),

    lunarMonth:
      current.name,

    monthType:
      current.type,

    purnimantaMonthType:
      purnimanta.type,

    nextMonthType:
      following.type,

    /*
     Adhika and Kshaya.
    */

    isAdhikaMonth:
      current.type === 'अधिक',

    possibleKshayaMonth:
      current.type ===
        'क्षय-संभावना' ||
      following.type ===
        'क्षय-संभावना',

    skippedMonth:
      current.skippedMonth ||
      following.skippedMonth ||
      null,

    /*
     Sankranti details.
    */

    sankrantiCount:
      current.count,

    sankrantis:
      current.crossings,

    /*
     Lunar boundaries.
    */

    amantaMonthStart:
      new Date(
        previousNewMoon
      ).toISOString(),

    amantaMonthEnd:
      new Date(
        nextNewMoon
      ).toISOString(),

    nextAmavasya:
      new Date(
        nextNewMoon
      ).toISOString(),

    nearestPurnima:
      nearestFull === null
        ? null
        : new Date(
            nearestFull
          ).toISOString(),

    /*
     Year numbers.
    */

    vikramSamvat:
      years.vikramSamvat,

    shakaSamvat:
      years.shakaSamvat,

    /*
     Gujarati Samvat is calculated
     separately by
     gujaratiCalendar.js.
    */

    gujaratiSamvat:
      null,

    /*
     60-year cycle.
    */

    samvatsara:
      years.samvatsara,

    brihaspatiSamvatsara:
      years.samvatsara,

    samvatsaraIndex:
      years.samvatsaraIndex,

    samvatYearStart:
      years.yearBoundary,

    yearStatus:
      years.yearStatus,

    yearConvention:
      years.yearConvention,

    /*
     Additional diagnostics.
    */

    lunarPhase:
      Number(
        phase.toFixed(6)
      ),

    paksha:
      waxing
        ? 'शुक्ल'
        : 'कृष्ण',

    monthRule:
      'निरयन सूर्य-संक्रांति एवं अमावस्या',

    ayanamsaModel:
      'legacy-linear-approximation',

    timezone:
      'Asia/Kolkata',

    accuracy:
      'approximate',

    validationRequired:
      true,

    calculationStatus:
      'PRELIMINARY_NOT_FOR_FINAL_FESTIVAL_DECISIONS'

  };
}
