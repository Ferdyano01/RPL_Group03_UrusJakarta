const EARTH_RADIUS_METERS = 6371000;
const OSM_OVERPASS_URL =
  process.env.OSM_OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const OSM_NOMINATIM_URL =
  process.env.OSM_NOMINATIM_URL || 'https://nominatim.openstreetmap.org/reverse';
const OSM_TIMEOUT_MS = Number(process.env.OSM_TIMEOUT_MS) || 2500;
const NOMINATIM_TIMEOUT_MS = Number(process.env.NOMINATIM_TIMEOUT_MS) || 3500;
const OSM_CACHE_TTL_MS = 10 * 60 * 1000;

// Cache in-memory berdasarkan koordinat dibulatkan (~11m) agar analisis berulang cepat
const osmContextCache = new Map();
const reverseGeocodeCache = new Map();

// Data kepadatan penduduk & zona wilayah DKI Jakarta (basis BPS DKI Jakarta)
const JAKARTA_REGION_DENSITY = [
  {
    region: 'Jakarta Pusat',
    tier: 'high',
    score: 15,
    keywords: [
      'jakarta pusat',
      'jakpus',
      'johar baru',
      'senen',
      'kemayoran',
      'tanah abang',
      'menteng',
      'gambir',
      'sawah besar',
      'cempaka putih',
    ],
  },
  {
    region: 'Jakarta Barat',
    tier: 'high',
    score: 15,
    keywords: [
      'jakarta barat',
      'jakbar',
      'tambora',
      'cengkareng',
      'grogol',
      'kalideres',
      'kebon jeruk',
      'palmerah',
      'taman sari',
      'kembangan',
    ],
  },
  {
    region: 'Jakarta Selatan',
    tier: 'medium',
    score: 12,
    keywords: [
      'jakarta selatan',
      'jaksel',
      'tebet',
      'setiabudi',
      'kuningan',
      'kebayoran',
      'mampang',
      'pancoran',
      'pasar minggu',
      'pesanggrahan',
      'cilandak',
      'jagakarsa',
    ],
  },
  {
    region: 'Jakarta Timur',
    tier: 'medium',
    score: 12,
    keywords: [
      'jakarta timur',
      'jaktim',
      'jatinegara',
      'matraman',
      'pulo gadung',
      'pulogadung',
      'cakung',
      'duren sawit',
      'kramat jati',
      'makasar',
      'pasar rebo',
      'ciracas',
      'cipayung',
    ],
  },
  {
    region: 'Jakarta Utara',
    tier: 'medium',
    score: 10,
    keywords: [
      'jakarta utara',
      'jakut',
      'koja',
      'cilincing',
      'kelapa gading',
      'pademangan',
      'penjaringan',
      'tanjung priok',
    ],
  },
];

// Kata kunci koridor jalan arteri / protokol utama di Jakarta
const ARTERIAL_ROAD_KEYWORDS = [
  'sudirman',
  'thamrin',
  'gatot subroto',
  'panjaitan',
  'mt haryono',
  'm.t. haryono',
  'rasuna said',
  'casablanca',
  'satrio',
  's. parman',
  'slipi',
  'gajah mada',
  'hayam wuruk',
  'ahmad yani',
  'perintis kemerdekaan',
  'pemuda',
  'matraman',
  'salemba',
  'kramat raya',
  'gunung sahari',
  'yos sudarso',
  'tb simatupang',
  'fatmawati',
  'antasari',
  'ciledug raya',
  'daan mogot',
  'tomang',
  'latumenten',
  'kebon sirih',
  'medan merdeka',
  'senopati',
  'pramuka',
  'bekasi raya',
  'kalimalang',
  'raya bogor',
  'arteri',
  'protokol',
  'flyover',
  'underpass',
  'lingkar luar',
  'jorr',
];

const COLLECTOR_ROAD_KEYWORDS = [
  'raya',
  'boulevard',
  'jend',
  'jenderal',
  'letjen',
  'mayjen',
  'kapten',
  'prof',
  'kemang',
  'ampera',
  'buncit',
  'lenteng agung',
  'margonda',
  'pasar',
];

