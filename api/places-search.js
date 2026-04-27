const GOOGLE_PLACES_TEXT_SEARCH_URL =
  'https://maps.googleapis.com/maps/api/place/textsearch/json';

const GOOGLE_PLACES_NEARBY_SEARCH_URL =
  'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

const MAX_RESULTS = 15;

function safeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text.length ? text : fallback;
}

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(n, max));
}

function normalizeText(value) {
  return safeText(value).toLowerCase();
}

function containsAny(source, words) {
  const text = normalizeText(source);
  return words.some((word) => text.includes(normalizeText(word)));
}

function getPhotoUrl(photoReference) {
  const ref = safeText(photoReference);

  if (!ref) return '';

  return `/api/place-photo?photoReference=${encodeURIComponent(ref)}&maxWidth=1200`;
}

function getBestPhotoReference(place) {
  if (!place || !Array.isArray(place.photos) || !place.photos.length) {
    return '';
  }

  return place.photos[0]?.photo_reference || '';
}

function getOpeningStatus(place) {
  const openingHours = place?.opening_hours || null;

  const openNow =
    openingHours && typeof openingHours.open_now === 'boolean'
      ? openingHours.open_now
      : null;

  return {
    isOpenNow: openNow === true,
    hasOpenNowData: typeof openNow === 'boolean',
    openInfoText:
      openNow === true
        ? 'Aperto ora'
        : openNow === false
        ? 'Chiuso ora'
        : 'Orari da verificare',
  };
}

function buildGoogleResult(place) {
  const photoReference = getBestPhotoReference(place);
  const photoUrl = getPhotoUrl(photoReference);
  const opening = getOpeningStatus(place);

  return {
    place_id: place.place_id || '',
    googlePlaceId: place.place_id || '',

    name: place.name || '',
    formatted_address: place.formatted_address || place.vicinity || '',
    address: place.formatted_address || place.vicinity || '',

    geometry: place.geometry || null,

    lat:
      place?.geometry?.location?.lat !== undefined
        ? Number(place.geometry.location.lat)
        : null,

    lon:
      place?.geometry?.location?.lng !== undefined
        ? Number(place.geometry.location.lng)
        : null,

    types: Array.isArray(place.types) ? place.types : [],

    rating: Number(place.rating || 0),
    user_ratings_total: Number(place.user_ratings_total || 0),
    userRatingsTotal: Number(place.user_ratings_total || 0),

    price_level:
      place.price_level === 0 || place.price_level
        ? Number(place.price_level)
        : null,

    business_status: place.business_status || '',
    businessStatus: place.business_status || '',

    opening_hours: place.opening_hours || null,
    openingHours: place.opening_hours || null,

    isOpenNow: opening.isOpenNow,
    hasOpenNowData: opening.hasOpenNowData,
    openInfoText: opening.openInfoText,

    photos: Array.isArray(place.photos) ? place.photos : [],
    photoReference,
    photoUrl,
    image: photoUrl,

    description:
      place.formatted_address ||
      place.vicinity ||
      'Risultato trovato tramite Google Places.',
  };
}

function isStrictFoodPlace(place) {
  const types = Array.isArray(place?.types) ? place.types : [];
  const name = normalizeText(place?.name);
  const typeText = types.join(' ').toLowerCase();
  const source = `${name} ${typeText}`;

  const foodWords = [
    'restaurant',
    'meal_takeaway',
    'meal_delivery',
    'bar',
    'cafe',
    'bakery',
    'food',
    'ristorante',
    'trattoria',
    'osteria',
    'pizzeria',
    'pizza',
    'sushi',
    'giapponese',
    'bar',
    'caff',
    'gelateria',
    'gelato',
    'pasticceria',
    'panificio',
    'pub',
    'bistrot',
    'kebab',
    'hamburger',
  ];

  const blockWords = [
    'supermarket',
    'grocery_or_supermarket',
    'store',
    'shopping_mall',
    'clothing_store',
    'shoe_store',
    'pharmacy',
    'hospital',
    'doctor',
    'parking',
    'gas_station',
    'lodging',
    'church',
    'museum',
    'tourist_attraction',
    'park',
    'beach',
    'bank',
    'atm',
    'post_office',
    'car_repair',
    'school',
    'local_government_office',
  ];

  return containsAny(source, foodWords) && !containsAny(source, blockWords);
}

