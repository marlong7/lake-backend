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

    const url =
      `https://maps.googleapis.com/maps/api/place/textsearch/json` +
      `?query=${encodeURIComponent(query + ' in ' + locationName)}` +
      `&location=${lat},${lon}` +
      `&radius=${Number(radiusKm || 10) * 1000}` +
      `&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'Errore server' });
  }
}
