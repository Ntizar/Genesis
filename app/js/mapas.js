/* GÉNESIS — mapas: mundo offline (canvas + Natural Earth) e Iberia IGN (Leaflet) */
'use strict';

/* ---------- mapa mundial offline de vecinos ---------- */
var VISTA_MUNDO = {minLon: -18, maxLon: 58, minLat: 18, maxLat: 72};

function dibujarMundo(cv, puntos){
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return; // canvas no visible / sin layout (p.ej. pestaña oculta)
  const ctx = cv.getContext && cv.getContext('2d');
  if (!ctx) return; // sin canvas disponible (tests headless)
  if (cv.width !== W * dpr){ cv.width = W * dpr; cv.height = H * dpr; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const {minLon, maxLon, minLat, maxLat} = VISTA_MUNDO;
  const X = lon => (lon - minLon) / (maxLon - minLon) * W;
  const Y = lat => H - (lat - minLat) / (maxLat - minLat) * H;
  const dentro = (lon, lat) => lon > minLon - 15 && lon < maxLon + 15 && lat > minLat - 15 && lat < maxLat + 15;

  // fondo y tierra
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--nz-blue-50') || '#eff6ff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--nz-gray-300') || '#cbd5e1';
  ctx.lineWidth = 1;
  for (const f of state.ne.features){
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) for (const ring of poly){
      ctx.beginPath();
      let started = false;
      for (const [lon, lat] of ring){
        if (!dentro(lon, lat)) continue;
        if (!started){ ctx.moveTo(X(lon), Y(lat)); started = true; } else ctx.lineTo(X(lon), Y(lat));
      }
      if (started){ ctx.closePath(); ctx.fill(); ctx.stroke(); }
    }
  }
  // puntos de vecinos (menor distancia = más grande y más azul)
  const maxD = Math.max(...puntos.map(p => p.d), 0.001);
  for (const p of puntos){
    const t = p.d / maxD;
    const r = 3 + (1 - t) * 9;
    ctx.beginPath();
    ctx.arc(X(p.ll[0]), Y(p.ll[1]), r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(37,99,235,${(0.85 - t * 0.55).toFixed(2)})`;
    ctx.fill();
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  // etiquetas de los 3 más cercanos
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillStyle = '#1e3a8a';
  for (const p of puntos.slice(0, 3)){
    ctx.fillText(p.name.replace(/_/g, ' '), Math.min(X(p.ll[0]) + 8, W - 90), Y(p.ll[1]) - 6);
  }
}

function renderMapaVecinos(r){
  const cv = $('#mapaMundo');
  if (!cv || !state.ne) return;
  const pts = r.vecinos.modernas.filter(x => x.ll).slice(0, 24);
  if (!pts.length){ cv.parentElement.innerHTML = '<p class="genes-p genes-muted">Sin vecinos geolocalizables.</p>'; return; }
  requestAnimationFrame(() => dibujarMundo(cv, pts));
}

/* ---------- mapa IGN de épocas (Leaflet, carga diferida) ---------- */
let mapaEpocas = null;

function renderMapaEpocas(nnlsRes){
  const div = $('#mapaIberia');
  if (!div) return;
  if (typeof L === 'undefined'){
    div.innerHTML = '<p class="genes-p genes-muted">Leaflet no disponible: mapa IGN no cargado.</p>';
    return;
  }
  if (!mapaEpocas){
    mapaEpocas = L.map(div, {scrollWheelZoom: false, attributionControl: true});
    L.tileLayer('https://www.ign.es/wmts/ign-base?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=IGNBase-gris&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}&FORMAT=image/jpeg', {
      attribution: '© IGN — Instituto Geográfico Nacional (CC BY 4.0)',
      maxZoom: 19
    }).addTo(mapaEpocas);
  }
  // limpiar capas de círculos previas
  mapaEpocas.eachLayer(l => { if (l instanceof L.CircleMarker) mapaEpocas.removeLayer(l); });
  const activos = nnlsRes.lista;
  const maxW = Math.max(...activos.map(c => c.w), 0.001);
  for (const c of activos){
    const [lat, lon] = c.pool.ancla;
    const radio = 8 + (c.w / maxW) * 22;
    L.circleMarker([lat, lon], {
      radius: radio, color: c.pool.color, weight: 2,
      fillColor: c.pool.color, fillOpacity: 0.35
    }).addTo(mapaEpocas)
      .bindPopup(`<b>${esc(c.pool.etiqueta)}</b><br>${fmtPct(c.w)} del modelo<br><span style="color:#64748b">${esc(c.pool.notas || '')}</span>`);
  }
  mapaEpocas.fitBounds([[26, -19], [45, 6]], {padding: [12, 12]});
  setTimeout(() => mapaEpocas.invalidateSize(), 60);
}
