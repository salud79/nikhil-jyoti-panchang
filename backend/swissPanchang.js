// Backend → swissPanchang.js

const WASM_URL = 'https://cdn.jsdelivr.net/npm/sweph-wasm@2.6.9/dist/wasm/swisseph.wasm';
const SIDEREAL_FLAGS = 4 | 65536; // Moshier + sidereal

const STEP_MS = 300000;
const MAX_SEARCH_MS = 72 * 3600000;
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

function karanaName(index) {


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

function nextChange(start, readIndex, step = STEP_MS) {
  const initial = readIndex(start);
  let left = start;

  for (let right = start + step; right <= start + MAX_SEARCH_MS; right += step) {
    if (readIndex(right) === initial) {
      left = right;
      continue;
    }

    let lo = left;
    let hi = right;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (readIndex(mid) === initial) lo = mid;
      else hi = mid;
    }
    return hi;
  }

  throw new Error('72 घंटे के भीतर अगला बदलाव नहीं मिला।');
}

// sweph-wasm 2.6.9 के wrapper में इन कॉलों के कुछ buffers मुक्त नहीं होते।
function calcUt(swiss, jd, body, flags) {
  const wasm = swiss.wasm;
  const buffer = wasm._malloc(48 + 256);
  if (!buffer) throw new Error('Swiss Ephemeris buffer allocation failed');
  try {
    const flag = wasm._swe_calc_ut(jd, body, flags, buffer, buffer + 48);
    if (flag < 0) throw new Error('Swiss Ephemeris longitude error ' + flag);
    return Array.from({ length: 6 }, (_, i) => wasm.getValue(buffer + i * 8, 'double'));
  } finally {
    wasm._free(buffer);
  }
}

function riseTransit(swiss, jd, body, mode, position) {
  const wasm = swiss.wasm;
  const buffer = wasm._malloc(32 + 256);
  if (!buffer) throw new Error('Swiss Ephemeris buffer allocation failed');
  try {
    position.forEach((value, i) => wasm.setValue(buffer + i * 8, value, 'double'));
    const flag = wasm._swe_rise_trans(jd, body, 0, 4, mode, buffer, 0, 15, buffer + 24, buffer + 32);
    if (flag < 0) throw Object.assign(new Error('Swiss Ephemeris rise/set error ' + flag), { flag });
    return wasm.getValue(buffer + 24, 'double');
  } finally {
    wasm._free(buffer);
  }
}

function calculateAt(swiss, time) {
  const jd = time / 86400000 + 2440587.5;
  const siderealSun = calcUt(swiss, jd, 0, SIDEREAL_FLAGS)[0];
  const siderealMoon = calcUt(swiss, jd, 1, SIDEREAL_FLAGS)[0];
  if (![siderealSun, siderealMoon].every(Number.isFinite)) {
    throw new Error('सूर्य या चंद्रमा का देशांतर उपलब्ध नहीं है।');
  }
  const phase = normalize(siderealMoon - siderealSun);


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
    tithi, tithiIndex, paksha, pakshaShort,
    nakshatra: NAKSHATRAS[nakshatraIndex], nakshatraIndex, nakshatraPada,
    yoga: YOGAS[yogaIndex], yogaIndex,
    karana: karanaName(karanaIndex), karanaIndex,
    suryaRashi: RASHIS[sunSignIndex], chandraRashi: RASHIS[moonSignIndex]
  };
}

let enginePromise;

function getEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const module = await import('sweph-wasm');
      const SwissEPH = module.default || module;
      const engine = await SwissEPH.init(WASM_URL);
      engine.swe_set_sid_mode(1, 0, 0); // Lahiri
      return engine;
    })().catch(error => {
      enginePromise = undefined;
      throw error;
    });
  }
  return enginePromise;
}

// व्रत निर्णय के लिए केवल मांगी गई तिथि या नक्षत्र सीमा निकालें।
export async function getSwissVratSample(time, transition) {
  if (!Number.isFinite(time) || time < Date.UTC(1899, 11, 20) ||
      time >= Date.UTC(2101, 0, 15)) {
    throw new Error('मान्य व्रत गणना समय चाहिए।');
  }
  const swiss = await getEngine();
  const sunrisePanchang = calculateAt(swiss, time);
  const sunriseTransitionISO = {};
  if (transition) {
    const index = transition + 'Index';
    const end = nextChange(time, instant => calculateAt(swiss, instant)[index], 3600000);
    sunriseTransitionISO[transition] = new Date(end).toISOString();
  }
  return { sunrisePanchang, sunriseTransitionISO };
}

