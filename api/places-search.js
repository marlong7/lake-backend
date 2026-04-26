function toIsoNoMs(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function getDateRange(whenMode = 'week') {
  const now = new Date();
  const end = new Date(now);

  if (whenMode === 'today') {
    end.setHours(23, 59, 59, 999);
  } else if (whenMode === 'week') {
    end.setDate(end.getDate() + 7);
  } else if (whenMode === 'month') {
    end.setDate(end.getDate() + 30);
  } else {
    end.setDate(end.getDate() + 7);
  }

  return {
    startDateTime: toIsoNoMs(now),
    endDateTime: toIsoNoMs(end),
  };
}

function pickBestImage(images = []) {
  if (!Array.isArray(images) || !images.length) return '';

  const sorted = [...images].sort((a, b) => {
    const aw = Number(a.width || 0);
    const bw = Number(b.width || 0);
    return bw - aw;
  });

  return sorted[0]?.url || '';
}

function getVenue(event) {
  const venues = event?._embedded?.venues;
  if (!Array.isArray(venues) || !venues.length) return null;
  return venues[0];
}

function normalizeEvent(event) {
  const venue = getVenue(event);
  const localDate = event?.dates?.start?.localDate || '';
  const localTime = event?.dates?.start?.localTime || '';
  const dateTime = event?.dates?.start?.dateTime || '';

  const image = pickBestImage(event?.images);

  const url = event?.url || '';

  return {
    id: event?.id || '',
    title: event?.name || '',
    name: event?.name || '',
    provider: 'Ticketmaster',
    source: 'Ticketmaster',
    image,
    url,
    ticketUrl: url,
    date: localDate,
    time: localTime,
    dateTime,
    location: venue?.city?.name || '',
    venueName: venue?.name || '',
    address: venue?.address?.line1 || '',
    country: venue?.country?.countryCode || '',
    lat:
      venue?.location?.latitude !== undefined
        ? Number(venue.location.latitude)
        : null,
    lon:
      venue?.location?.longitude !== undefined
        ? Number(venue.location.longitude)
        : null,
    status: event?.dates?.status?.code || '',
    info: event?.info || '',
    description: event?.pleaseNote || event?.info || 'Evento trovato tramite Ticketmaster.',
    isBookable: Boolean(url),
  };
}

function isValidFutureBookableEvent(event) {
  if (!event) return false;
  if (!event.title) return false;
  if (!event.url) return false;
  if (!event.image) return false;
  if (!event.date && !event.dateTime) return false;

  if (event.dateTime) {
    const eventDate = new Date(event.dateTime);
    if (Number.isFinite(eventDate.getTime()) && eventDate < new Date()) {
      return false;
    }
  } else if (event.date) {
    const eventDate = new Date(`${event.date}T23:59:59`);
    if (Number.isFinite(eventDate.getTime()) && eventDate < new Date()) {
      return false;
    }
  }

  const badStatuses = ['cancelled', 'canceled', 'offsale'];
  if (badStatuses.includes(String(event.status || '').toLowerCase())) {
    return false;
  }

  return true;
}

export default async function handler(req, res) {
  try {
    const {
      query = '',
      locationName = 'Lago di Garda',
      lat,
      lon,
      radiusKm = 50,
      whenMode = 'week',
    } = req.query;

    const apiKey = process.env.TICKETMASTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'TICKETMASTER_API_KEY non trovata su Vercel',
      });
    }

    const latitude = Number(lat);
    const longitude = Number(lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({
        error: 'Coordinate mancanti o non valide',
      });
    }

    const cleanQuery = String(query || '').trim();
    const cleanLocationName = String(locationName || 'Lago di Garda').trim();

    const radius = Math.max(1, Math.min(Number(radiusKm || 50), 100));
    const { startDateTime, endDateTime } = getDateRange(whenMode);

    const params = new URLSearchParams({
      apikey: apiKey,
      countryCode: 'IT',
      latlong: `${latitude},${longitude}`,
      radius: String(radius),
      unit: 'km',
      size: '20',
      sort: 'date,asc',
      startDateTime,
      endDateTime,
      locale: 'it-it',
    });

    if (cleanQuery) {
      params.set('keyword', cleanQuery);
    }

    const url = `https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: data?.fault?.faultstring || data?.message || 'Errore Ticketmaster',
        details: data,
      });
    }

    const rawEvents = Array.isArray(data?._embedded?.events)
      ? data._embedded.events
      : [];

    const results = rawEvents
      .map(normalizeEvent)
      .filter(isValidFutureBookableEvent)
      .slice(0, 15);

    return res.status(200).json({
      status: 'OK',
      provider: 'Ticketmaster',
      query: cleanQuery,
      locationName: cleanLocationName,
      radiusKm: radius,
      whenMode,
      count: results.length,
      results,
    });
  } catch (e) {
    return res.status(500).json({
      error: 'Errore server events-search',
      details: e.message,
    });
  }
}
