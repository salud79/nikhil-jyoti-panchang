// backend/ekadashiRules.js
// धर्मसिन्धु — स्मार्त गृहस्थ (माधव) और सामान्य वैष्णव निर्णय।
import { getSwissRiseSet, getSwissVratSample } from './swissPanchang';

const MINUTE = 60000;
const DAY = 86400000;
const IST = 330 * MINUTE;
const add = (date, days) => new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10);
const localTime = ms => new Date(Math.round(ms / 1000) * 1000 + IST).toISOString().slice(11, 19);
const localDate = ms => new Date(ms + IST).toISOString().slice(0, 10);
const civilIndex = (days, time) => days.findIndex((day, i) =>
  i + 1 < days.length && day.sunrise <= time && time < days[i + 1].sunrise
);
const at = (ms, transition = 'tithi') => getSwissVratSample(ms, transition);
const tithi = sample => sample.sunrisePanchang.tithiIndex;
const endOf = (sample, name) => Date.parse(sample.sunriseTransitionISO[name]);
const iso = ms => new Date(ms).toISOString();

function countSunrises(days, start, end) {
  return days.filter(day => start <= day.sunrise && day.sunrise < end).length;
}

function timeWindow(day, start, end, status, label) {
  if (!(start < end)) return null;
  return {
    date: day.date, status, start: iso(start), end: iso(end),
    text: day.date + ' · ' + label + ' ' + localTime(start) + '–' + localTime(end) + ' IST'
  };
}

function parana(day, dvadashiStart, dvadashiEnd, trayodashiEnd) {
  const sunrise = day.sunrise;
  const daylight = day.sunset - sunrise;
  const hariVasaraEnd = dvadashiStart + (dvadashiEnd - dvadashiStart) / 4;
  const morningEnd = sunrise + daylight / 5;

  if (dvadashiEnd <= sunrise) {
    return timeWindow(day, sunrise, Math.min(day.sunset, trayodashiEnd),
      'trayodashi', 'त्रयोदशी में पारण। दिन में त्रयोदशी की उपलब्धता') || {
      date: day.date, status: 'review', text: 'पारण-दिन दिन में त्रयोदशी उपलब्ध नहीं'
    };
  }

  const start = Math.max(sunrise, hariVasaraEnd);
  const morning = timeWindow(day, start, Math.min(morningEnd, dvadashiEnd),
    'window', 'पारण');
  if (morning) return morning;

  const afternoon = timeWindow(day, Math.max(start, sunrise + daylight * 3 / 5),
    Math.min(dvadashiEnd, sunrise + daylight * 4 / 5),
    'afternoon-alternative', 'अपराह्ण मत का पारण विकल्प');
  if (afternoon) return afternoon;

  return {
    date: day.date, status: 'review',
    text: day.date + ' · सामान्य प्रातःकाल या अपराह्ण में पारण का समय उपलब्ध नहीं'
  };
}

function specialParana(day, dvadashiStart, dvadashiEnd, trayodashiEnd, nakshatraEnd) {
  if (nakshatraEnd == null) return parana(day, dvadashiStart, dvadashiEnd, trayodashiEnd);

  const afterBoth = timeWindow(day, Math.max(day.sunrise, dvadashiEnd, nakshatraEnd),
    Math.min(day.sunset, trayodashiEnd), 'after-both',
    'तिथि और नक्षत्र दोनों समाप्त होने के बाद दिन में उपलब्ध समय');
  return afterBoth || {
    date: day.date, status: 'review',
    text: day.date + ' · दोनों की समाप्ति के बाद दिन में त्रयोदशी उपलब्ध नहीं। एक के अंत वाला गौण पक्ष परंपरा के अनुसार।'
  };
}

async function nakshatraConditions(dvadashiStart, dvadashiEnd, days) {
  const names = new Map([[3, 'पापनाशिनी'], [6, 'जयंती'], [7, 'जया'], [21, 'विजया']]);
  const result = [];
  let start = dvadashiStart;
  while (start < dvadashiEnd) {
    const sample = await at(start, 'nakshatra');
    const index = sample.sunrisePanchang.nakshatraIndex;
    const end = Math.min(dvadashiEnd, endOf(sample, 'nakshatra'));
    if (!(end > start)) throw new Error('Invalid nakshatra boundary');
    if (names.has(index)) {
      for (const day of days) {
        const overlap = Math.min(end, day.sunset) - Math.max(start, day.sunrise);
        const qualifies = index === 21
          ? overlap >= 48 * MINUTE
          : start <= day.sunrise && day.sunset <= end;
        if (qualifies) result.push({ name: names.get(index), date: day.date, nakshatraEnd: endOf(sample, 'nakshatra') });
      }
    }
    start = end;
  }
  return result;
}

