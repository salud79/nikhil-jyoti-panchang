import { calculateVratTithiEvents, SWISS_VRAT_IDS } from './vratTithiRules';
import { calculateNamedAshtami } from './ashtamiFestivals';
import { calculateEkadashiEvents } from './ekadashiRules';
import { getSwissRiseSet, getSwissVratSample } from './swissPanchang';
import { calculateLunarCalendar } from './lunarCalendar';

/*
 Nikhil Jyoti Panchang
 backend/vratEngine.js

 Vrat and festival candidate engine.

 Supported:
 - Ekadashi
 - Pradosh
 - Sankashti Chaturthi
 - Vinayaka Chaturthi
 - Purnima
 - Amavasya
 - Ashtami
 - Masik Shivaratri

 Uses approximate astronomical
 calculations and local solar events.

 IMPORTANT:
 This is a preliminary screening
 engine, NOT a certified religious
 observance decision system.

 It does not finalize:
 - Smarta/Vaishnava Ekadashi
 - Dashami Vedha
 - Mahadvadashi
 - Ekadashi Parana
 - Consecutive-day priority
 - Regional festival rules
*/

import {
  calculateAstronomy
} from './astronomy';

import {
  solarEvent,
  lunarEvents,
  addDays,
  istDate,
  dateParts
} from './dailyPanchang';

const MINUTE = 60000;
const DAY = 86400000;
const IST = 330 * MINUTE;

const MAX_DAYS = 45;

function isValidDate(value) {
  return (
    value instanceof Date &&
    Number.isFinite(value.getTime())
  );
}

function validCoords(lat, lon) {
  return (
    lat !== null &&
    lat !== undefined &&
    lat !== '' &&
    lon !== null &&
    lon !== undefined &&
    lon !== '' &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lon)) &&
    Math.abs(Number(lat)) <= 66 &&
    Math.abs(Number(lon)) <= 180
  );
}

function localTimeText(date) {
  if (!isValidDate(date)) {
    return null;
  }

  return new Date(
    date.getTime() + IST
  ).toISOString().slice(11, 16);
}

/*
 Read Tithi using astronomy.js.

 This keeps the vrat engine
 consistent with the main Panchang.
*/

function tithiAt(date) {

  if (!isValidDate(date)) {
    return null;
  }

  const a = calculateAstronomy(date);

  return {
    index: a.tithiIndex,
    number: a.tithiNumber,
    paksha: a.pakshaShort,
    name: a.tithi,
    label: a.tithiLabel ||
      (a.pakshaShort + ' ' + a.tithi),
    elongation: a.lunarPhase
  };
}

function isTithi(
  tithi,
  number,
  paksha = null
) {
  return !!tithi &&
    tithi.number === number &&
    (
      paksha === null ||
      tithi.paksha === paksha
    );
}

/*
 Search for a specified Tithi
 anywhere within a time interval.

 Sampling is used to identify
 candidate overlap. This is not
 an exact astronomical boundary
 calculation.

 The sample step is 5 minutes.
*/

function tithiOverlaps(
  start,
  end,
  number,
  paksha = null
) {

  if (
    !isValidDate(start) ||
    !isValidDate(end) ||
    end <= start
  ) {
    return false;
  }

  const startMs = start.getTime();
  const endMs = end.getTime();

  const step = 5 * MINUTE;

  for (
    let ms = startMs;
    ms <= endMs;
    ms += step
  ) {
    if (
      isTithi(
        tithiAt(new Date(ms)),
        number,
        paksha
      )
    ) {
      return true;
    }
  }

  return isTithi(
    tithiAt(end),
    number,
    paksha
  );
}

/*
 Find the next change in Tithi.

 Used for diagnostics only.
*/

