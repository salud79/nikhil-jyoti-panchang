
/*
 * Nikhil Jyoti Panchang
 * backend/gujaratiCalendar.js
 *
 * Approximate Gujarati Kartikadi Samvat.
 *
 * Main purpose:
 * - Find Kartika Amavasya candidate
 * - Find subsequent local sunrise
 * - Check Shukla Pratipada at sunrise
 * - Estimate Gujarati Samvat year
 *
 * Compatible with:
 * astronomy.js
 * dailyPanchang.js
 * panchang.web.js
 *
 * IMPORTANT:
 * This is an approximate screening engine.
 * It is NOT a validated religious
 * calendar or authoritative festival
 * decision system.
 *
 * Gujarati New Year rules may involve
 * regional sunrise and tithi priority
 * conventions not fully implemented here.
 */

import {
  julianDay,
  sunLongitude,
  moonLongitude,
  ayanamsa,
  calculateAstronomy
} from './astronomy';

import {
  solarEvent,
  addDays,
  dateParts
} from './dailyPanchang';

const HOUR = 3600000;
const MINUTE = 60000;
const IST = 330 * MINUTE;

const norm = x =>
  ((x % 360) + 360) % 360;

const signed = x =>
  norm(x + 180) - 180;

/*
 * Validate geographic coordinates.
 */

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
 * Validate UTC instant.
 */

function validInstant(value) {

  const date = new Date(value);

  if (
    !Number.isFinite(date.getTime())
  ) {
    throw new Error(
      'Invalid Gujarati calendar instant'
    );
  }

  return date;
}

/*
 * Tropical Sun-Moon elongation.
 *
 * Both functions in astronomy.js
 * return tropical longitudes.
 */

function phase(ms) {

  const jd = julianDay(
    new Date(ms)
  );

  return norm(
    moonLongitude(jd) -
    sunLongitude(jd)
  );
}

/*
 * Signed residual around New Moon.
 */

function residual(ms) {
  return signed(
    phase(ms)
  );
}

/*
 * Refine New Moon crossing
 * by bisection.
 */

