/* GÉNESIS — mapas: mundo offline (canvas + Natural Earth) e Iberia IGN (Leaflet)
   2026-09-17 rediseño: cercanía por color (rampa azul continua), hover con tooltip,
   halo al vecino más cercano, leyenda épocas clicable y encuadre dinámico. */
'use strict';

/* ---------- mapa mundial offline de vecinos ---------- */
var VISTA_MUNDO = {minLon: -18, maxLon: 58, minLat: 18, maxLat: 72};

/* rampa de cercanía: t=0 → azul profundo (más cerca), t=1 → azul pálido (más lejos) */
function colorCercania(t, alpha){
  const paradas = [[30,58,138],[37,99,235],[147,197,253]]; // #1e3a8a → #2563eb → #93c5fd
  const s = Math.max(0, Math.min(1, t)) * 2;
  const i = Math.min(1, Math.floor(s)), f = s - i;
  const c = paradas[i].map((v, k) => Math.round(v + (paradas[i+1][k] - v) * f));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha === undefined ? 1 : alpha})`;
}

var _puntosMundo = [];

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
  // vecinos: los más lejanos primero, los cercanos encima; color = cercanía
  const maxD = Math.max(...puntos.map(p => p.d), 0.001);
  _puntosMundo = puntos.map(p => ({...p, x: X(p.ll[0]), y: Y(p.ll[1]), t: p.d / maxD}));
  const ordenados = [..._puntosMundo].sort((a, b) => b.t - a.t);
  for (const p of ordenados){
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 + (1 - p.t) * 9, 0, Math.PI * 2);
    ctx.fillStyle = colorCercania(p.t, 0.92 - p.t * 0.35);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  // halo al más cercano
  const top = ordenados[ordenados.length - 1];
  if (top){
    ctx.beginPath();
    ctx.arc(top.x, top.y, 17, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(37,99,235,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // etiquetas de los 3 más cercanos
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillStyle = '#1e3a8a';
  for (const p of puntos.slice(0, 3)){
    ctx.fillText(p.name.replace(/_/g, ' '), Math.min(X(p.ll[0]) + 8, W - 90), Y(p.ll[1]) - 6);
  }
}

function leyendaMundoHTML(){
  return `<span class="genes-leyenda__item">más cerca</span>
    <span class="genes-leyenda__rampa" aria-hidden="true"></span>
    <span class="genes-leyenda__item">más lejos</span>
    <span class="genes-leyenda__item genes-muted">· círculo mayor = más cercano · pasa el ratón para ver cada uno</span>`;
}

function renderMapaVecinos(r){
  const cv = $('#mapaMundo');
  if (!cv || !state.ne) return;
  // hover/touch: tooltip del vecino más próximo al puntero
  cv.onmousemove = ev => tooltipMundoMostrar(cv, ev);
  cv.onmouseleave = () => tooltipMundoOcultar(cv);
  cv.ontouchmove = ev => tooltipMundoMostrar(cv, ev);
  cv.ontouchend = () => tooltipMundoOcultar(cv);
  const pts = r.vecinos.modernas.filter(x => x.ll).slice(0, 24);
  const ley = $('#leyendaMundo');
  if (ley) ley.innerHTML = leyendaMundoHTML();
  if (!pts.length){ cv.parentElement.innerHTML = '<p class="genes-p genes-muted">Sin vecinos geolocalizables.</p>'; if (ley) ley.innerHTML = ''; return; }
  requestAnimationFrame(() => dibujarMundo(cv, pts));
}

/* tooltip flotante del mapa mundo (hover/ratón y toque) */
function tooltipMundoMostrar(cv, ev){
  let tip = cv.parentElement.querySelector('.genes-mapa-tip');
  if (!tip){ tip = document.createElement('div'); tip.className = 'genes-mapa-tip'; cv.parentElement.appendChild(tip); }
  const rect = cv.getBoundingClientRect();
  const mx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
  const my = (ev.touches ? ev.touches[0].clientY : ev.clientY) - rect.top;
  let mejor = null, mejorD = 18 * 18;
  for (const p of _puntosMundo){
    const dd = (p.x - mx) * (p.x - mx) + (p.y - my) * (p.y - my);
    if (dd < mejorD){ mejorD = dd; mejor = p; }
  }
  if (!mejor){ tip.hidden = true; cv.style.cursor = 'default'; return; }
  tip.hidden = false;
  cv.style.cursor = 'pointer';
  tip.style.left = Math.min(Math.max(mejor.x, 70), rect.width - 70) + 'px';
  tip.style.top = Math.max(mejor.y - 14, 34) + 'px';
  tip.innerHTML = `<b>${esc(mejor.name.replace(/_/g, ' '))}</b> · ${esc(mejor.dPct || ('dist ' + mejor.d.toFixed(3)))}`;
}

function tooltipMundoOcultar(cv){
  const tip = cv.parentElement.querySelector('.genes-mapa-tip');
  if (tip) tip.hidden = true;
}

/* ---------- mapa IGN de épocas (Leaflet, carga diferida) ---------- */
let mapaEpocas = null;
var _marcadoresEpocas = {};

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
  _marcadoresEpocas = {};
  const activos = nnlsRes.lista;
  const maxW = Math.max(...activos.map(c => c.w), 0.001);
  const bounds = L.latLngBounds([[26, -19], [45, 6]]);
  for (const c of activos){
    const [lat, lon] = c.pool.ancla;
    bounds.extend([lat - 1.5, lon - 1.5]);
    bounds.extend([lat + 1.5, lon + 1.5]);
    const radio = 8 + (c.w / maxW) * 22;
    const m = L.circleMarker([lat, lon], {
      radius: radio, color: '#ffffff', weight: 1.5,
      fillColor: c.pool.color, fillOpacity: 0.5 + 0.3 * (c.w / maxW)
    }).addTo(mapaEpocas)
      .bindTooltip(`${esc(c.pool.etiqueta)} · ${fmtPct(c.w)}`, {direction: 'top', offset: [0, -6]})
      .bindPopup(`<b>${esc(c.pool.etiqueta)}</b><br>${fmtPct(c.w)} del modelo<br><span style="color:#64748b">${esc(c.pool.notas || '')}</span>`);
    _marcadoresEpocas[c.pool.id] = m;
  }
  mapaEpocas.fitBounds(bounds, {padding: [14, 14]});
  setTimeout(() => mapaEpocas.invalidateSize(), 60);
  leyendaEpocas(activos);
}

/* leyenda de épocas sobre el mapa IGN: click = volar al ancla y abrir su ficha */
function leyendaEpocas(activos){
  const ley = $('#leyendaEpocas');
  if (!ley) return;
  if (!activos.length){ ley.innerHTML = ''; ley.hidden = true; return; }
  ley.hidden = false;
  ley.innerHTML = activos.map(c => `<button type="button" class="genes-leyenda-epoca" data-pool="${esc(c.pool.id)}" style="--epoca:${esc(c.pool.color)}">
      <i aria-hidden="true"></i>${esc(c.pool.etiqueta)} · ${fmtPct(c.w)}
    </button>`).join('');
  ley.querySelectorAll('.genes-leyenda-epoca').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = _marcadoresEpocas[btn.dataset.pool];
      if (m && mapaEpocas){ mapaEpocas.flyToBounds(m.getBounds().pad(6), {maxZoom: 6, duration: 0.6}); setTimeout(() => m.openPopup(), 650); }
    });
  });
}
