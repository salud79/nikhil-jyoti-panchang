/*
 * Nikhil Jyoti Panchang
 * backend/astronomyValidation.js
 *
 * Astronomy Validation Engine v3.0
 *
 * Independent reference values must
 * be supplied by the caller.
 *
 * No fabricated ephemeris values.
 * No external paid API required.
 *
 * IMPORTANT:
 * This module compares values.
 * It does not independently generate
 * high-precision reference ephemerides.
 */

import {
  calculateAstronomy
} from './astronomy';

const IST_OFFSET_MS = 330 * 60000;

const DEFAULTS = {
  date: '2026-11-10',
  time: '12:00',
  city: 'Varanasi',
  latitude: 25.3176,
  longitude: 82.9739
};

const THRESHOLDS = {
  sunLongitude: 0.1,
  moonLongitude: 0.25,
  ayanamsa: 0.05,
  lunarPhase: 0.25
};

function normalize(value) {
  return ((value % 360) + 360) % 360;
}

function angularDifference(a, b) {
  const difference = Math.abs(
    normalize(a) - normalize(b)
  );

  return Math.min(
    difference,
    360 - difference
  );
}

function isValidDate(text) {
  if (
    typeof text !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(text)
  ) {
    return false;
  }

  const [year, month, day] =
    text.split('-').map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    year >= 1900 &&
    year <= 2100 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function toUTC(dateText, timeText) {
  if (!isValidDate(dateText)) {
    throw new Error(
      'Invalid date: YYYY-MM-DD'
    );
  }

  if (
    typeof timeText !== 'string' ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(
      timeText
    )
  ) {
    throw new Error(
      'Invalid time: HH:mm'
    );
  }

  const [year, month, day] =
    dateText.split('-').map(Number);

  const [hour, minute] =
    timeText.split(':').map(Number);

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute
    ) - IST_OFFSET_MS
  );
}

function hasValue(value) {
  return (
    value !== undefined &&
    value !== null &&
    value !== ''
  );
}

function finiteReference(value, name) {
  if (!hasValue(value)) {
    return null;
  }

  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    throw new Error(
      'Invalid reference value: ' + name
    );
  }

  return value;
}

function integerReference(value, name) {
  if (!hasValue(value)) {
    return null;
  }

  if (
    typeof value !== 'number' ||
    !Number.isInteger(value)
  ) {
    throw new Error(
      'Invalid reference integer: ' + name
    );
  }

  return value;
}

function result(
  id,
  title,
  status,
  calculated,
  reference,
  difference,
  tolerance,
  details = ''
) {
  return {
    id,
    title,
    status,
    calculated,
    reference,
    difference,
    tolerance,
    details
  };
}

function compareAngle(
  id,
  title,
  actual,
  expected,
  tolerance
) {
  if (expected === null) {
    return result(
      id,
      title,
      'UNVERIFIED',
      actual,
      null,
      null,
      tolerance,
      'स्वतंत्र संदर्भ मान उपलब्ध नहीं है।'
    );
  }

  if (!Number.isFinite(actual)) {
    return result(
      id,
      title,
      'FAIL',
      actual ?? null,
      expected,
      null,
      tolerance,
      'गणना मान अमान्य है।'
    );
  }

  const difference =
    angularDifference(
      actual,
      expected
    );

  return result(
    id,
    title,
    difference <= tolerance
      ? 'PASS'
      : 'FAIL',
    actual,
    expected,
    Number(difference.toFixed(6)),
    tolerance,
    difference <= tolerance
      ? 'निर्धारित सहनशीलता के भीतर।'
      : 'निर्धारित सहनशीलता से अधिक अंतर।'
  );
}

function compareInteger(
  id,
  title,
  actual,
  expected
) {
  if (expected === null) {
    return result(
      id,
      title,
      'UNVERIFIED',
      actual,
      null,
      null,
      0,
      'स्वतंत्र संदर्भ मान उपलब्ध नहीं है।'
    );
  }

  const valid =
    Number.isInteger(actual);

  const difference = valid
    ? Math.abs(actual - expected)
    : null;

  return result(
    id,
    title,
    valid && actual === expected
      ? 'PASS'
      : 'FAIL',
    actual ?? null,
    expected,
    difference,
    0,
    valid && actual === expected
      ? 'संदर्भ से सटीक मिलान।'
      : 'संदर्भ से मिलान नहीं हुआ।'
  );
}

