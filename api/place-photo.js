export default async function handler(req, res) {
  try {
    const { photoReference, maxwidth } = req.query;

    if (!photoReference) {
      return res.status(400).json({ error: 'photoReference mancante' });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY non trovata' });
    }

    const safeMaxWidth = Math.max(100, Math.min(Number(maxwidth || 900), 1600));

    const googleUrl =
      `https://maps.googleapis.com/maps/api/place/photo` +
      `?maxwidth=${safeMaxWidth}` +
      `&photo_reference=${encodeURIComponent(photoReference)}` +
      `&key=${apiKey}`;

    const response = await fetch(googleUrl);

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