function nextTithiBoundary(start) {

  if (!isValidDate(start)) {
    return null;
  }

  const original =
    tithiAt(start).index;

  const step = 5 * MINUTE;
  const finish =
    start.getTime() + 72 * 60 * MINUTE;

  let left = start.getTime();

  for (
    let right = left + step;
    right <= finish;
    right += step
  ) {

    if (
      tithiAt(new Date(right)).index !==
      original
    ) {

      let lo = left;
      let hi = right;

      for (let i = 0; i < 40; i++) {

        const mid =
          Math.floor((lo + hi) / 2);

        if (mid <= lo || mid >= hi) {
          break;
        }

        if (
          tithiAt(new Date(mid)).index ===
          original
        ) {
          lo = mid;
        } else {
          hi = mid;
        }
      }

      return new Date(hi);
    }

    left = right;
  }

  return null;
}

/*
 Local Madhyahna approximation.

 Uses the central fifth of
 sunrise-to-sunset daylight.

 Different traditions may use
 different Madhyahna definitions.
*/

function madhyahnaPeriod(
  sunrise,
  sunset
) {

  if (
    !isValidDate(sunrise) ||
    !isValidDate(sunset) ||
    sunset <= sunrise
  ) {
    return null;
  }

  const length =
    sunset.getTime() -
    sunrise.getTime();

  return {
    start: new Date(
      sunrise.getTime() +
      length * 2 / 5
    ),
    end: new Date(
      sunrise.getTime() +
      length * 3 / 5
    )
  };
}

// स्थानीय सूर्यास्त से रात के पहले पाँचवें भाग में त्रयोदशी का समय।

function pradoshaWindow(day) {
  if (!day.solarAvailable || day.nextSunrise <= day.sunset) return null;
  const sunset = day.sunset.getTime();
  const end = sunset + (day.nextSunrise.getTime() - sunset) / 5;
  let start = day.sunset;
  let tithi = day.sunsetTithi;
  if (isTithi(tithi, 12)) {
    start = nextTithiBoundary(start);
    if (!start || start.getTime() >= end) return null;
    tithi = tithiAt(start);
  }
  if (!isTithi(tithi, 13)) return null;
  const boundary = nextTithiBoundary(start);
  if (!boundary) return null;
  return { start, end: new Date(Math.min(end, boundary.getTime())), tithi };
}

function paranaWindow(day, next) {
  if (!isTithi(next.sunriseTithi, 12) || !next.solarAvailable) return null;
  const arunodaya = new Date(day.sunrise.getTime() - 96 * MINUTE);
  if (!isTithi(tithiAt(arunodaya), 11)) return null;
  const dvadashiStart = nextTithiBoundary(day.sunrise);
  const dvadashiEnd = nextTithiBoundary(next.sunrise);
  if (!dvadashiStart || !dvadashiEnd || !isTithi(tithiAt(dvadashiStart), 12)) return null;
  const sunrise = next.sunrise.getTime();
  const hariVasaraEnd = (3 * dvadashiStart.getTime() + dvadashiEnd.getTime()) / 4;
  const morningEnd = sunrise + (next.sunset.getTime() - sunrise) / 5;
  const start = Math.max(sunrise, hariVasaraEnd);
  const end = Math.min(morningEnd, dvadashiEnd.getTime());
  return end > start ? { start: new Date(start), end: new Date(end) } : null;
}

function windowText(window) {
  const minute = date => localTimeText(new Date(Math.round(date.getTime() / MINUTE) * MINUTE));
  return minute(window.start) + '–' + minute(window.end) + ' IST';
}

/*
 Nishita screening period.

 Centered around local midnight
 between sunset and next sunrise.

 The period is one-fifteenth
 of the nighttime duration.
*/

function nishitaPeriod(
  sunset,
  nextSunrise
) {

  if (
    !isValidDate(sunset) ||
    !isValidDate(nextSunrise) ||
    nextSunrise <= sunset
  ) {
    return null;
  }

  const night =
    nextSunrise.getTime() -
    sunset.getTime();

  const midpoint =
    sunset.getTime() + night / 2;

  const halfWidth =
    night / 30;

  return {
    start: new Date(
      midpoint - halfWidth
    ),
    end: new Date(
      midpoint + halfWidth
    )
  };
}

/*
 Build the astronomical data
 for one Indian civil date.
*/

