export default async function handler(req, res) {
  try {
    const {
      query,
      locationName,
      lat,
      lon,
      radiusKm,
      mode,
      openNowOnly,
      strictOpenNow,
    } = req.query;

    if (!query || !locationName || !lat || !lon) {
      return res.status(400).json({ error: 'Parametri mancanti' });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Chiave non trovata' });
    }

    const latitude = Number(lat);
    const longitude = Number(lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ error: 'Coordinate non valide' });
    }

    const cleanQuery = String(query).trim();
    const cleanLocationName = String(locationName).trim();

    const radiusMeters = Math.max(
      1000,
      Math.min(Number(radiusKm || 10) * 1000, 50000)
    );

    const cleanMode = String(mode || '').trim();

    const mustBeOpenNow =
      cleanMode === 'food_open_now' ||
      String(openNowOnly) === 'true' ||
      String(strictOpenNow) === 'true';

    const FOOD_TYPES = [
      'restaurant',
      'bar',
      'cafe',
      'meal_takeaway',
    ];

    const SERVICE_TYPE_MAP = {
      farmacia: 'pharmacy',
      pharmacy: 'pharmacy',

      parcheggio: 'parking',
      parking: 'parking',

      benzina: 'gas_station',
      distributore: 'gas_station',
      gas_station: 'gas_station',

      supermercato: 'supermarket',
      supermarket: 'supermarket',

      bancomat: 'atm',
      atm: 'atm',

      banca: 'bank',
      bank: 'bank',

      ospedale: 'hospital',
      hospital: 'hospital',

      medico: 'doctor',
      doctor: 'doctor',

      meccanico: 'car_repair',
      officina: 'car_repair',
      car_repair: 'car_repair',
    };

    function safeText(value, fallback = '') {
      if (value === null || value === undefined) return fallback;
      const text = String(value).trim();
      return text.length ? text : fallback;
    }

    function normalize(value) {
      return safeText(value).toLowerCase();
    }

    function containsAny(source, words) {
      return words.some((word) => source.includes(word));
    }

    function getWantedServiceType(value) {
      const q = normalize(value);

      const keys = Object.keys(SERVICE_TYPE_MAP);

      for (const key of keys) {
        if (q.includes(key)) {
          return SERVICE_TYPE_MAP[key];
        }
      }

      return null;
    }

    function isFoodPlace(place) {
      const types = Array.isArray(place.types) ? place.types : [];
      const name = normalize(place.name);
      const typeText = types.join(' ').toLowerCase();

      const source = `${name} ${typeText}`;

      const hasFoodType = types.some((type) => FOOD_TYPES.includes(type));

      const hasFoodName = containsAny(source, [
        'ristorante',
        'restaurant',
        'trattoria',
        'osteria',
        'pizzeria',
        'pizza',
        'bar',
        'cafe',
        'caffè',
        'caffe',
        'bistrot',
        'bistro',
        'pub',
        'paninoteca',
        'kebab',
        'hamburger',
        'takeaway',
        'tavola calda',
      ]);

      const blocked = containsAny(source, [
        'clothing_store',
        'shoe_store',
        'store',
        'shopping_mall',
        'supermarket',
        'grocery',
        'pharmacy',
        'hospital',
        'doctor',
        'parking',
        'gas_station',
        'lodging',
        'hotel',
        'church',
        'museum',
        'tourist_attraction',
        'park',
        'beach',
        'real_estate',
        'car_repair',
        'bank',
        'atm',
        'post_office',
      ]);

      return (hasFoodType || hasFoodName) && !blocked;
    }

    function isOperational(place) {
      return place.business_status === 'OPERATIONAL';
    }

    function getOpening(place) {
      return place.current_opening_hours || place.opening_hours || null;
    }

    function hasConfirmedOpenNow(place) {
      const opening = getOpening(place);
      return !!opening && opening.open_now === true;
    }

    async function fetchPlaceDetails(placeId) {
      const fields = [
        'place_id',
        'name',
        'formatted_address',
        'formatted_phone_number',
        'international_phone_number',
        'website',
        'url',
        'rating',
        'user_ratings_total',
        'price_level',
        'business_status',
        'opening_hours',
        'current_opening_hours',
        'photos',
        'types',
        'geometry',
      ].join(',');

      const detailsUrl =
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${encodeURIComponent(placeId)}` +
        `&fields=${encodeURIComponent(fields)}` +
        `&language=it` +
        `&key=${apiKey}`;

      const response = await fetch(detailsUrl);
      const data = await response.json();

      if (!response.ok || data.status === 'REQUEST_DENIED') {
        return null;
      }

      if (!data.result) {
        return null;
      }

      return data.result;
    }

    function mapPlaceToResult(place) {
      const photoReference =
        place.photos && place.photos[0] && place.photos[0].photo_reference
          ? place.photos[0].photo_reference
          : '';

      const photoUrl = photoReference
        ? `/api/place-photo?photoReference=${encodeURIComponent(
            photoReference
          )}&maxwidth=900`
        : '';

      const opening = getOpening(place);

      const hasOpenNowData =
        !!opening && typeof opening.open_now === 'boolean';

      const isOpenNow = hasOpenNowData ? opening.open_now === true : false;

      const latValue =
        place.geometry &&
        place.geometry.location &&
        place.geometry.location.lat != null
          ? place.geometry.location.lat
          : null;

      const lonValue =
        place.geometry &&
        place.geometry.location &&
        place.geometry.location.lng != null
          ? place.geometry.location.lng
          : null;

      return {
        place_id: place.place_id || '',
        googlePlaceId: place.place_id || '',

        name: place.name || '',

        formatted_address: place.formatted_address || '',
        address: place.formatted_address || '',

        geometry: place.geometry || null,
        lat: latValue,
        lon: lonValue,

        rating: Number(place.rating || 0),
        user_ratings_total: Number(place.user_ratings_total || 0),
        userRatingsTotal: Number(place.user_ratings_total || 0),

        price_level:
          place.price_level !== undefined && place.price_level !== null
            ? place.price_level
            : null,

        types: Array.isArray(place.types) ? place.types : [],

        business_status: place.business_status || '',
        businessStatus: place.business_status || '',

        opening_hours: opening,
        current_opening_hours: place.current_opening_hours || null,

        isOpenNow,
        hasOpenNowData,

        openInfoText: hasOpenNowData
          ? isOpenNow
            ? 'Aperto ora'
            : 'Chiuso ora'
          : 'Orari da verificare',

        phone:
          place.formatted_phone_number ||
          place.international_phone_number ||
          '',

        website: place.website || '',
        googleMapsUrl: place.url || '',

        photoReference,
        photoUrl,
        image: photoUrl,

        description:
          place.formatted_address ||
          'Risultato trovato tramite Google Places.',
      };
    }

    function dedupeByPlaceId(items) {
      const seen = new Set();

      return items.filter((item) => {
        const key = item.place_id || `${item.name}_${item.formatted_address}`;

        if (!key) return false;
        if (seen.has(key)) return false;

        seen.add(key);
        return true;
      });
    }

    async function runTextSearch({
      searchQuery,
      type,
      forceOpenNow,
    }) {
      const params = new URLSearchParams();

      params.set('query', searchQuery);
      params.set('location', `${latitude},${longitude}`);
      params.set('radius', String(radiusMeters));
      params.set('language', 'it');
      params.set('key', apiKey);

      if (type) {
        params.set('type', type);
      }

      if (forceOpenNow) {
        params.set('opennow', 'true');
      }

      const url =
        `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || data.status === 'REQUEST_DENIED') {
        throw new Error(data.error_message || 'Errore Google Places');
      }

      if (data.status === 'ZERO_RESULTS') {
        return [];
      }

      if (data.status && data.status !== 'OK') {
        throw new Error(data.error_message || 'Errore Google Places');
      }

      return Array.isArray(data.results) ? data.results : [];
    }

    let rawResults = [];

    if (cleanMode === 'food_open_now') {
      const foodQueries = [
        `ristorante ${cleanLocationName}`,
        `bar ${cleanLocationName}`,
        `cafe ${cleanLocationName}`,
        `pizzeria ${cleanLocationName}`,
      ];

      for (const foodQuery of foodQueries) {
        for (const foodType of FOOD_TYPES) {
          const partial = await runTextSearch({
            searchQuery: foodQuery,
            type: foodType,
            forceOpenNow: true,
          });

          rawResults = rawResults.concat(partial);
        }
      }
    } else if (cleanMode === 'service') {
      const wantedType = getWantedServiceType(cleanQuery);

      const partial = await runTextSearch({
        searchQuery: `${cleanQuery} ${cleanLocationName}`,
        type: wantedType,
        forceOpenNow: mustBeOpenNow,
      });

      rawResults = rawResults.concat(partial);
    } else {
      const partial = await runTextSearch({
        searchQuery: `${cleanQuery} ${cleanLocationName}`,
        type: null,
        forceOpenNow: mustBeOpenNow,
      });

      rawResults = rawResults.concat(partial);
    }

    rawResults = dedupeByPlaceId(rawResults).slice(0, 20);

    const checkedResults = [];

    for (const place of rawResults) {
      if (!place.place_id) continue;

      const details = await fetchPlaceDetails(place.place_id);

      if (!details) continue;

      if (!isOperational(details)) continue;

      if (cleanMode === 'food_open_now') {
        if (!isFoodPlace(details)) continue;
        if (!hasConfirmedOpenNow(details)) continue;
      }

      if (mustBeOpenNow && !hasConfirmedOpenNow(details)) {
        continue;
      }

      checkedResults.push(details);

      if (cleanMode === 'food_open_now' && checkedResults.length >= 10) {
        break;
      }

      if (cleanMode === 'service' && checkedResults.length >= 15) {
        break;
      }

      if (checkedResults.length >= 15) {
        break;
      }
    }

    const results = checkedResults.map(mapPlaceToResult);

    if (!results.length) {
      return res.status(200).json({
        status: 'ZERO_RESULTS',
        query: cleanQuery,
        locationName: cleanLocationName,
        radiusMeters,
        mode: cleanMode || 'default',
        strictOpenNow: mustBeOpenNow,
        count: 0,
        results: [],
        message:
          cleanMode === 'food_open_now'
            ? 'Non trovo bar o ristoranti sicuramente aperti adesso vicino a te.'
            : 'Nessun risultato verificato trovato.',
      });
    }

    return res.status(200).json({
      status: 'OK',
      query: cleanQuery,
      locationName: cleanLocationName,
      radiusMeters,
      mode: cleanMode || 'default',
      strictOpenNow: mustBeOpenNow,
      count: results.length,
      results,
    });
  } catch (e) {
    return res.status(500).json({
      error: 'Errore server',
      details: e.message,
    });
  }
}
