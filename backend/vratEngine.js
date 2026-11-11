
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

/*
 Pradosha period approximation.

 Uses sunset to sunset + 2
 fixed 24-minute ghatis? No.

 Here we use sunset +/- 36 min
 as a clearly labelled screening
 window, not a final ritual rule.
*/

function pradoshaScreeningPeriod(
  sunset
) {

  if (!isValidDate(sunset)) {
    return null;
  }

  return {
    start: new Date(
      sunset.getTime() - 36 * MINUTE
    ),
    end: new Date(
      sunset.getTime() + 36 * MINUTE
    )
  };
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

 The previous and next days are
 available for future priority
 rules, but no final two-day
 priority decision is made here.
*/

function eventsForDay(
  day,
  previous,
  next
) {

  const events = [];

  const sr = day.sunriseTithi;
  const ss = day.sunsetTithi;
  const mr = day.moonriseTithi;

  /*
   Ekadashi candidate.

   Final Smarta/Vaishnava
   selection is not implemented.
  */

  if (isTithi(sr, 11)) {

    events.push(
      makeEvent(
        day.date,
        'ekadashi',
        sr.paksha + ' एकादशी',
        'सूर्योदय पर एकादशी; दशमी-वेध, महाद्वादशी और पारण निर्णय शेष',
        sr
      )
    );
  }

  /*
   Pradosh candidate.

   Trayodashi must overlap the
   screening interval around
   local sunset.
  */

  const pradosha =
    pradoshaScreeningPeriod(
      day.sunset
    );

  if (
    pradosha &&
    (
      tithiOverlaps(
        pradosha.start,
        pradosha.end,
        13,
        'शुक्ल'
      ) ||
      tithiOverlaps(
        pradosha.start,
        pradosha.end,
        13,
        'कृष्ण'
      )
    )
  ) {

    const t =
      isTithi(ss, 13)
        ? ss
        : tithiAt(
            pradosha.start
          );

    events.push(
      makeEvent(
        day.date,
        'pradosh',
        (isTithi(t, 13)
          ? t.paksha + ' '
          : '') + 'प्रदोष व्रत',
        'प्रदोष के अनुमानित कालखंड में त्रयोदशी; दो-दिवसीय प्राथमिकता और परंपरागत निर्णय शेष',
        isTithi(t, 13) ? t : null,
        {
          screeningWindow: {
            start:
              pradosha.start.toISOString(),
            end:
              pradosha.end.toISOString()
          }
        }
      )
    );
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

   Sunrise-based candidates only.
  */

  if (
    isTithi(
      sr,
      15,
      'शुक्ल'
    )
  ) {

    events.push(
      makeEvent(
        day.date,
        'purnima',
        'पूर्णिमा',
        'सूर्योदय पर पूर्णिमा; स्नान, दान और व्रत का अंतिम निर्णय शेष',
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

      'एकादशी पारण समय शेष',

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
