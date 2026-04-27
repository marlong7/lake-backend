export default async function handler(req, res) {
  try {
    const { placeId } = req.query;

    if (!placeId) {
      return res.status(400).json({
        error: 'placeId mancante',
      });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'GOOGLE_PLACES_API_KEY non trovata',
      });
    }

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

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Errore HTTP Google Place Details',
        status: response.status,
        details: data,
      });
    }

    if (data.status === 'REQUEST_DENIED') {
      return res.status(500).json({
        error: 'Richiesta Google rifiutata. Controlla GOOGLE_PLACES_API_KEY, billing e API attive.',
        googleStatus: data.status,
        details: data.error_message || data,
      });
    }

    if (data.status === 'INVALID_REQUEST') {
      return res.status(400).json({
        error: 'Richiesta non valida a Google Place Details.',
        googleStatus: data.status,
        details: data.error_message || data,
      });
    }

    if (data.status === 'NOT_FOUND' || data.status === 'ZERO_RESULTS') {
      return res.status(404).json({
        error: 'Place non trovato.',
        googleStatus: data.status,
      });
    }

    if (data.status && data.status !== 'OK') {
      return res.status(500).json({
        error: 'Errore Google Place Details',
        googleStatus: data.status,
        details: data.error_message || data,
      });
    }

    const place = data.result;

    if (!place) {
      return res.status(404).json({
        error: 'Dettagli posto non disponibili.',
      });
    }

    const opening = place.current_opening_hours || place.opening_hours || null;

    const hasOpenNowData =
      !!opening && typeof opening.open_now === 'boolean';

    const isOpenNow = hasOpenNowData ? opening.open_now === true : false;

    const weekdayText =
      opening && Array.isArray(opening.weekday_text)
        ? opening.weekday_text
        : [];

    const photoReference =
      place.photos && place.photos[0] && place.photos[0].photo_reference
        ? place.photos[0].photo_reference
        : '';

    const photoUrl = photoReference
      ? `/api/place-photo?photoReference=${encodeURIComponent(photoReference)}&maxwidth=1200`
      : '';

    const lat =
      place.geometry &&
      place.geometry.location &&
      place.geometry.location.lat != null
        ? Number(place.geometry.location.lat)
        : null;

    const lon =
      place.geometry &&
      place.geometry.location &&
      place.geometry.location.lng != null
        ? Number(place.geometry.location.lng)
        : null;

    return res.status(200).json({
      status: 'OK',

      place_id: place.place_id || placeId,
      googlePlaceId: place.place_id || placeId,

      name: place.name || '',
      address: place.formatted_address || '',
      formatted_address: place.formatted_address || '',

      phone:
        place.formatted_phone_number ||
        place.international_phone_number ||
        '',

      formatted_phone_number: place.formatted_phone_number || '',
      international_phone_number: place.international_phone_number || '',

      website: place.website || '',
      googleMapsUrl: place.url || '',
      url: place.url || '',

      rating: Number(place.rating || 0),
      userRatingsTotal: Number(place.user_ratings_total || 0),
      user_ratings_total: Number(place.user_ratings_total || 0),

      priceLevel:
        place.price_level !== undefined && place.price_level !== null
          ? place.price_level
          : null,

      price_level:
        place.price_level !== undefined && place.price_level !== null
          ? place.price_level
          : null,

      businessStatus: place.business_status || '',
      business_status: place.business_status || '',

      types: Array.isArray(place.types) ? place.types : [],

      opening_hours: place.opening_hours || null,
      current_opening_hours: place.current_opening_hours || null,
      rawOpeningHours: opening,

      hasOpenNowData,
      isOpenNow,

      openInfoText: hasOpenNowData
        ? isOpenNow
          ? 'Aperto ora'
          : 'Chiuso ora'
        : 'Orari da verificare',

      weekdayText,
      hours: weekdayText.length
        ? weekdayText.join('\n')
        : 'Orari non disponibili. Chiama o controlla su Google Maps prima di andare.',

      photoReference,
      photoUrl,
      image: photoUrl,

      lat,
      lon,

      geometry: place.geometry || null,
    });
  } catch (e) {
    return res.status(500).json({
      error: 'Errore server place-details',
      details: e.message,
    });
  }
}
