// backend/ashtamiFestivals.js
import { calculateLunarCalendar } from './lunarCalendar';
import { getSwissRiseSet, getSwissVratSample } from './swissPanchang';

const DAY = 86400000;
const GHATI = 24 * 60000;
const add = (date, days) =>
  new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10);
const at = (instant, transition = null) => getSwissVratSample(Math.floor(instant), transition);
const tithi = sample => sample.sunrisePanchang.tithiIndex;
const endOf = (sample, limb) => Date.parse(sample.sunriseTransitionISO[limb]);
const overlaps = (start, end, from, to) => Math.max(start, from) < Math.min(end, to);

function event(date, id, name, paksha, rule) {
  return {
    date, id, name, rule,
    tithi: paksha + ' अष्टमी',
    accuracy: 'swiss-ephemeris',
    status: 'rule-based',
    validationRequired: false
  };
}

async function nishithaRank(day, start, end) {
  const night = day.nextSunrise - day.sunset;
  const from = Math.max(start, day.sunset + night * 7 / 15);
  const to = Math.min(end, day.sunset + night * 8 / 15);
  if (!(from < to)) return 0;

  let time = Math.ceil(from);
  while (time < to) {
    const sample = await at(time, 'nakshatra');
    if (sample.sunrisePanchang.nakshatraIndex === 3) return 2;
    const boundary = endOf(sample, 'nakshatra');
    if (!(boundary > time)) throw new Error('Invalid Rohini boundary');
    time = boundary;
  }
  return 1;
}

async function selectJanmashtami(days, start, end) {
  let selected = days[0];
  let bestRank = -1;
  for (const day of days) {
    const rank = await nishithaRank(day, start, end);
    if (rank >= bestRank) {
      selected = day;
      bestRank = rank;
    }
  }
  const reason = bestRank === 2 ? 'निशीथ में अष्टमी और रोहिणी का योग।'
    : bestRank === 1 ? 'निशीथ में कृष्ण अष्टमी की व्याप्ति।'
    : days.length === 1 ? 'कृष्ण अष्टमी का एकमात्र व्रत-दिन।'
    : 'दोनों निशीथों में अष्टमी की व्याप्ति न होने पर बाद का दिन।';
  return event(selected.date, 'janmashtami-smarta', 'श्रीकृष्ण जन्माष्टमी (स्मार्त)',
    'कृष्ण', 'धर्मसिन्धु · ' + reason);
}

async function selectDurgaAshtami(days, start, end) {
  const first = days[0];
  const last = days[days.length - 1];
  const navami = await at(end, 'tithi');
  if (tithi(navami) !== 8) throw new Error('Invalid Navami boundary');
  const navamiEnd = endOf(navami, 'tithi');
  const lastHasGhati = start <= last.sunrise && end - last.sunrise >= GHATI;
  const firstFull = start <= first.sunrise && end >= first.nextSunrise;
  const navamiSkipsSunrise = navamiEnd <= last.nextSunrise;
  const useLast = lastHasGhati && !firstFull && !navamiSkipsSunrise;
  const selected = useLast ? last : first;
  const reason = first === last ? 'आश्विन शुक्ल अष्टमी की एकमात्र व्रत-तारीख।'
    : firstFull ? 'पहले सूर्योदय से अगले सूर्योदय तक अष्टमी।'
    : !lastHasGhati ? 'दूसरे दिन सूर्योदय के बाद एक घटिका से कम अष्टमी।'
    : navamiSkipsSunrise ? 'नवमी-क्षय के कारण पूर्व दिन।'
    : 'सूर्योदय पर कम से कम एक घटिका और उसी दिन नवमी।';
  return event(selected.date, 'sharadiya-durgashtami', 'शारदीय दुर्गाष्टमी (महाष्टमी)',
    'शुक्ल', 'धर्मसिन्धु · ' + reason);
}

function selectKalashtami(days, start, end) {
  const qualifying = days.filter(day => {
    const afterPradosh = day.sunset + (day.nextSunrise - day.sunset) / 5 + GHATI;
    return start <= afterPradosh && afterPradosh < end;
  });
  const day = qualifying[qualifying.length - 1];
  if (!day) return null;
  return event(day.date, 'kalashtami', 'मासिक कालाष्टमी', 'कृष्ण',
    'स्थानीय प्रदोषकाल के बाद एक घटिका पर कृष्ण अष्टमी।');
}

export async function calculateNamedAshtami(startDate, count, latitude, longitude) {
  const days = [];
  for (let offset = -3; offset < count + 3; offset++) {
    const date = add(startDate, offset);
    const rise = await getSwissRiseSet(date, latitude, longitude);
    if (!rise.sunrise || !rise.sunset || !rise.nextSunrise) {
      throw new Error('Local solar times unavailable for Ashtami festivals');
    }
    days.push({
      date, sunrise: +rise.sunrise, sunset: +rise.sunset, nextSunrise: +rise.nextSunrise
    });
  }

  const events = [];
  let instant = days[0].sunrise;
  let sample = await at(instant, 'tithi');
  while (instant < days[days.length - 1].sunrise) {
    const boundary = endOf(sample, 'tithi');
    if (!(boundary > instant)) throw new Error('Invalid Ashtami tithi boundary');

    // पहले दिन पर चल रही तिथि का आरम्भ उपलब्ध नहीं है। पड़ोसी दिनों का बफ़र
    // उसे अनुरोधित अवधि से बाहर रखता है।
    const index = tithi(sample);
    if ((index === 7 || index === 22) && instant !== days[0].sunrise) {
      const candidates = days.filter(day =>
        overlaps(instant, boundary, day.sunrise, day.nextSunrise));
      if (candidates.length) {
        const localDate = new Date(instant + 19800000).toISOString().slice(0, 10);
        const month = calculateLunarCalendar(localDate, new Date(instant));
        if (index === 22) {
          const kala = selectKalashtami(candidates, instant, boundary);
          if (kala) events.push(kala);
          if (month.lunarMonth === 'श्रावण' && !month.isAdhikaMonth) {
            events.push(await selectJanmashtami(candidates, instant, boundary));
          }
        } else if (month.lunarMonth === 'आश्विन' && !month.isAdhikaMonth) {
          events.push(await selectDurgaAshtami(candidates, instant, boundary));
        }
      }
    }

    instant = boundary;
    sample = await at(instant, 'tithi');
  }

  const endDate = add(startDate, count);
  return events.filter(item => startDate <= item.date && item.date < endDate);
}
