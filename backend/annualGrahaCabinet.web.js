import { Permissions, webMethod } from 'wix-web-module';
import { getSwissGrahaPositions, getSwissRiseSet } from './swissPanchang';

const year = { samvat: 2083, start: '2026-03-19', nextStart: '2027-04-07' };
const referencePlace = { city: 'वाराणसी', latitude: 25.3176, longitude: 82.9739 };
const planets = ['सूर्य', 'चंद्र', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];
const offices = [
  ['मंत्री', 'मेष संक्रांति', 0, '2026-04-14'],
  ['सेनाधिपति', 'सिंह संक्रांति', 120, '2026-08-17'],
  ['सस्याधिपति', 'कर्क संक्रांति', 90, '2026-07-17'],
  ['धान्याधिपति', 'धनु संक्रांति', 240, '2026-12-16'],
  ['धनाधिपति', 'कन्या संक्रांति', 150, '2026-09-17'],
  ['मेघाधिपति', 'सूर्य का आर्द्रा प्रवेश', 66 + 2 / 3, '2026-06-22'],
  ['रसाधिपति', 'तुला संक्रांति', 180, '2026-10-17'],
  ['नीरसाधिपति', 'मकर संक्रांति', 270, '2027-01-14'],
  ['फलाधिपति', 'मीन संक्रांति', 330, '2027-03-15']
];
const dayMs = 86400000;
const istOffset = 19800000;
const isoDate = ms => new Date(ms).toISOString().slice(0, 10);
const weekdayLord = date => planets[new Date(date + 'T00:00:00Z').getUTCDay()];
let cabinet;

async function ingress(longitude, nearDate) {
  const center = Date.parse(nearDate + 'T00:00:00Z');
  let low = center - 5 * dayMs;
  let high = center + 5 * dayMs;

  const offset = async ms => {
    const graha = await getSwissGrahaPositions(new Date(ms));
    return (graha.positions.sun.sidereal - longitude + 540) % 360 - 180;
  };

  if (!(await offset(low) < 0 && await offset(high) >= 0)) {
    throw new Error('Solar ingress outside expected search window: ' + nearDate);
  }

  while (high - low > 100) {
    const mid = Math.floor((low + high) / 2);
    if (await offset(mid) < 0) low = mid;
    else high = mid;
  }

  return high;
}

async function officeRow([office, event, longitude, nearDate]) {
  const instant = await ingress(longitude, nearDate);
  const localDate = isoDate(instant + istOffset);
  const { sunrise } = await getSwissRiseSet(localDate, referencePlace.latitude, referencePlace.longitude);
  const sunriseMs = new Date(sunrise || NaN).getTime();
  if (!Number.isFinite(sunriseMs)) throw new Error('Sunrise unavailable: ' + localDate);

  const varaDate = instant < sunriseMs ? isoDate(Date.parse(localDate) - dayMs) : localDate;
  return { office, event, graha: weekdayLord(varaDate), varaDate, instant: new Date(instant).toISOString() };
}

async function buildCabinet() {
  const rows = await Promise.all(offices.map(officeRow));
  return {
    samvat: year.samvat,
    start: year.start,
    nextStart: year.nextStart,
    city: referencePlace.city,
    rows: [{
      office: 'राजा',
      event: 'चैत्र शुक्ल प्रतिपदा · नववर्ष',
      graha: weekdayLord(year.start),
      varaDate: year.start,
      instant: null
    }, ...rows]
  };
}

export const getAnnualGrahaCabinet = webMethod(Permissions.Anyone, async date => {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ms = Date.parse(date);
  if (!Number.isFinite(ms) || isoDate(ms) !== date || date < year.start || date >= year.nextStart) return null;
  cabinet ??= buildCabinet().catch(error => {
    cabinet = undefined;
    throw error;
  });
  return cabinet;
});