function isServiceLike(place, query) {
  const q = normalizeText(query);
  const types = Array.isArray(place?.types) ? place.types.join(' ') : '';
  const name = normalizeText(place?.name);
  const source = `${name} ${types}`.toLowerCase();

  if (q.includes('farmacia')) {
    return source.includes('pharmacy') || source.includes('farmacia');
  }

  if (q.includes('parcheggio') || q.includes('parking')) {
    return source.includes('parking') || source.includes('parcheggio');
  }

  if (q.includes('benzina') || q.includes('distributore')) {
    return source.includes('gas_station') || source.includes('benzina') || source.includes('distributore');
  }

  if (q.includes('supermercato') || q.includes('alimentari')) {
    return (
      source.includes('supermarket') ||
      source.includes('grocery_or_supermarket') ||
      source.includes('supermercato') ||
      source.includes('alimentari') ||
      source.includes('market')
    );
  }

  if (q.includes('meccanico') || q.includes('officina')) {
    return source.includes('car_repair') || source.includes('meccanico') || source.includes('officina');
  }

  if (q.includes('banca') || q.includes('bancomat') || q.includes('atm')) {
    return source.includes('bank') || source.includes('atm') || source.includes('banca') || source.includes('bancomat');
  }

  if (q.includes('poste') || q.includes('ufficio postale')) {
    return source.includes('post_office') || source.includes('poste') || source.includes('postale');
  }

  return true;
}

function isBadPlaceForGenericSearch(place) {
  const types = Array.isArray(place?.types) ? place.types.join(' ') : '';
  const name = normalizeText(place?.name);
  const source = `${name} ${types}`.toLowerCase();

  const blocked = [
    'local_government_office',
    'city_hall',
    'courthouse',
    'police',
    'school',
    'primary_school',
    'secondary_school',
    'university',
    'political',
    'cemetery',
    'funeral_home',
  ];

  return containsAny(source, blocked);
}

function dedupePlaces(places) {
  const seen = new Set();

  return places.filter((place) => {
    const id = place.place_id || place.googlePlaceId;

    const lat =
      place?.geometry?.location?.lat !== undefined
        ? Number(place.geometry.location.lat).toFixed(5)
        : '';

    const lon =
      place?.geometry?.location?.lng !== undefined
        ? Number(place.geometry.location.lng).toFixed(5)
        : '';

    const key = id || `${normalizeText(place.name)}_${lat}_${lon}`;

    if (!key) return false;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function sortPlaces(places) {
  return [...places].sort((a, b) => {
    const aStatus = a.business_status === 'OPERATIONAL' ? 1 : 0;
    const bStatus = b.business_status === 'OPERATIONAL' ? 1 : 0;

    if (bStatus !== aStatus) return bStatus - aStatus;

    const aRating = Number(a.rating || 0);
    const bRating = Number(b.rating || 0);

    if (bRating !== aRating) return bRating - aRating;

    const aTotal = Number(a.user_ratings_total || 0);
    const bTotal = Number(b.user_ratings_total || 0);

    return bTotal - aTotal;
  });
}

function getSearchTypeFromQuery(query) {
  const q = normalizeText(query);

  if (q.includes('farmacia')) return 'pharmacy';
  if (q.includes('parcheggio') || q.includes('parking')) return 'parking';
  if (q.includes('benzina') || q.includes('distributore')) return 'gas_station';
  if (q.includes('supermercato') || q.includes('alimentari')) return 'supermarket';
  if (q.includes('banca')) return 'bank';
  if (q.includes('bancomat') || q.includes('atm')) return 'atm';
  if (q.includes('poste') || q.includes('postale')) return 'post_office';
  if (q.includes('meccanico') || q.includes('officina')) return 'car_repair';

  if (
    q.includes('ristorante') ||
    q.includes('ristoranti') ||
    q.includes('pizzeria') ||
    q.includes('pizza') ||
    q.includes('sushi') ||
    q.includes('mangiare') ||
    q.includes('pranzo') ||
    q.includes('cena')
  ) {
    return 'restaurant';
  }

  if (
    q.includes('bar') ||
    q.includes('caff') ||
    q.includes('colazione') ||
    q.includes('aperitivo')
  ) {
    return 'bar';
  }

  if (q.includes('museo')) return 'museum';
  if (q.includes('spiaggia') || q.includes('lido')) return 'tourist_attraction';
  if (q.includes('parco')) return 'park';
  if (q.includes('hotel') || q.includes('dormire')) return 'lodging';
  if (q.includes('spa') || q.includes('terme') || q.includes('benessere')) return 'spa';

  return '';
}

async function fetchGoogleTextSearch({
  apiKey,
  query,
  lat,
  lon,
  radiusMeters,
  openNowOnly,
}) {
  const params = new URLSearchParams();

  params.set('key', apiKey);
  params.set('query', query);
  params.set('location', `${lat},${lon}`);
  params.set('radius', String(radiusMeters));
  params.set('language', 'it');
  params.set('region', 'it');

  if (openNowOnly) {
    params.set('opennow', 'true');
  }

  const type = getSearchTypeFromQuery(query);
  if (type) {
    params.set('type', type);
  }

  const url = `${GOOGLE_PLACES_TEXT_SEARCH_URL}?${params.toString()}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error_message || 'Errore HTTP Google Places');
  }

  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || `Google Places status: ${data.status}`);
  }

  return Array.isArray(data.results) ? data.results : [];
}

async function fetchGoogleNearbySearch({
  apiKey,
  type,
  keyword,
  lat,
  lon,
  radiusMeters,
  openNowOnly,
}) {
  const params = new URLSearchParams();

  params.set('key', apiKey);
  params.set('location', `${lat},${lon}`);
  params.set('radius', String(radiusMeters));
  params.set('language', 'it');

  if (type) params.set('type', type);
  if (keyword) params.set('keyword', keyword);
  if (openNowOnly) params.set('opennow', 'true');

  const url = `${GOOGLE_PLACES_NEARBY_SEARCH_URL}?${params.toString()}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error_message || 'Errore HTTP Google Nearby Search');
  }

  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || `Google Places status: ${data.status}`);
  }

  return Array.isArray(data.results) ? data.results : [];
}

