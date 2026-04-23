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

    const radiusMeters = Math.max(1000, Math.min(Number(radiusKm || 10) * 1000, 50000));

    const url =
      `https://maps.googleapis.com/maps/api/place/textsearch/json` +
      `?query=${encodeURIComponent(query + ' in ' + locationName)}` +
      `&location=${lat},${lon}` +
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

    const results = Array.isArray(data.results)
      ? data.results.map((place) => {
          const photoReference =
            place.photos && place.photos[0] && place.photos[0].photo_reference
              ? place.photos[0].photo_reference
              : null;

          const photoUrl = photoReference
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=900&photo_reference=${encodeURIComponent(
                photoReference
              )}&key=${apiKey}`
            : '';

          return {
            ...place,
            photoUrl,
            image: photoUrl,
          };
        })
      : [];

    return res.status(200).json({
      ...data,
      results,
    });
  } catch (e) {
    return res.status(500).json({
      error: 'Errore server',
      details: e.message,
    });
  }
}