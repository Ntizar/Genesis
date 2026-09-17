/* GÉNESIS — controlador: tabs, carga y orquestación (Aurora 7) */
'use strict';

/* ---------- pestañas ---------- */
function activarTab(id){
  $$('.nz-tab').forEach(t => t.classList.toggle('nz-tab--active', t.dataset.tab === id));
  $$('main > section').forEach(s => { s.hidden = (s.id !== 'tab-' + id); });
  if (id === 'mapa' && state.ultimo){ renderMapaVecinos(state.ultimo); renderMapaEpocas(state.ultimo.nnls); }
}

/* ---------- progreso y errores ---------- */
function progreso(txt, pct){ $('#estadoTxt').textContent = txt; $('#barra').style.width = pct + '%'; }
function errorApp(msg){ const b = $('#errbox'); b.hidden = false; b.querySelector('p').textContent = msg; }
function limpiarError(){ $('#errbox').hidden = true; }

/* ---------- lectura de fichero (con .gz y .zip) ---------- */
async function leerFichero(file){
  const nombre = file.name;
  const leer = () => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsText(file); });
  if (/\.gz$/i.test(nombre)){
    const buf = await file.arrayBuffer();
    const ab = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    return {nombre: nombre.replace(/\.gz$/i, ''), texto: new TextDecoder().decode(ab)};
  }
  if (/\.zip$/i.test(nombre)){
    if (typeof JSZip === 'undefined') throw new Error('No se pudo cargar el descompresor ZIP. Recarga la página (Ctrl+F5) e inténtalo de nuevo.');
    const zip = await JSZip.loadAsync(file);
    const candidatos = [];
    for (const f of Object.values(zip.files)){
      if (f.dir) continue;
      const n = f.name;
      let texto = null;
      if (/\.(txt|csv|vcf)$/i.test(n)){
        texto = await f.async('string');
      } else if (/\.gz$/i.test(n) && /\.(txt|csv|vcf)\.gz$/i.test(n)){
        // 23andMe anida el raw como .txt.gz dentro del zip
        try{
          const buf = await f.async('arraybuffer');
          const ab = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
          texto = new TextDecoder().decode(ab);
        }catch(e){ texto = null; }
      }
      if (texto == null) continue;
      const s = Motor.puntuaRaw(texto);
      if (s.puntos > 0) candidatos.push({nombre: n.replace(/\.gz$/i,''), texto, puntos: s.puntos});
    }
    if (!candidatos.length) throw new Error('El ZIP no contiene ningún raw reconocible (un .txt/.csv/.vcf con rsID dentro).');
    candidatos.sort((a, b) => b.puntos - a.puntos);
    return {nombre: candidatos[0].nombre, texto: candidatos[0].texto};
  }
  return {nombre, texto: await leer()};
}

/* ---------- orquestación del estudio ---------- */
async function ejecutarEstudio(nombre, texto, fuente){
  limpiarError();
  $('#progreso').hidden = false;
  progreso('Preparando…', 2);
  try{
    let r;
    if (fuente === 'oficial'){
      const of = Motor.parseOfficialLines(texto)[0];
      let gv = of.v, etiqueta = 'oficial';
      if (of.escala === 'raw'){
        gv = Motor.escalarRawOficial(of.v);
        etiqueta = 'oficial · Raw escalado a Scaled (ley K, 2026-09)';
      }
      r = estudioDesdeG25(of.name || nombre, gv, etiqueta);
      r.vecinos = vecinos(r.g25, 25);
      r.nnls = modeloEpocas(r.g25);
      r.modelos = modelosAlternativos(r.g25);
    } else {
      r = await analizarRaw(nombre, texto, progreso);
      r.vecinos = vecinos(r.g25, 25);
      r.nnls = modeloEpocas(r.g25);
      r.modelos = modelosAlternativos(r.g25);
    }
    state.ultimo = r;
    state.results.push(r);
    progreso('Renderizando el estudio…', 96);
    renderKpis(r, r.nnls);
    renderDonutK36(r);
    renderVecinos(r);
    renderEpocas(r, r.nnls);
    renderModelos(r, r.modelos);
    renderTimeline(r, r.nnls);
    renderPCA(r);
    activarTab(state.tabPedida || 'estudio');
    window.scrollTo({top: 0, behavior: 'smooth'});
    progreso('Estudio completo.', 100);
    document.title = 'OK: ' + r.nombre + ' · ' + r.nnls.lista.map(c => Math.round(c.w*100) + '% ' + c.pool.id).join(', ');
    setTimeout(() => { $('#progreso').hidden = true; }, 800);
  }catch(e){
    console.error(e);
    document.title = 'ERR: ' + e.message;
    errorApp('No se pudo completar el estudio: ' + e.message);
    $('#progreso').hidden = true;
  }
}

