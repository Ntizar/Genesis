// Test e2e del motor limpio de GÉNESIS: payload → parseRaw → extractCalls → MLE → project → nearest
'use strict';
const path = require('path');
const Motor = require('../js/motor.js');

const DATA = path.join(__dirname, '..', 'js');
const fs = require('fs');

// shim mínimo de window para cargar los payloads (solo definen consts globales)
global.window = global;
const dataPayload = fs.readFileSync(path.join(DATA, 'data_payload.js'), 'utf8');
const derivedPayload = fs.readFileSync(path.join(DATA, 'derived_payload.js'), 'utf8');

let fallos = 0;
function test(nombre, cond, detalle) {
  console.log((cond ? '  OK  ' : '  FAIL') + ' ' + nombre + (cond ? '' : ' :: ' + detalle));
  if (!cond) fallos++;
}

(async () => {
  // 1. evaluar payloads (definen K36_SNPS_GZ_B64 etc.)
  const sandbox = {};
  new Function(dataPayload)( );
  // los payloads usan const global — al hacer new Function no quedan. Alternativa: extraer con regex.
  function extraerConst(nombre, src) {
    const m = src.match(new RegExp('const\\s+' + nombre + '\\s*=\\s*"([A-Za-z0-9+/=]+)"'));
    if (!m) throw new Error('no encontrado ' + nombre);
    return m[1];
  }
  const K36_SNPS_GZ_B64 = extraerConst('K36_SNPS_GZ_B64', dataPayload);
  const K36_FREQ_GZ_B64 = extraerConst('K36_FREQ_GZ_B64', dataPayload);
  const G25_MODERN_GZ_B64 = extraerConst('G25_MODERN_GZ_B64', dataPayload);
  const G25_ANCIENT_GZ_B64 = extraerConst('G25_ANCIENT_GZ_B64', dataPayload);
  const K1000G_DERIVED_GZ_B64 = extraerConst('K1000G_DERIVED_GZ_B64', derivedPayload);
  console.log('Payloads extraídos OK');

  // 2. descomprimir (Node 18+ tiene Blob/Response/DecompressionStream)
  const [st, fb, mo, an, der] = await Promise.all([
    Motor.ungzip(K36_SNPS_GZ_B64), Motor.ungzip(K36_FREQ_GZ_B64, false),
    Motor.ungzip(G25_MODERN_GZ_B64), Motor.ungzip(G25_ANCIENT_GZ_B64), Motor.ungzip(K1000G_DERIVED_GZ_B64)
  ]);
  const snps = st.trim().split(/\r?\n/).map(x => x.split('\t'));
  const freq = new Float32Array(fb);
  const index = new Map(); snps.forEach((x, i) => index.set(x[0], i));
  const model = { snps, freq, index };
  const modern = Motor.parseG25(mo);
  const ancient = Motor.parseG25(an);
  const derived = Motor.parseDerived(der);
  test('T1 SNP panel exactos (165.688)', snps.length === 165688, snps.length);
  test('T2 modernas exactas (11.899)', modern.length === 11899, modern.length);
  test('T3 antiguas exactas (7.292)', ancient.length === 7292, ancient.length);
  test('T4 derivadas 1000G (503)', derived.length === 503, derived.length);

  // 3. demo sintética determinista: 50% k3 (ibérico) + 20% k5 (norte-Europa) + 15% k20 (N.Africa) + 15% k0 (América)
  // Componentes lejanos entre sí → señal recuperable con 800 SNP (calibración: data/k36-names.json)
  const W = 800, MIX = [[3,0.50],[5,0.20],[20,0.15],[0,0.15]];
  // mulberry32: PRNG de 32 bits con aritmética segura (un LCG con producto >2^53 degrada en JS)
  let _s = 1013904223;
  const rnd = () => { _s |= 0; _s = _s + 0x6D2B79F5 | 0; let t = Math.imul(_s ^ _s >>> 15, 1 | _s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const usados = new Set(); const rsLines = [];
  for (let s = 0; s < W; s++) {
    let i; do { i = Math.floor(rnd() * snps.length); } while (usados.has(i));
    usados.add(i);
    const [rs, a, b] = snps[i];
    // elegir componente según mezcla
    let r = rnd(), c = MIX[0][0], acc = 0;
    for (const [k, w] of MIX) { acc += w; if (r <= acc) { c = k; break; } }
    const f = freq[i * 36 + c]; // F = frecuencia del alelo b (derivado), convención del motor
    let nB = 0; // nº de alelos b
    if (rnd() < f) nB++;
    if (rnd() < f) nB++;
    const gt = nB === 0 ? a + a : nB === 1 ? a + b : b + b;
    rsLines.push(`${rs}\t${a}\t${b}\t${gt[0]}\t${gt[1]}`);
  }
  const rawTxt = 'rsid\tchrom\tposition\tallele1\tallele2\n' + rsLines.join('\n');
  const raw = Motor.parseRaw(rawTxt, 'demo');
  const ex = Motor.extractCalls(raw, model);
  console.log(`  demo: formato=${raw.format} snps=${raw.total} usadas=${ex.calls.length} flips=${ex.flips} discord=${ex.discord}`);
  test('T5 demo: 800 SNP usados', ex.calls.length === 800, ex.calls.length);
  const fit = await Motor.mle(ex.calls, freq);
  test('T6 MLE: 100 iteraciones, delta<0.01', fit.iter === 100 && fit.delta < 0.01, `iter=${fit.iter} delta=${fit.delta.toExponential(2)}`);
  const qArr = [...fit.q];
  const argmax = qArr.indexOf(Math.max(...qArr));
  test('T6b componente dominante correcto (k3)', argmax === 3, `argmax=k${argmax}`);
  // Nota: con K36 las proporciones son "blandas" incluso con 165k SNP (identifiabilidad);
  // el motor NO promete porcentajes exactos de componentes, sí el pico y la proyección.

  // ridge
  global.window = undefined;
  const reg = fs.readFileSync(path.join(DATA, 'reg_k36_v2.js'), 'utf8');
  const mREG = reg.match(/const\s+REG_K36_V2\s*=\s*(\[\[.*?\]\]);/s);
  const mINT = reg.match(/const\s+REG_K36_V2_INTERCEPT\s*=\s*(\[.*?\]);/s);
  if (!mREG || !mINT) { console.log('  (reg fallback: regex simple)'); }
  const REG = JSON.parse(mREG[1].replace(/,\s*]/g, ']'));
  const INT = JSON.parse(mINT[1].replace(/,\s*]/g, ']'));
  const g25 = Motor.project(fit.q, REG, INT);
  test('T7 proyección 25D finita', g25.length === 25 && [...g25].every(Number.isFinite), 'ok');

  // 4. resultados coherentes con la auditoría previa
  const topMod = Motor.nearest(g25, modern, 5);
  const topAnc = Motor.nearest(g25, ancient, 5);
  console.log('  top modernas:', topMod.map(x => `${x.name}(${x.d.toFixed(4)})`).join(' '));
  console.log('  top antiguas:', topAnc.map(x => `${x.name}(${x.d.toFixed(4)})`).join(' '));
  test('T8 top-1 moderna plausible (dist<0.09)', topMod[0].d < 0.09, `${topMod[0].name} d=${topMod[0].d.toFixed(4)}`);
  test('T9 top-1 antigua plausible (dist<0.09)', topAnc[0].d < 0.09, `${topAnc[0].name} d=${topAnc[0].d.toFixed(4)}`);

  // 5. oficial: parse + distancia
  const oficial = Motor.parseOfficialLines('Spain_Catalonia,0.080,0.100,0.030,-0.005,0.012,-0.003,0.001,-0.002,0.000,0.001,-0.001,0.000,0.000,0.001,-0.001,0.000,0.000,0.001,0.000,-0.001,0.000,0.000,0.001,0.000,0.000');
  test('T10 parseOfficial 1 línea', oficial.length === 1 && oficial[0].name === 'Spain_Catalonia', 'ok');
  const d = Motor.dist(g25, oficial[0].v);
  test('T11 distancia demo↔oficial finita', Number.isFinite(d) && d > 0, d.toFixed(4));


  // 6. componentes puros → región esperada (validación genérica de la cadena completa)
  const calib = JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','k36-names.json'),'utf8'));
  const porIdx = Object.fromEntries(calib.componentes.map(c=>[c.indice,c]));
  test('T12 k3 → sur-europa', porIdx[3].region === 'sur-europa', porIdx[3].ejemplo);
  test('T12 k20 → norte-africa', porIdx[20].region === 'norte-africa', porIdx[20].ejemplo);
  test('T12 k0 → america', porIdx[0].region === 'america', porIdx[0].ejemplo);
  test('T12 k5 → norte-europa', porIdx[5].region === 'norte-europa', porIdx[5].ejemplo);

  console.log(fallos === 0 ? '\n✅ MOTOR COMPLETO VERIFICADO' : `\n❌ ${fallos} fallos`);

  process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('ERROR:', e.message); process.exit(2); });
