// --- Tile layers ---
const layers = {
  osm: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  }),
  satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; <a href="https://www.esri.com">Esri</a>',
    maxZoom: 19,
  }),
  topo: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  }),
};

const map = L.map('map', {
  center: [20, 0],
  zoom: 2,
  layers: [layers.osm],
  zoomControl: true,
});

let activeLayer = 'osm';

document.querySelectorAll('.layer-btn[data-layer]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.layer;
    if (target === activeLayer) return;
    map.removeLayer(layers[activeLayer]);
    map.addLayer(layers[target]);
    activeLayer = target;
    document.querySelectorAll('.layer-btn[data-layer]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// --- Flight overlay ---

const TYPE_COLOR = {
  military:   '#ff3b3b',
  government: '#ffb700',
  civilian:   '#60aaff',
};

// Known military ICAO24 hex address ranges
const MILITARY_RANGES = [
  [0xAE0000, 0xAFFFFF], // US Military (USAF, USN, USMC, Army, Coast Guard)
  [0x43C000, 0x43FFFF], // UK Royal Air Force / Royal Navy
  [0x3B0000, 0x3BFFFF], // French Air & Space Force
  [0x3DC000, 0x3DFFFF], // German Luftwaffe
  [0x140000, 0x17FFFF], // Chinese PLA Air Force
  [0x054000, 0x057FFF], // Russian Aerospace Forces
  [0x710000, 0x7FFFFF], // Various Middle East military
];

// Callsign prefixes used by military aircraft
const MILITARY_CS_RE = /^(RCH|REACH|IRON|KNIFE|VIPER|GHOST|FURY|RAPTOR|TALON|BLADE|REAPER|GRIM|DOOM|SNAKE|HAWK|EAGLE|BUCK|DUKE|TOPGUN|MAGMA|EVAC|JAKE|ROCKY|JOLLY|PEDRO|MOOSE|BISON|COLT|STALLION|SPARTAN|RANGER|RANGER|ATLAS|HERKY|PAPA|GLOBE)/;

// Callsign prefixes used by government (non-military) aircraft
const GOVT_CS_RE = /^(SAM|EXEC|VENUS|NASA|USGS|USCG|FAA|CBP|ICE|SECRET|MARINE|ARMY|NAVY\d)/;

function classifyAircraft(icao24, callsign) {
  const n = parseInt(icao24, 16);
  for (const [lo, hi] of MILITARY_RANGES) {
    if (n >= lo && n <= hi) return 'military';
  }
  const cs = (callsign || '').trim().toUpperCase();
  if (MILITARY_CS_RE.test(cs)) return 'military';
  if (GOVT_CS_RE.test(cs)) return 'government';
  return 'civilian';
}

function makePlaneIcon(heading, type) {
  const color = TYPE_COLOR[type];
  const deg = heading ?? 0;
  // Plane silhouette pointing up (north = 0°), rotated by heading
  return L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
      <g transform="rotate(${deg},11,11)">
        <polygon points="11,2 13.5,9 11,7.5 8.5,9" fill="${color}" stroke="rgba(0,0,0,0.6)" stroke-width="0.8"/>
        <polygon points="11,7 4,13 4.5,14.5 11,11 17.5,14.5 18,13" fill="${color}" stroke="rgba(0,0,0,0.6)" stroke-width="0.8"/>
        <polygon points="11,11 8.5,16 11,15 13.5,16" fill="${color}" stroke="rgba(0,0,0,0.6)" stroke-width="0.8"/>
      </g>
    </svg>`,
  });
}

// adsb.lol gives altitude in feet, speed in knots
function formatAlt(ft) {
  if (ft == null || ft === 'ground') return ft === 'ground' ? 'Ground' : '—';
  return `${Math.round(ft).toLocaleString()} ft / ${Math.round(ft * 0.3048).toLocaleString()} m`;
}

function formatSpd(kts) {
  if (kts == null) return '—';
  return `${Math.round(kts)} kts / ${Math.round(kts * 1.852)} km/h`;
}

function buildPopup(hex, callsign, altFt, speedKts, heading, squawk, type) {
  const label = (callsign || hex).trim();
  const badge = `<span class="plane-type-badge" style="background:${TYPE_COLOR[type]}">${type}</span>`;
  return `<div class="plane-popup">
    <b>${label}</b>
    ${badge}
    <div>Altitude: ${formatAlt(altFt)}</div>
    <div>Speed: ${formatSpd(speedKts)}</div>
    <div>Heading: ${heading != null ? Math.round(heading) + '°' : '—'}</div>
    ${squawk ? `<div>Squawk: ${squawk}</div>` : ''}
    <div class="detail">ICAO24: ${hex}</div>
  </div>`;
}

// --- Plane fetch & render ---

const planeGroup = L.layerGroup().addTo(map);
const planeMarkers = new Map(); // icao24 -> marker
let planesEnabled = true;
let fetchTimer = null;

async function refreshPlanes() {
  if (!planesEnabled) return;
  if (map.getZoom() < 2) { updateCounter(null); return; }

  try {
    const center = map.getCenter();
    const corner = map.getBounds().getNorthEast();
    // Radius from center to corner in nautical miles, capped at 500
    const radiusNm = Math.min(500, Math.round(map.distance(center, corner) / 1852));

    // adsb.lol — open CORS, no key needed, altitude in ft, speed in kts
    const url = `https://api.adsb.lol/v2/lat/${center.lat.toFixed(4)}/lon/${center.lng.toFixed(4)}/dist/${radiusNm}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const { ac: aircraft = [] } = await res.json();

    const seen = new Set();
    const counts = { military: 0, government: 0, civilian: 0 };

    for (const a of aircraft) {
      const { hex, flight, lat, lon, alt_baro, gs, track, squawk } = a;
      if (lat == null || lon == null || alt_baro === 'ground') continue;

      const type = classifyAircraft(hex, flight);
      counts[type]++;
      seen.add(hex);

      const popup = buildPopup(hex, flight, alt_baro, gs, track, squawk, type);
      const icon  = makePlaneIcon(track, type);

      if (planeMarkers.has(hex)) {
        const m = planeMarkers.get(hex);
        m.setLatLng([lat, lon]);
        m.setIcon(icon);
        if (m.isPopupOpen()) m.setPopupContent(popup);
        else m.bindPopup(popup);
      } else {
        planeMarkers.set(hex, L.marker([lat, lon], { icon }).bindPopup(popup).addTo(planeGroup));
      }
    }

    for (const [hex, m] of planeMarkers) {
      if (!seen.has(hex)) { planeGroup.removeLayer(m); planeMarkers.delete(hex); }
    }

    updateCounter(counts);
  } catch (err) {
    console.warn('Flight fetch error:', err);
  }
}

function updateCounter(counts) {
  const el = document.getElementById('plane-counter');
  if (!counts) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <span style="color:${TYPE_COLOR.military}">&#9992; ${counts.military} mil</span>
    <span style="color:${TYPE_COLOR.government}">&#9992; ${counts.government} gov</span>
    <span style="color:${TYPE_COLOR.civilian}">&#9992; ${counts.civilian} civ</span>
  `;
}

document.getElementById('btn-planes').addEventListener('click', function () {
  planesEnabled = !planesEnabled;
  this.classList.toggle('active', planesEnabled);
  if (planesEnabled) {
    planeGroup.addTo(map);
    refreshPlanes();
  } else {
    map.removeLayer(planeGroup);
    updateCounter(null);
  }
});

// Refresh every 15 s and on map move
refreshPlanes();
setInterval(refreshPlanes, 15000);
map.on('moveend', () => {
  clearTimeout(fetchTimer);
  fetchTimer = setTimeout(refreshPlanes, 400); // debounce rapid panning
});