export async function getSwissSunrisePanchang(sunriseISO) {
  const start = typeof sunriseISO === 'string' ? Date.parse(sunriseISO) : NaN;
  if (!Number.isFinite(start) ||
      start < Date.UTC(1899, 11, 31) || start >= Date.UTC(2101, 0, 2)) {
    throw new Error('मान्य सूर्योदय का समय चाहिए।');
  }

  const swiss = await getEngine();
  const cache = new Map();

  function at(time) {
    if (!cache.has(time)) cache.set(time, calculateAt(swiss, time));
    return cache.get(time);
  }

  const sunrisePanchang = at(start);
  const sunriseTransitionISO = {};
  const sunriseNext = {};

  for (const name of ['tithi', 'nakshatra', 'yoga', 'karana']) {
    const end = nextChange(start, (time) => at(time)[name + 'Index']);
    sunriseTransitionISO[name] = new Date(end).toISOString();
    sunriseNext[name] = at(end)[name];
  }

  return {
    sunrisePanchang,
    sunriseTransitionISO,
    sunriseNext,
    engine: 'Swiss Ephemeris',
    version: swiss.swe_version(),
    ephemeris: 'Moshier',
    ayanamsaModel: 'Lahiri'
  };
}


// समय भारतीय नागरिक तारीख पर आधारित हैं। ऊँचाई और मौसम के मान परीक्षण जैसे हैं।
export async function getSwissRiseSet(date, latitude, longitude) {
  const dayMs = 86400000;
  const epoch = 2440587.5;
  const start = Date.parse(date + 'T00:00:00+05:30');
  if (!Number.isFinite(start) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('उदय-अस्त के लिए तारीख और निर्देशांक चाहिए।');
  }

  const swiss = await getEngine();
  const position = [longitude, latitude, 0];

  function event(day, body, mode) {
    let jd;
    try {
      jd = riseTransit(swiss, day / dayMs + epoch, body, mode, position);
    } catch (error) {
      if (error?.flag === -2) return null;
      throw error;
    }

    if (!Number.isFinite(jd)) throw new Error('उदय-अस्त का समय अमान्य है।');
    const ms = Math.round((jd - epoch) * dayMs);
    return ms >= day && ms < day + dayMs ? new Date(ms) : null;
  }

  return {
    sunrise: event(start, 0, 1),
    sunset: event(start, 0, 2),
    nextSunrise: event(start + dayMs, 0, 1),
    moonrise: event(start, 1, 1),
    moonset: event(start, 1, 2)
  };
}


// ग्रह-गोचर चुने हुए क्षण पर है। केतु मध्यम राहु से 180° दूर है।
export async function getSwissGrahaPositions(date) {
  const time = date.getTime();
  if (!Number.isFinite(time)) throw new Error('ग्रह गणना का समय अमान्य है।');

  const swiss = await getEngine();
  const jd = time / 86400000 + 2440587.5;
  const flags = 4 | 256; // Moshier + speed
  const bodies = { sun: 0, moon: 1, mars: 4, mercury: 2, jupiter: 5, venus: 3, saturn: 6, rahu: 10 };
  const positions = {};

  for (const [name, body] of Object.entries(bodies)) {
    const tropical = calcUt(swiss, jd, body, flags)[0];
    const sidereal = calcUt(swiss, jd, body, flags | 65536);
    const [longitude, , , speed] = sidereal;
    if (![tropical, longitude, speed].every(Number.isFinite)) {
      throw new Error('ग्रह की स्थिति उपलब्ध नहीं है: ' + name);
    }
    positions[name] = { tropical: normalize(tropical), sidereal: normalize(longitude), speed };
  }

  const rahu = positions.rahu;
  positions.ketu = {
    tropical: normalize(rahu.tropical + 180),
    sidereal: normalize(rahu.sidereal + 180),
    speed: rahu.speed
  };

  return {
    ayanamsa: swiss.swe_get_ayanamsa_ut(jd),
    positions
  };
}
