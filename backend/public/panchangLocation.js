import wixWindowFrontend from 'wix-window-frontend';
import { session } from 'wix-storage-frontend';

const key = 'nikhil-panchang-selected-place';
export const defaultPanchangPlace = {
  city: 'वाराणसी, उत्तर प्रदेश',
  latitude: 25.3176,
  longitude: 82.9739
};

export function validPanchangPlace(place) {
  return place && typeof place.city === 'string' && place.city.trim() &&
    Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 66 &&
    Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180;
}

function readSelection() {
  try {
    const place = JSON.parse(session.getItem(key) || 'null');
    return validPanchangPlace(place) ? place : null;
  } catch {
    return null;
  }
}

export function savePanchangPlace(place) {
  if (!validPanchangPlace(place)) return;
  const { city, latitude, longitude } = place;
  try {
    session.setItem(key, JSON.stringify({ city: city.trim().slice(0, 120), latitude, longitude }));
  } catch (error) {
    console.warn('Panchang location storage unavailable', error);
  }
}

export async function resolvePanchangPlace({ useCurrent = false } = {}) {
  if (!useCurrent) {
    const saved = readSelection();
    if (saved) return saved;
  }

  let timeout;
  try {
    const location = await Promise.race([
      wixWindowFrontend.getCurrentGeolocation(),
      new Promise(resolve => { timeout = setTimeout(() => resolve(null), 7000); })
    ]);

    const { latitude, longitude } = location?.coords || {};
    const place = {
      city: 'आपका वर्तमान स्थान',
      latitude: Math.round(latitude * 10000) / 10000,
      longitude: Math.round(longitude * 10000) / 10000
    };
    return validPanchangPlace(place) ? place : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

