// backend/vratTithiRules.js
import { getSwissRiseSet, getSwissVratSample } from './swissPanchang';

const DAY = 86400000;
const targets = new Set([3, 14, 18, 28, 29]);
const nextDate = (date, offset) =>
  new Date(Date.parse(date) + offset * DAY).toISOString().slice(0, 10);
const overlap = (start, end, from, to) =>
  Math.max(0, Math.min(end, to) - Math.max(start, from));
const contains = (start, end, time) => time != null && start <= time && time < end;

export const SWISS_VRAT_IDS = [
  'purnima', 'purnima-vrat', 'sankashti', 'vinayaka',
  'masik-shivaratri', 'amavasya', 'darsha-shraddha'
];

function event(day, id, name, tithi, rule, status = 'rule-based') {
  return {
    date: day.date, id, name, tithi, rule, status,
    accuracy: 'swiss-ephemeris', validationRequired: false
  };
}

function dayPart(day, fraction) {
  return day.sunrise + (day.sunset - day.sunrise) * fraction;
}

function choosePurnima(days, start, end) {
  const daylight = days.filter(d => overlap(start, end, d.sunrise, d.sunset));
  const sunrise = days.find(d => contains(start, end, d.sunrise));
  const purnima = sunrise || daylight[0] || days[0];
  const fasting = daylight.find(d => start < dayPart(d, 3 / 5)) || purnima;

  return [
    event(purnima, 'purnima', 'पूर्णिमा', 'शुक्ल पूर्णिमा',
      sunrise ? 'स्थानीय सूर्योदय पर पूर्णिमा तिथि।'
        : daylight.length ? 'किसी सूर्योदय पर पूर्णिमा न होने पर दिन में तिथि की व्याप्ति।'
          : 'किसी सूर्योदय पर पूर्णिमा न होने पर रात्रि में तिथि की व्याप्ति।',
      sunrise ? 'sunrise-tithi' : 'rule-based'),
    event(fasting, 'purnima-vrat', 'पूर्णिमा व्रत', 'शुक्ल पूर्णिमा',
      'स्थानीय सूर्योदय और मध्याह्न की सीमा से चुना गया व्रत-दिन।')
  ];
}

function chooseChaturthi(index, days, start, end) {
  if (index === 3) {
    const midday = days.find(d => overlap(start, end, dayPart(d, 2 / 5), dayPart(d, 3 / 5)));
    return event(midday || days[0], 'vinayaka', 'विनायक चतुर्थी', 'शुक्ल चतुर्थी',
      midday ? 'धर्मसिन्धु · स्थानीय मध्याह्न में चतुर्थी।'
        : 'धर्मसिन्धु · दोनों मध्याह्नों में चतुर्थी न होने पर पहला दिन।');
  }

  const moonrise = days.find(d => d.moonrises.some(time => contains(start, end, time)));
  return event(moonrise || days[days.length - 1], 'sankashti', 'संकष्टी चतुर्थी', 'कृष्ण चतुर्थी',
    moonrise ? 'धर्मसिन्धु · चंद्रोदय पर चतुर्थी। दोनों दिन योग होने पर पहला दिन।'
      : 'धर्मसिन्धु · दोनों चंद्रोदयों पर चतुर्थी न होने पर बाद का दिन।');
}

function chooseShivaratri(days, start, end) {
  let selected = days[days.length - 1];
  let rank = 0;
  for (const day of days) {
    const night = day.nextSunrise - day.sunset;
    const from = day.sunset + night * 7 / 15;
    const to = day.sunset + night * 8 / 15;
    const current = start <= from && to <= end ? 2 : overlap(start, end, from, to) ? 1 : 0;
    if (current >= rank) {
      selected = day;
      rank = current;
    }
  }
  const detail = rank === 2 ? 'निशीथ में कृष्ण चतुर्दशी की पूर्ण व्याप्ति।'
    : rank === 1 ? 'निशीथ में कृष्ण चतुर्दशी की आंशिक व्याप्ति।'
      : 'निशीथ में व्याप्ति न मिलने पर बाद का दिन।';
  return event(selected, 'masik-shivaratri', 'मासिक शिवरात्रि', 'कृष्ण चतुर्दशी',
    'धर्मसिन्धु · ' + detail);
}

function chooseAmavasya(days, start, end) {
  const events = days.filter(d => contains(start, end, d.sunrise))
    .map(d => event(d, 'amavasya', 'अमावस्या', 'कृष्ण अमावस्या',
      'स्थानीय सूर्योदय पर अमावस्या तिथि।', 'sunrise-tithi'));

  const afternoon = days.map(d => ({
    day: d, coverage: overlap(start, end, dayPart(d, 3 / 5), dayPart(d, 4 / 5))
  })).filter(x => x.coverage > 0).sort((a, b) => b.coverage - a.coverage);
  if (afternoon.length && afternoon[0].coverage !== afternoon[1]?.coverage) {
    events.push(event(afternoon[0].day, 'darsha-shraddha', 'दर्श अमावस्या (अपराह्ण-व्याप्ति)',
      'कृष्ण अमावस्या', 'दर्श श्राद्ध के लिए स्थानीय अपराह्ण की व्याप्ति। इष्टि का निर्णय अलग है।'));
  }
  return events;
}

export async function calculateVratTithiEvents(startDate, count, latitude, longitude) {
  const days = [];
  for (let i = -3; i <= count + 3; i++) {
    const date = nextDate(startDate, i);
    const r = await getSwissRiseSet(date, latitude, longitude);
    if (!r.sunrise || !r.sunset || !r.nextSunrise ||
        !(r.sunrise < r.sunset && r.sunset < r.nextSunrise)) {
      throw new Error('Local solar times unavailable for festival decisions');
    }

    days.push({
      date, sunrise: +r.sunrise, sunset: +r.sunset, nextSunrise: +r.nextSunrise,
      moonrise: r.moonrise ? +r.moonrise : null, moonrises: []
    });
  }

  for (let i = 0; i + 1 < days.length; i++) {
    const day = days[i];
    day.moonrises = [day.moonrise, days[i + 1].moonrise]
      .filter(time => contains(day.sunrise, day.nextSunrise, time));
  }

  const results = [];
  let start = days[0].sunrise;
  while (start < days[days.length - 1].sunrise) {
    const sample = await getSwissVratSample(start, 'tithi');
    const end = Date.parse(sample.sunriseTransitionISO.tithi);
    if (!(end > start)) throw new Error('Invalid festival tithi boundary');
    const index = sample.sunrisePanchang.tithiIndex;
    if (targets.has(index) && start !== days[0].sunrise) {
      const candidates = days.filter(d => overlap(start, end, d.sunrise, d.nextSunrise));
      if (candidates.length) {
        if (index === 14) results.push(...choosePurnima(candidates, start, end));
        if (index === 3 || index === 18) results.push(chooseChaturthi(index, candidates, start, end));
        if (index === 28) results.push(chooseShivaratri(candidates, start, end));
        if (index === 29) results.push(...chooseAmavasya(candidates, start, end));
      }
    }
    start = end;
  }

  const until = nextDate(startDate, count);
  return results.filter(event => startDate <= event.date && event.date < until);
}