function buildDay(
  dateText,
  latitude,
  longitude
) {

  dateParts(dateText);

  const sunrise = solarEvent(
    dateText,
    latitude,
    longitude,
    true
  );

  const sunset = solarEvent(
    dateText,
    latitude,
    longitude,
    false
  );

  const nextSunrise = solarEvent(
    addDays(dateText, 1),
    latitude,
    longitude,
    true
  );

  const lunar = lunarEvents(
    dateText,
    latitude,
    longitude
  );

  const moonrise =
    lunar.moonrise
      ? new Date(lunar.moonrise)
      : null;

  const noon = istDate(
    dateText,
    12,
    0
  );

  return {
    date: dateText,

    sunrise,
    sunset,
    nextSunrise,
    moonrise,

    sunriseTithi:
      tithiAt(sunrise),

    sunsetTithi:
      tithiAt(sunset),

    moonriseTithi:
      tithiAt(moonrise),

    noonTithi:
      tithiAt(noon),

    solarAvailable:
      isValidDate(sunrise) &&
      isValidDate(sunset) &&
      isValidDate(nextSunrise)
  };
}

/*
 Event factory.

 Existing frontend-compatible
 fields are retained.
*/

function makeEvent(
  date,
  id,
  name,
  rule,
  tithi,
  extra = {}
) {

  return {
    date,
    id,
    name,
    rule,

    tithi:
      tithi ? tithi.label : null,

    status: 'candidate',

    accuracy: 'approximate',

    validationRequired: true,

    ...extra
  };
}

/*
 Generate candidate observances.

 The adjacent days are
 available for observance priority
 rules. Most observances still need
 two-day priority validation.
*/

// सूर्योदय या उसके बाद मध्याह्न की समाप्ति से पहले पूर्णिमा हो तो
// वह दिन व्रत के लिए योग्य है। दो योग्य दिनों में पहले दिन को लें।
function purnimaVratTithi(day) {
  const sunriseTithi = day.sunriseTithi;
  if (isTithi(sunriseTithi, 15, 'शुक्ल')) return sunriseTithi;
  if (!isTithi(sunriseTithi, 14, 'शुक्ल')) return null;

  const madhyahna = madhyahnaPeriod(day.sunrise, day.sunset);
  if (!madhyahna) return null;

  const tithi = tithiAt(new Date(madhyahna.end.getTime() - 1));
  return isTithi(tithi, 15, 'शुक्ल') ? tithi : null;
}

function ramaNavamiAtMadhyahna(period) {
  if (!period) return null;

  let instant = period.start;
  let tithi = tithiAt(instant);
  if (isTithi(tithi, 8, 'शुक्ल')) {
    instant = nextTithiBoundary(instant);
    if (!instant || instant >= period.end) return null;
    tithi = tithiAt(instant);
  }
  return isTithi(tithi, 9, 'शुक्ल') ? { instant, tithi } : null;
}

