/* GÉNESIS — análisis: carga de payloads, pipeline y modelo por épocas */
'use strict';

/* estado global compartido por todos los módulos de la app */
var state = {
  snps: null, freq: null, index: null,
  modern: [], ancient: [], derived: [],
  pools: null, geo: null, k36names: null,
  ne: null,
  results: [],
  official: null,
  ultimo: null
};

var NARRATIVAS = {
  paleolitico: ['los primeros iberos', 'cazadores-recolectores que poblaron la península tras la última glaciación (Aziliense, El Mirón). Su herencia es pequeña pero detectable, sobre todo en el norte.'],
  neolitico: ['los agricultores del Mediterráneo', 'campesinos que llegaron desde Anatolia hace ~7.500 años y trajeron la agricultura, el Cerro de los Covachos y la cerámica cardial. Suelen ser la fuente principal de cualquier español actual.'],
  bronce: ['la Edad del Bronce y El Argar', 'la fusión de agricultores y esteparios (Yamnaya, Campaniforme) que reorganizó Europa. El Argar de Murcia y Almería fue una de las primeras sociedades estatales de Occidente.'],
  hierro: ['los íberos y celtas del Hierro', 'los pueblos que nombraron media España: íberos del este, celtíberos del interior, lusitanos del oeste. Son el espejo más directo del sustrato prerromano.'],
  roma: ['Roma e Hispania', 'seis siglos de imperio: colonos itálicos, legionarios, esclavos orientales y la romanización completa del territorio. Aportan el componente "mediterráneo clásico" (etruscos, griegos, romanos).'],
  visigodo: ['los visigodos', 'una élite germánica pequeña (~1-3 % genético real) que gobernó Hispania entre 415 y 711. Su señal es tenue pero existente: la vencerán las épocas anteriores.'],
  alandalus: ['al-Ándalus', 'ocho siglos con bereberes norteafricanos, árabes y poblaciones locales convertidas. La huella genética media en la península ronda el 5-10 %, con máximos en el sur.']
};

async function cargarDatos(onProgreso){
  const prog = (t, p) => onProgreso && onProgreso(t, p);
  prog('Descomprimiendo el panel genético…', 5);
  const [st, fb, mo, an, der] = await Promise.all([
    Motor.ungzip(K36_SNPS_GZ_B64), Motor.ungzip(K36_FREQ_GZ_B64, false),
    Motor.ungzip(G25_MODERN_GZ_B64), Motor.ungzip(G25_ANCIENT_GZ_B64),
    Motor.ungzip(K1000G_DERIVED_GZ_B64)
  ]);
  prog('Indexando 165.688 SNP…', 35);
  const snps = st.trim().split(/\r?\n/).map(x => x.split('\t'));
  const index = new Map(); snps.forEach((x, i) => index.set(x[0], i));
  state.snps = snps; state.freq = new Float32Array(fb); state.index = index;
  state.modern = Motor.parseG25(mo); state.ancient = Motor.parseG25(an); state.derived = Motor.parseDerived(der);
  prog('Cargando referencias y mapas…', 70);
  state.pools = GENESIS_POOLS.pools;
  state.geo = GENESIS_GEO;
  state.k36names = GENESIS_K36NAMES;
  state.ne = JSON.parse(await Motor.ungzip(NATURAL_EARTH_GZ_B64));
  prog('Motor listo.', 100);
}

/* pipeline raw → K36 → G25 */
async function analizarRaw(nombre, texto, onPaso){
  const raw = Motor.parseRaw(texto, nombre);
  onPaso && onPaso(`Fichero leído: ${raw.format}, ${fmtNum(raw.total)} genotipos.`);
  if (raw.total < 10000 && !/demo/i.test(nombre)) throw new Error(`El fichero tiene ${fmtNum(raw.total)} genotipos; parece incompleto (un raw completo trae >100.000).`);
  const ex = Motor.extractCalls(raw, {snps: state.snps, index: state.index});
  onPaso && onPaso(`Cruce con el panel: ${fmtNum(ex.calls.length)} SNP útiles, ${ex.flips} reorientados, ${ex.discord} descartados.`);
  if (ex.calls.length < 5000 && !/demo/i.test(nombre)) throw new Error(`Solo ${fmtNum(ex.calls.length)} SNP del panel coinciden con tu raw — cobertura insuficiente para un estudio fiable.`);
  const fit = await Motor.mle(ex.calls, state.freq);
  const g25 = Motor.project([...fit.q], REG_K36_V2, REG_K36_V2_INTERCEPT);
  return {nombre: raw.name, fuente: 'raw', formato: raw.format, q: [...fit.q], g25, calls: ex.calls, flips: ex.flips, discord: ex.discord, mapa: raw.map};
}