function compareText(
  id,
  title,
  actual,
  expected
) {
  if (!hasValue(expected)) {
    return result(
      id,
      title,
      'UNVERIFIED',
      actual,
      null,
      null,
      null,
      'स्वतंत्र संदर्भ मान उपलब्ध नहीं है।'
    );
  }

  if (typeof expected !== 'string') {
    throw new Error(
      'Invalid reference text: ' + id
    );
  }

  const matched =
    String(actual).trim() ===
    expected.trim();

  return result(
    id,
    title,
    matched ? 'PASS' : 'FAIL',
    actual,
    expected,
    matched ? 0 : 1,
    0,
    matched
      ? 'संदर्भ से मिलान।'
      : 'संदर्भ से मिलान नहीं हुआ।'
  );
}

function summarize(results) {
  const summary = {
    total: results.length,
    passed: 0,
    failed: 0,
    unverified: 0
  };

  for (const item of results) {
    if (item.status === 'PASS') {
      summary.passed++;
    } else if (item.status === 'FAIL') {
      summary.failed++;
    } else {
      summary.unverified++;
    }
  }

  return summary;
}

function normalizeConfig(options) {
  const config = {
    ...DEFAULTS,
    ...(options || {})
  };

  const latitude =
    Number(config.latitude);

  const longitude =
    Number(config.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    throw new Error(
      'Invalid latitude or longitude'
    );
  }

  return {
    date: config.date,
    time: config.time,
    city: String(config.city).slice(0, 100),
    latitude,
    longitude
  };
}

/*
 * Accepted reference structure:
 *
 * {
 *   sunLongitude: number,
 *   moonLongitude: number,
 *   ayanamsa: number,
 *   lunarPhase: number,
 *   tithiNumber: integer,
 *   pakshaShort: string,
 *   nakshatraNumber: integer,
 *   yogaNumber: integer
 * }
 *
 * Longitude references must be
 * SIDEREAL degrees, not tropical.
 *
 * The reference must correspond to
 * the exact same UTC instant.
 *
 * Ayanamsa must use a declared
 * convention. Different ayanamsa
 * systems cannot be compared blindly.
 */

