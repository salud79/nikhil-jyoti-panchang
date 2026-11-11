/*
 * Nikhil Jyoti Panchang
 * backend/astronomy.js
 *
 * Approximate geocentric astronomy engine.
 *
 * Exports:
 *   julianDay
 *   sunLongitude
 *   moonLongitude
 *   ayanamsa
 *   karanaName
 *   calculateAstronomy
 *
 * All longitude functions accept Julian Day.
 * All angles are in degrees.
 *
 * IMPORTANT:
 * This is NOT a validated high-precision
 * astronomical ephemeris.
 */

const DEG = Math.PI / 180;

const NAKSHATRA_SIZE = 360 / 27;
const PADA_SIZE = 360 / 108;

const TITHIS = [
  'प्रतिपदा',
  'द्वितीया',
  'तृतीया',
  'चतुर्थी',
  'पंचमी',
  'षष्ठी',
  'सप्तमी',
  'अष्टमी',
  'नवमी',
  'दशमी',
  'एकादशी',
  'द्वादशी',
  'त्रयोदशी',
  'चतुर्दशी'
];

const NAKSHATRAS = [
  'अश्विनी',
  'भरणी',
  'कृत्तिका',
  'रोहिणी',
  'मृगशिरा',
  'आर्द्रा',
  'पुनर्वसु',
  'पुष्य',
  'आश्लेषा',
  'मघा',
  'पूर्वाफाल्गुनी',
  'उत्तराफाल्गुनी',
  'हस्त',
  'चित्रा',
  'स्वाती',
  'विशाखा',
  'अनुराधा',
  'ज्येष्ठा',
  'मूल',
  'पूर्वाषाढ़ा',
  'उत्तराषाढ़ा',
  'श्रवण',
  'धनिष्ठा',
  'शतभिषा',
  'पूर्वाभाद्रपदा',
  'उत्तराभाद्रपदा',
  'रेवती'
];

const YOGAS = [
  'विष्कुम्भ',
  'प्रीति',
  'आयुष्मान',
  'सौभाग्य',
  'शोभन',
  'अतिगण्ड',
  'सुकर्मा',
  'धृति',
  'शूल',
  'गण्ड',
  'वृद्धि',
  'ध्रुव',
  'व्याघात',
  'हर्षण',
  'वज्र',
  'सिद्धि',
  'व्यतीपात',
  'वरीयान',
  'परिघ',
  'शिव',
  'सिद्ध',
  'साध्य',
  'शुभ',
  'शुक्ल',
  'ब्रह्म',
  'इन्द्र',
  'वैधृति'
];

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

const MOVABLE_KARANAS = [
  'बव',
  'बालव',
  'कौलव',
  'तैतिल',
  'गर',
  'वणिज',
  'विष्टि'
];

function normalize(angle) {
  return ((angle % 360) + 360) % 360;
}

