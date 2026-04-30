const SUPPORTED_LANGUAGES = ['it', 'en', 'de', 'fr', 'es', 'nl'];
const SUPPORTED_CATEGORIES = ['Tutto', 'Mangiare', 'Negozi', 'Servizi', 'Svago'];

const CATEGORY_FALLBACKS = {
  Mangiare: ['restaurant', 'bar', 'cafe', 'pizzeria', 'food'],
  Negozi: ['store', 'supermarket', 'clothing store', 'shopping'],
  Servizi: ['pharmacy', 'doctor', 'bank', 'gas station', 'car repair'],
  Svago: ['tourist attraction', 'museum', 'park', 'spa', 'beach'],
  Tutto: [],
};

function normalizeLanguage(value) {
  const code = String(value || 'it').slice(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.includes(code) ? code : 'it';
}

function normalizeCategory(value) {
  const category = String(value || 'Tutto').trim();
  return SUPPORTED_CATEGORIES.includes(category) ? category : 'Tutto';
}

function isSupportedCategory(value) {
  const category = String(value || 'Tutto').trim();
  return SUPPORTED_CATEGORIES.includes(category);
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

function dedupeResults(results) {
  const seen = new Set();
  const finalResults = [];

  for (const item of results) {
    if (!item) continue;

    const key =
      item.place_id ||
      `${String(item.name || '').toLowerCase()}_${String(item.formatted_address || item.address || '').toLowerCase()}`;

    if (!key || seen.has(key)) continue;
    seen.add(key);
    finalResults.push(item);
  }

  return finalResults;
}

async function googleTextSearch({ query, lat, lng, radius, language, openNow, apiKey }) {
  const params = new URLSearchParams({
    query,
    location: `${lat},${lng}`,
    radius: String(radius),
    key: apiKey,
    language,
  });

  if (openNow === true) {
    params.set('opennow', 'true');
  }

  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`;
  const response = await fetch(url);
  const data = await response.json();

  return {
    ok: response.ok && ['OK', 'ZERO_RESULTS'].includes(data.status),
    status: data.status || response.status,
    error: data.error_message || '',
    results: Array.isArray(data.results) ? data.results : [],
  };
}

module.exports = async function placesSearch(req, res) {
  const debug = {
    googleStatus: '',
    rawCount: 0,
    finalCount: 0,
    queriesTried: [],
    locationUsed: null,
    radius: null,
  };

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      sendJson(res, 500, { ok: false, results: [], error: 'Google Places API key missing', debug });
      return;
    }

    const language = normalizeLanguage(req.query.language);
    const rawCategory = String(req.query.category || 'Tutto').trim();
    const category = normalizeCategory(rawCategory);
    const query = String(req.query.query || '').trim();
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng ?? req.query.lon);
    const rawRadius = Number(req.query.radius ?? Number(req.query.radiusKm || 10) * 1000);
    const radius = Math.max(500, Math.min(Number.isFinite(rawRadius) ? rawRadius : 10000, 50000));
    const openNow = String(req.query.openNow ?? req.query.openNowOnly ?? 'false') === 'true';
    const locationName = String(req.query.locationName || '').trim();

    debug.locationUsed = { name: locationName, lat, lng };
    debug.radius = radius;

    if (
      !query ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(radius) ||
      !isSupportedCategory(rawCategory)
    ) {
      sendJson(res, 400, {
        ok: false,
        results: [],
        error: 'Missing or invalid query, lat, lng, radius or category',
        debug,
      });
      return;
    }

    const fallbackQueries = CATEGORY_FALLBACKS[category] || [];
    const queries = [...new Set([query, ...fallbackQueries].filter(Boolean))];
    let rawResults = [];

    for (const queryText of queries) {
      debug.queriesTried.push(queryText);

      const result = await googleTextSearch({
        query: queryText,
        lat,
        lng,
        radius,
        language,
        openNow,
        apiKey,
      });

      debug.googleStatus = result.status;

      if (!result.ok) {
        sendJson(res, 502, {
          ok: false,
          results: [],
          error: result.error || `Google Places error: ${result.status}`,
          debug,
        });
        return;
      }

      rawResults = rawResults.concat(result.results);

      if (rawResults.length > 0 && queryText === query) {
        break;
      }
    }

    const finalResults = dedupeResults(rawResults);
    debug.rawCount = rawResults.length;
    debug.finalCount = finalResults.length;

    sendJson(res, 200, {
      ok: true,
      results: finalResults,
      source: 'google',
      debug,
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      results: [],
      error: error?.message || 'Unexpected places search error',
      debug,
    });
  }
};