export function validateAstronomy(
  options = {},
  reference = {}
) {
  const config =
    normalizeConfig(options);

  const instant =
    toUTC(
      config.date,
      config.time
    );

  if (
    !reference ||
    typeof reference !== 'object' ||
    Array.isArray(reference)
  ) {
    throw new Error(
      'Reference must be an object'
    );
  }

  const astronomy =
    calculateAstronomy(instant);

  /*
   * calculateAstronomy() returns
   * SIDEREAL Sun and Moon values
   * in sunLongitude/moonLongitude.
   */

  const ref = {
    sunLongitude:
      finiteReference(
        reference.sunLongitude,
        'sunLongitude'
      ),

    moonLongitude:
      finiteReference(
        reference.moonLongitude,
        'moonLongitude'
      ),

    ayanamsa:
      finiteReference(
        reference.ayanamsa,
        'ayanamsa'
      ),

    lunarPhase:
      finiteReference(
        reference.lunarPhase,
        'lunarPhase'
      ),

    tithiNumber:
      integerReference(
        reference.tithiNumber,
        'tithiNumber'
      ),

    nakshatraNumber:
      integerReference(
        reference.nakshatraNumber,
        'nakshatraNumber'
      ),

    yogaNumber:
      integerReference(
        reference.yogaNumber,
        'yogaNumber'
      ),

    pakshaShort:
      reference.pakshaShort ?? null
  };

  const results = [
    compareAngle(
      'VAL-SUN',
      'सूर्य निरयण देशांतर',
      astronomy.sunLongitude,
      ref.sunLongitude,
      THRESHOLDS.sunLongitude
    ),

    compareAngle(
      'VAL-MOON',
      'चंद्र निरयण देशांतर',
      astronomy.moonLongitude,
      ref.moonLongitude,
      THRESHOLDS.moonLongitude
    ),

    compareAngle(
      'VAL-AYA',
      'अयनांश',
      astronomy.ayanamsa,
      ref.ayanamsa,
      THRESHOLDS.ayanamsa
    ),

    compareAngle(
      'VAL-PHASE',
      'सूर्य-चंद्र कोणीय अंतर',
      astronomy.lunarPhase,
      ref.lunarPhase,
      THRESHOLDS.lunarPhase
    ),

    compareInteger(
      'VAL-TITHI',
      'तिथि संख्या',
      astronomy.tithiNumber,
      ref.tithiNumber
    ),

    compareText(
      'VAL-PAKSHA',
      'पक्ष',
      astronomy.pakshaShort,
      ref.pakshaShort
    ),

    compareInteger(
      'VAL-NAK',
      'नक्षत्र संख्या',
      astronomy.nakshatraNumber,
      ref.nakshatraNumber
    ),

    compareInteger(
      'VAL-YOGA',
      'योग संख्या',
      astronomy.yogaNumber,
      ref.yogaNumber
    )
  ];

  const summary =
    summarize(results);

  const status =
    summary.failed > 0
      ? 'FAIL'
      : summary.unverified > 0
        ? 'UNVERIFIED'
        : 'PASS';

  return {
    success: true,
    engine: 'Nikhil Jyoti Astronomy Validation',
    version: '3.0',
    status,
    config,
    utcInstant: instant.toISOString(),
    summary,
    results,

    calculated: {
      sunLongitude:
        astronomy.sunLongitude,

      moonLongitude:
        astronomy.moonLongitude,

      tropicalSunLongitude:
        astronomy.tropicalSunLongitude,

      tropicalMoonLongitude:
        astronomy.tropicalMoonLongitude,

      ayanamsa:
        astronomy.ayanamsa,

      lunarPhase:
        astronomy.lunarPhase,

      tithi:
        astronomy.tithi,

      tithiNumber:
        astronomy.tithiNumber,

      pakshaShort:
        astronomy.pakshaShort,

      nakshatra:
        astronomy.nakshatra,

      nakshatraNumber:
        astronomy.nakshatraNumber,

      yoga:
        astronomy.yoga,

      yogaNumber:
        astronomy.yogaNumber
    },

    referenceMetadata: {
      source:
        typeof reference.source === 'string'
          ? reference.source.slice(0, 200)
          : null,

      ayanamsaModel:
        typeof reference.ayanamsaModel === 'string'
          ? reference.ayanamsaModel.slice(0, 100)
          : null
    },

    referenceProvided:
      summary.unverified <
      summary.total,

    disclaimer:
      'Validation depends on accurate, independently sourced reference values for the same instant and coordinate convention. PASS does not validate festivals, sunrise or muhurta.'
  };
}

/*
 * Batch validation:
 * useful for testing dates around
 * Amavasya, Purnima, Ekadashi,
 * Sankranti and Nakshatra changes.
 */

export function validateAstronomyBatch(
  cases = []
) {
  if (
    !Array.isArray(cases) ||
    cases.length < 1 ||
    cases.length > 100
  ) {
    throw new Error(
      'Provide 1 to 100 validation cases'
    );
  }

  const reports = cases.map(
    (item, index) => {
      try {
        return {
          index,
          ...validateAstronomy(
            item.options || {},
            item.reference || {}
          )
        };
      } catch (error) {
        return {
          index,
          success: false,
          status: 'ERROR',
          message:
            error?.message ||
            String(error)
        };
      }
    }
  );

  const summary = {
    total: reports.length,
    passed: reports.filter(
      x => x.status === 'PASS'
    ).length,
    failed: reports.filter(
      x => x.status === 'FAIL'
    ).length,
    unverified: reports.filter(
      x => x.status === 'UNVERIFIED'
    ).length,
    errors: reports.filter(
      x => x.status === 'ERROR'
    ).length
  };

  return {
    success: true,
    version: '3.0',
    summary,
    reports
  };
}