function buildQueries(query, locationName, mode) {
  const q = safeText(query);
  const loc = safeText(locationName, 'Lago di Garda');

  if (mode === 'food_open_now') {
    return [
      `ristoranti aperti ora ${loc}`,
      `bar aperti ora ${loc}`,
      `pizzerie aperte ora ${loc}`,
      `locali aperti ora ${loc}`,
    ];
  }

  if (!q) {
    return [
      `ristoranti ${loc}`,
      `bar ${loc}`,
      `pizzeria ${loc}`,
      `farmacia ${loc}`,
      `supermercato ${loc}`,
      `parcheggio ${loc}`,
      `spiaggia ${loc}`,
      `museo ${loc}`,
    ];
  }

  return [
    `${q} ${loc}`,
    q,
  ];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Metodo non consentito. Usa GET.',
      results: [],
    });
  }

  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'GOOGLE_PLACES_API_KEY non trovata su Vercel',
        status: 'MISSING_GOOGLE_PLACES_API_KEY',
        results: [],
      });
    }

    const {
      query = '',
      locationName = 'Lago di Garda',
      lat,
      lon,
      radiusKm = 10,
      mode = '',
      openNowOnly = '',
      strictOpenNow = '',
    } = req.query;

    const latitude = toNumber(lat, null);
    const longitude = toNumber(lon, null);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({
        error: 'Coordinate mancanti o non valide',
        status: 'INVALID_COORDINATES',
        results: [],
      });
    }

    const cleanQuery = safeText(query);
    const cleanLocationName = safeText(locationName, 'Lago di Garda');
    const cleanMode = safeText(mode);
    const radius = clampNumber(radiusKm, 1, 50, 10);
    const radiusMeters = Math.round(radius * 1000);

    const wantsOpenNow =
      openNowOnly === 'true' ||
      strictOpenNow === 'true' ||
      cleanMode === 'food_open_now';

    const queries = buildQueries(cleanQuery, cleanLocationName, cleanMode);

    let rawResults = [];

    for (const q of queries) {
      try {
        const partial = await fetchGoogleTextSearch({
          apiKey,
          query: q,
          lat: latitude,
          lon: longitude,
          radiusMeters,
          openNowOnly: wantsOpenNow,
        });

        rawResults = rawResults.concat(partial);
      } catch (e) {}
    }

    if (!rawResults.length) {
      const nearbyType = getSearchTypeFromQuery(cleanQuery || cleanMode);

      try {
        const partial = await fetchGoogleNearbySearch({
          apiKey,
          type: nearbyType,
          keyword: cleanQuery,
          lat: latitude,
          lon: longitude,
          radiusMeters,
          openNowOnly: wantsOpenNow,
        });

        rawResults = rawResults.concat(partial);
      } catch (e) {}
    }

    let cleaned = dedupePlaces(rawResults)
      .filter((place) => place && safeText(place.name))
      .filter((place) => place.business_status !== 'CLOSED_PERMANENTLY')
      .filter((place) => !isBadPlaceForGenericSearch(place));

    if (cleanMode === 'food_open_now') {
      cleaned = cleaned.filter((place) => {
        const opening = getOpeningStatus(place);

        if (!isStrictFoodPlace(place)) return false;
        if (opening.hasOpenNowData !== true) return false;
        if (opening.isOpenNow !== true) return false;
        if (place.business_status && place.business_status !== 'OPERATIONAL') return false;

        return true;
      });
    }

    if (cleanMode === 'service') {
      cleaned = cleaned.filter((place) => isServiceLike(place, cleanQuery));
    }

    if (strictOpenNow === 'true') {
      cleaned = cleaned.filter((place) => {
        const opening = getOpeningStatus(place);
        return opening.hasOpenNowData === true && opening.isOpenNow === true;
      });
    }

    cleaned = sortPlaces(cleaned)
      .slice(0, MAX_RESULTS)
      .map(buildGoogleResult);

    return res.status(200).json({
      status: cleaned.length ? 'OK' : 'ZERO_RESULTS',
      provider: 'Google Places',
      source: 'google_places',
      query: cleanQuery,
      locationName: cleanLocationName,
      radiusKm: radius,
      mode: cleanMode,
      openNowOnly: wantsOpenNow,
      count: cleaned.length,
      results: cleaned,
    });
  } catch (e) {
    return res.status(500).json({
      error: 'Errore server places-search',
      details: e?.message || String(e),
      results: [],
    });
  }
}
