import { Permissions, webMethod } from 'wix-web-module';
import { fetch } from 'wix-fetch';

const GEONAMES_USERNAME = 'YOUR_GEONAMES_USERNAME';
const hindiAliases = new Map([
  ['चकिया', 'Chakia'],
  ['वाराणसी', 'Varanasi'],
  ['बनारस', 'Varanasi'],
  ['दिल्ली', 'Delhi'],
  ['नई दिल्ली', 'New Delhi'],
  ['मुंबई', 'Mumbai'],
  ['लखनऊ', 'Lucknow'],
  ['चंदौली', 'Chandauli'],
  ['प्रयागराज', 'Prayagraj']
]);

async function search(query, hindi) {
  const params = new URLSearchParams({
    country: 'IN',
    featureClass: 'P',
    maxRows: '30',
    style: 'FULL',
    lang: hindi ? 'hi' : 'en',
    username: GEONAMES_USERNAME,
    ...(hindi ? { name: query, isNameRequired: 'true' } : { name_startsWith: query })
  });
  const response = await fetch('https://secure.geonames.org/searchJSON?' + params.toString(), {
    method: 'get',
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) throw new Error('GeoNames HTTP ' + response.status);
  const data = await response.json();
  if (data.status) throw new Error(data.status.message || 'GeoNames error');

  return (data.geonames || []).map(place => ({
    id: String(place.geonameId || ''),
    name: place.name || place.toponymName || '',
    district: place.adminName2 || '',
    state: place.adminName1 || '',
    country: 'भारत',
    latitude: Number(place.lat),
    longitude: Number(place.lng)
  })).filter(place =>
    place.id && place.name &&
    Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
  );
}

export const searchIndianPlaces = webMethod(Permissions.Anyone, async text => {
  const query = String(text ?? '').normalize('NFC').replace(/[\u200C\u200D]/g, '')
    .trim().replace(/\s+/g, ' ').slice(0, 70);
  if (query.length < 2) return { success: true, places: [] };

  const hindi = /[\u0900-\u097F]/.test(query);
  const alias = hindiAliases.get(query);

  try {
    // Known aliases use the same query as the English spelling.
    const places = await search(alias || query, hindi && !alias);
    return { success: true, places: [...new Map(places.map(place => [place.id, place])).values()] };
  } catch (error) {
    console.error('GeoNames place search:', error);
    return {
      success: false,
      places: [],
      error: 'स्थान खोज अभी उपलब्ध नहीं है। बाद में फिर प्रयास करें।'
    };
  }
});