const FACILITY_RULES = [
  {
    key: 'transit',
    label: 'Halte / Stasiun Transit',
    keywords: [
      'halte',
      'busway',
      'transjakarta',
      'stasiun',
      'mrt',
      'lrt',
      'krl',
      'commuter',
      'terminal',
    ],
  },
  {
    key: 'health',
    label: 'Rumah Sakit / Fasilitas Kesehatan',
    keywords: ['rumah sakit', 'rsud', 'rsu ', 'puskesmas', 'klinik', 'igd'],
  },
  {
    key: 'education_public',
    label: 'Sekolah / Kampus / Pusat Keramaian',
    keywords: [
      'sekolah',
      'sdn',
      'smp',
      'sma',
      'smk',
      'kampus',
      'universitas',
      'pasar',
      'mall',
      'perkantoran',
      'bundaran',
      'simpang',
      'perempatan',
    ],
  },
];

const ROAD_CLASS_SCORE_MAP = {
  arterial: { score: 40, label: 'Jalan Arteri / Protokol' },
  collector: { score: 25, label: 'Jalan Kolektor / Penghubung' },
  local: { score: 10, label: 'Jalan Lingkungan / Lokal' },
};

const INACTIVE_DUPLICATE_STATUSES = new Set(['fixed', 'closed', 'rejected']);

/**
 * Menghitung jarak antara dua koordinat GPS (dalam meter) menggunakan rumus Haversine.
 */
export const calculateDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const phi1 = (Number(lat1) * Math.PI) / 180;
  const phi2 = (Number(lat2) * Math.PI) / 180;
  const deltaPhi = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
  const deltaLambda = ((Number(lng2) - Number(lng1)) * Math.PI) / 180;

  if (
    Number.isNaN(phi1) ||
    Number.isNaN(phi2) ||
    Number.isNaN(deltaPhi) ||
    Number.isNaN(deltaLambda)
  ) {
    return Infinity;
  }

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Number((EARTH_RADIUS_METERS * c).toFixed(1));
};

/**
 * Menentukan tier kepadatan penduduk berdasarkan alamat atau rentang koordinat wilayah Jakarta.
 */
const inferJakartaPopulationDensity = (address = '', latitude, longitude) => {
  const lowerAddr = (address || '').toLowerCase();

  for (const item of JAKARTA_REGION_DENSITY) {
    if (item.keywords.some((kw) => lowerAddr.includes(kw))) {
      return {
        region: item.region,
        tier: item.tier,
        score: item.score,
      };
    }
  }

  // Perkiraan kasar pusat kota Jakarta (-6.15 s/d -6.22, 106.80 s/d 106.86)
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    const distFromMonas = calculateDistanceMeters(lat, lng, -6.1754, 106.8272);
    if (distFromMonas <= 5000) {
      return { region: 'Pusat Kota Jakarta', tier: 'high', score: 15 };
    }
    if (distFromMonas <= 15000) {
      return { region: 'DKI Jakarta', tier: 'medium', score: 11 };
    }
  }

  return { region: 'Jabodetabek', tier: 'low', score: 6 };
};

/**
 * Mengambil konteks kelas jalan dan fasilitas publik sekitar dari OpenStreetMap Overpass API.
 * Berjalan non-blocking terhadap kegagalan: mengembalikan null jika offline / timeout.
 */
