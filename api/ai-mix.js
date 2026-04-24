function safeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text.length ? text : fallback;
}

function cleanText(value, fallback = '') {
  const text = safeText(value, fallback);
  const lower = text.toLowerCase();

  if (
    lower.includes('24 ore') ||
    lower.includes('24h') ||
    lower.includes('sempre aperto') ||
    lower.includes('aperto tutto il giorno')
  ) {
    return fallback || 'Orari da verificare prima di partire.';
  }

  return text;
}

function cleanReason(value) {
  const text = cleanText(
    value,
    'Scelto in base a distanza, categoria e qualità dei risultati disponibili.'
  );

  const lower = text.toLowerCase();

  if (
    lower.includes('orari') ||
    lower.includes('verificare') ||
    lower.includes('controlla')
  ) {
    return text;
  }

  return `${text} Orari da verificare prima di partire.`;
}

function normalizePlace(place) {
  return {
    id: safeText(place && place.id),
    name: safeText(place && place.name, 'Posto senza nome'),
    section: safeText(place && place.section),
    subcategory: safeText(place && place.subcategory),
    rating: place && place.rating ? place.rating : null,
    distanceKm: place && place.distanceKm !== undefined ? place.distanceKm : null,
    isOpenNow: typeof (place && place.isOpenNow) === 'boolean' ? place.isOpenNow : null,
    openInfoText: safeText(place && place.openInfoText, 'Orari da verificare'),
    address: safeText(place && place.address),
    description: safeText(place && place.description),
    town: safeText(place && place.town),
    price: safeText(place && place.price),
  };
}

function findPlaceById(id, places) {
  const cleanId = safeText(id);
  if (!cleanId) return null;

  return places.find((place) => safeText(place.id) === cleanId) || null;
}

function findPlaceByName(title, places) {
  const cleanTitle = safeText(title).toLowerCase();
  if (!cleanTitle) return null;

  return (
    places.find((place) => {
      const name = safeText(place.name).toLowerCase();
      return name && cleanTitle.includes(name);
    }) || null
  );
}

function pickFallbackPlaces(places) {
  const safePlaces = Array.isArray(places) ? places.filter(Boolean) : [];

  const byRatingDistance = [...safePlaces].sort((a, b) => {
    const ratingA = Number(a.rating || 0);
    const ratingB = Number(b.rating || 0);
    const distanceA = Number.isFinite(Number(a.distanceKm)) ? Number(a.distanceKm) : 999;
    const distanceB = Number.isFinite(Number(b.distanceKm)) ? Number(b.distanceKm) : 999;

    if (ratingB !== ratingA) return ratingB - ratingA;
    return distanceA - distanceB;
  });

  const used = new Set();

  const pickBySection = (section) => {
    const found =
      byRatingDistance.find((place) => {
        if (!place || used.has(place.id)) return false;
        if (!section) return true;
        return safeText(place.section).toLowerCase() === section.toLowerCase();
      }) || null;

    if (found && found.id) used.add(found.id);
    return found;
  };

  return {
    morning: pickBySection('Svago') || pickBySection(null),
    lunch: pickBySection('Mangiare') || pickBySection(null),
    afternoon: pickBySection('Negozi') || pickBySection('Svago') || pickBySection(null),
    evening: pickBySection('Mangiare') || pickBySection(null),
  };
}

