import { getSwissGrahaPositions, getSwissRiseSet, getSwissSunrisePanchang } from './swissPanchang';

/*
 Nikhil Jyoti Panchang
 backend/panchang.web.js

 Main Panchang API for Wix Velo.

 Integrated engines:
 1. astronomy.js
 2. dailyPanchang.js
 3. grahaEngine.js
 4. vedicCalendar.js
 5. lunarCalendar.js
 6. muhurtaEngine.js
 7. gujaratiCalendar.js
 8. vratEngine.js

 Diagnostics:
 astronomyValidation.js

 Features:
 - Strict input validation
 - IST date/time conversion
 - Sunrise-based Hindu calendar
 - Planetary positions
 - Vedic calendar and Muhurta
 - Amanta/Purnimanta lunar months
 - Gujarati calendar
 - Vrat and festival candidates
 - Independent engine error handling
 - Partial-result reporting
 - Backward-compatible HTML response

 IMPORTANT:
 Astronomical calculations are approximate.
 Religious festival dates require validation.
*/

import {
  webMethod,
  Permissions
} from 'wix-web-module';

import {
  calculateAstronomy
} from './astronomy';

import {
  getDailyDetails
} from './dailyPanchang';

import {
  calculateGrahas
} from './grahaEngine';

import {
  calculateVedicCalendar
} from './vedicCalendar';

import {
  calculateLunarCalendar
} from './lunarCalendar';

import {
  calculateMuhurtaEngine
} from './muhurtaEngine';

import {
  calculateGujaratiCalendar
} from './gujaratiCalendar';

import {
  calculateVratCalendar, refineVratTimes
} from './vratEngine';

import {
  validateAstronomy
} from './astronomyValidation';

/*
 Constants
*/

const IST_OFFSET = 330 * 60000;

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

const VRAT_DAYS = 30;

/*
 Validate user request.
*/

function validateRequest(input) {

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error(
      'Invalid Panchang request'
    );
  }

  /*
   Date and time.
  */

  const date = input.date;

  const time =
    input.time == null ||
    input.time === ''
      ? '12:00'
      : input.time;

  const city = String(
    input.city || 'वाराणसी'
  ).trim().slice(0, 100);

  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    throw new Error(
      'Date must be YYYY-MM-DD'
    );
  }

  if (
    typeof time !== 'string' ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ) {
    throw new Error(
      'Time must be HH:MM'
    );
  }

  /*
   Validate actual calendar date.
  */

  const [y, m, d] =
    date.split('-').map(Number);

  const [h, minute] =
    time.split(':').map(Number);

  const check = new Date(
    Date.UTC(y, m - 1, d)
  );

  if (
    y < MIN_YEAR ||
    y > MAX_YEAR ||
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  ) {
    throw new Error(
      'Invalid calendar date'
    );
  }

  /*
   Validate coordinates.
  */

  if (
    input.latitude == null ||
    input.longitude == null ||
    input.latitude === '' ||
    input.longitude === ''
  ) {
    throw new Error(
      'Coordinates required'
    );
  }

  const latitude =
    Number(input.latitude);

  const longitude =
    Number(input.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 66 ||
    Math.abs(longitude) > 180
  ) {
    throw new Error(
      'Invalid coordinates'
    );
  }

  /*
   Convert selected Indian Standard
   Time to UTC.

   This API uses Asia/Kolkata
   for all supplied locations.
  */

  const utc = new Date(
    Date.UTC(
      y,
      m - 1,
      d,
      h,
      minute
    ) - IST_OFFSET
  );

  if (
    !Number.isFinite(utc.getTime())
  ) {
    throw new Error(
      'Invalid calculation instant'
    );
  }

  return {
    date,
    time,
    city,
    latitude,
    longitude,
    utc
  };
}

/*
 Execute independent engines safely.

 A failure in one optional engine
 should not prevent other results
 from being returned.
*/

function runEngine(
  engineName,
  callback,
  errors
) {

  try {

    return callback();

  } catch (error) {

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      'Panchang engine failed:',
      engineName,
      message
    );

    errors.push({
      engine: engineName,
      message
    });

    return null;
  }
}

/*
 Check valid JavaScript Date.
*/

function validDate(value) {

  return (
    value instanceof Date &&
    Number.isFinite(value.getTime())
  );
}

/*
 Safely read sunrise.

 dailyPanchang.js is expected
 to return an ISO date string
 in daily.sunrise.
*/

