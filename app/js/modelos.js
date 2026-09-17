/* GÉNESIS — modelos alternativos de mezcla: raíces profundas (ADN antiguo) y vecinos (G25 moderno)
   El mismo G25 25D mirado con distintas lupas. Si una señal es robusta, aparece en todos los modelos. */
'use strict';

/* anclas del modelo de raíces: patrones sobre los nombres del payload antiguo (verificados 2026-09-17) */
var B_ANCLAS = {
  whg:      {re: /(Villabruna|IronGates_Mesolithic|Latvia_HG|Spain_HG|ElMiron|Ireland_Mesolithic|Loschbour|Sweden_Motala|Ukraine_Mesolithic|oWHG|Croatia_Mesolithic|Italy_Mesolithic|Karelia_HG|Sidelkino|Samara_HG|England_Mesolithic|Germany_Mesolithic|France_NouvelleAquitaine_Mesolithic|Wales_Mesolithic|Sicily_LateMesolithic|Ostuni|Romania_C_oHG|MontAime)/,
             etiqueta: 'Cazadores-recolectores europeos (WHG/EHG)', color: '#1d4ed8'},
  anatolia: {re: /^(Turkey_N|Anatolia_N|Barcin|Tepcik)/, etiqueta: 'Agricultores de Anatolia', color: '#3b82f6'},
  estepa:   {re: /(Yamnaya|CordedWare|BellBeaker|Sintashta|Poltavka|Afanasievo|Andronovo)/, etiqueta: 'Pastores de la estepa póntica', color: '#0ea5e9'},
  chg:      {re: /(Georgia_Kotias|Satsurblia|Armenia_EBA)/, etiqueta: 'Cáucaso (CHG)', color: '#6366f1'},
  nafr:     {re: /(Iberomaurusian|Morocco_)/, etiqueta: 'Norte de África', color: '#f59e0b'},
  levante:  {re: /(Natufian|Levant_N|Israel_MLBA|Israel_Canaanite|Sidon)/, etiqueta: 'Levante', color: '#84cc16'}
};

/* B — raíces profundas: NNLS del G25 del usuario sobre centroides de grupos del ADN antiguo */
function modeloRaices(g25){
  const grupos = [];
  for (const [id, cfg] of Object.entries(B_ANCLAS)){
    const m = state.ancient.filter(x => cfg.re.test(x.name));
    if (!m.length) continue;
    const c = new Float64Array(25);
    for (const x of m){ for (let j = 0; j < 25; j++) c[j] += x.v[j]; }
    grupos.push({id, etiqueta: cfg.etiqueta, color: cfg.color, n: m.length, v: c.map(v => v / m.length)});
  }
  if (grupos.length < 3) throw new Error('Anclas insuficientes para el modelo de raíces.');
  const sol = nnls(grupos.map(g => g.v), Float64Array.from(g25));
  const wN = normalizar(sol.w);
  const lista = grupos.map((g, i) => ({...g, w: wN[i], wAbs: sol.w[i]}))
    .filter(x => x.wAbs > 0.004).sort((a, b) => b.wAbs - a.wAbs);
  return {lista, r2: sol.r2, residuo: sol.residuo,
    nota: 'Centroides de las muestras antiguas publicadas (datasheets G25 de Vahaduo/Davidski). Los grupos solapan entre sí (la estepa ya lleva cazadores y cáucaso dentro), así que léelo como énfasis, no como receta exacta.'};
}

/* C — tu gente: NNLS sobre los 10 vecinos modernos más cercanos del G25 */
function modeloVecinos(g25){
  const top = Motor.nearest(g25, state.modern, 10).filter(x => !x.derived);
  const sol = nnls(top.map(x => x.v), Float64Array.from(g25));
  const wN = normalizar(sol.w);
  const lista = top.map((x, i) => ({name: x.name, d: x.d, w: wN[i], wAbs: sol.w[i], ll: geoDe(x.name)}))
    .filter(x => x.wAbs > 0.004).sort((a, b) => b.wAbs - a.wAbs);
  return {lista, r2: sol.r2, residuo: sol.residuo};
}

/* los dos modelos juntos; cada estudio lleva además el modelo por épocas (A) */
function modelosAlternativos(g25){
  return {raices: modeloRaices(g25), vecinos: modeloVecinos(g25)};
}