/* estudio desde 25 coordenadas directas (oficiales Vahaduo o demo) */
function estudioDesdeG25(nombre, v25, fuente){
  return {nombre, fuente, q: null, g25: Float64Array.from(v25), mapa: null};
}

/* NNLS por épocas sobre centroides de pools */
function modeloEpocas(g25){
  const pools = state.pools;
  const A = pools.map(p => Float64Array.from(p.centroide));
  const b = Float64Array.from(g25);
  const sol = nnls(A, b);
  const wN = normalizar(sol.w);
  const cov = sol.w.map((v, i) => v > 0.004 ? {i, w: wN[i], wAbs: v, pool: pools[i]} : null).filter(Boolean);
  cov.sort((a, b) => b.wAbs - a.wAbs);
  return {w: wN, lista: cov, residuo: sol.residuo, r2: sol.r2, iter: sol.iter};
}

/* vecinos con nombre, distancia y geolocalización */
function geoDe(nombre){
  const g = state.geo && state.geo.geo;
  if (!g) return null;
  if (g[nombre]) return g[nombre];
  const base = nombre.split(':')[0];
  if (g[base]) return g[base];
  const tok = base.split(/[_\-.]/);
  for (let i = tok.length - 1; i >= 1; i--){
    const p = tok.slice(0, i).join('_');
    if (g[p]) return g[p];
  }
  return null;
}
function vecinos(g25, n){
  const calc = (data, conGeo) => Motor.nearest(g25, data, n).map(x => {
    const g = conGeo ? geoDe(x.name) : null;
    return {...x, ll: g, dPct: fmtDist(x.d)};
  });
  return {modernas: calc(state.modern, true), antiguas: calc(state.ancient, false)};
}

/* rasgos verificables del genotipo crudo */
/* alelo "derivado" documentado de cada variante (para contar copias) */
var RASGOS = [
  {rs: 'rs4988235', gen: 'MCM6/LCT −13910', tema: 'Lactosa', deriv: 'T',
   textos: ['Intolerancia a la lactosa en el adulto: es lo más común en el mundo. Los cazadores mesolíticos europeos no llevaban este alelo.',
            'Una copia del alelo de tolerancia: suele bastar para digerir leche con normalidad.',
            'Tolerancia a la lactosa de por vida: el alelo −13910*T surgió hace ~7.500 años entre los primeros ganaderos de Europa central.']},
  {rs: 'rs182549', gen: 'MCM6 −22018', tema: 'Lactosa', deriv: 'C',
   textos: ['Alelo ancestral en las dos copias.', 'Una copia derivada: refuerza la persistencia de la lactasa.', 'Dos copias derivadas: refuerza la persistencia de la lactasa.']},
  {rs: 'rs1426654', gen: 'SLC24A5', tema: 'Pigmentación', deriv: 'T',
   textos: ['Alelo ancestral, típico de poblaciones subsaharianas o de Oceanía: indicaría linaje reciente no europeo.',
            'Heterocigoto: mezcla de linajes recientes (norte de África, Cuerno de África, sur de Asia o América).',
            'El alelo europeo clásico (>98 % en Iberia): pigmentación clara que llegó con los primeros agricultores.']},
  {rs: 'rs1800562', gen: 'HFE C282Y', tema: 'Hierro', deriv: 'A',
   textos: ['Sin la variante C282Y.', 'Portador de una copia C282Y: no la desarrolla, pero es un dato de familia (hemocromatosis hereditaria).',
            'Dos copias C282Y: riesgo elevado de sobrecarga de hierro. Esto sí merece una analítica con tu médico.']},
  {rs: 'rs1799945', gen: 'HFE H63D', tema: 'Hierro', deriv: 'C',
   textos: ['Sin la variante H63D.', 'Portador de una copia H63D: efecto leve o nulo.', 'Dos copias H63D: efecto leve; solo relevante si se combina con C282Y.']},
  {rs: 'rs762551', gen: 'CYP1A2', tema: 'Cafeína', deriv: 'C',
   textos: ['Metabolizador rápido de la cafeína: dos copias del alelo rápido.', 'Metabolizador intermedio.', 'Metabolizador lento: el café te dura más y te activa más.']}
];

function rasgosDesdeMapa(mapa){
  return RASGOS.map(r => {
    let gt = mapa.get(r.rs);
    if (gt) {
      gt = gt.split('').sort().join('');            // orden alfabético → clave estable AA/AC/…
      const nCopias = [...gt].filter(c => c === r.deriv).length;
      return {...r, gt, nCopias, texto: r.textos[nCopias]};
    }
    return {...r, gt: null, nCopias: null, texto: 'No cubierto por tu raw (o rsID no presente en este fichero).'};
  });
}