async function calculateCycle(days, start, ekadashi) {
  const end = endOf(ekadashi, 'tithi');
  const dvadashi = await at(end);
  const dvadashiEnd = endOf(dvadashi, 'tithi');
  if (tithi(dvadashi) !== tithi(ekadashi) + 1 || !(start < end && end < dvadashiEnd)) {
    throw new Error('Invalid Ekadashi or Dvadashi boundary');
  }
  const firstSunrise = days.findIndex(day => start <= day.sunrise && day.sunrise < end);
  const first = firstSunrise >= 0 ? firstSunrise : civilIndex(days, start);
  if (first < 0 || first + 4 >= days.length) return [];
  const today = days[first];
  const ekadashiGrows = countSunrises(days, start, end) >= 2;
  const dvadashiGrows = countSunrises(days, end, dvadashiEnd) >= 2;

  // तिथि सूर्योदय के बाद शुरू हो तो पहले दिन का सूर्योदय दशमी में था।
  const sunriseVedha = tithi(today.sample) === tithi(ekadashi) - 1;
  const arunodayaVedha = tithi(await at(today.sunrise - 96 * MINUTE, null)) === tithi(ekadashi) - 1;
  const smarta = (ekadashiGrows && dvadashiGrows) || (dvadashiGrows && sunriseVedha)
    ? first + 1 : first;
  const vaishnava = arunodayaVedha || ekadashiGrows || dvadashiGrows ? first + 1 : first;
  const firstDvadashi = days.find(day => end <= day.sunrise && day.sunrise < dvadashiEnd);
  const special = [];

  if (ekadashiGrows && !arunodayaVedha) {
    special.push({ name: 'उन्मीलनी', date: firstDvadashi?.date || localDate(end) });
  }
  if (dvadashiGrows && firstDvadashi) {
    special.push({ name: 'वंजुली', date: firstDvadashi.date });
  }
  for (const i of new Set([smarta, vaishnava])) {
    if (start <= days[i].sunrise && days[i].sunrise < end && dvadashiEnd <= days[i + 1].sunrise) {
      special.push({ name: 'त्रिस्पर्शा', date: days[i].date });
    }
  }

  // द्वादशी से आगे उसी पक्ष की पूर्णिमा या अमावस्या तक देखें।
  const trayodashi = await at(dvadashiEnd);
  const trayodashiEnd = endOf(trayodashi, 'tithi');
  const chaturdashi = await at(trayodashiEnd);
  const pakshaEndStart = endOf(chaturdashi, 'tithi');
  const pakshaEnd = await at(pakshaEndStart);
  if (countSunrises(days, pakshaEndStart, endOf(pakshaEnd, 'tithi')) >= 2) {
    special.push({ name: 'पक्षवर्धिनी', date: firstDvadashi?.date || localDate(end) });
  }
  special.push(...await nakshatraConditions(end, dvadashiEnd, days));

  const decisions = new Map();
  for (const [i, tradition] of [[smarta, 'स्मार्त गृहस्थ'], [vaishnava, 'वैष्णव']]) {
    if (!decisions.has(i)) decisions.set(i, []);
    decisions.get(i).push(tradition);
  }

  const paksha = ekadashi.sunrisePanchang.pakshaShort;
  const events = [...decisions].map(([i, traditions]) => {
    const day = days[i];
    const next = days[i + 1];
    const window = parana(next, end, dvadashiEnd, trayodashiEnd);
    return {
      id: 'ekadashi',
      date: day.date,
      name: paksha + ' एकादशी व्रत (' + traditions.join(' और ') + ')',
      tithi: tithi(day.sample) % 15 === 11 ? paksha + ' द्वादशी' : paksha + ' एकादशी',
      rule: 'धर्मसिन्धु · केवल एकादशी उपवास। ' + window.text,
      traditions, parana: window, accuracy: 'swiss-ephemeris',
      tithiBoundaries: { ekadashiStart: iso(start), dvadashiStart: iso(end), dvadashiEnd: iso(dvadashiEnd) },
      status: 'rule-based', validationRequired: window.status === 'review' || window.status === 'afternoon-alternative'
    };
  });
  for (const item of special) {
    const day = days.find(candidate => candidate.date === add(item.date, 1));
    if (!day) continue;
    const window = specialParana(day, end, dvadashiEnd, trayodashiEnd, item.nakshatraEnd);
    events.push({
      id: 'mahadwadashi', date: item.date, name: item.name + ' महाद्वादशी',
      tithi: paksha + ' द्वादशी',
      rule: 'धर्मसिन्धु · यदि इस दिन विशेष उपवास रखा जाए। ' + window.text,
      parana: window,
      status: 'special-yoga', accuracy: 'swiss-ephemeris', validationRequired: true
    });
  }
  return events;
}

export async function calculateEkadashiEvents(startDate, count, latitude, longitude) {
  const days = [];
  for (let offset = -4; offset < count + 7; offset++) {
    const date = add(startDate, offset);
    const { sunrise, sunset } = await getSwissRiseSet(date, latitude, longitude);
    if (!sunrise || !sunset || !(sunrise < sunset)) throw new Error('Missing local solar times');
    days.push({ date, sunrise: +sunrise, sunset: +sunset, sample: await at(+sunrise, null) });
  }

  const events = [];
  let instant = days[0].sunrise;
  let sample = await at(instant);
  while (instant < days[days.length - 1].sunrise) {
    const next = endOf(sample, 'tithi');
    if (!(next > instant)) throw new Error('Invalid tithi boundary');
    const following = await at(next);
    if (tithi(sample) % 15 === 9 && tithi(following) % 15 === 10) {
      events.push(...await calculateCycle(days, next, following));
    }
    instant = next;
    sample = following;
  }
  const endDate = add(startDate, count);
  return events.filter(event => startDate <= event.date && event.date < endDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}
