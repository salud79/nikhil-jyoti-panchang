import { Permissions, webMethod } from 'wix-web-module';
import { getSwissRiseSet, getSwissVratSample } from './swissPanchang';

const zones = ['पृथ्वी', 'आकाश', 'पाताल', 'पृथ्वी'];
const defaultPlace = { city: 'वाराणसी, उत्तर प्रदेश', latitude: 25.3176, longitude: 82.9739 };

function dateIST() {
  return new Date(Date.now() + 19800000).toISOString().slice(0, 10);
}

async function getDay(date, latitude, longitude) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(latitude) || Math.abs(latitude) > 66 ||
      !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    throw new Error('दिनांक या निर्देशांक अमान्य हैं।');
  }
  const midnight = new Date(date + 'T00:00:00Z');
  if (!Number.isFinite(+midnight) || midnight.toISOString().slice(0, 10) !== date) {
    throw new Error('दिनांक अमान्य है।');
  }
  const solar = await getSwissRiseSet(date, latitude, longitude);
  if (!solar.sunrise || !solar.nextSunrise || !(solar.sunrise < solar.nextSunrise)) {
    throw new Error('स्थानीय सूर्योदय उपलब्ध नहीं है।');
  }
  const sample = await getSwissVratSample(+solar.sunrise, 'tithi');
  return { solar, sample, weekday: midnight.getUTCDay() + 1 };
}

export const getAgniVasa = webMethod(Permissions.Anyone, async (date, latitude, longitude) => {
  const { solar, sample, weekday } = await getDay(date, latitude, longitude);
  const windows = [];
  let start = +solar.sunrise;
  const limit = +solar.nextSunrise;
  let current = sample;
  while (start < limit) {
    const next = Date.parse(current.sunriseTransitionISO.tithi);
    const index = current.sunrisePanchang.tithiIndex;
    if (!(next > start) || !Number.isInteger(index) || index < 0 || index > 29) {
      throw new Error('तिथि की सीमा उपलब्ध नहीं है।');
    }
    const end = Math.min(next, limit);
    const place = zones[(index + weekday + 2) % 4];
    if (windows.at(-1)?.place === place) {
      windows.at(-1).end = new Date(end).toISOString();
    } else {
      windows.push({ place, start: new Date(start).toISOString(), end: new Date(end).toISOString() });
    }
    start = end;
    if (start < limit) current = await getSwissVratSample(start, 'tithi');
  }
  return windows;
});

export const getTodayPanchang = webMethod(Permissions.Anyone, async () => {
  const date = dateIST();
  const { solar, sample } = await getDay(date, defaultPlace.latitude, defaultPlace.longitude);
  const { paksha, tithi, nakshatra, yoga, karana } = sample.sunrisePanchang;
  return {
    date, city: defaultPlace.city, tithi: [paksha, tithi].filter(Boolean).join(' '),
    nakshatra, yoga, karana, sunrise: solar.sunrise, sunset: solar.sunset
  };
});