function buildSafeFallbackPlan(locationName, places) {
  const picked = pickFallbackPlaces(places);
  const steps = [];

  const add = (time, label, place, backupTitle) => {
    if (!place) {
      steps.push({
        time,
        title: backupTitle,
        reason: 'Tappa indicativa. Servono più risultati reali per una scelta precisa. Orari da verificare prima di partire.',
        placeId: null,
      });
      return;
    }

    steps.push({
      time,
      title: `${label}: ${place.name}`,
      reason: `Scelto perché è coerente con la fascia oraria e con i risultati disponibili. Rating ${place.rating || 'n/d'}, distanza ${
        place.distanceKm !== null && place.distanceKm !== undefined ? place.distanceKm + ' km' : 'da verificare'
      }. Orari da verificare prima di partire.`,
      placeId: place.id || null,
    });
  };

  steps.push({
    time: '08:30 - 09:00',
    title: `Partenza - ${locationName || 'Lago di Garda'}`,
    reason: 'Inizio giornata. Controlla meteo, traffico, parcheggi e orari reali prima di partire.',
    placeId: null,
  });

  add('09:30 - 11:30', 'Mattina', picked.morning, 'Mattina: attività o passeggiata');
  add('12:30 - 14:00', 'Pranzo', picked.lunch, 'Pranzo: posto da scegliere');
  add('15:30 - 17:30', 'Pomeriggio', picked.afternoon, 'Pomeriggio: attività o visita');
  add('19:00 - 20:30', 'Sera', picked.evening, 'Sera: cena o aperitivo');

  steps.push({
    time: '21:00 - 21:30',
    title: 'Rientro',
    reason: 'Fine giornata. Verifica strada, parcheggi e tempi di rientro.',
    placeId: null,
  });

  return {
    title: `Mix AI - ${locationName || 'Lago di Garda'}`,
    summary: 'Giornata completa indicativa con mattina, pranzo, pomeriggio e sera.',
    usedIds: steps.map((step) => step.placeId).filter(Boolean),
    steps,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Metodo non consentito' });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    const {
      locationName,
      prefs = {},
      places = [],
      currentTime,
      instruction,
    } = req.body || {};

    if (!Array.isArray(places) || places.length === 0) {
      return res.status(400).json({
        error: 'Nessun posto disponibile per creare il mix',
      });
    }

    const normalizedPlaces = places.slice(0, 15).map(normalizePlace);

    if (!apiKey) {
      return res.status(200).json({
        plan: buildSafeFallbackPlan(locationName, normalizedPlaces),
      });
    }

    const placesText = normalizedPlaces
      .map((p, i) => {
        const openText =
          p.isOpenNow === true
            ? 'aperto ora secondo i dati disponibili, ma orari da verificare'
            : 'orari da verificare';

        return `${i + 1}. ${p.name}
ID: ${p.id}
Categoria: ${p.section} / ${p.subcategory}
Rating: ${p.rating || 'n/d'}
Distanza: ${p.distanceKm !== null && p.distanceKm !== undefined ? p.distanceKm : 'n/d'} km
Stato orari: ${openText}
Indirizzo: ${p.address || 'n/d'}
Descrizione: ${p.description || 'n/d'}`;
      })
      .join('\n\n');

    const prompt = `
Crea un itinerario serio per Lake Finder.

Regole obbligatorie:
- Rispondi SOLO in JSON valido.
- Non usare markdown.
- Non inventare posti fuori dalla lista.
- Devi creare una giornata completa: partenza, mattina, pranzo, pomeriggio, sera, rientro.
- Usa 5 o 6 tappe.
- Ogni tappa deve avere time, title, reason e placeId.
- Ogni tappa collegata a un posto deve usare placeId esatto dalla lista.
- Le tappe senza posto reale, come partenza o rientro, devono avere placeId null.
- Non scrivere mai "aperto 24 ore", "24h", "sempre aperto" o "aperto tutto il giorno".
- Se non sei sicuro degli orari, scrivi "orari da verificare".
- Non dire che un posto è aperto se il dato non è chiarissimo.
- Il piano deve partire dalla mattina, non dalla sera.
- Usa orari realistici:
  - partenza circa 08:30
  - mattina circa 09:30-11:30
  - pranzo circa 12:30-14:00
  - pomeriggio circa 15:30-17:30
  - sera circa 19:00-20:30
  - rientro circa 21:00
- Considera distanza, rating, categoria e preferenze.
- Se un posto non è collegabile a una fascia oraria, scegline un altro.
- Non inventare eventi.

Istruzione extra dal frontend:
${safeText(instruction, 'Nessuna')}

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
      "time": "08:30 - 09:00",
      "title": "Partenza - Nome località",
      "reason": "Motivo concreto. Orari da verificare prima di partire.",
      "placeId": null
    },
    {
      "time": "09:30 - 11:30",
      "title": "Mattina: Nome posto",
      "reason": "Motivo concreto. Orari da verificare prima di partire.",
      "placeId": "id-esatto"
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
        temperature: 0.2,
        max_output_tokens: 1200,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(200).json({
        plan: buildSafeFallbackPlan(locationName, normalizedPlaces),
        fallbackReason: data?.error?.message || 'Errore AI Mix',
      });
    }

    const raw =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      data.output?.[0]?.content?.[0]?.value ||
      '';

    if (!raw) {
      return res.status(200).json({
        plan: buildSafeFallbackPlan(locationName, normalizedPlaces),
        fallbackReason: 'Risposta AI vuota',
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(200).json({
        plan: buildSafeFallbackPlan(locationName, normalizedPlaces),
        fallbackReason: 'Risposta AI non valida',
      });
    }

    const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];

    const cleanedSteps = rawSteps
      .slice(0, 6)
      .map((step, index) => {
        const stepPlace =
          findPlaceById(step.placeId, normalizedPlaces) ||
          findPlaceByName(step.title, normalizedPlaces);

        const placeId = stepPlace ? stepPlace.id : null;

        const fallbackTimes = [
          '08:30 - 09:00',
          '09:30 - 11:30',
          '12:30 - 14:00',
          '15:30 - 17:30',
          '19:00 - 20:30',
          '21:00 - 21:30',
        ];

        return {
          time: cleanText(step.time, fallbackTimes[index] || 'Orario da definire'),
          title: cleanText(step.title, `Tappa ${index + 1}`),
          reason: cleanReason(step.reason),
          placeId,
        };
      });

    const hasMorning = cleanedSteps.some((step) => {
      const time = safeText(step.time).toLowerCase();
      return time.includes('08:') || time.includes('09:') || time.includes('10:') || time.includes('11:');
    });

    const hasEveningOnly =
      cleanedSteps.length > 0 &&
      cleanedSteps.every((step) => {
        const time = safeText(step.time).toLowerCase();
        return time.includes('19:') || time.includes('20:') || time.includes('21:');
      });

    if (!cleanedSteps.length || !hasMorning || hasEveningOnly) {
      return res.status(200).json({
        plan: buildSafeFallbackPlan(locationName, normalizedPlaces),
        fallbackReason: 'Piano AI incompleto o non giornaliero',
      });
    }

    const usedIds = [
      ...(Array.isArray(parsed.usedIds) ? parsed.usedIds : []),
      ...cleanedSteps.map((step) => step.placeId).filter(Boolean),
    ].filter((id, index, arr) => id && arr.indexOf(id) === index);

    const plan = {
      title: cleanText(parsed.title, `Mix AI - ${locationName || 'Lago di Garda'}`),
      summary: cleanText(
        parsed.summary,
        'Giornata completa indicativa con mattina, pranzo, pomeriggio e sera.'
      ),
      usedIds,
      steps: cleanedSteps,
    };

    return res.status(200).json({
      plan,
    });
  } catch (e) {
    return res.status(200).json({
      plan: buildSafeFallbackPlan(req.body?.locationName, req.body?.places || []),
      fallbackReason: e.message || 'Errore server AI Mix',
    });
  }
}