function eventsForDay(
  day,
  previous,
  next
) {

  const events = [];

  const sr = day.sunriseTithi;
  const ss = day.sunsetTithi;
  const mr = day.moonriseTithi;

  const fastingTithi = purnimaVratTithi(day);
  if (fastingTithi && !purnimaVratTithi(previous)) {
    events.push(
      makeEvent(
        day.date,
        'purnima-vrat',
        'पूर्णिमा व्रत',
        'पूर्णिमा तिथि के लिए सूर्योदय और मध्याह्न पर आधारित व्रत-दिन',
        fastingTithi
      )
    );
  }


  /*
   Ekadashi candidate.

   Final Smarta/Vaishnava
   selection is not implemented.
  */

  if (isTithi(sr, 11)) {
    const parana = paranaWindow(day, next);

    events.push(
      makeEvent(
        day.date,
        'ekadashi',
        sr.paksha + ' एकादशी',
        parana
          ? 'अनुमानित पारण ' + next.date + ' · ' + windowText(parana) + '। सामान्य द्वादशी नियम।'
          : 'सूर्योदय पर एकादशी; दशमी-वेध, महाद्वादशी और पारण निर्णय शेष',
        sr
      )
    );
  }

  const pradosha = pradoshaWindow(day);
  if (pradosha) {
    events.push(makeEvent(
      day.date,
      'pradosh',
      pradosha.tithi.paksha + ' प्रदोष व्रत',
      'अनुमानित पूजा-समय ' + windowText(pradosha) + '। दो-दिवसीय प्राथमिकता का सत्यापन शेष।',
      pradosha.tithi,
      { screeningWindow: { start: pradosha.start.toISOString(), end: pradosha.end.toISOString() } }
    ));
  }

  /*
   Sankashti Chaturthi.

   Krishna Chaturthi at moonrise.
  */

  if (
    isTithi(
      mr,
      4,
      'कृष्ण'
    )
  ) {

    events.push(
      makeEvent(
        day.date,
        'sankashti',
        'संकष्टी चतुर्थी',
        'स्थानीय चंद्रोदय पर कृष्ण चतुर्थी; क्षेत्रीय निर्णय शेष',
        mr
      )
    );
  }

  /*
   Vinayaka Chaturthi.

   Shukla Chaturthi overlapping
   approximate Madhyahna.
  */

  const madhyahna =
    madhyahnaPeriod(
      day.sunrise,
      day.sunset
    );

  const navami = ramaNavamiAtMadhyahna(madhyahna);
  if (navami && !ramaNavamiAtMadhyahna(
    madhyahnaPeriod(previous.sunrise, previous.sunset)
  )) {
    const month = calculateLunarCalendar(day.date, navami.instant);
    if (month.lunarMonth === 'चैत्र' && !month.isAdhikaMonth) {
      events.push(makeEvent(
        day.date,
        'rama-navami-smarta',
        'श्री राम नवमी (स्मार्त)',
        'चैत्र शुक्ल नवमी का स्थानीय मध्याह्न से योग',
        navami.tithi
      ));
    }
  }

  if (
    madhyahna &&
    tithiOverlaps(
      madhyahna.start,
      madhyahna.end,
      4,
      'शुक्ल'
    )
  ) {

    events.push(
      makeEvent(
        day.date,
        'vinayaka',
        'विनायक चतुर्थी',
        'अनुमानित मध्याह्न काल में शुक्ल चतुर्थी; अंतिम व्रत-दिन निर्णय शेष',
        tithiAt(
          new Date(
            (
              madhyahna.start.getTime() +
              madhyahna.end.getTime()
            ) / 2
          )
        ),
        {
          screeningWindow: {
            start:
              madhyahna.start.toISOString(),
            end:
              madhyahna.end.toISOString()
          }
        }
      )
    );
  }

  /*
   Purnima and Amavasya.

   Use the first sunrise for a tithi spanning two sunrises.
  */

  if (
    isTithi(
      sr,
      15,
      'शुक्ल'
    ) &&
    !isTithi(previous.sunriseTithi, 15, 'शुक्ल')
  ) {

    events.push(
      makeEvent(
        day.date,
        'purnima',
        'पूर्णिमा',
        'सूर्योदय पर पूर्णिमा तिथि',
        sr
      )
    );
  }

  if (
    isTithi(
      sr,
      15,
      'कृष्ण'
    )
  ) {

    events.push(
      makeEvent(
        day.date,
        'amavasya',
        'अमावस्या',
        'सूर्योदय पर अमावस्या; श्राद्ध और पर्व निर्णय शेष',
        sr
      )
    );
  }

  /*
   Ashtami candidate.
  */

  if (
    isTithi(sr, 8)
  ) {

    events.push(
      makeEvent(
        day.date,
        'ashtami',
        sr.paksha + ' अष्टमी',
        'सूर्योदय पर अष्टमी; विशेष पर्व के नियम शेष',
        sr
      )
    );
  }

  /*
   Masik Shivaratri.

   Krishna Chaturdashi must
   overlap approximate Nishita.
  */

  const nishita =
    nishitaPeriod(
      day.sunset,
      day.nextSunrise
    );

  if (
    nishita &&
    tithiOverlaps(
      nishita.start,
      nishita.end,
      14,
      'कृष्ण'
    )
  ) {

    const midpoint =
      new Date(
        (
          nishita.start.getTime() +
          nishita.end.getTime()
        ) / 2
      );

    events.push(
      makeEvent(
        day.date,
        'masik-shivaratri',
        'मासिक शिवरात्रि',
        'अनुमानित निशीथकाल में कृष्ण चतुर्दशी; अंतिम निर्णय शेष',
        tithiAt(midpoint),
        {
          screeningWindow: {
            start:
              nishita.start.toISOString(),
            end:
              nishita.end.toISOString()
          }
        }
      )
    );
  }

  return events;
}

