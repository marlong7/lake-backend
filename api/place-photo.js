export default async function handler(req, res) {
  try {
    const photoReference = String(
      req.query.photoReference ||
      req.query.photo_reference ||
      req.query.photoreference ||
      ''
    ).trim();

    const maxwidth = Math.max(100, Math.min(Number(req.query.maxwidth || 1200), 1600));

    if (!photoReference) {
      return res.status(400).json({ error: 'photoReference mancante' });
    }

    const apiKey =
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY non trovata' });
    }

    const params = new URLSearchParams({
      maxwidth: String(maxwidth),
      photo_reference: photoReference,
      key: apiKey,
    });

    const googleUrl = `https://maps.googleapis.com/maps/api/place/photo?${params.toString()}`;

    const response = await fetch(googleUrl, { redirect: 'follow' });

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Errore Google Place Photo',
        status: response.status,
      });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800');

    return res.status(200).send(buffer);
  } catch (e) {
    return res.status(500).json({
      error: 'Errore server place-photo',
      details: e.message,
    });
  }
}
