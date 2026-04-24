export default async function handler(req, res) {
  try {
    const { placeId } = req.query;

    if (!placeId) {
      return res.status(400).json({ error: 'placeId mancante' });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY non trovata' });
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

    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=${encodeURIComponent(fields)}` +
      `&language=it` +
      `&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.status === 'REQUEST_DENIED') {
      return res.status(500).json({
        error: data.error_message || 'Errore Google Place Details',
        status: data.status,
      });
    }

    if (!data.result) {
      return res.status(404).json({
        error: 'Dettagli posto non trovati',
        status: data.status,
      });
    }

    const place = data.result;

    const photoReference =
      place.photos && place.photos[0] && place.photos[0].photo_reference
        ? place.photos[0].photo_reference
        : null;

    const photoUrl = photoReference
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(
          photoReference
        )}&key=${apiKey}`
      : '';

    const opening =
      place.current_opening_hours ||
      place.opening_hours ||
      null;

    const weekdayText =
      opening && Array.isArray(opening.weekday_text)
        ? opening.weekday_text
        : [];

    const isOpenNow =
      opening && typeof opening.open_now === 'boolean'
        ? opening.open_now
        : null;

    const openInfoText =
      isOpenNow === true
        ? 'Aperto ora'
        : isOpenNow === false
        ? 'Chiuso ora'
        : 'Orari da verificare';

    return res.status(200).json({
      googlePlaceId: place.place_id || placeId,
      name: place.name || '',
      address: place.formatted_address || '',
      phone:
        place.formatted_phone_number ||
        place.international_phone_number ||
        '',
      website: place.website || '',
      googleMapsUrl: place.url || '',
      rating: place.rating || 0,
      userRatingsTotal: place.user_ratings_total || 0,
      priceLevel: place.price_level,
      businessStatus: place.business_status || '',
      types: place.types || [],
      image: photoUrl,
      photoUrl,
      hours: weekdayText.length ? weekdayText.join('\n') : 'Orari non disponibili',
      weekdayText,
      isOpenNow,
      openInfoText,
      rawOpeningHours: opening,
      lat: place.geometry?.location?.lat || null,
      lon: place.geometry?.location?.lng || null,
    });
  } catch (e) {
    return res.status(500).json({
      error: 'Errore server place-details',
      details: e.message,
    });
  }
}