function refineNewMoon(left, right) {

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
      Math.floor(
        (lo + hi) / 2
      );

    if (mid <= lo || mid >= hi) {
      break;
    }

    if (residual(mid) < 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return hi;
}

/*
 * Approximate sidereal solar sign.
 *
 * 0 = Mesha
 * 6 = Tula
 */

function siderealSolarSign(ms) {

  const jd = julianDay(
    new Date(ms)
  );

  const longitude = norm(
    sunLongitude(jd) -
    ayanamsa(jd)
  );

  return Math.floor(
    longitude / 30
  );
}

/*
 * Find New Moon candidates
 * around October-November.
 *
 * Expanded search window helps
 * avoid missing boundary events.
 */

function newMoons(year) {

  const start =
    Date.UTC(year, 8, 20);

  const end =
    Date.UTC(year, 11, 15);

  const step =
    3 * HOUR;

  const found = [];

  let left = start;
  let previous =
    residual(left);

  for (
    let right = left + step;
    right <= end;
    right += step
  ) {

    const current =
      residual(right);

    /*
     Accept the true crossing
     around zero elongation.

     Reject the artificial
     signed-angle jump near
     180 degrees.
    */

    if (
      previous < 0 &&
      current >= 0 &&
      current - previous < 90
    ) {

      const event =
        refineNewMoon(
          left,
          right
        );

      if (
        !found.length ||
        event -
          found[found.length - 1] >
          20 * 86400000
      ) {
        found.push(event);
      }
    }

    left = right;
    previous = current;
  }

  return found;
}

/*
 * Convert UTC milliseconds
 * to Indian civil date.
 */

function istDateText(ms) {

  return new Date(
    ms + IST
  ).toISOString().slice(0, 10);
}

/*
 * Find first local sunrise
 * strictly after an instant.
 */

function nextSunriseAfter(
  ms,
  latitude,
  longitude
) {

  let day =
    istDateText(ms);

  for (
    let i = 0;
    i < 5;
    i++
  ) {

    const rise =
      solarEvent(
        day,
        latitude,
        longitude,
        true
      );

    if (
      rise &&
      rise.getTime() > ms
    ) {
      return rise;
    }

    day = addDays(
      day,
      1
    );
  }

  return null;
}

/*
 * Check Tithi at a given
 * UTC instant.
 */

function tithiAt(date) {

  const a =
    calculateAstronomy(date);

  return {
    tithiNumber:
      a.tithiNumber,

    paksha:
      a.pakshaShort,

    tithi:
      a.tithi,

    label:
      a.tithiLabel
  };
}

/*
 * Identify a Shukla
 * Pratipada sunrise.
 */

function isShuklaPratipada(date) {

  if (!date) {
    return false;
  }

  const t =
    tithiAt(date);

  return (
    t.tithiNumber === 1 &&
    t.paksha === 'शुक्ल'
  );
}

/*
 * Inspect local sunrise
 * after the New Moon.
 *
 * A normal candidate is the
 * first sunrise after Amavasya.
 *
 * If Shukla Pratipada is not
 * present at that sunrise,
 * return an unresolved candidate
 * instead of inventing a date.
 */

function inspectNewYearSunrise(
  newMoonMs,
  latitude,
  longitude
) {

  const sunrise =
    nextSunriseAfter(
      newMoonMs,
      latitude,
      longitude
    );

  if (!sunrise) {
    return null;
  }

  const firstTithi =
    tithiAt(sunrise);

  const matches =
    isShuklaPratipada(
      sunrise
    );

  return {
    sunrise,

    date:
      istDateText(
        sunrise.getTime()
      ),

    sunriseTithi:
      firstTithi.label,

    pratipadaAtSunrise:
      matches,

    status:
      matches
        ? 'PRATIPADA_AT_SUNRISE_CANDIDATE'
        : 'UNRESOLVED_SUNRISE_TITHI'
  };
}

/*
 * Find approximate Kartikadi
 * New Year boundary.
 *
 * Screening conditions:
 * 1. New Moon in seasonal window
 * 2. Sidereal Sun in Tula
 * 3. Next local sunrise
 * 4. Check Shukla Pratipada
 *
 * Condition 4 is a screening
 * condition, not the complete
 * religious decision rule.
 */

function newYearBoundary(
  year,
  latitude,
  longitude
) {

  const candidates =
    newMoons(year);

  const matching =
    candidates.filter(
      ms =>
        siderealSolarSign(ms) === 6
    );

  if (!matching.length) {
    return null;
  }

  /*
   Prefer a candidate in the
   expected seasonal window.

   Do not silently select a
   non-Tula lunation.
  */

  const moon =
    matching[0];

  const inspected =
    inspectNewYearSunrise(
      moon,
      latitude,
      longitude
    );

  if (!inspected) {
    return null;
  }

  return {

    newMoon:
      new Date(
        moon
      ).toISOString(),

    boundary:
      inspected.sunrise.toISOString(),

    date:
      inspected.date,

    sunriseTithi:
      inspected.sunriseTithi,

    pratipadaAtSunrise:
      inspected.pratipadaAtSunrise,

    status:
      inspected.status
  };
}

/*
 * Main public API.
 *
 * Signature retained:
 *
 * calculateGujaratiCalendar(
 *   dateText,
 *   utcDate,
 *   latitude,
 *   longitude
 * )
 */

export function calculateGujaratiCalendar(
  dateText,
  utcDate,
  latitude,
  longitude
) {

  /*
   Validate input date.
  */

  dateParts(dateText);

  const instant =
    validInstant(
      utcDate
    );

  if (
    !validCoords(
      latitude,
      longitude
    )
  ) {
    throw new Error(
      'Invalid Gujarati calendar coordinates'
    );
  }

  const lat =
    Number(latitude);

  const lon =
    Number(longitude);

  const ms =
    instant.getTime();

  const year =
    new Date(
      ms + IST
    ).getUTCFullYear();

  /*
   Calculate current and
   previous Kartikadi
   candidate boundaries.
  */

  const currentBoundary =
    newYearBoundary(
      year,
      lat,
      lon
    );

  const previousBoundary =
    newYearBoundary(
      year - 1,
      lat,
      lon
    );

  let activeYear = null;
  let activeBoundary = null;

  /*
   Only activate a boundary
   if Pratipada is found at
   the candidate sunrise.

   Otherwise avoid presenting
   an uncertain Samvat number.
  */

  if (
    currentBoundary &&
    currentBoundary.pratipadaAtSunrise &&
    ms >= Date.parse(
      currentBoundary.boundary
    )
  ) {

    activeYear =
      year;

    activeBoundary =
      currentBoundary;

  } else if (
    previousBoundary &&
    previousBoundary.pratipadaAtSunrise &&
    ms >= Date.parse(
      previousBoundary.boundary
    )
  ) {

    activeYear =
      year - 1;

    activeBoundary =
      previousBoundary;
  }

  /*
   Approximate Gujarati Samvat
   year-number convention.

   The year starting in
   Gregorian year Y is
   provisionally Y + 57.
  */

  const gujaratiSamvat =
    activeYear === null
      ? null
      : activeYear + 57;

  return {

    gujaratiSamvat,

    gujaratiNewYearDate:
      activeBoundary
        ? activeBoundary.date
        : null,

    gujaratiNewYearBoundary:
      activeBoundary
        ? activeBoundary.boundary
        : null,

    precedingAmavasya:
      activeBoundary
        ? activeBoundary.newMoon
        : null,

    /*
     Diagnostics for the
     current Gregorian year.
    */

    candidateNewYearDate:
      currentBoundary
        ? currentBoundary.date
        : null,

    candidateSunriseTithi:
      currentBoundary
        ? currentBoundary.sunriseTithi
        : null,

    candidateStatus:
      currentBoundary
        ? currentBoundary.status
        : 'NO_CANDIDATE_FOUND',

    /*
     Calendar metadata.
    */

    calendarType:
      'कार्तिकादि',

    calculationRule:
      'तुला राशि में अमावस्या के बाद स्थानीय सूर्योदय पर शुक्ल प्रतिपदा की प्रारंभिक जाँच',

    yearStatus:
      activeBoundary
        ? 'approximate'
        : 'unavailable_or_unresolved',

    timezone:
      'Asia/Kolkata',

    accuracy:
      'approximate',

    validationRequired:
      true,

    calculationStatus:
      'PRELIMINARY_NOT_FOR_FINAL_NEW_YEAR_DECISIONS'
  };
}
