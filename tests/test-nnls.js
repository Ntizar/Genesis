// Tests del NNLS de GÉNESIS con datos reales G25
'use strict';
const { nnls, normalizar } = require('../js/nnls.js');
const fs = require('fs');

// cargar coordenadas reales desde ancient.txt
const lines = fs.readFileSync('data/src/ancient.txt', 'utf8').trim().split('\n');
const refs = {};
for (const l of lines) {
  if (!l || l.startsWith(',')) continue;           // cabecera y líneas vacías
  const parts = l.split(',');
  const nombre = parts[0];
  const coords = parts.slice(1, 26).map(Number);
  if (coords.length === 25 && coords.every(Number.isFinite)) refs[nombre] = coords;
}
console.log('Refs cargadas:', Object.keys(refs).length);

function buscar(prefijo) {
  const k = Object.keys(refs).find(n => n.startsWith(prefijo));
  if (!k) throw new Error('No encontrado: ' + prefijo);
  return { nombre: k, v: refs[k] };
}

let fallos = 0;
function test(nombre, cond, detalle) {
  console.log((cond ? '  OK  ' : '  FAIL') + ' ' + nombre + (cond ? '' : ' :: ' + detalle));
  if (!cond) fallos++;
}

// ---- Test 1: mezcla conocida de 2 fuentes, recuperación exacta ----
{
  const a = buscar('Spain_SE_Iberia_BA_Argar'), b = buscar('Turkey_Buyukkaya_EC');
  const wReal = [0.62, 0.38];
  const bvec = a.v.map((v, d) => wReal[0] * v + wReal[1] * b.v[d]);
  const r = nnls([a.v, b.v], bvec);
  const w = r.w;
  test('T1 2-fuentes recupera pesos (±0.01)',
    Math.abs(w[0] - 0.62) < 0.01 && Math.abs(w[1] - 0.38) < 0.01,
    `got [${w.map(x => x.toFixed(4))}] iter=${r.iter}`);
  test('T1 residuo ~0', r.residuo < 1e-6, r.residuo.toExponential(2));
}

// ---- Test 2: 3 fuentes + ruido → R² alto y pesos próximos ----
{
  const A = [buscar('Spain_C_oSteppe'), buscar('Germany_BellBeaker'), buscar('Morocco_EN')].map(x => x.v);
  const wReal = [0.55, 0.30, 0.15];
  let bvec = A[0].map((_, d) => wReal[0] * A[0][d] + wReal[1] * A[1][d] + wReal[2] * A[2][d]);
  // ruido determinista 0.5%
  bvec = bvec.map((v, i) => v * (1 + 0.005 * Math.sin(i * 2.399)));
  const r = nnls(A, bvec);
  const maxErr = Math.max(...r.w.map((v, i) => Math.abs(v - wReal[i])));
  test('T2 pesos 3-fuentes con ruido ±0.02', maxErr < 0.02, `got [${r.w.map(x => x.toFixed(4))}] maxErr=${maxErr.toFixed(4)}`);
  test('T2 R² > 0.999', r.r2 > 0.999, r.r2.toFixed(5));
}

// ---- Test 3: restricción de no-negatividad ----
{
  // b = Spain_C - 0.5*Anatolia (dirección imposible físicamente) → peso anatolia debe ser 0
  const a = buscar('Spain_C_oSteppe'), b = buscar('Turkey_Buyukkaya_EC');
  const bvec = a.v.map((v, d) => v - 0.5 * b.v[d]);
  const r = nnls([a.v, b.v], bvec);
  // La componente negativa debe quedar clamped a 0, y el residuo no puede ser peor
  // que el del punto (1,0) [proyección pura sobre a].
  const res10 = Math.sqrt(bvec.reduce((s, v, d) => s + (v - a.v[d]) ** 2, 0));
  test('T3 NNLS clampa componente negativa a 0', r.w[1] === 0, `got w=[${r.w.map(x => x.toFixed(4))}]`);
  test('T3 residuo ≤ proyección pura', r.residuo <= res10 + 1e-9, `${r.residuo.toFixed(4)} vs ${res10.toFixed(4)}`);
}

// ---- Test 4: normalización y suma de pesos ----
{
  const A = [buscar('Spain_C_oSteppe'), buscar('Portugal_C')].map(x => x.v);
  const bvec = A[0].map((v, d) => 0.5 * v + 0.5 * A[1][d]);
  const r = nnls(A, bvec);
  const w = normalizar(r.w);
  const s = w.reduce((x, y) => x + y, 0);
  test('T4 normalizar suma 1.0', Math.abs(s - 1) < 1e-9, s.toString());
  test('T4 pesos ~0.5/0.5', Math.abs(w[0] - 0.5) < 0.01, `got [${w.map(x => x.toFixed(4))}]`);
}

// ---- Test 5: pool real — el centroide de un pool se explica por sí mismo ----
{
  const pools = JSON.parse(fs.readFileSync('data/pools.json', 'utf8'));
  const por = Object.fromEntries(pools.pools.map(p => [p.id, p.centroide]));
  const centroide = por['roma'], hierro = por['hierro'], argar = por['bronce'];
  // centroide romano ≈ 70% hierro + 30% bronce (composición plausible)
  const wReal = [0.70, 0.30];
  const bvec = centroide.map((v, d) => wReal[0] * hierro[d] + wReal[1] * argar[d]);
  const r = nnls([hierro, argar], bvec);
  test('T5 pool romano = f(hierro, argar) recupera (±0.02)',
    Math.abs(r.w[0] - 0.70) < 0.02 && Math.abs(r.w[1] - 0.30) < 0.02,
    `got [${r.w.map(x => x.toFixed(4))}]`);
}

// ---- Test 6: rendimiento con 12 fuentes × 25 dims ----
{
  const claves = ['Spain_C_oSteppe', 'Portugal_C', 'Germany_BellBeaker', 'Morocco_EN', 'Turkey_Buyukkaya_EC',
    'Russia_Samara_EBA_Yamnaya', 'Ukraine_N', 'Spain_SE_Iberia_BA_Argar', 'France_LN', 'Italy_North_BellBeaker_1',
    'Greece_LN_2', 'Turkey_N'];
  const A = claves.map(c => buscar(c).v);
  const wReal = [0.4, 0.2, 0.1, 0.05, 0.05, 0.04, 0.03, 0.03, 0.03, 0.03, 0.02, 0.02];
  const bvec = A[0].map((_, d) => A.reduce((s, v, i) => s + wReal[i] * v[d], 0));
  const t0 = Date.now();
  const r = nnls(A, bvec);
  const ms = Date.now() - t0;
  const maxErr = Math.max(...r.w.map((v, i) => Math.abs(v - wReal[i])));
  test('T6 12 fuentes < 50ms', ms < 50, ms + 'ms');
  test('T6 pesos recuperados ±0.03', maxErr < 0.03, `maxErr=${maxErr.toFixed(4)} got=[${r.w.map(x => x.toFixed(3))}]`);
}

console.log(fallos === 0 ? '\n✅ TODOS LOS TESTS PASAN' : `\n❌ ${fallos} test(s) fallan`);
process.exit(fallos === 0 ? 0 : 1);