export const fetchOsmLocationContext = async (latitude, longitude) => {
  if (process.env.OSM_OVERPASS_ENABLED === 'false') {
    return null;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = osmContextCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < OSM_CACHE_TTL_MS) {
    return cached.value;
  }

  const query = `[out:json][timeout:2];
(
  way(around:60,${lat},${lng})["highway"];
  node(around:300,${lat},${lng})["amenity"~"^(hospital|clinic|school|university|college|marketplace)$"];
  way(around:300,${lat},${lng})["amenity"~"^(hospital|clinic|school|university|college|marketplace)$"];
  node(around:300,${lat},${lng})["highway"="bus_stop"];
  node(around:300,${lat},${lng})["railway"~"^(station|halt)$"];
  node(around:300,${lat},${lng})["public_transport"="station"];
);
out tags center 40;`;

  try {
    const response = await fetch(OSM_OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(OSM_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const elements = Array.isArray(payload?.elements) ? payload.elements : [];

    let detectedRoadClass = null;
    const roadPriority = { arterial: 3, collector: 2, local: 1 };
    const facilities = new Set();

    for (const el of elements) {
      const tags = el?.tags || {};

      if (el.type === 'way' && tags.highway) {
        let candidateClass = 'local';
        if (['motorway', 'trunk', 'primary', 'motorway_link', 'trunk_link', 'primary_link'].includes(tags.highway)) {
          candidateClass = 'arterial';
        } else if (['secondary', 'tertiary', 'secondary_link', 'tertiary_link'].includes(tags.highway)) {
          candidateClass = 'collector';
        }

        if (!detectedRoadClass || roadPriority[candidateClass] > roadPriority[detectedRoadClass]) {
          detectedRoadClass = candidateClass;
        }
      }

      if (
        tags.highway === 'bus_stop' ||
        tags.railway === 'station' ||
        tags.railway === 'halt' ||
        tags.public_transport === 'station'
      ) {
        facilities.add('Halte / Stasiun Transit');
      }
      if (tags.amenity === 'hospital' || tags.amenity === 'clinic') {
        facilities.add('Rumah Sakit / Fasilitas Kesehatan');
      }
      if (
        ['school', 'university', 'college', 'marketplace'].includes(tags.amenity)
      ) {
        facilities.add('Sekolah / Kampus / Pusat Keramaian');
      }
    }

    const result = {
      road_class: detectedRoadClass,
      facilities: Array.from(facilities),
    };
    osmContextCache.set(cacheKey, { cachedAt: Date.now(), value: result });
    return result;
  } catch {
    return null;
  }
};

/**
 * Mendeteksi laporan sekitar (150m / 90 hari) dan kandidat duplikat aktif (radius 35m / 30 hari).
 */
export const findNearbyReportsAndDuplicates = ({
  latitude,
  longitude,
  category = null,
  existingReports = [],
  duplicateRadiusMeters = 35,
  areaRadiusMeters = 150,
  duplicateWindowDays = 30,
  areaWindowDays = 90,
  excludeReportId = null,
}) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng) || !Array.isArray(existingReports)) {
    return {
      nearby_report_count: 0,
      possible_duplicates: [],
    };
  }

  const nowMs = Date.now();
  const duplicateCutoffMs = nowMs - duplicateWindowDays * 24 * 60 * 60 * 1000;
  const areaCutoffMs = nowMs - areaWindowDays * 24 * 60 * 60 * 1000;
  const normalizedCategory = category ? String(category).toLowerCase() : null;

  let nearbyCount = 0;
  const duplicates = [];

  for (const report of existingReports) {
    if (!report || (excludeReportId && report.id === excludeReportId)) {
      continue;
    }

    const rLat = Number(report.latitude);
    const rLng = Number(report.longitude);
    if (Number.isNaN(rLat) || Number.isNaN(rLng)) {
      continue;
    }

    const distance = calculateDistanceMeters(lat, lng, rLat, rLng);
    if (distance > areaRadiusMeters) {
      continue;
    }

    const createdMs = report.created_at ? new Date(report.created_at).getTime() : nowMs;
    if (!Number.isNaN(createdMs) && createdMs >= areaCutoffMs) {
      nearbyCount += 1;
    }

    const reportStatus = String(report.status || 'submitted').toLowerCase();
    const isActiveStatus = !INACTIVE_DUPLICATE_STATUSES.has(reportStatus);
    const isWithinWindow = Number.isNaN(createdMs) || createdMs >= duplicateCutoffMs;

    const reportCategory = String(report.category || '').toLowerCase();
    const categoryMatches =
      !normalizedCategory ||
      !reportCategory ||
      normalizedCategory === reportCategory ||
      (normalizedCategory !== 'undamaged' && reportCategory !== 'undamaged');

    if (distance <= duplicateRadiusMeters && isActiveStatus && isWithinWindow && categoryMatches) {
      const supportCount = Number(report.ai_analysis?.support_count) || 1;
      duplicates.push({
        id: report.id,
        title: report.title || 'Laporan Kerusakan Jalan',
        address: report.address || null,
        category: report.category || 'pothole',
        severity: report.severity || 'medium',
        status: report.status || 'submitted',
        distance_meters: distance,
        support_count: supportCount,
        created_at: report.created_at || null,
      });
    }
  }

  duplicates.sort((a, b) => a.distance_meters - b.distance_meters);

  return {
    nearby_report_count: nearbyCount,
    possible_duplicates: duplicates.slice(0, 5),
  };
};

