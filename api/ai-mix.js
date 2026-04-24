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

    if (!Array.isArray(places) || places.length === 0) {
      return res.status(400).json({
        error: 'Nessun posto disponibile per creare il mix',
      });
    }

    const placesText = places
      .slice(0, 15)
      .map((p, i) => {
        return `${i + 1}. ${p.name}
ID: ${p.id || ''}
Categoria: ${p.section || ''} / ${p.subcategory || ''}
Rating: ${p.rating || 'n/d'}
Distanza: ${p.distanceKm || 'n/d'} km
Aperto ora: ${p.isOpenNow ? 'sì' : 'da verificare'}
Indirizzo: ${p.address || 'n/d'}
Descrizione: ${p.description || 'n/d'}`;
      })
      .join('\n\n');

    const prompt = `
Crea un itinerario serio per Lake Finder.

Regole:
- Rispondi SOLO in JSON valido.
- Non usare markdown.
- Non inventare posti fuori dalla lista.
- Usa 3 o 4 tappe massimo.
- Ogni tappa deve avere time, title e reason.
- Il campo title deve essere tipo: "Prima tappa: Nome posto".
- Il campo reason deve spiegare perché ha senso andarci.
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
  "title": "Mix AI - titolo breve",
  "summary": "breve riassunto del piano",
  "usedIds": ["id1", "id2"],
  "steps": [
    {
      "time": "10:00 - 11:15",
      "title": "Prima tappa: Nome posto",
      "reason": "Motivo concreto della scelta."
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
        error: data?.error?.message || 'Errore AI Mix',
      });
    }

    const raw =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      data.output?.[0]?.content?.[0]?.value ||
      '';

    if (!raw) {
      return res.status(500).json({
        error: 'Risposta AI vuota',
        raw: data,
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        error: 'Risposta AI non valida',
        raw,
      });
    }

    const plan = {
      title: parsed.title || `Mix AI - ${locationName || 'Lago di Garda'}`,
      summary: parsed.summary || '',
      usedIds: Array.isArray(parsed.usedIds) ? parsed.usedIds : [],
      steps: Array.isArray(parsed.steps)
        ? parsed.steps.map((step, index) => ({
            time: step.time || `${10 + index}:00`,
            title: step.title || `Tappa ${index + 1}`,
            reason: step.reason || 'Scelto perché è adatto al piano.',
          }))
        : [],
    };

    if (!plan.steps.length) {
      return res.status(500).json({
        error: 'Piano AI senza tappe',
        raw: parsed,
      });
    }

    return res.status(200).json({
      plan,
    });
  } catch (e) {
    return res.status(500).json({
      error: 'Errore server AI Mix',
      details: e.message,
    });
  }
}