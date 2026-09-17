/* GÉNESIS — vistas del estudio (Aurora 7) */
'use strict';

function colorK36(k){
  const c = state.k36names.componentes && state.k36names.componentes[k];
  return (c && c.color) || '#2563eb';
}
function nombreK36(k){
  const c = state.k36names.componentes && state.k36names.componentes[k];
  return (c && (c.region || c.nombre)) || ('Componente ' + (k+1));
}

/* KPIs de cabecera del estudio */
function renderKpis(r, nnlsRes){
  $('#kpiNombre').textContent = r.nombre;
  $('#kpiFuente').textContent = r.fuente === 'oficial' ? 'G25 oficial' : (r.fuente === 'demo' ? 'demo sintética' : 'raw ' + (r.formato || ''));
  $('#kpiSnp').textContent = r.calls ? fmtNum(r.calls.length) : '—';
  const topMod = r.vecinos.modernas[0];
  $('#kpiTopModerna').textContent = topMod ? topMod.name.replace(/_/g, ' ') : '—';
  const top = nnlsRes.lista[0];
  $('#kpiTopAntigua').textContent = top ? top.pool.etiqueta : '—';
}

/* donut K36: componentes ordenados, pequeños agrupados en "otros" */
function renderDonutK36(r){
  const datos = [...r.q]
    .map((v, k) => ({k, v}))
    .sort((a, b) => b.v - a.v);
  const grandes = datos.filter(d => d.v >= 0.02).slice(0, 8);
  const resto = datos.filter(d => !grandes.includes(d)).reduce((s, d) => s + d.v, 0);
  const vis = grandes.map(d => ({valor: d.v, color: colorK36(d.k), etiqueta: nombreK36(d.k)}));
  if (resto > 0.004) vis.push({valor: resto, color: '#94a3b8', etiqueta: 'Otros'});
  $('#donutK36').innerHTML = donutHTML(vis, null, null, 'nz-chart-donut--lg');
  $('#donutLeyenda').innerHTML = leyendaHTML(vis);
}

/* vecinos modernos y antiguos: tabla de barras por distancia (menor = más cerca) */
function renderVecinos(r){
  const filas = (lista) => lista.slice(0, 10).map(x => ({
    nombre: x.name.replace(/_/g, ' '),
    valor: Math.max(0, 0.12 - Math.min(x.d, 0.12)),
    texto: x.dPct
  }));
  $('#vecinosMod').innerHTML = tablebarHTML(filas(r.vecinos.modernas));
  $('#vecinosAnc').innerHTML = tablebarHTML(filas(r.vecinos.antiguas));
}

/* PCA: tú + 12 vecinos modernos + 12 antiguos */
function renderPCA(r){
  const mod = r.vecinos.modernas.slice(0, 12);
  const anc = r.vecinos.antiguas.slice(0, 12);
  const pts25 = [r.g25, ...mod.map(x => x.v), ...anc.map(x => x.v)];
  const escala = escalaPCA(pts25);
  const puntos = [];
  mod.forEach(x => puntos.push({...escala(x.v), clase: '', tooltip: x.name.replace(/_/g, ' ') + ' · moderno · ' + x.dPct}));
  anc.forEach(x => puntos.push({...escala(x.v), clase: 'nz-chart-scatter__dot--muted', tooltip: x.name.replace(/_/g, ' ') + ' · antiguo · ' + x.dPct}));
  puntos.unshift({...escala(r.g25), clase: 'genes-dot-yo', tooltip: r.nombre + ' (tú)'});
  $('#pca').innerHTML = scatterHTML(puntos, 'PC1 →', 'PC2 ↑');
}

