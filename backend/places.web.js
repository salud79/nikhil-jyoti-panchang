// backend/places.web.js
// अपने GeoNames खाते का उपयोगकर्ता नाम Wix की कॉपी में भरें।
import { webMethod, Permissions } from 'wix-web-module';
import { fetch } from 'wix-fetch';

const GEONAMES_USERNAME = 'YOUR_GEONAMES_USERNAME';

export const searchIndianPlaces = webMethod(
  Permissions.Anyone,
  async (searchText) => {
    const query = String(searchText || '').trim().slice(0, 70);
    if (query.length < 2) return { success: true, places: [] };

    try {
      const url =
        'https://secure.geonames.org/searchJSON?' +
        'country=IN&featureClass=P&maxRows=30&style=FULL&lang=en&name_startsWith=' +
        encodeURIComponent(query) +
        '&username=' +
        encodeURIComponent(GEONAMES_USERNAME);

      const response = await fetch(url, {
        method: 'get',
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) throw Error('GeoNames HTTP ' + response.status);

      const data = await response.json();
      if (data.status) throw Error(data.status.message || 'GeoNames error');

      const places = (data.geonames || []).map((place) => ({
        id: String(place.geonameId || ''),
        name: place.name || '',
        district: place.adminName2 || '',
        state: place.adminName1 || '',
        country: 'भारत',
        latitude: Number(place.lat),
        longitude: Number(place.lng)
      })).filter((place) =>
        place.name &&
        Number.isFinite(place.latitude) &&
        Number.isFinite(place.longitude)
      );

      return { success: true, places };
    } catch (error) {
      console.error('GeoNames:', error);
      return {
        success: false,
        places: [],
        error: 'स्थान खोज उपलब्ध नहीं है। GeoNames username और Web Services जाँचें।'
      };
    }
  }
);
