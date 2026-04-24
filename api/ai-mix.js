export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Metodo non consentito' });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY non trovata' });
    }

    const {
      locationName,
      prefs = {},
      places = [],
      currentTime,
    } = req.body || {};

    if (!places.length) {
      return res.status(400).json({ error: 'Nessun posto disponibile per creare il mix' });
    }

    const placesText = places
      .slice(0, 15)
      .map((p, i) => {
        return `${i + 1}. ${p.name}
Categoria: ${p.section || ''} / ${p.subcategory || ''}
Rating: ${p.rating || 'n/d'}
Distanza: ${p.distanceKm || 'n/d'} km
Aperto ora: ${p.isOpenNow ? 'sì' : 'da verificare'}
Indirizzo: ${p.address || 'n/d'}`;
      })
      .join('\n\n');

    const prompt = `
Crea un itinerario serio per Lake Finder.

Regole:
- Rispondi SOLO in JSON valido.
- Non inventare posti fuori dalla lista.
- Usa 3 o 4 tappe massimo.
- Ogni tappa deve avere orario, nome posto, motivo concreto, durata stimata.
- Deve sembrare un piano turistico reale, non generico.
- Considera distanza, rating, apertura, categoria e preferenze.
- Se ci sono pochi dati, crea comunque il piano migliore possibile.

Località: ${locationName || 'Lago di Garda'}
Ora attuale: ${currentTime || 'adesso'}

Preferenze:
${JSON.stringify(prefs, null, 2)}

Posti disponibili:
${placesText}

Formato JSON obbligatorio:
{
  "title": "string",
  "summary": "string",
  "steps": [
    {
      "time": "string",
      "title": "string",
      "placeName": "string",
      "reason": "string",
      "duration": "string"
    }
  ]
}
`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: prompt,
        temperature: 0.4,
        max_output_tokens: 900,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: data.error?.message || 'Errore AI Mix',
      });
    }

    const raw =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      '';

    let plan;

    try {
      plan = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        error: 'Risposta AI non valida',
        raw,
      });
    }

    return res.status(200).json(plan);
  } catch (e) {
    return res.status(500).json({
      error: 'Errore server AI Mix',
      details: e.message,
    });
  }
}