function sin(angle) {
  return Math.sin(angle * DEG);
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function requireFinite(value, label) {
  if (!Number.isFinite(value)) {
    throw new Error(
      'Invalid astronomical input: ' + label
    );
  }

  return value;
}

/*
 * Convert JavaScript Date to Julian Day.
 *
 * JavaScript Date represents an instant
 * in UTC internally.
 */

export function julianDay(date) {
  if (
    !(date instanceof Date) ||
    !Number.isFinite(date.getTime())
  ) {
    throw new Error('Invalid Date');
  }

  return (
    date.getTime() / 86400000 +
    2440587.5
  );
}

/*
 * प्रकाश-विपथन सहित सूर्य का अनुमानित देशांतर।
 *
 * Low-order solar series.
 * Input: Julian Day
 * Output: tropical ecliptic longitude
 */

export function sunLongitude(jd) {
  requireFinite(jd, 'Julian Day');

  const T = (jd - 2451545.0) / 36525;

  const L0 = normalize(
    280.46646 +
    T * (36000.76983 + 0.0003032 * T)
  );

  const M = normalize(
    357.52911 +
    T * (35999.05029 - 0.0001537 * T)
  );

  const C =
    (1.914602 -
      T * (0.004817 + 0.000014 * T)) *
      sin(M) +
    (0.019993 - 0.000101 * T) *
      sin(2 * M) +
    0.000289 * sin(3 * M);

  // वार्षिक प्रकाश-विपथन का मानक सन्निकटन, डिग्री में।
  // देशांतर मध्यम विषुव के सापेक्ष रहता है।
  const aberration = 0.00569;
  return normalize(L0 + C - aberration);
}

// Meeus अध्याय 47 के देशांतर पद। अंतिम स्तंभ माइक्रोडिग्री में है।
const LUNAR_LONGITUDE_TERMS = [
  [0, 0, 1, 0, 6288774],
  [2, 0, -1, 0, 1274027],
  [2, 0, 0, 0, 658314],
  [0, 0, 2, 0, 213618],
  [0, 1, 0, 0, -185116],
  [0, 0, 0, 2, -114332],
  [2, 0, -2, 0, 58793],
  [2, -1, -1, 0, 57066],
  [2, 0, 1, 0, 53322],
  [2, -1, 0, 0, 45758],
  [0, 1, -1, 0, -40923],
  [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383],
  [2, 0, 0, -2, 15327],
  [0, 0, 1, 2, -12528],
  [0, 0, 1, -2, 10980],
  [4, 0, -1, 0, 10675],
  [0, 0, 3, 0, 10034],
  [4, 0, -2, 0, 8548],
  [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766],
  [1, 0, -1, 0, -5163],
  [1, 1, 0, 0, 4987],
  [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994],
  [4, 0, 0, 0, 3861],
  [2, 0, -3, 0, 3665],
  [0, 1, -2, 0, -2689],
  [2, 0, -1, 2, -2602],
  [2, -1, -2, 0, 2390],
  [1, 0, 1, 0, -2348],
  [2, -2, 0, 0, 2236],
  [0, 1, 2, 0, -2120],
  [0, 2, 0, 0, -2069],
  [2, -2, -1, 0, 2048],
  [2, 0, 1, -2, -1773],
  [2, 0, 0, 2, -1595],
  [4, -1, -1, 0, 1215],
  [0, 0, 2, 2, -1110],
  [3, 0, -1, 0, -892],
  [2, 1, 1, 0, -810],
  [4, -1, -2, 0, 759],
  [0, 2, -1, 0, -713],
  [2, 2, -1, 0, -700],
  [2, 1, -2, 0, 691],
  [2, -1, 0, -2, 596],
  [4, 0, 1, 0, 549],
  [0, 0, 4, 0, 537],
  [4, -1, 0, 0, 520],
  [1, 0, -2, 0, -487],
  [2, 1, 0, -2, -399],
  [0, 0, 2, -2, -381],
  [1, 1, 1, 0, 351],
  [3, 0, -2, 0, -340],
  [4, 0, -3, 0, 330],
  [2, -1, 2, 0, 327],
  [0, 2, 1, 0, -323],
  [1, 1, -1, 0, 299],
  [2, 0, 3, 0, 294]
];

// API के 1900–2100 कालखंड के लिए NASA का ΔT सन्निकटन।
const DELTA_T_MODELS = [
  [1920, 1900, [-2.79, 1.494119, -0.0598939, 0.0061966, -0.000197]],
  [1941, 1920, [21.20, 0.84493, -0.0761, 0.0020936]],
  [1961, 1950, [29.07, 0.407, -1 / 233, 1 / 2547]],
  [1986, 1975, [45.45, 1.067, -1 / 260, -1 / 718]],
  [2005, 2000, [63.86, 0.3345, -0.060374, 0.0017275, 0.000651814, 0.00002373599]],
  [2050, 2000, [62.92, 0.32217, 0.005589]]
];

function deltaTSeconds(jd) {
  const year = 2000 + (jd - 2451545.0) / 365.2425;
  if (year >= 2050) {
    return -20 + 32 * ((year - 1820) / 100) ** 2 -
      0.5628 * Math.max(0, 2150 - year);
  }

  const [, epoch, coefficients] = DELTA_T_MODELS.find(([end]) => year < end);
  return coefficients.reduceRight((sum, coefficient) =>
    sum * (year - epoch) + coefficient, 0);
}

// पृथ्वी-केंद्रित चंद्र देशांतर, मध्यम विषुव के सापेक्ष।
export function moonLongitude(jd) {
  requireFinite(jd, 'Julian Day');

  const t = (jd - 2451545.0 + deltaTSeconds(jd) / 86400) / 36525;
  const L = normalize(218.3164477 + t * (481267.88123421 +
    t * (-0.0015786 + t * (1 / 538841 - t / 65194000))));
  const D = normalize(297.8501921 + t * (445267.1114034 +
    t * (-0.0018819 + t * (1 / 545868 - t / 113065000))));
  const M = normalize(357.5291092 + t * (35999.0502909 +
    t * (-0.0001536 + t / 24490000)));
  const Mp = normalize(134.9633964 + t * (477198.8675055 +
    t * (0.0087414 + t * (1 / 69699 - t / 14712000))));
  const F = normalize(93.2720950 + t * (483202.0175233 +
    t * (-0.0036539 + t * (-1 / 3526000 + t / 863310000))));
  const E = 1 - t * (0.002516 + 0.0000074 * t);
  const eccentricity = [1, E, E * E];

  let correction =
    3958 * sin(119.75 + 131.849 * t) +
    1962 * sin(L - F) +
    318 * sin(53.09 + 479264.29 * t);

  for (const [d, m, mp, f, amplitude] of LUNAR_LONGITUDE_TERMS) {
    correction += amplitude * eccentricity[Math.abs(m)] *
      sin(d * D + m * M + mp * Mp + f * F);
  }

  return normalize(L + correction / 1000000);
}

/*
 * Approximate ayanamsa.
 *
 * Preserves the original project's
 * ayanamsa convention for compatibility.
 *
 * Do not label this as a certified
 * Lahiri / Chitrapaksha calculation.
 */

export function ayanamsa(jd) {
  requireFinite(jd, 'Julian Day');

  const years =
    (jd - 2451545.0) / 365.2425;

  return (
    23.85675 +
    years * 0.013969
  );
}

/*
 * Karana index:
 *
 * 0      Kinstughna
 * 1..56  Seven movable Karanas repeated
 * 57     Shakuni
 * 58     Chatushpada
 * 59     Naga
 */

export function karanaName(index) {
  requireFinite(index, 'Karana index');

  const n = (
    (Math.floor(index) % 60) + 60
  ) % 60;

  if (n === 0) {
    return 'किंस्तुघ्न';
  }

  if (n === 57) {
    return 'शकुनि';
  }

  if (n === 58) {
    return 'चतुष्पाद';
  }

  if (n === 59) {
    return 'नाग';
  }

  return MOVABLE_KARANAS[
    (n - 1) % 7
  ];
}

/*
 * Detailed astronomical calculation.
 *
 * Existing response fields are retained
 * for compatibility with Wix frontend
 * and other backend engines.
 */

export function calculateAstronomy(date) {
  const jd = julianDay(date);

  const tropicalSun = normalize(
    sunLongitude(jd)
  );

  const tropicalMoon = normalize(
    moonLongitude(jd)
  );

  const aya = ayanamsa(jd);

  const siderealSun = normalize(
    tropicalSun - aya
  );

  const siderealMoon = normalize(
    tropicalMoon - aya
  );

  /*
   * Tithi:
   * Relative lunar elongation.
   * One tithi = 12 degrees.
   */

  const phase = normalize(
    tropicalMoon - tropicalSun
  );

  const tithiIndex = Math.min(
    29,
    Math.floor(phase / 12)
  );

  const tithiNumber =
    tithiIndex % 15 + 1;

  const isShukla = tithiIndex < 15;

  const pakshaShort =
    isShukla ? 'शुक्ल' : 'कृष्ण';

  const paksha =
    pakshaShort + ' पक्ष';

  let tithi;

  if (tithiNumber === 15) {
    tithi = isShukla
      ? 'पूर्णिमा'
      : 'अमावस्या';
  } else {
    tithi = TITHIS[
      tithiNumber - 1
    ];
  }

  /*
   * Nakshatra:
   * Sidereal lunar longitude.
   */

  const nakshatraIndex = Math.min(
    26,
    Math.floor(
      siderealMoon / NAKSHATRA_SIZE
    )
  );

  const nakshatraNumber =
    nakshatraIndex + 1;

  const positionInNakshatra =
    siderealMoon -
    nakshatraIndex * NAKSHATRA_SIZE;

  const nakshatraPada = Math.min(
    4,
    Math.floor(
      positionInNakshatra / PADA_SIZE
    ) + 1
  );

  /*
   * Yoga:
   * Sum of sidereal Sun and Moon.
   */

  const yogaAngle = normalize(
    siderealSun + siderealMoon
  );

  const yogaIndex = Math.min(
    26,
    Math.floor(
      yogaAngle / NAKSHATRA_SIZE
    )
  );

  /*
   * Karana:
   * Half a tithi = 6 degrees.
   */

  const karanaIndex = Math.min(
    59,
    Math.floor(phase / 6)
  );

  /*
   * Sidereal solar and lunar signs.
   */

  const sunSignIndex = Math.min(
    11,
    Math.floor(siderealSun / 30)
  );

  const moonSignIndex = Math.min(
    11,
    Math.floor(siderealMoon / 30)
  );

  return {
    /*
     * Existing compatibility fields
     */

    julianDay: round(jd),

    tithi,
    tithiNumber,
    tithiIndex,
    paksha,

    nakshatra:
      NAKSHATRAS[nakshatraIndex],

    nakshatraNumber,
    nakshatraIndex,
    nakshatraPada,

    yoga: YOGAS[yogaIndex],
    yogaIndex,

    karana: karanaName(
      karanaIndex
    ),

    karanaIndex,

    suryaRashi:
      RASHIS[sunSignIndex],

    chandraRashi:
      RASHIS[moonSignIndex],

    sunLongitude:
      round(siderealSun),

    moonLongitude:
      round(siderealMoon),

    tropicalSunLongitude:
      round(tropicalSun),

    tropicalMoonLongitude:
      round(tropicalMoon),

    lunarPhase:
      round(phase),

    yogaAngle:
      round(yogaAngle),

    ayanamsa:
      round(aya),

    /*
     * Additional compatibility and
     * diagnostic fields
     */

    pakshaShort,

    tithiLabel:
      pakshaShort + ' ' + tithi,

    karanaNumber:
      karanaIndex + 1,

    yogaNumber:
      yogaIndex + 1,

    suryaRashiNumber:
      sunSignIndex + 1,

    chandraRashiNumber:
      moonSignIndex + 1,

    sunSignIndex,
    moonSignIndex,

    siderealSunLongitude:
      round(siderealSun),

    siderealMoonLongitude:
      round(siderealMoon),

    tithiProgress:
      round(
        (phase % 12) / 12 * 100,
        3
      ),

    nakshatraProgress:
      round(
        positionInNakshatra /
        NAKSHATRA_SIZE * 100,
        3
      ),

    yogaProgress:
      round(
        (yogaAngle % NAKSHATRA_SIZE) /
        NAKSHATRA_SIZE * 100,
        3
      ),

    karanaProgress:
      round(
        (phase % 6) / 6 * 100,
        3
      ),

    ayanamsaModel:
      'legacy-linear-approximation',

    accuracy:
      'approximate',

    validationRequired:
      true
  };
}


