import { getAnnualGrahaCabinet } from 'backend/annualGrahaCabinet.web';
import { resolvePanchangPlace, savePanchangPlace } from 'public/panchangLocation.js';
import { getAgniVasa } from 'backend/panchangDisplay.web';
// निखिल ज्योति पंचांग — मुख्य पेज का पूरा Page Code
import { getPanchang } from 'backend/panchang.web';
import { searchIndianPlaces } from 'backend/places.web';
import { getSankranti2026 } from 'backend/sankranti.web';

$w.onReady(() => {
  const html = $w('#htmlPanchang');
  let panchangSequence = 0;
  let automaticLocationRequested = false;

  async function sendLocation(requestId, useCurrent) {
    const place = await resolvePanchangPlace({ useCurrent });
    send({ type: 'PANCHANG_LOCATION', requestId, place });
  }

  function send(message) {
    try {
      html.postMessage(message);
    } catch (error) {
      console.error('HTML postMessage failed:', error);
    }
  }

  function errorMessage(error) {
    return String(error?.message || error || 'Unknown error');
  }

  function connect() {
    send({ type: 'PANCHANG_CONNECTED', version: '2.0', timezone: 'Asia/Kolkata' });
  }

  async function handlePlaceSearch(msg) {
    const requestId = msg.requestId ?? null;
    const query = String(msg.query || '').trim().slice(0, 100);

    if (query.length < 2) {
      send({
        type: 'PLACES_RESULT',
        requestId,
        payload: { success: false, places: [], error: 'कम से कम दो अक्षर लिखें।' }
      });
      return;
    }

    try {
      const result = await searchIndianPlaces(query);
      send({ type: 'PLACES_RESULT', requestId, payload: result });
    } catch (error) {
      console.error('Place search failed:', error);
      send({
        type: 'PLACES_RESULT',
        requestId,
        payload: { success: false, places: [], error: errorMessage(error) }
      });
    }
  }

  async function handlePanchang(msg) {
    const requestId = msg.requestId ?? null;
    const sequence = ++panchangSequence;
    const p = msg.payload || {};

    try {
      const [result, agniVasa, annualCabinet] = await Promise.all([getPanchang({
        date: p.date,
        time: p.time || '12:00',
        city: p.city,
        latitude: p.latitude,
        longitude: p.longitude
      }), getAgniVasa(p.date, p.latitude, p.longitude).catch(error => {
        console.warn('Agni Vasa unavailable', error);
        return null;
      }), getAnnualGrahaCabinet(p.date).catch(error => {
        console.warn('Annual graha cabinet unavailable', error);
        return null;
      })]);

      if (sequence === panchangSequence) {
        const daily = result?.daily;
        const swiss = daily?.swissSunrise;
        const payload = swiss ? {
          ...result,
          daily: {
            ...daily,
            sunrisePanchang: swiss.sunrisePanchang,
            sunriseTransitionISO: swiss.sunriseTransitionISO,
            sunriseNext: swiss.sunriseNext
          }
        } : result;
        send({ type: 'PANCHANG_RESULT', requestId, payload: { ...payload, agniVasa, annualCabinet } });
      }
    } catch (error) {
      if (sequence === panchangSequence) {
        console.error('Panchang calculation failed:', error);
        send({ type: 'PANCHANG_ERROR', requestId, message: errorMessage(error) });
      }
    }
  }

  async function handleSankranti(requestId) {
    if (!Number.isSafeInteger(requestId)) return;

    try {
      const rows = await getSankranti2026();
      send({ type: 'SANKRANTI_RESULT', requestId, payload: { rows } });
    } catch (error) {
      console.error('Sankranti load failed:', error);
      send({ type: 'SANKRANTI_RESULT', requestId, payload: {} });
    }
  }

  html.onMessage(async ({ data: msg }) => {
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'PANCHANG_READY':
        connect();
        if (!automaticLocationRequested) {
          automaticLocationRequested = true;
          await sendLocation(0, false);
        }
        break;
      case 'PANCHANG_USE_CURRENT_LOCATION':
        if (Number.isSafeInteger(msg.requestId) && msg.requestId > 0) {
          await sendLocation(msg.requestId, true);
        }
        break;
      case 'PANCHANG_SAVE_LOCATION':
        savePanchangPlace(msg.place);
        break;
      case 'SEARCH_PLACES':
        await handlePlaceSearch(msg);
        break;
      case 'CALCULATE_PANCHANG':
        await handlePanchang(msg);
        break;
      case 'GET_SANKRANTI_2026':
        await handleSankranti(msg.requestId);
        break;
      default:
        console.log('Unhandled HTML message:', msg.type);
    }
  });

  connect();
});