/* modelo por épocas: barras horizontales + narrativa */
function renderEpocas(r, nnlsRes){
  const wrap = $('#modeloEpocas');
  if (!nnlsRes.lista.length){ wrap.innerHTML = '<p class="genes-p genes-muted">Sin contribuciones detectables.</p>'; return; }
  const filas = nnlsRes.lista.map(c => ({
    nombre: c.pool.etiqueta,
    valor: c.w,
    texto: fmtPct(c.w),
    color: c.pool.color
  }));
  wrap.innerHTML = tablebarHTML(filas) +
    `<p class="genes-p genes-xs genes-muted" style="margin-top:var(--nz-space-2)">Modelo con ${nnlsRes.lista.length} fuentes activas · error residual ${(nnlsRes.residuo*100).toFixed(2)} % · R² ${nnlsRes.r2.toFixed(3)} · ${nnlsRes.iter} iteraciones.</p>`;
  const desc = nnlsRes.lista.map((c, i) => {
    const pct = fmtPct(c.w);
    if (i === 0) return `${pct} encaja con ${NARRATIVAS[c.pool.id][0]} — ${NARRATIVAS[c.pool.id][1]}`;
    return `${pct} con ${NARRATIVAS[c.pool.id][0]} (${NARRATIVAS[c.pool.id][1]})`;
  });
  $('#narraModelo').innerHTML = `<b>${esc(r.nombre)}</b>, tu genoma se explica mejor como: ` + desc.join('; ') + '.';
}

/* modelos alternativos: raíces profundas y mezcla de vecinos */
function renderModelos(r, mod){
  const tb = (lista, etiqueta) => tablebarHTML(lista.map(x => ({
    nombre: etiqueta(x), valor: x.w, texto: fmtPct(x.w), color: x.color || 'var(--accent)'
  })));
  const rj = mod.raices;
  $('#modeloRaices').innerHTML = tb(rj.lista, x => x.etiqueta) +
    `<p class="genes-p genes-xs genes-muted" style="margin-top:var(--nz-space-2)">R² ${rj.r2.toFixed(3)} · error ${(rj.residuo*100).toFixed(2)} %</p>`;
  $('#narraRaices').innerHTML = esc(rj.nota);
  const rv = mod.vecinos;
  $('#modeloVecinos').innerHTML = tb(rv.lista, x => x.name.replace(/:/g, ' · ').replace(/_/g, ' ')) +
    `<p class="genes-p genes-xs genes-muted" style="margin-top:var(--nz-space-2)">R² ${rv.r2.toFixed(3)} · error ${(rv.residuo*100).toFixed(2)} %</p>`;
  $('#narraVecinos').innerHTML = `Lectura geográfica: la combinación de poblaciones actuales que mejor reproduce tu G25. Con canciones de distancia ~0,02 cualquier combinación de vecinas es plausible; fíjate más en la coincidencia entre modelos que en el % exacto.`;
}

/* timeline histórica: épocas ordenadas con peso */
function renderTimeline(r, nnlsRes){
  const pools = [...state.pools].sort((a, b) => a.inicio - b.inicio);
  const wDe = id => { const c = nnlsRes.lista.find(x => x.pool.id === id); return c ? c.w : 0; };
  const maxW = Math.max(...pools.map(p => wDe(p.id)), 0.001);
  const items = pools.map(p => {
    const w = wDe(p.id);
    const años = p.inicio < 0 ? `${Math.abs(p.inicio).toLocaleString('es-ES')} a. C.` : `${p.inicio} d. C.`;
    const fin = p.fin < 0 ? `${Math.abs(p.fin).toLocaleString('es-ES')} a. C.` : `${p.fin} d. C.`;
    return `<div class="nz-timeline__item">
      <span class="nz-timeline__dot" style="background:${p.color};${w < 0.01 ? 'opacity:.35' : ''}"></span>
      <span class="nz-timeline__time">${años} — ${fin}</span>
      <span class="nz-timeline__title">${esc(p.etiqueta)} ${w >= 0.005 ? '· ' + fmtPct(w) : ''}</span>
      ${p.notas ? `<span class="nz-timeline__card">${esc(p.notas)}</span>` : ''}
    </div>`;
  }).join('');
  $('#timelineHistoria').innerHTML = `<div class="nz-timeline">${items}</div>`;
}

/* rasgos: pestaña eliminada 2026-09-17 */
