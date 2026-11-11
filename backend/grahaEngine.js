
/*
 * Nikhil Jyoti Panchang
 * backend/grahaEngine.js
 *
 * Approximate Geocentric Navagraha Engine
 *
 * Features:
 * - Sun
 * - Moon
 * - Mars
 * - Mercury
 * - Jupiter
 * - Venus
 * - Saturn
 * - Mean Rahu
 * - Mean Ketu
 *
 * - Tropical longitude
 * - Sidereal longitude
 * - Rashi
 * - Degree within Rashi
 * - Approximate daily motion
 * - Retrograde status
 * - 12-sign transit chart data
 *
 * Sun and Moon positions come from
 * astronomy.js for consistency.
 *
 * Planetary calculations use
 * low-precision analytical elements.
 *
 * NOT a high-precision ephemeris.
 * NOT suitable for certified
 * natal-chart or transit decisions.
 */

import {
  sunLongitude,
  moonLongitude,
  julianDay,
  ayanamsa as astronomyAyanamsa
} from './astronomy';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

const HOUR = 3600000;
const DAY = 86400000;

const norm = value =>
  ((value % 360) + 360) % 360;

const sin = angle =>
  Math.sin(angle * RAD);

const cos = angle =>
  Math.cos(angle * RAD);

const RASHIS = [
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

const NAMES = {
  sun: ['सूर्य', 'सू'],
  moon: ['चंद्र', 'चं'],
  mars: ['मंगल', 'मं'],
  mercury: ['बुध', 'बु'],
  jupiter: ['गुरु', 'गु'],
  venus: ['शुक्र', 'शु'],
  saturn: ['शनि', 'श'],
  rahu: ['राहु', 'रा'],
  ketu: ['केतु', 'के']
};

const ORDER = [
  'sun',
  'moon',
  'mars',
  'mercury',
  'jupiter',
  'venus',
  'saturn',
  'rahu',
  'ketu'
];

/*
 * Validate Date.
 */

function validateDate(date) {

  if (
    !(date instanceof Date) ||
    !Number.isFinite(date.getTime())
  ) {
    throw new Error(
      'Invalid astronomical Date'
    );
  }
}

/*
 * Normalize angular difference
 * into -180 to +180 degrees.
 */

function angularDifference(
  after,
  before
) {

  let difference =
    norm(after) - norm(before);

  if (difference > 180) {
    difference -= 360;
  }

  if (difference < -180) {
    difference += 360;
  }

  return difference;
}

/*
 * Shared approximate Ayanamsa.
 */

export function approximateAyanamsa(date) {

  validateDate(date);

  return astronomyAyanamsa(
    julianDay(date)
  );
}

/*
 * Solve Kepler equation:
 *
 * E - e sin(E) = M
 */

function eccentricAnomaly(M, e) {

  const mean =
    norm(M) * RAD;

  let E = mean;

  for (
    let i = 0;
    i < 20;
    i++
  ) {

    const denominator =
      1 - e * Math.sin(E) * 0 -
      e * Math.cos(E);

    if (
      Math.abs(denominator) <
      1e-12
    ) {
      break;
    }

    const correction =
      (
        E -
        e * Math.sin(E) -
        mean
      ) / denominator;

    E -= correction;

    if (
      Math.abs(correction) <
      1e-12
    ) {
      break;
    }
  }

  return E;
}

/*
 * Low-precision orbital elements.
 *
 * d = days since JD 2451543.5
 */

function elements(name, d) {

  switch (name) {

    case 'earth':
      return {
        N: 0,
        i: 0,
        w:
          282.9404 +
          4.70935e-5 * d,
        a: 1,
        e:
          0.016709 -
          1.151e-9 * d,
        M:
          356.0470 +
          0.9856002585 * d
      };

    case 'mercury':
      return {
        N:
          48.3313 +
          3.24587e-5 * d,
        i:
          7.0047 +
          5e-8 * d,
        w:
          29.1241 +
          1.01444e-5 * d,
        a: 0.387098,
        e:
          0.205635 +
          5.59e-10 * d,
        M:
          168.6562 +
          4.0923344368 * d
      };

    case 'venus':
      return {
        N:
          76.6799 +
          2.46590e-5 * d,
        i:
          3.3946 +
          2.75e-8 * d,
        w:
          54.8910 +
          1.38374e-5 * d,
        a: 0.723330,
        e:
          0.006773 -
          1.302e-9 * d,
        M:
          48.0052 +
          1.6021302244 * d
      };

    case 'mars':
      return {
        N:
          49.5574 +
          2.11081e-5 * d,
        i:
          1.8497 -
          1.78e-8 * d,
        w:
          286.5016 +
          2.92961e-5 * d,
        a: 1.523688,
        e:
          0.093405 +
          2.516e-9 * d,
        M:
          18.6021 +
          0.5240207766 * d
      };

    case 'jupiter':
      return {
        N:
          100.4542 +
          2.76854e-5 * d,
        i:
          1.3030 -
          1.557e-7 * d,
        w:
          273.8777 +
          1.64505e-5 * d,
        a: 5.20256,
        e:
          0.048498 +
          4.469e-9 * d,
        M:
          19.8950 +
          0.0830853001 * d
      };

    case 'saturn':
      return {
        N:
          113.6634 +
          2.3898e-5 * d,
        i:
          2.4886 -
          1.081e-7 * d,
        w:
          339.3939 +
          2.97661e-5 * d,
        a: 9.55475,
        e:
          0.055546 -
          9.499e-9 * d,
        M:
          316.9670 +
          0.0334442282 * d
      };

    default:
      throw new Error(
        'Unsupported planet: ' +
        name
      );
  }
}

/*
 * Heliocentric orbital vector.
 *
 * Units: Astronomical Units.
 */

function orbitalVector(name, d) {

  const p =
    elements(name, d);

  const E =
    eccentricAnomaly(
      p.M,
      p.e
    );

  const xv =
    p.a *
    (
      Math.cos(E) -
      p.e
    );

  const yv =
    p.a *
    Math.sqrt(
      1 - p.e * p.e
    ) *
    Math.sin(E);

  const trueAnomaly =
    Math.atan2(
      yv,
      xv
    ) * DEG;

  const radius =
    Math.hypot(
      xv,
      yv
    );

  const u =
    trueAnomaly + p.w;

  const x =
    radius *
    (
      cos(p.N) * cos(u) -
      sin(p.N) *
      sin(u) *
      cos(p.i)
    );

  const y =
    radius *
    (
      sin(p.N) * cos(u) +
      cos(p.N) *
      sin(u) *
      cos(p.i)
    );

  const z =
    radius *
    sin(u) *
    sin(p.i);

  return {
    x,
    y,
    z,
    radius
  };
}

/*
 * Geocentric Sun-direction vector.
 *
 * IMPORTANT:
 * The adopted low-precision
 * orbital-element convention
 * represents the Earth-element
 * solution as the geocentric
 * direction of the Sun.
 *
 * For planetary geocentric
 * coordinates:
 *
 * geocentric planet =
 * heliocentric planet +
 * geocentric Sun vector
 *
 * Do not reverse this addition.
 */

function approximateSunVector(d) {

  const p =
    elements('earth', d);

  const E =
    eccentricAnomaly(
      p.M,
      p.e
    );

  const xv =
    Math.cos(E) - p.e;

  const yv =
    Math.sqrt(
      1 - p.e * p.e
    ) *
    Math.sin(E);

  const radius =
    Math.hypot(
      xv,
      yv
    );

  const longitude = norm(
    Math.atan2(
      yv,
      xv
    ) * DEG + p.w
  );

  return {
    x:
      radius *
      cos(longitude),

    y:
      radius *
      sin(longitude),

    z: 0
  };
}

/*
 * Approximate tropical longitude.
 */

function tropicalLongitude(name, date) {

  const jd =
    julianDay(date);

  const d =
    jd - 2451543.5;

  /*
   Sun and Moon use the same
   source as daily Panchang.
  */

  if (name === 'sun') {
    return sunLongitude(jd);
  }

  if (name === 'moon') {
    return moonLongitude(jd);
  }

  /*
   Approximate mean lunar node.
  */

  if (name === 'rahu') {

    return norm(
      125.1228 -
      0.0529538083 * d
    );
  }

  if (name === 'ketu') {

    return norm(
      305.1228 -
      0.0529538083 * d
    );
  }

  /*
   Planetary geocentric vector.
  */

  const sun =
    approximateSunVector(d);

  const planet =
    orbitalVector(
      name,
      d
    );

  const x =
    planet.x + sun.x;

  const y =
    planet.y + sun.y;

  return norm(
    Math.atan2(
      y,
      x
    ) * DEG
  );
}

/*
 * Sidereal longitude.
 */

function siderealLongitude(
  name,
  date,
  ayanamsaOverride = null
) {

  const tropical =
    tropicalLongitude(
      name,
      date
    );

  const aya =
    ayanamsaOverride === null
      ? approximateAyanamsa(date)
      : ayanamsaOverride;

  return norm(
    tropical - aya
  );
}

/*
 * Approximate sidereal daily
 * motion using symmetric samples.
 *
 * If an ayanamsa override is
 * provided, use its central
 * offset consistently.
 *
 * The natural ayanamsa drift
 * is still applied to the
 * sampled instants.
 */

function dailyMotion(
  name,
  date,
  ayanamsaOverride = null
) {

  const t =
    date.getTime();

  const beforeDate =
    new Date(
      t - 12 * HOUR
    );

  const afterDate =
    new Date(
      t + 12 * HOUR
    );

  const centerAya =
    approximateAyanamsa(date);

  const offset =
    ayanamsaOverride === null
      ? 0
      : ayanamsaOverride -
        centerAya;

  const beforeAya =
    approximateAyanamsa(
      beforeDate
    ) + offset;

  const afterAya =
    approximateAyanamsa(
      afterDate
    ) + offset;

  const before =
    siderealLongitude(
      name,
      beforeDate,
      beforeAya
    );

  const after =
    siderealLongitude(
      name,
      afterDate,
      afterAya
    );

  return angularDifference(
    after,
    before
  );
}

/*
 * Format degree within sign.
 */

function degreeInSign(
  sidereal
) {

  return Number(
    (sidereal % 30).toFixed(5)
  );
}

/*
 * Main public API.
 *
 * Compatible with existing
 * panchang.web.js.
 */

export function calculateGrahas(
  date,
  options = {}
) {

  validateDate(date);

  const calculatedAyanamsa =
    approximateAyanamsa(date);

  const aya =
    Number.isFinite(
      options.ayanamsa
    )
      ? options.ayanamsa
      : calculatedAyanamsa;

  const planets =
    ORDER.map(name => {

      const tropical =
        tropicalLongitude(
          name,
          date
        );

      const sidereal =
        norm(
          tropical - aya
        );

      const signIndex =
        Math.floor(
          sidereal / 30
        );

      const speed =
        dailyMotion(
          name,
          date,
          aya
        );

      /*
       Nodes are mean nodes.
       Sun and Moon are not
       displayed as retrograde.
      */

      let retrograde =
        speed < -0.0001;

      if (
        name === 'sun' ||
        name === 'moon'
      ) {
        retrograde = false;
      }

      let motionStatus;

      if (
        Math.abs(speed) <=
        0.0001
      ) {

        motionStatus =
          'स्थिर के निकट';

      } else if (
        retrograde
      ) {

        motionStatus =
          'वक्री';

      } else {

        motionStatus =
          'मार्गी';
      }

      return {

        key: name,

        name:
          NAMES[name][0],

        short:
          NAMES[name][1],

        longitude:
          Number(
            sidereal.toFixed(5)
          ),

        tropicalLongitude:
          Number(
            tropical.toFixed(5)
          ),

        rashi:
          RASHIS[signIndex],

        signNumber:
          signIndex + 1,

        degreeInSign:
          degreeInSign(
            sidereal
          ),

        dailyMotion:
          Number(
            speed.toFixed(5)
          ),

        retrograde,

        motionStatus,

        nodeType:
          name === 'rahu' ||
          name === 'ketu'
            ? 'mean'
            : null,

        accuracy:
          'approximate'
      };
    });

  /*
   Fixed zodiac-sign chart data.

   This is a transit chart,
   not a birth Lagna chart.
  */

  const signs =
    RASHIS.map(
      (rashi, index) => {

        const number =
          index + 1;

        return {

          number,

          rashi,

          planets:
            planets.filter(
              planet =>
                planet.signNumber ===
                number
            )
        };
      }
    );

  return {

    ayanamsa:
      Number(
        aya.toFixed(5)
      ),

    ayanamsaModel:
      'legacy-linear-approximation',

    nodeModel:
      'approximate-mean-lunar-node',

    chartType:
      'sidereal-transit-fixed-aries',

    planets,

    signs,

    accuracy:
      'low-precision-analytical',

    validationRequired:
      true
  };
}