/*
 Build one calendar row.
*/

function summarizeDay(
  day,
  events
) {

  return {
    date: day.date,

    sunrise:
      localTimeText(
        day.sunrise
      ),

    sunset:
      localTimeText(
        day.sunset
      ),

    moonrise:
      localTimeText(
        day.moonrise
      ),

    sunriseTithi:
      day.sunriseTithi
        ? day.sunriseTithi.label
        : null,

    sunsetTithi:
      day.sunsetTithi
        ? day.sunsetTithi.label
        : null,

    moonriseTithi:
      day.moonriseTithi
        ? day.moonriseTithi.label
        : null,

    events,

    festivals:
      events.map(
        event => event.name
      ),

    status:
      'candidate',

    accuracy:
      'approximate',

    validationRequired:
      true
  };
}

/*
 Main exported Vrat calendar.

 Signature unchanged for
 panchang.web.js compatibility.
*/

export function calculateVratCalendar(
  startDate,
  latitude,
  longitude,
  days = 30
) {

  dateParts(startDate);

  if (
    !validCoords(
      latitude,
      longitude
    )
  ) {
    throw new Error(
      'Invalid coordinates'
    );
  }

  const lat =
    Number(latitude);

  const lon =
    Number(longitude);

  const count =
    Math.min(
      MAX_DAYS,
      Math.max(
        1,
        Math.floor(
          Number(days) || 30
        )
      )
    );

  /*
   Include the preceding and
   following date for future
   priority-rule implementation.
  */

  const records = [];

  for (
    let i = -1;
    i <= count;
    i++
  ) {

    const date =
      addDays(
        startDate,
        i
      );

    records.push(
      buildDay(
        date,
        lat,
        lon
      )
    );
  }

  const calendar = [];

  for (
    let i = 1;
    i <= count;
    i++
  ) {

    const day =
      records[i];

    const previous =
      records[i - 1];

    const next =
      records[i + 1];

    const events =
      eventsForDay(
        day,
        previous,
        next
      );

    calendar.push(
      summarizeDay(
        day,
        events
      )
    );
  }

  const events =
    calendar.flatMap(
      row => row.events
    );

  return {

    startDate,

    days: count,

    calendar,

    events,

    totalEvents:
      events.length,

    rulesVersion:
      '1.1-candidate',

    decisionStatus:
      'PRELIMINARY_NOT_FOR_FINAL_VRAT_DECISIONS',

    limitations: [

      'खगोलीय गणना अनुमानित है',

      'दशमी-वेध के पूर्ण नियम शेष',

      'महाद्वादशी के नियम शेष',

      'विशेष एकादशी और महाद्वादशी का पारण निर्णय शेष',

      'स्मार्त एवं वैष्णव निर्णय शेष',

      'लगातार दो दिनों में तिथि की प्राथमिकता शेष',

      'प्रदोषकाल की अंतिम परंपरागत गणना शेष',

      'मध्याह्न एवं निशीथकाल के क्षेत्रीय नियम शेष',

      'क्षेत्रीय पर्व और उत्सव शेष',

      'बाहरी पंचांग से सत्यापन शेष'

    ],

    accuracy:
      'approximate',

    validationRequired:
      true,

    timezone:
      'Asia/Kolkata'

  };
}

/*
 Diagnostic helper.

 Inspect Tithi at a supplied
 ISO timestamp.
*/

export function inspectVratTithi(
  isoDate
) {

  const date =
    new Date(isoDate);

  if (!isValidDate(date)) {
    throw new Error(
      'Invalid ISO datetime'
    );
  }

  const tithi =
    tithiAt(date);

  const ending =
    nextTithiBoundary(date);

  return {

    ...tithi,

    at:
      date.toISOString(),

    nextBoundary:
      ending
        ? ending.toISOString()
        : null,

    accuracy:
      'approximate',

    validationRequired:
      true

  };
}

