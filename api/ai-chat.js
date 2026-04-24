export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Metodo non consentito' });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY non trovata' });
    }

    const { message, locationName, places = [] } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: 'Messaggio mancante' });
    }

    const placesText = places
      .slice(0, 8)
      .map((p, i) => {
        return `${i + 1}. ${p.name} - ${p.subcategory || p.section || ''} - rating ${p.rating || 'n/d'} - distanza ${p.distanceKm || 'n/d'} km - ${p.address || ''}`;
      })
      .join('\n');

    const prompt = `
Sei il bot di Lake Finder.
Aiuti turisti e utenti sul Lago di Garda.
Rispondi in italiano, breve ma utile.
Non inventare posti se non ci sono nei dati.
Se i dati sono pochi, di' che servono più risultati.

Località attuale: ${locationName || 'Lago di Garda'}

Posti disponibili:
${placesText || 'Nessun posto disponibile'}

Domanda utente:
${message}
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
        temperature: 0.5,
        max_output_tokens: 450,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: data.error?.message || 'Errore AI',
      });
    }

    const answer =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      'Non riesco a generare una risposta ora.';

    return res.status(200).json({ answer });
  } catch (e) {
    return res.status(500).json({
      error: 'Errore server AI',
      details: e.message,
    });
  }
}