function safeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text.length ? text : fallback;
}

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const aLat = Number(lat1);
  const aLon = Number(lon1);
  const bLat = Number(lat2);
  const bLon = Number(lon2);

  if (
    !Number.isFinite(aLat) ||
    !Number.isFinite(aLon) ||
    !Number.isFinite(bLat) ||
    !Number.isFinite(bLon)
  ) {
    return 999;
  }

  const EARTH_RADIUS_KM = 6371;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) *
      Math.cos(toRad(bLat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

function toTicketmasterDateTime(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function buildDateRange(whenMode) {
  const now = new Date();

  const start = new Date(now);
  start.setSeconds(0, 0);

  const end = new Date(now);

  if (whenMode === 'today') {
    end.setHours(23, 59, 59, 0);
  } else {
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 0);
  }

  return {
    start,
    end,
    startDateTime: toTicketmasterDateTime(start),
    endDateTime: toTicketmasterDateTime(end),
  };
}

function pickBestImage(images) {
  if (!Array.isArray(images) || !images.length) return '';

  const sorted = [...images].sort((a, b) => {
    const areaA = Number(a.width || 0) * Number(a.height || 0);
    const areaB = Number(b.width || 0) * Number(b.height || 0);
    return areaB - areaA;
  });

  return sorted[0]?.url || '';
}

function pickVenue(event) {
  const venues = event?._embedded?.venues;

  if (Array.isArray(venues) && venues.length) {
    return venues[0];
  }

  return null;
}

function normalizeTicketmasterEvent(event, originLat, originLon) {
  const venue = pickVenue(event);

  const date = event?.dates?.start?.localDate || '';
  const time = event?.dates?.start?.localTime || '';
  const dateTime = event?.dates?.start?.dateTime || '';

  const venueName = venue?.name || '';
  const city = venue?.city?.name || '';
  const country = venue?.country?.name || venue?.country?.countryCode || '';
  const address = [
    venue?.address?.line1,
    venue?.postalCode,
    city,
    venue?.state?.name,
    country,
  ]
    .filter(Boolean)
    .join(', ');

  const lat = toNumber(venue?.location?.latitude, null);
  const lon = toNumber(venue?.location?.longitude, null);

  const distanceKm = getDistanceKm(originLat, originLon, lat, lon);

  const classifications = Array.isArray(event?.classifications)
    ? event.classifications
    : [];

  const categoryParts = [];

  classifications.forEach((item) => {
    if (item?.segment?.name) categoryParts.push(item.segment.name);
    if (item?.genre?.name) categoryParts.push(item.genre.name);
    if (item?.subGenre?.name) categoryParts.push(item.subGenre.name);
  });

  const category = [...new Set(categoryParts.filter(Boolean))].join(' • ');

  return {
    id: `ticketmaster_${event.id || event.url || event.name}`,
    eventId: event.id || '',
    source: 'ticketmaster',
    sourceLabel: 'Ticketmaster',
    type: 'event',
    isEvent: true,

    name: safeText(event.name, 'Evento'),
    title: safeText(event.name, 'Evento'),

    date,
    time,
    dateTime,

    venueName,
    venue: venueName,
    city,
    country,
    address,

    lat,
    lon,
    distanceKm,

    category: category || 'Evento',
    section: 'Eventi',
    subcategory: category || 'Evento',

    url: event.url || '',
    website: event.url || '',
    ticketUrl: event.url || '',
    image: pickBestImage(event.images),

    status: event?.dates?.status?.code || '',
    info: event.info || '',
    pleaseNote: event.pleaseNote || '',

    description:
      [category, venueName, city].filter(Boolean).join(' • ') ||
      'Evento trovato tramite fonte esterna verificabile.',

    openInfoText: date && time ? `${date} • ${time.slice(0, 5)}` : date || 'Data da verificare',
    hasOpenNowData: false,
    isOpenNow: false,

    rawSource: 'ticketmaster',
  };
}

function isValidEvent(item) {
  if (!item) return false;

  if (!safeText(item.name)) return false;
  if (!safeText(item.url)) return false;
  if (!safeText(item.date) && !safeText(item.dateTime)) return false;

  return true;
}

function dedupeEvents(events) {
  const seen = new Set();

  return events.filter((event) => {
    const key =
      event.eventId ||
      event.url ||
      `${safeText(event.name).toLowerCase()}_${safeText(event.date)}_${safeText(event.venueName).toLowerCase()}`;

    if (!key) return false;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

async function searchTicketmasterEvents({
  apiKey,
  keyword,
  locationName,
  lat,
  lon,
  radiusKm,
  whenMode,
}) {
  const { startDateTime, endDateTime } = buildDateRange(whenMode);

  const params = new URLSearchParams();

  params.set('apikey', apiKey);
  params.set('locale', '*');
  params.set('countryCode', 'IT');
  params.set('size', '30');
  params.set('sort', 'date,asc');
  params.set('startDateTime', startDateTime);
  params.set('endDateTime', endDateTime);

  if (keyword) {
    params.set('keyword', keyword);
  }

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    params.set('latlong', `${lat},${lon}`);
    params.set('radius', String(Math.max(1, Math.min(Number(radiusKm || 30), 100))));
    params.set('unit', 'km');
  } else if (locationName) {
    params.set('city', locationName);
  }

  const url = `https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.fault?.faultstring || data?.message || 'Errore Ticketmaster');
  }

  const rawEvents = Array.isArray(data?._embedded?.events)
    ? data._embedded.events
    : [];

  return rawEvents
    .map((event) => normalizeTicketmasterEvent(event, lat, lon))
    .filter(isValidEvent);
}

export default async function handler(req, res) {
  try {
    const {
      query,
      locationName,
      lat,
      lon,
      radiusKm,
      whenMode,
      period,
    } = req.query;

    const cleanLocationName = safeText(locationName, 'Lago di Garda');
    const cleanQuery = safeText(query, `eventi ${cleanLocationName}`);

    const latitude = toNumber(lat, null);
    const longitude = toNumber(lon, null);

    const safeRadiusKm = Math.max(5, Math.min(Number(radiusKm || 30), 100));

    const cleanWhenMode =
      whenMode === 'today' || period === 'today'
        ? 'today'
        : 'week';

    const ticketmasterApiKey = process.env.TICKETMASTER_API_KEY;

    if (!ticketmasterApiKey) {
      return res.status(500).json({
        error: 'TICKETMASTER_API_KEY non trovata',
        status: 'MISSING_TICKETMASTER_API_KEY',
        results: [],
      });
    }

    let events = [];

    const keywords = [
      cleanQuery,
      `eventi ${cleanLocationName}`,
      `concerti ${cleanLocationName}`,
      `spettacoli ${cleanLocationName}`,
      `festival ${cleanLocationName}`,
    ];

    for (const keyword of keywords) {
      try {
        const partial = await searchTicketmasterEvents({
          apiKey: ticketmasterApiKey,
          keyword,
          locationName: cleanLocationName,
          lat: latitude,
          lon: longitude,
          radiusKm: safeRadiusKm,
          whenMode: cleanWhenMode,
        });

        events = events.concat(partial);
      } catch (e) {}
    }

    const cleaned = dedupeEvents(events)
      .sort((a, b) => {
        const aTime = a.dateTime ? new Date(a.dateTime).getTime() : new Date(a.date).getTime();
        const bTime = b.dateTime ? new Date(b.dateTime).getTime() : new Date(b.date).getTime();

        if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
          return aTime - bTime;
        }

        return Number(a.distanceKm || 999) - Number(b.distanceKm || 999);
      })
      .slice(0, 20);

    if (!cleaned.length) {
      return res.status(200).json({
        status: 'ZERO_RESULTS',
        source: 'ticketmaster',
        query: cleanQuery,
        locationName: cleanLocationName,
        whenMode: cleanWhenMode,
        radiusKm: safeRadiusKm,
        count: 0,
        results: [],
        message:
          cleanWhenMode === 'today'
            ? 'Non trovo eventi verificabili oggi in questa zona.'
            : 'Non trovo eventi verificabili nei prossimi 7 giorni in questa zona.',
      });
    }

    return res.status(200).json({
      status: 'OK',
      source: 'ticketmaster',
      query: cleanQuery,
      locationName: cleanLocationName,
      whenMode: cleanWhenMode,
      radiusKm: safeRadiusKm,
      count: cleaned.length,
      results: cleaned,
    });
  } catch (e) {
    return res.status(500).json({
      error: 'Errore server events-search',
      details: e.message,
      results: [],
    });
  }
}