function getSunriseDate(daily) {

  if (
    !daily ||
    !daily.sunrise
  ) {
    return null;
  }

  const result = new Date(
    daily.sunrise
  );

  return validDate(result)
    ? result
    : null;
}

/*
 Main public Panchang API.
*/

export const getPanchang = webMethod(
  Permissions.Anyone,

  async input => {

    /*
     Step 1:
     Validate input.
    */

    const request =
      validateRequest(input);

    const {
      date,
      time,
      city,
      latitude,
      longitude,
      utc
    } = request;

    const errors = [];

    /*
     Step 2:
     Calculate astronomy for the
     user-selected time.

     This is the required core engine.
    */

    const astronomy =
      calculateAstronomy(utc);

    /*
     Step 3:
     Daily Panchang and solar events.
    */

    let riseSet = null;
    try {
      riseSet = await getSwissRiseSet(date, latitude, longitude);
    } catch (error) {
      console.error('Swiss Ephemeris rise/set failed:', error);
      errors.push({ engine: 'swissRiseSet', message: 'Swiss Ephemeris उदय-अस्त उपलब्ध नहीं है।' });
    }

    const daily = runEngine(
      'dailyPanchang',

      () => getDailyDetails(
        date,
        utc,
        latitude,
        longitude,
        riseSet
      ),

      errors
    );

    let swissSunrise = null;
    if (daily?.sunrise) {
      try {
        swissSunrise = await getSwissSunrisePanchang(daily.sunrise);
      } catch (error) {
        console.error('Swiss Ephemeris sunrise Panchang failed:', error);
        errors.push({
          engine: 'swissPanchang',
          message: 'Swiss Ephemeris उपलब्ध नहीं है।'
        });
      }
    }


    /*
     Step 4:
     Planetary calculations.

     Uses the same approximate
     ayanamsa as astronomy.js.
    */

    let swissGraha = null;
    try {
      swissGraha = await getSwissGrahaPositions(utc);
    } catch (error) {
      console.error('Swiss Ephemeris graha calculation failed:', error);
      errors.push({ engine: 'swissGraha', message: 'Swiss Ephemeris ग्रह स्थिति उपलब्ध नहीं है।' });
    }

    const graha = runEngine(
      'grahaEngine',

      () => calculateGrahas(
        utc,
        {
          ayanamsa: swissGraha?.ayanamsa ?? astronomy.ayanamsa,
          swissPositions: swissGraha?.positions
        }
      ),

      errors
    );

    /*
     Step 5:
     Determine local sunrise.

     Hindu calendar fields should
     use sunrise-based positions,
     not arbitrary noon positions.
    */

    const sunriseDate =
      getSunriseDate(daily);

    const sunriseAvailable =
      validDate(sunriseDate);

    /*
     Step 6:
     Astronomy at sunrise.

     Prefer recalculation at the
     actual sunrise instant.
    */

    const sunriseAstronomy =
      sunriseAvailable
        ? runEngine(
            'sunriseAstronomy',

            () => calculateAstronomy(
              sunriseDate
            ),

            errors
          )
        : null;

    /*
     Step 7:
     Vedic calendar and Muhurta.

     Use sidereal solar/lunar
     longitude at sunrise.
    */

    const vedic = runEngine(
      'vedicCalendar',

      () => calculateVedicCalendar(
        date,
        latitude,
        longitude,

        sunriseAstronomy
          ? sunriseAstronomy.sunLongitude
          : null,

        sunriseAstronomy
          ? sunriseAstronomy.moonLongitude
          : null,
        riseSet
      ),

      errors
    );

    /*
     Step 8:
     Lunar calendar.

     Requires sunrise to avoid
     silently treating noon as
     the religious calendar anchor.
    */

    const lunar =
      sunriseAvailable
        ? runEngine(
            'lunarCalendar',

            () => calculateLunarCalendar(
              date,
              sunriseDate,
              { nextSunrise: daily.nextSunrise }
            ),

            errors
          )
        : null;

    /*
     Step 9:
     Choghadiya and Hora.
    */

    const muhurta = runEngine(
      'muhurtaEngine',

      () => calculateMuhurtaEngine(
        date,
        latitude,
        longitude,
        riseSet
      ),

      errors
    );

    /*
     Step 10:
     Gujarati calendar.

     Uses its separate
     Kartikadi year rules.
    */

    const gujarati =
      sunriseAvailable
        ? runEngine(
            'gujaratiCalendar',

            () => calculateGujaratiCalendar(
              date,
              sunriseDate,
              latitude,
              longitude
            ),

            errors
          )
        : null;

    /*
     Step 11:
     Vrat and festival candidates.

     This is not a final
     religious festival authority.
    */

    const vratCandidates = runEngine(
      'vratEngine',

      () => calculateVratCalendar(
        date,
        latitude,
        longitude,
        VRAT_DAYS
      ),

      errors
    );

    const vrat = await refineVratTimes(vratCandidates, latitude, longitude);

    /*
     Step 12:
     Combine Vedic and lunar
     calendar results.

     IMPORTANT:

     Spread vedic first.
     Spread lunar second.

     Otherwise the null placeholders
     in vedicCalendar.js overwrite
     the actual lunar month and
     Samvat values.
    */

    const combinedVedic = {

      ...(vedic || {}),

      ...(lunar || {}),

      gujaratiSamvat:
        gujarati
          ? gujarati.gujaratiSamvat
          : null,

      gujaratiNewYearDate:
        gujarati
          ? gujarati.gujaratiNewYearDate
          : null

    };

    /*
     Step 13:
     Engine availability.
    */

    const available = {

      astronomy: true,

      daily: !!daily,

      graha: !!graha,

      sunrise: sunriseAvailable,

      sunriseAstronomy:
        !!sunriseAstronomy,

      vedic: !!vedic,

      lunar: !!lunar,

      muhurta: !!muhurta,

      gujarati: !!gujarati,

      vrat: !!vrat

    };

    /*
     Step 14:
     Detect partial results.
    */

    const partial =
      errors.length > 0 ||
      !sunriseAvailable ||
      !vedic ||
      !lunar ||
      !graha ||
      !muhurta ||
      !gujarati ||
      !vrat;

    /*
     Step 15:
     Return API response.

     Existing HTML field names
     are retained.
    */

    return {

      success: true,

      partial,

      /*
       User selection.
      */

      date,
      time,
      city,

      latitude,
      longitude,

      timezone:
        'Asia/Kolkata',

      /*
       Core Panchang astronomy.

       Fields include:
       tithi, nakshatra, yoga,
       karana, paksha, rashi etc.
      */

      ...astronomy,

      /*
       Daily Panchang.
      */

      daily: daily ? {
        ...daily,
        swissSunrise,
        riseSetSource: riseSet ? 'Swiss Ephemeris' : 'legacy-approximation'
      } : daily,

      /*
       Planetary positions.
      */

      planets:
        graha &&
        Array.isArray(graha.planets)
          ? graha.planets
          : [],

      signs:
        graha &&
        Array.isArray(graha.signs)
          ? graha.signs
          : [],

      /*
       Combined Hindu calendar.

       Used by the existing
       HTML daily calendar panel.
      */

      vedic: combinedVedic,

      /*
       Separate engine outputs
       for future UI development.
      */

      lunarCalendar:
        lunar,

      gujaratiCalendar:
        gujarati,

      muhurtaEngine:
        muhurta,

      /*
       30-day festival calendar.
      */

      calendar:
        vrat &&
        Array.isArray(vrat.calendar)
          ? vrat.calendar
          : [],

      /*
       Festival engine metadata.
      */

      vratEngine:
        vrat
          ? {
              startDate:
                vrat.startDate,

              days:
                vrat.days,

              rulesVersion:
                vrat.rulesVersion,

              decisionStatus:
                vrat.decisionStatus,

              limitations:
                vrat.limitations
            }
          : null,

      /*
       Graha engine metadata.
      */

      grahaInfo:
        graha
          ? {
              ayanamsa:
                graha.ayanamsa,

              ayanamsaModel:
                graha.ayanamsaModel,

              nodeModel:
                graha.nodeModel,

              accuracy:
                graha.accuracy
            }
          : null,

      /*
       Sunrise-based calendar
       astronomy, kept separately.
      */

      sunriseAstronomy,

      /*
       Diagnostics.
      */

      available,

      errors,

      /*
       Accuracy metadata.
      */

      accuracy:
        'approximate',

      validationRequired:
        true,

      /*
       Selected instant versus
       actual calculation time.
      */

      selectedInstant:
        utc.toISOString(),

      calculatedAt:
        new Date().toISOString()

    };
  }
);

/*
 Astronomy validation API.

 Admin access only.

 This validates internal astronomical
 calculations, not final religious
 festival correctness.
*/

export const runAstronomyValidation = webMethod(
  Permissions.Admin,

  async dateText => {

    return validateAstronomy(
      dateText
    );

  }
);




