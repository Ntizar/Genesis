/* Test e2e del stack completo de GÉNESIS en Node (simula el navegador sin DOM) */
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const DATA = path.join(__dirname, '..', 'js');
const APP = path.join(__dirname, '..', 'app');

let fallos = 0;
function test(nombre, cond, detalle) {
  console.log((cond ? '  OK   ' : '  FAIL ') + nombre + (cond ? '' : ' :: ' + detalle));
  if (!cond) fallos++;
}

(async () => {
  const sandbox = {
    console, setTimeout, clearTimeout, requestAnimationFrame: fn => setTimeout(fn, 0),
    performance, TextDecoder, TextEncoder, URL, Blob, Response, DecompressionStream,
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    document: { addEventListener: () => {} },   // stub: app.js solo registra el listener al cargar
    window: null
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);
  const ev = expr => vm.runInContext(expr, ctx, { filename: 'test-inline' });

  const cargar = (f, base) => vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), ctx, { filename: f });
  cargar('js/data_payload.js', path.join(__dirname, '..'));
  cargar('js/derived_payload.js', path.join(__dirname, '..'));
  cargar('js/reg_k36_v2.js', path.join(__dirname, '..'));
  cargar('js/pools_data.js', path.join(__dirname, '..'));
  cargar('js/geo_data.js', path.join(__dirname, '..'));
  cargar('js/k36names_data.js', path.join(__dirname, '..'));
  cargar('js/motor.js', path.join(__dirname, '..'));
  cargar('js/nnls.js', path.join(__dirname, '..'));
  cargar('app/js/util.js', path.join(__dirname, '..'));
  cargar('app/js/analisis.js', path.join(__dirname, '..'));
  cargar('app/js/vistas.js', path.join(__dirname, '..'));
  cargar('app/js/mapas.js', path.join(__dirname, '..'));
  cargar('app/app.js', path.join(__dirname, '..'));

  // T0: consts y funciones presentes
  test('T0 payloads y funciones en el contexto', ev('typeof K36_SNPS_GZ_B64 === "string" && typeof GENESIS_POOLS === "object" && typeof Motor === "object" && typeof nnls === "function" && typeof analizarRaw === "function" && typeof modeloEpocas === "function" && typeof demoTexto === "function"'), 'faltan símbolos');

  await ev('cargarDatos()');
  test('T1 panel 165.688 SNP', ev('state.snps.length') === 165688, ev('state.snps.length'));
  test('T2 modernas 11.899 / antiguas 7.292', ev('state.modern.length') === 11899 && ev('state.ancient.length') === 7292, ev('state.modern.length') + '/' + ev('state.ancient.length'));
  test('T3 7 pools con centroide 25D', ev('state.pools.length') === 7 && ev('state.pools.every(p=>p.centroide&&p.centroide.length===25)'), 'pools mal');
  test('T4 geo > 2.700 prefijos', ev('Object.keys(state.geo.geo).length') > 2700, ev('Object.keys(state.geo.geo).length'));
  test('T5 Natural Earth cargado', ev('state.ne && state.ne.features && state.ne.features.length') > 100, ev('state.ne && state.ne.features && state.ne.features.length'));

  const resumen = await ev(`(async()=>{
    const txt = demoTexto();
    const r = await analizarRaw('demo', txt);
    r.vecinos = vecinos(r.g25, 25);
    r.nnls = modeloEpocas(r.g25);
    state.ultimo = r;
    return JSON.stringify({
      lineas: txt.split('\\n').length,
      snp: r.calls.length, flips: r.flips, discord: r.discord,
      top3m: r.vecinos.modernas.slice(0,3).map(x=>x.name+'|'+x.dPct),
      top3a: r.vecinos.antiguas.slice(0,3).map(x=>x.name+'|'+x.dPct),
      geoOK: r.vecinos.modernas.filter(x=>x.ll).length,
      epocas: r.nnls.lista.map(c=>c.pool.id+':'+Math.round(c.w*100)+'%'),
      residuo: +r.nnls.residuo.toFixed(4), r2: +r.nnls.r2.toFixed(3),
      k36top: r.q.map((v,k)=>({v,k})).sort((a,b)=>b.v-a.v).slice(0,3).map(x=>'k'+x.k+':'+(x.v*100).toFixed(0)+'%')
    });
  })()`);
  const R = JSON.parse(resumen);
  console.log('\n→ RESULTADO DEMO:', JSON.stringify(R, null, 1));

  test('T6 demo 801 líneas y ≥790 SNP usados', R.lineas === 801 && R.snp >= 790, R.lineas + '/' + R.snp);
  test('T7 vecinos modernos geolocalizados ≥ 20/25', R.geoOK >= 20, R.geoOK);
  test('T8 modelo con 2+ épocas activas', R.epocas.length >= 2, R.epocas.length);
  // mix validada en el motor: 50% ibérico + 20% danés + 15% bereber + 15% americano →
  // el vecino coherente es población de ascendencia europea o iberoamericana (ver test-motor.js T6b)
  test('T9 top moderno de ascendencia europea/iberoamericana', /^(Afrikaner|.*Dutch|.*Netherlands|.*Spain|Spanish|.*Portug|Basque|Canarias|French|.*German|Mexican|Colombian|.*Peruvian|.*Argentin)/.test(R.top3m[0] || ''), R.top3m && R.top3m[0]);
  test('T10 modelo por épocas encaja (residuo < 0.06, R² > 0.85)', R.residuo < 0.06 && R.r2 > 0.85, R.residuo + '/R²=' + R.r2);
  // identifiabilidad K36 documentada: con 797 SNP la masa se reparte pero el argmax es correcto
  test('T11 argmax K36 = k3 (ibérico)', (R.k36top[0] || '').startsWith('k3:'), R.k36top[0]);

  // rasgos con el mapa del demo (el demo no tiene rs4988235 garantizado, pero la función no debe lanzar)
  const nrasgos = await ev('rasgosDesdeMapa(state.ultimo.mapa).length');
  test('T12 rasgos evaluados sin error (6)', nrasgos === 6, nrasgos);

  console.log('\nRESULTADO: ' + (fallos === 0 ? 'TODOS LOS TESTS OK' : fallos + ' FALLOS'));
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('ERROR FATAL:', e); process.exit(2); });