/* ---------- demo sintética determinista (misma mezcla que el test del motor) ---------- */
function demoTexto(){
  const MIX = [[3, 0.50], [5, 0.20], [20, 0.15], [0, 0.15]];   // k3 ibérico + k5 N.Europa + k20 N.África + k0 América
  let _s = 1013904223;
  const rnd = () => { _s |= 0; _s = _s + 0x6D2B79F5 | 0; let t = Math.imul(_s ^ _s >>> 15, 1 | _s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const filas = ['rsid,cromosoma,posicion,alelo1,alelo2'];
  const N = state.snps.length;
  for (let n = 0; n < 800; n++){
    const idx = Math.floor(rnd() * N);
    const snp = state.snps[idx];
    const a = snp[1], b = snp[2];
    // muestreo del componente elegido: p(alelo derivado b) = frecuencia del componente
    let p = 0;
    let u = rnd(), acc = 0;
    for (const [k, w] of MIX){ acc += w; if (u < acc){ p = state.freq[idx * 36 + k]; break; } }
    const g1 = rnd() < p ? b : a;
    const g2 = rnd() < p ? b : a;
    filas.push(`${snp[0]},1,${1000 + n},${g1},${g2}`);
  }
  return filas.join('\n');
}

/* ---------- informe exportable (HTML autocontenido) ---------- */
function descargarInforme(){
  const r = state.ultimo;
  if (!r) return;
  const secciones = [];
  secciones.push(`<h2>Resumen</h2><p>Muestra <b>${esc(r.nombre)}</b> · fuente ${esc(r.fuente)}${r.calls ? ' · ' + fmtNum(r.calls.length) + ' SNP usados' : ''}.</p>`);
  secciones.push(`<h2>Modelo por épocas (NNLS 25D)</h2><ul>` +
    r.nnls.lista.map(c => `<li><b>${esc(c.pool.etiqueta)}</b>: ${fmtPct(c.w)} ${c.pool.notas ? '— ' + esc(c.pool.notas) : ''}</li>`).join('') + `</ul>`);
  secciones.push(`<h2>Vecinos modernos</h2><ol>` + r.vecinos.modernas.slice(0, 15).map(x => `<li>${esc(x.name)} — ${x.dPct}</li>`).join('') + `</ol>`);
  secciones.push(`<h2>Vecinos antiguos</h2><ol>` + r.vecinos.antiguas.slice(0, 15).map(x => `<li>${esc(x.name)} — ${x.dPct}</li>`).join('') + `</ol>`);
  if (r.q) secciones.push(`<h2>Composición K36</h2><ul>` + [...r.q].map((v, k) => ({k, v})).sort((a, b) => b.v - a.v).filter(x => x.v >= 0.01)
    .map(x => `<li>${esc(nombreK36(x.k))}: ${fmtPct(x.v)}</li>`).join('') + `</ul>`);
  if (r.modelos){
    if (r.modelos.raices) secciones.push(`<h2>Modelo de raíces profundas (ADN antiguo)</h2><ul>` +
      r.modelos.raices.lista.map(x => `<li><b>${esc(x.etiqueta)}</b>: ${fmtPct(x.w)}</li>`).join('') +
      `</ul><p class="genes-xs">R² ${r.modelos.raices.r2.toFixed(3)} — ${esc(r.modelos.raices.nota)}</p>`);
    if (r.modelos.vecinos) secciones.push(`<h2>Modelo de vecinos (G25 moderno)</h2><ul>` +
      r.modelos.vecinos.lista.map(x => `<li><b>${esc(x.name.replace(/_/g, ' '))}</b>: ${fmtPct(x.w)}</li>`).join('') +
      `</ul><p class="genes-xs">R² ${r.modelos.vecinos.r2.toFixed(3)} — combinación óptima de las 10 poblaciones modernas más cercanas.</p>`);
  }
  if (r.g25) secciones.push(`<h2>Coordenadas G25 (25D, escaladas)</h2><p style="word-break:break-all;font-family:ui-monospace,monospace;font-size:.85rem">${esc(Array.from(r.g25).map(x => x.toFixed(6)).join(','))}</p><p class="genes-xs">Pégalas en Vahaduo/G25 para reproducir y comparar cualquiera de los modelos de este estudio.</p>`);
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>GÉNESIS — informe de ${esc(r.nombre)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:52rem;margin:2rem auto;padding:0 1rem;color:#0f172a}h1{color:#2563eb}h2{border-bottom:2px solid #e2e8f0;padding-bottom:.3rem;margin-top:2rem}table{border-collapse:collapse}td,th{padding:.3rem .6rem;border:1px solid #e2e8f0}</style></head><body>
<h1>GÉNESIS — estudio de ascendencia</h1>
<p>Estudio generado localmente. Motor K36+ridge v2 (GPL-3.0, stevenliuyi/admix) · datasheets G25 vía Vahaduo · 1000 Genomes fase 3.</p>
${secciones.join('')}
<p style="margin-top:3rem;color:#64748b;border-top:1px solid #e2e8f0;padding-top:1rem">Hecho con ❤️ por David Antizar</p>
</body></html>`;
  const blob = new Blob([html], {type: 'text/html'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'genesis-estudio-' + r.nombre.replace(/[^\w-]+/g, '_') + '.html';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- eventos ---------- */
function init(){
  try{
  // cualquier error del runtime se ve en la app (nada de consolas silenciosas)
  window.addEventListener('error', e => errorApp(e.message || 'Error desconocido'));
  window.addEventListener('unhandledrejection', e => errorApp('Promesa rechazada: ' + (e.reason && e.reason.message || e.reason)));
  $$('.nz-tab').forEach(t => {
    t.addEventListener('click', () => activarTab(t.dataset.tab));
    t.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); activarTab(t.dataset.tab); } });
  });
  const fz = $('#filezona'), fi = $('#fichero');
  fz.addEventListener('click', () => fi.click());
  fz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); fi.click(); } });
  fz.addEventListener('dragover', e => { e.preventDefault(); fz.classList.add('genes-drop--over'); });
  fz.addEventListener('dragleave', () => fz.classList.remove('genes-drop--over'));
  fz.addEventListener('drop', async e => {
    e.preventDefault(); fz.classList.remove('genes-drop--over');
    const f = e.dataTransfer.files[0];
    if (!f) return;
    try{ const {nombre, texto} = await leerFichero(f); ejecutarEstudio(nombre, texto, 'raw'); }
    catch(err){ errorApp('No se pudo leer el fichero: ' + err.message); }
  });
  fi.addEventListener('change', async () => {
    const f = fi.files[0];
    if (!f) return;
    try{ const {nombre, texto} = await leerFichero(f); ejecutarEstudio(nombre, texto, 'raw'); }
    catch(err){ errorApp('No se pudo leer el fichero: ' + err.message); }
  });
  $('#btnG25').addEventListener('click', () => {
    const txt = $('#g25texto').value;
    if (!txt.trim()){ errorApp('Pega primero tus coordenadas: nombre + 25 números separados por comas.'); return; }
    try{ ejecutarEstudio(null, txt, 'oficial'); }
    catch(err){ errorApp(err.message); }
  });
  $('#btnDemo').addEventListener('click', () => {
    document.title = 'DEMO START';
    try{ ejecutarEstudio('demo-ibero', demoTexto(), 'raw'); }
    catch(err){ document.title = 'DEMO ERR: ' + err.message; errorApp(err.message); }
  });
  $('#btnInforme').addEventListener('click', descargarInforme);

  // arranque: cargar payloads en segundo plano
  $('#progreso').hidden = false;
  cargarDatos(progreso).then(() => {
    $('#progreso').hidden = true;
    $('#estadoTxt').textContent = 'Motor listo: arrastra tu raw, pega coordenadas oficiales o lanza la demo.';
    // acceso directo para compartir: ?demo=1 o #demo ejecutan la demo al cargar (con el motor ya listo)
    if (location.search.indexOf('demo=1') !== -1 || location.hash === '#demo'){
      document.title = 'DEMO AUTO';
      ejecutarEstudio('demo-ibero', demoTexto(), 'raw');
    }
    // deep-link de pestañas: ?tab=mapa (o mapas) | estudio | carga
    const mTab = location.search.match(/tab=(\w+)/);
    let tId = mTab && mTab[1];
    if (tId === 'mapas') tId = 'mapa';
    if (tId && document.querySelector(`.nz-tab[data-tab="${tId}"]`)){ state.tabPedida = tId; activarTab(tId); }
  }).catch(e => {
  console.error(e);
  errorApp('Error cargando el motor local: ' + e.message);
  });
  }catch(err){ document.title = 'INIT ERR: ' + err.message; return; }
  document.title = 'INIT OK';
  }

document.addEventListener('DOMContentLoaded', init);
