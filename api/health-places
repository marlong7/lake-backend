const BASE_URL = 'https://lake-backend.vercel.app';

const LOCATIONS = [
  { name: 'Affi', lat: 45.5527, lng: 10.7772 },
  { name: 'Albisano', lat: 45.6047, lng: 10.6989 },
  { name: 'Arco', lat: 45.9188, lng: 10.8862 },
  { name: 'Assenza', lat: 45.7315, lng: 10.7894 },
  { name: 'Bardolino', lat: 45.5469, lng: 10.7248 },
  { name: 'Bogliaco', lat: 45.6738, lng: 10.6611 },
  { name: 'Brenzone sul Garda', lat: 45.7033, lng: 10.7642 },
  { name: 'Calmasino', lat: 45.5059, lng: 10.7463 },
  { name: 'Campione del Garda', lat: 45.7562, lng: 10.7491 },
  { name: 'Caprino Veronese', lat: 45.6047, lng: 10.7954 },
  { name: 'Castelletto di Brenzone', lat: 45.6877, lng: 10.7518 },
  { name: 'Castelnuovo del Garda', lat: 45.4398, lng: 10.7646 },
  { name: 'Cavaion Veronese', lat: 45.5403, lng: 10.7706 },
  { name: 'Cisano', lat: 45.5301, lng: 10.7235 },
  { name: 'Colombare di Sirmione', lat: 45.4664, lng: 10.6028 },
  { name: 'Costermano sul Garda', lat: 45.5864, lng: 10.7396 },
  { name: 'Desenzano del Garda', lat: 45.4689, lng: 10.5357 },
  { name: 'Fasano', lat: 45.6203, lng: 10.5685 },
  { name: 'Garda', lat: 45.5756, lng: 10.7072 },
  { name: 'Gardola', lat: 45.7426, lng: 10.7214 },
  { name: 'Gardone Riviera', lat: 45.6217, lng: 10.5585 },
  { name: 'Gargnano', lat: 45.688, lng: 10.6637 },
  { name: 'Lazise', lat: 45.5057, lng: 10.7324 },
  { name: 'Limone sul Garda', lat: 45.8131, lng: 10.7918 },
  { name: 'Lonato del Garda', lat: 45.4613, lng: 10.4847 },
  { name: 'Lugana di Sirmione', lat: 45.4607, lng: 10.6233 },
  { name: 'Maderno', lat: 45.6331, lng: 10.6017 },
  { name: 'Magugnano', lat: 45.7003, lng: 10.7629 },
  { name: 'Malcesine', lat: 45.7646, lng: 10.8067 },
  { name: 'Manerba del Garda', lat: 45.5511, lng: 10.5535 },
  { name: 'Moniga del Garda', lat: 45.5265, lng: 10.5392 },
  { name: 'Muscoline', lat: 45.5637, lng: 10.4612 },
  { name: 'Nago-Torbole', lat: 45.8699, lng: 10.8766 },
  { name: 'Padenghe sul Garda', lat: 45.5081, lng: 10.5079 },
  { name: 'Pai', lat: 45.6381, lng: 10.7125 },
  { name: 'Peschiera del Garda', lat: 45.4397, lng: 10.6905 },
  { name: 'Pieve di Tremosine', lat: 45.7701, lng: 10.7594 },
  { name: 'Polpenazze del Garda', lat: 45.5515, lng: 10.5041 },
  { name: 'Ponti sul Mincio', lat: 45.4139, lng: 10.6863 },
  { name: 'Portese', lat: 45.5836, lng: 10.5524 },
  { name: 'Porto di Brenzone', lat: 45.7055, lng: 10.7659 },
  { name: 'Pozzolengo', lat: 45.4057, lng: 10.6335 },
  { name: 'Puegnago del Garda', lat: 45.5678, lng: 10.5091 },
  { name: 'Riva del Garda', lat: 45.8859, lng: 10.8413 },
  { name: 'Rivoltella', lat: 45.4614, lng: 10.5787 },
  { name: 'Salò', lat: 45.6065, lng: 10.5206 },
  { name: 'San Felice del Benaco', lat: 45.5922, lng: 10.5539 },
  { name: 'San Zeno di Montagna', lat: 45.6375, lng: 10.7321 },
  { name: 'Sirmione', lat: 45.4924, lng: 10.6099 },
  { name: 'Soiano del Lago', lat: 45.5276, lng: 10.5123 },
  { name: 'Tignale', lat: 45.7426, lng: 10.7214 },
  { name: 'Torri del Benaco', lat: 45.6109, lng: 10.686 },
  { name: 'Torbole sul Garda', lat: 45.8699, lng: 10.8766 },
  { name: 'Toscolano', lat: 45.6398, lng: 10.6082 },
  { name: 'Toscolano-Maderno', lat: 45.6347, lng: 10.6077 },
  { name: 'Tremosine sul Garda', lat: 45.7701, lng: 10.7594 },
  { name: 'Valeggio sul Mincio', lat: 45.3533, lng: 10.7364 },
  { name: 'Verona', lat: 45.4384, lng: 10.9916 },
];

const CATEGORIES = [
  { category: 'Mangiare', query: 'restaurant' },
  { category: 'Negozi', query: 'store' },
  { category: 'Servizi', query: 'pharmacy' },
  { category: 'Svago', query: 'tourist attraction' },
];

async function checkOne(location, item) {
  const params = new URLSearchParams({
    query: item.query,
    category: item.category,
    lat: String(location.lat),
    lng: String(location.lng),
    radius: '10000',
    language: 'it',
    openNow: 'false',
    locationName: location.name,
  });

  const url = `${BASE_URL}/api/places-search?${params.toString()}`;
  const startedAt = Date.now();

  try {
    const response = await fetch(url);
    const data = await response.json();

    return {
      location: location.name,
      category: item.category,
      query: item.query,
      ok: response.ok && data?.ok === true,
      status: response.status,
      count: Array.isArray(data?.results) ? data.results.length : 0,
      googleStatus: data?.debug?.googleStatus || null,
      ms: Date.now() - startedAt,
      error: data?.error || null,
    };
  } catch (error) {
    return {
      location: location.name,
      category: item.category,
      query: item.query,
      ok: false,
      status: 0,
      count: 0,
      googleStatus: null,
      ms: Date.now() - startedAt,
      error: error?.message || String(error),
    };
  }
}

async function runWithLimit(tasks, limit = 5) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const current = tasks[index];
      index += 1;
      results.push(await current());
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const tasks = [];

    for (const location of LOCATIONS) {
      for (const category of CATEGORIES) {
        tasks.push(() => checkOne(location, category));
      }
    }

    const results = await runWithLimit(tasks, 5);
    const failed = results.filter((item) => !item.ok);
    const zeroResults = results.filter((item) => item.ok && item.count === 0);

    return res.status(200).json({
      ok: failed.length === 0,
      locations: LOCATIONS.length,
      categories: CATEGORIES.length,
      checks: results.length,
      passed: results.length - failed.length,
      failedCount: failed.length,
      zeroResultsCount: zeroResults.length,
      failed,
      zeroResults,
      results,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || String(error),
    });
  }
}
