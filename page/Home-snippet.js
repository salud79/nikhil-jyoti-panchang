import { searchIndianPlaces } from 'backend/places.web';
import { defaultPanchangPlace, resolvePanchangPlace, savePanchangPlace, validPanchangPlace } from 'public/panchangLocation.js';
import wixLocationFrontend from 'wix-location-frontend';
import { getPanchang } from 'backend/panchang.web';
import { getAgniVasa } from 'backend/panchangDisplay.web';

const shivaPlaces = ['श्मशान', 'कैलाश', 'गौरी के साथ', 'नन्दी पर', 'सभा', 'भोजन', 'क्रीड़ा'];
const directions = {
  'मेष': 'पूर्व', 'सिंह': 'पूर्व', 'धनु': 'पूर्व',
  'वृषभ': 'दक्षिण', 'कन्या': 'दक्षिण', 'मकर': 'दक्षिण',
  'मिथुन': 'पश्चिम', 'तुला': 'पश्चिम', 'कुम्भ': 'पश्चिम', 'कुंभ': 'पश्चिम',
  'कर्क': 'उत्तर', 'वृश्चिक': 'उत्तर', 'मीन': 'उत्तर'
};

async function loadToday(date, place) {
  const [result, agniVasa] = await Promise.all([
    getPanchang({ ...place, date, time: '12:00' }),
    getAgniVasa(date, place.latitude, place.longitude).catch(error => {
      console.warn('Home Agnivasa', error);
      return [];
    })
  ]);

  if (!result?.success || !result.daily) throw new Error('Daily Panchang unavailable');

  const { daily } = result;
  const vedic = result.vedic || {};
  const swiss = daily.swissSunrise || daily;
  const p = swiss.sunrisePanchang || daily.sunrisePanchang || {};
  const end = swiss.sunriseTransitionISO || daily.sunriseTransitionISO || {};
  const next = swiss.sunriseNext || daily.sunriseNext || {};
  const engine = result.muhurtaEngine || {};
  const validTithi = Number.isInteger(p.tithiIndex) && p.tithiIndex >= 0 && p.tithiIndex < 30;
  const tithiNumber = p.tithiIndex + 1;
  const nextTithiNumber = tithiNumber % 30 + 1;

  return {
    date,
    city: place.city,
    sunrise: daily.sunrise,
    sunset: daily.sunset,
    moonrise: daily.moonrise,
    moonset: daily.moonset,
    tithi: p.tithi,
    paksha: p.paksha,
    nakshatra: p.nakshatra,
    yoga: p.yoga,
    karana: p.karana,
    tithiEnd: end.tithi,
    nakshatraEnd: end.nakshatra,
    nextTithi: next.tithi && validTithi
      ? (nextTithiNumber <= 15 ? 'शुक्ल पक्ष ' : 'कृष्ण पक्ष ') + next.tithi
      : next.tithi,
    nextNakshatra: next.nakshatra,
    nakshatraPada: p.nakshatraPada,
    yogaEnd: end.yoga,
    nextYoga: next.yoga,
    karanaEnd: end.karana,
    nextKarana: next.karana,
    shakaSamvat: vedic.shakaSamvat,
    brahma: vedic.muhurta?.brahma,
    abhijit: vedic.muhurta?.abhijit,
    yamaGanda: vedic.muhurta?.yamaGanda,
    gulikaKaal: vedic.muhurta?.gulikaKaal,
    amantaMonth: vedic.amantaMonth,
    purnimantaMonth: vedic.purnimantaMonth,
    vikramSamvat: vedic.vikramSamvat,
    suryaRashi: p.suryaRashi,
    chandraRashi: p.chandraRashi,
    ritu: vedic.ritu,
    ayana: vedic.ayana,
    rahuKaal: vedic.muhurta?.rahuKaal,
    dayLength: vedic.dinmaan,
    agniVasa,
    shivaVasa: validTithi ? shivaPlaces[(2 * tithiNumber + 5) % 7] : null,
    nextShivaVasa: validTithi && end.tithi ? shivaPlaces[(2 * nextTithiNumber + 5) % 7] : null,
    chandraVasa: directions[p.chandraRashi],
    choghadiya: [
      ...(engine.dayChoghadiya || []),
      ...(engine.nightChoghadiya || [])
    ].map(({ name, quality, start, end }) => ({ name, quality, start, end }))
  };
}

$w.onReady(() => {
  const embed = $w('#htmlTodayPanchang');
  const requests = new Map();
  let preferredPlace;
  let locationRevision = 0;

  embed.onMessage(async ({ data }) => {
    if (data?.type === 'OPEN_PANCHANG_APP') {
      wixLocationFrontend.to('/panchang-app');
      return;
    }

    if (data?.type === 'OPEN_FULL_PANCHANG') {
      wixLocationFrontend.to('/panchang');
      return;
    }

    if (data?.type === 'HOME_SEARCH_PLACES') {
      let result;
      try { result = await searchIndianPlaces(data.query); }
      catch { result = { success: false }; }
      embed.postMessage({ type: 'HOME_PLACES', id: data.id, result });
      return;
    }

    if (data?.type === 'HOME_SET_PLACE' || data?.type === 'HOME_CURRENT_PLACE') {
      const revision = ++locationRevision;
      const place = data.type === 'HOME_SET_PLACE' ? data.place
        : await resolvePanchangPlace({ useCurrent: true });
      if (revision !== locationRevision) return;
      const success = Boolean(validPanchangPlace(place));
      if (success) {
        savePanchangPlace(place);
        preferredPlace = Promise.resolve(place);
        requests.clear();
      }
      embed.postMessage({ type: 'HOME_PLACE_CHANGED', success });
      return;
    }

    if (data?.type !== 'TODAY_PANCHANG_READY') return;

    const { date, requestId } = data;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        date < '1900-01-01' || date > '2100-12-31' || !Number.isSafeInteger(requestId)) return;
    const parsed = new Date(date + 'T00:00:00Z');
    if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== date) return;

    if (!requests.has(date)) {
      preferredPlace ??= resolvePanchangPlace();
      const task = preferredPlace.then(place => loadToday(date, place || defaultPanchangPlace));
      if (requests.size >= 8) requests.delete(requests.keys().next().value);
      requests.set(date, task);
    }

    const task = requests.get(date);
    try {
      const payload = await task;
      embed.postMessage({ type: 'TODAY_PANCHANG_RESULT', requestId, payload });
    } catch (error) {
      if (requests.get(date) === task) requests.delete(date);
      console.error('Home Panchang', error);
      embed.postMessage({ type: 'TODAY_PANCHANG_ERROR', requestId });
    }
  });
});
