const SUPPORTED_LANGUAGES = ['it', 'en', 'de', 'fr', 'es', 'nl'];

function normalizeLanguage(value) {
  const code = String(value || 'it').slice(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.includes(code) ? code : 'it';
}

function getApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(data));
}

module.exports = async function placeDetails(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    res.end();
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    sendJson(res, 500, { error: 'Google Places API key missing' });
    return;
  }

  const language = normalizeLanguage(req.query.language);
  const placeId = String(req.query.placeId || '').trim();

  if (!placeId) {
    sendJson(res, 400, { error: 'Missing placeId' });
    return;
  }

  const params = new URLSearchParams({
    place_id: placeId,
    key: apiKey,
    language,
    fields:
      'place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,url,rating,user_ratings_total,business_status,types,geometry,opening_hours,photos',
  });

  const url = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || (data.status && !['OK'].includes(data.status))) {
    sendJson(res, 502, { error: data.error_message || data.status || 'Google Place details failed' });
    return;
  }

  const result = data.result || {};
  const location = result.geometry?.location || {};

  sendJson(res, 200, {
    googlePlaceId: result.place_id || placeId,
    name: result.name || '',
    phone: result.formatted_phone_number || result.international_phone_number || '',
    website: result.website || '',
    googleMapsUrl: result.url || '',
    address: result.formatted_address || '',
    rating: result.rating || 0,
    userRatingsTotal: result.user_ratings_total || 0,
    businessStatus: result.business_status || '',
    types: result.types || [],
    rawOpeningHours: result.opening_hours || null,
    weekdayText: result.opening_hours?.weekday_text || [],
    isOpenNow: result.opening_hours?.open_now === true,
    hasOpenNowData: typeof result.opening_hours?.open_now === 'boolean',
    lat: location.lat || null,
    lon: location.lng || null,
    photos: result.photos || [],
    language,
  });
};
