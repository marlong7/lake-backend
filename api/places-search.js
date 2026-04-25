export default async function handler(req, res) {
  try {
    const { query, locationName, lat, lon, radiusKm } = req.query;

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

    const url =
      `https://maps.googleapis.com/maps/api/place/textsearch/json` +
      `?query=${encodeURIComponent(`${cleanQuery} ${cleanLocationName}`)}` +
      `&location=${latitude},${longitude}` +
      `&radius=${radiusMeters}` +
      `&language=it` +
      `&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.status === 'REQUEST_DENIED') {
      return res.status(500).json({
        error: data.error_message || 'Errore Google Places',
        status: data.status,
      });
    }

    if (data.status === 'ZERO_RESULTS') {
      return res.status(200).json({
        status: 'ZERO_RESULTS',
        query: cleanQuery,
        locationName: cleanLocationName,
        radiusMeters,
        count: 0,
        results: [],
      });
    }

    if (data.status && data.status !== 'OK') {
      return res.status(500).json({
        error: data.error_message || 'Errore Google Places',
        status: data.status,
      });
    }

    const rawResults = Array.isArray(data.results) ? data.results : [];

    const results = rawResults.slice(0, 15).map((place) => {
      const photoReference =
        place.photos && place.photos[0] && place.photos[0].photo_reference
          ? place.photos[0].photo_reference
          : '';

      const photoUrl = photoReference
        ? `/api/place-photo?photoReference=${encodeURIComponent(photoReference)}&maxwidth=900`
        : '';

      const opening = place.opening_hours || null;
      const hasOpenNowData = !!opening && typeof opening.open_now === 'boolean';

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
        isOpenNow: hasOpenNowData ? opening.open_now === true : false,
        hasOpenNowData,
        openInfoText: hasOpenNowData
          ? opening.open_now
            ? 'Aperto ora'
            : 'Chiuso ora'
          : 'Orari da verificare',
        photoReference,
        photoUrl,
        image: photoUrl,
        description:
          place.formatted_address ||
          'Risultato trovato tramite Google Places.',
      };
    });

    return res.status(200).json({
      status: data.status || 'OK',
      query: cleanQuery,
      locationName: cleanLocationName,
      radiusMeters,
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