// मौजूदा सूची की प्रविष्टियों के समय Swiss Ephemeris से दोबारा निकालें।
export async function refineVratTimes(report, latitude, longitude) {
  if (!report) return report;

  let ashtamiByDate;
  let pradoshByDate;
  try {
    const eveningsByTrayodashi = new Map();
    const ashtamiAtSunrise = new Map();

    // पहली और आखिरी तारीख की पड़ोसी शाम भी चयन में शामिल करें।
    for (let offset = -1; offset <= report.days; offset++) {
      const date = addDays(report.startDate, offset);
      const day = await getSwissRiseSet(date, latitude, longitude);
      if (!day.sunset || !day.nextSunrise || day.nextSunrise <= day.sunset) {
        throw new Error('Missing local Pradosha solar times');
      }

      if (offset >= 0 && offset < report.days) {
        if (!day.sunrise) throw new Error('Missing local sunrise for Ashtami');
        const { sunrisePanchang } = await getSwissVratSample(+day.sunrise, null);
        if (sunrisePanchang.tithiIndex % 15 === 7) {
          const label = sunrisePanchang.pakshaShort + ' अष्टमी';
          ashtamiAtSunrise.set(date, makeEvent(
            date, 'ashtami', label,
            'स्थानीय सूर्योदय पर अष्टमी तिथि। Swiss Ephemeris।',
            { label },
            { status: 'sunrise-tithi', accuracy: 'swiss-ephemeris', validationRequired: false }
          ));
        }
      }

      const sunset = +day.sunset;
      const cutoff = sunset + (+day.nextSunrise - sunset) / 5;
      let start = sunset;
      let sample = await getSwissVratSample(start, 'tithi');
      if (sample.sunrisePanchang.tithiIndex % 15 === 11) {
        start = Date.parse(sample.sunriseTransitionISO.tithi);
        if (!(start < cutoff)) continue;
        sample = await getSwissVratSample(start, 'tithi');
      }

      const tithi = sample.sunrisePanchang;
      if (tithi.tithiIndex % 15 !== 12) continue;
      const trayodashiEnd = sample.sunriseTransitionISO.tithi;
      const end = Math.min(cutoff, Date.parse(trayodashiEnd));
      if (!(start < end)) continue;

      const evenings = eveningsByTrayodashi.get(trayodashiEnd) || [];
      evenings.push({ date, sunset, cutoff, start, end, tithi });
      eveningsByTrayodashi.set(trayodashiEnd, evenings);
    }

    ashtamiByDate = ashtamiAtSunrise;
    const time = ms => new Date(Math.round(ms / 1000) * 1000 + IST).toISOString().slice(11, 19);
    pradoshByDate = new Map();
    for (const evenings of eveningsByTrayodashi.values()) {
      const first = evenings[0];
      const last = evenings[evenings.length - 1];
      const firstDuration = first.end - first.start;
      const lastDuration = last.end - last.start;
      const selected = firstDuration > lastDuration ? first : last;
      const { date, start, end, tithi } = selected;

      let nakta = null;
      if (first !== last) {
        // तीन घटिका संध्या के बाद नक्त। भोजन की समाप्ति के लिए
        // स्थानीय प्रदोषकाल का अंत हमारी गणना की मानक सीमा है।
        const firstNaktaStart = Math.max(first.start, first.sunset + 72 * MINUTE);
        const firstQualifies = firstNaktaStart < first.cutoff && first.end >= first.cutoff;
        const day = firstDuration !== lastDuration && firstQualifies ? first : last;
        const from = Math.max(day.start, day.sunset + 72 * MINUTE);
        nakta = { date: day.date, policy: 'pradosha-end-assumption' };
        if (from < day.end) {
          nakta.start = new Date(from).toISOString();
          nakta.end = new Date(day.end).toISOString();
          nakta.text = ' नक्तभोजन विकल्प ' + day.date + ' · संध्या के बाद त्रयोदशी की उपलब्धता ' +
            time(from) + '–' + time(day.end) +
            ' IST। पहले दिन के लिए प्रदोष के अंत तक त्रयोदशी मानकर चयन।';
        } else {
          nakta.text = ' नक्तभोजन के लिए ' + day.date +
            ' चयनित। उस शाम संध्या के बाद प्रदोषकाल में त्रयोदशी उपलब्ध नहीं।';
        }
      }

      const paksha = tithi.pakshaShort;
      pradoshByDate.set(date, makeEvent(
        date,
        'pradosh',
        paksha + ' प्रदोष व्रत',
        'पूजा-समय ' + time(start) + '–' + time(end) +
          ' IST। Swiss Ephemeris · प्रदोषकाल में त्रयोदशी की व्याप्ति।' + (nakta?.text || ''),
        { label: paksha + ' त्रयोदशी' },
        {
          ...(nakta ? { nakta } : {}),
          accuracy: 'swiss-ephemeris',
          screeningWindow: {
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString()
          }
        }
      ));
    }
  } catch (error) {
    console.warn('Swiss Pradosha decision unavailable', error?.message);
  }

  let ekadashiByDate;
  try {
    const computed = await calculateEkadashiEvents(report.startDate, report.days, latitude, longitude);
    ekadashiByDate = new Map();
    for (const event of computed) {
      if (!ekadashiByDate.has(event.date)) ekadashiByDate.set(event.date, []);
      ekadashiByDate.get(event.date).push(event);
    }
  } catch (error) {
    console.warn('Dharmasindhu Ekadashi calculation unavailable', error?.message);
  }

  const namedAshtamiByDate = new Map();
  try {
    const computed = await calculateNamedAshtami(
      report.startDate, report.days, latitude, longitude
    );
    for (const event of computed) {
      if (!namedAshtamiByDate.has(event.date)) namedAshtamiByDate.set(event.date, []);
      namedAshtamiByDate.get(event.date).push(event);
    }
  } catch (error) {
    console.warn('Named Ashtami calculation unavailable', error?.message);
  }

  let swissVratByDate;
  try {
    const computed = await calculateVratTithiEvents(
      report.startDate, report.days, latitude, longitude
    );
    swissVratByDate = new Map();
    for (const event of computed) {
      if (!swissVratByDate.has(event.date)) swissVratByDate.set(event.date, []);
      swissVratByDate.get(event.date).push(event);
    }
  } catch (error) {
    console.warn('Swiss festival tithi calculation unavailable', error?.message);
  }

  const calendar = report.calendar.map(row => {
    const events = row.events.filter(event =>
      !(ekadashiByDate && event.id === 'ekadashi') &&
      !(pradoshByDate && event.id === 'pradosh') &&
      !(ashtamiByDate && event.id === 'ashtami') &&
      !(swissVratByDate && SWISS_VRAT_IDS.includes(event.id))
    );
    if (pradoshByDate?.has(row.date)) events.push(pradoshByDate.get(row.date));
    if (ashtamiByDate?.has(row.date)) events.push(ashtamiByDate.get(row.date));
    events.push(...(ekadashiByDate?.get(row.date) || []));
    events.push(...(namedAshtamiByDate.get(row.date) || []));
    events.push(...(swissVratByDate?.get(row.date) || []));
    return { ...row, events, festivals: events.map(event => event.name) };
  });
  const events = calendar.flatMap(row => row.events);
  const result = { ...report, calendar, events, totalEvents: events.length };
  if (!ekadashiByDate) return result;
  return {
    ...result,
    rulesVersion: swissVratByDate ? '2.1-dharmasindhu-preview' : '2.0-dharmasindhu-preview',
    limitations: [
      'विशेष व्रत और सामान्य प्रातःकाल से बाहर के पारण का अंतिम निर्णय शेष',
      'दर्श श्राद्ध में समान या अनुपलब्ध अपराह्ण व्याप्ति तथा इष्टि का निर्णय शेष',
      'अन्य क्षेत्रीय व्रत-परंपराओं का सत्यापन शेष'
    ]
  };
}