/**
 * Mengevaluasi skor strategis lokasi (0-100) dari kelas jalan, kedekatan fasilitas vital,
 * kepadatan penduduk wilayah, dan frekuensi laporan warga di sekitar koordinat.
 */
export const evaluateStrategicLocation = ({
  latitude,
  longitude,
  address = '',
  userDescription = '',
  nearbyReportCount = 0,
  duplicateCount = 0,
  osmContext = null,
}) => {
  const combinedText = `${address || ''} ${userDescription || ''}`.toLowerCase();

  // 1. Kelas Jalan (0 - 40 poin)
  let roadClass = osmContext?.road_class || null;
  if (!roadClass) {
    if (ARTERIAL_ROAD_KEYWORDS.some((kw) => combinedText.includes(kw))) {
      roadClass = 'arterial';
    } else if (COLLECTOR_ROAD_KEYWORDS.some((kw) => combinedText.includes(kw))) {
      roadClass = 'collector';
    } else {
      roadClass = 'local';
    }
  }
  const roadInfo = ROAD_CLASS_SCORE_MAP[roadClass] || ROAD_CLASS_SCORE_MAP.local;
  const roadClassScore = roadInfo.score;

  // 2. Kedekatan Fasilitas Publik Vital (0 - 30 poin)
  const facilitySet = new Set(osmContext?.facilities || []);
  for (const rule of FACILITY_RULES) {
    if (rule.keywords.some((kw) => combinedText.includes(kw))) {
      facilitySet.add(rule.label);
    }
  }
  const nearbyVitalFacilities = Array.from(facilitySet);
  const poiProximityScore = Math.min(30, nearbyVitalFacilities.length * 10);

  // 3. Kepadatan Penduduk Zona / Wilayah (0 - 15 poin)
  const densityInfo = inferJakartaPopulationDensity(address, latitude, longitude);
  const populationDensityScore = densityInfo.score;

  // 4. Frekuensi Laporan Warga / Kerusakan Berulang di Radius Sekitar (0 - 15 poin)
  const effectiveHits = Math.max(nearbyReportCount, duplicateCount);
  let reportFrequencyScore = 0;
  if (effectiveHits >= 3) {
    reportFrequencyScore = 15;
  } else if (effectiveHits >= 1) {
    reportFrequencyScore = 8;
  }

  const strategicScore = Math.min(
    100,
    roadClassScore + poiProximityScore + populationDensityScore + reportFrequencyScore
  );

  let strategicTier = 'low';
  if (strategicScore >= 70) {
    strategicTier = 'high';
  } else if (strategicScore >= 40) {
    strategicTier = 'medium';
  }

  return {
    strategic_score: strategicScore,
    strategic_tier: strategicTier,
    road_class: roadClass,
    road_class_label: roadInfo.label,
    population_density_tier: densityInfo.tier,
    detected_region: densityInfo.region,
    nearby_vital_facilities: nearbyVitalFacilities,
    nearby_report_count: nearbyReportCount,
    duplicate_count: duplicateCount,
    score_breakdown: {
      road_class_score: roadClassScore,
      poi_proximity_score: poiProximityScore,
      population_density_score: populationDensityScore,
      report_frequency_score: reportFrequencyScore,
    },
    data_source: osmContext ? 'osm_overpass+local' : 'local_heuristic',
  };
};

/**
 * Orkestrator penuh untuk analisis lokasi strategis dan deteksi duplikat laporan.
 */
export const evaluateLocationAndDuplicates = async ({
  latitude,
  longitude,
  address = '',
  userDescription = '',
  category = null,
  existingReports = [],
  excludeReportId = null,
}) => {
  const [osmContext, spatial] = await Promise.all([
    fetchOsmLocationContext(latitude, longitude),
    Promise.resolve(
      findNearbyReportsAndDuplicates({
        latitude,
        longitude,
        category,
        existingReports,
        excludeReportId,
      })
    ),
  ]);

  const locationContext = evaluateStrategicLocation({
    latitude,
    longitude,
    address,
    userDescription,
    nearbyReportCount: spatial.nearby_report_count,
    duplicateCount: spatial.possible_duplicates.length,
    osmContext,
  });

  return {
    location_context: locationContext,
    possible_duplicates: spatial.possible_duplicates,
  };
};

/**
 * Memformat payload JSON dari OpenStreetMap Nominatim menjadi alamat jalan ringkas Bahasa Indonesia.
 */
export const formatNominatimAddress = (nominatimData) => {
  if (!nominatimData || typeof nominatimData !== 'object') {
    return null;
  }

  const addr = nominatimData.address || {};
  const streetBase =
    addr.road ||
    addr.pedestrian ||
    addr.footway ||
    addr.cycleway ||
    addr.path ||
    nominatimData.name ||
    null;

  const streetPart =
    streetBase && addr.house_number ? `${streetBase} No. ${addr.house_number}` : streetBase;
  const subLocality = addr.village || addr.suburb || addr.neighbourhood || null;
  const district = addr.city_district || addr.municipality || addr.town || null;
  const city = addr.city || addr.county || addr.state_district || addr.state || null;

  const parts = [];
  for (const part of [streetPart, subLocality, district, city]) {
    if (part && !parts.some((existing) => existing.toLowerCase() === part.toLowerCase())) {
      parts.push(part);
    }
  }

  if (parts.length > 0) {
    return parts.join(', ');
  }

  if (typeof nominatimData.display_name === 'string' && nominatimData.display_name.trim()) {
    return nominatimData.display_name
      .split(',')
      .slice(0, 4)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');
  }

  return null;
};

/**
 * Mengubah koordinat GPS (latitude, longitude) menjadi nama jalan & wilayah via OSM Nominatim.
 * Tetap aman jika offline/timeout: mengembalikan available: false agar pelapor bisa mengisi manual.
 */
export const reverseGeocodeCoordinates = async (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const densityInfo = inferJakartaPopulationDensity('', lat, lng);

  if (
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new Error('Koordinat latitude (-90 s/d 90) atau longitude (-180 s/d 180) tidak valid.');
  }

  if (process.env.OSM_NOMINATIM_ENABLED === 'false') {
    return {
      available: false,
      address: null,
      region: densityInfo.region,
      source: 'disabled',
    };
  }

  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = reverseGeocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < OSM_CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const url = new URL(OSM_NOMINATIM_URL);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('zoom', '18');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', 'id');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'UrusJakarta/1.0 (FTUI Civic Road Reporting Prototype)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        available: false,
        address: null,
        region: densityInfo.region,
        source: 'unavailable',
      };
    }

    const data = await response.json();
    const formattedAddress = formatNominatimAddress(data);
    const result = {
      available: Boolean(formattedAddress),
      address: formattedAddress,
      region: data?.address?.city || densityInfo.region,
      source: formattedAddress ? 'osm_nominatim' : 'unavailable',
    };

    if (formattedAddress) {
      reverseGeocodeCache.set(cacheKey, { cachedAt: Date.now(), value: result });
    }
    return result;
  } catch {
    return {
      available: false,
      address: null,
      region: densityInfo.region,
      source: 'unavailable',
    };
  }
};
