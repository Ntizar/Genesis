// GÉNESIS — calibración de componentes K36: ¿qué región proyecta cada uno?
// Para cada componente c: genera 1500 SNP sintéticos de su frecuencia → MLE → ridge → top moderna.
// Salida: data/k36-names.json (índice → región empírica + ejemplo top-1). Sin nombres propietarios.
'use strict';
const path = require('path');
const fs = require('fs');
const Motor = require('../js/motor.js');

function extraerConst(nombre, src) {
  const m = src.match(new RegExp('const\\s+' + nombre + '\\s*=\\s*"([A-Za-z0-9+/=]+)"'));
  if (!m) throw new Error('no encontrado ' + nombre);
  return m[1];
}

(async () => {
  const DATA = path.join(__dirname, '..', 'js');
  const [st, fb, mo] = await Promise.all([
    Motor.ungzip(extraerConst('K36_SNPS_GZ_B64', fs.readFileSync(path.join(DATA, 'data_payload.js'), 'utf8'))),
    Motor.ungzip(extraerConst('K36_FREQ_GZ_B64', fs.readFileSync(path.join(DATA, 'data_payload.js'), 'utf8')), false),
    Motor.ungzip(extraerConst('G25_MODERN_GZ_B64', fs.readFileSync(path.join(DATA, 'data_payload.js'), 'utf8')))
  ]);
  const snps = st.trim().split(/\r?\n/).map(x => x.split('\t'));
  const freq = new Float32Array(fb);
  const modern = Motor.parseG25(mo);
  const reg = fs.readFileSync(path.join(DATA, 'reg_k36_v2.js'), 'utf8');
  const REG = JSON.parse(reg.match(/const\s+REG_K36_V2\s*=\s*(\[\[.*?\]\]);/s)[1]);
  const INT = JSON.parse(reg.match(/const\s+REG_K36_V2_INTERCEPT\s*=\s*(\[.*?\]);/s)[1]);

  const NSNP = 1500;
  let _s = 42;
  const rnd = () => { _s |= 0; _s = _s + 0x6D2B79F5 | 0; let t = Math.imul(_s ^ _s >>> 15, 1 | _s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  const nombres = [];
  const PALETA = { // azul monocromo + vecinos neutros del DS; sin gradientes ni mezclas
    'sur-europa': '#1d4ed8', 'norte-europa': '#3b82f6', 'este-europa': '#60a5fa',
    'mediterraneo-este': '#0e7490', 'norte-africa': '#155e75', 'arabia': '#0369a1',
    'asia-central-este': '#64748b', 'sur-asia': '#475569',
    'africa-sub': '#94a3b8', 'america': '#0891b2', 'oceania-se-asia': '#6b7280', 'otro': '#cbd5e1'
  };
  for (let c = 0; c < 36; c++) {
    _s = 1000 + c; // semilla por componente → reproducible
    const usados = new Set(); const lines = [];
    for (let s = 0; s < NSNP; s++) {
      let i; do { i = Math.floor(rnd() * snps.length); } while (usados.has(i));
      usados.add(i);
      const [rs, a, b] = snps[i];
      const f = freq[i * 36 + c];
      let nB = 0; if (rnd() < f) nB++; if (rnd() < f) nB++;
      const gt = nB === 0 ? a + a : nB === 1 ? a + b : b + b;
      lines.push(`${rs}\t${a}\t${b}\t${gt[0]}\t${gt[1]}`);
    }
    const raw = Motor.parseRaw('rsid\tchrom\tposition\tallele1\tallele2\n' + lines.join('\n'), 'cal');
    const ex = Motor.extractCalls(raw, { snps, freq, index: new Map(snps.map((x, i) => [x[0], i])) });
    const fit = await Motor.mle(ex.calls, freq);
    const q = [...fit.q];
    const pico = q.indexOf(Math.max(...q));
    const g25 = Motor.project(fit.q, REG, INT);
    const top = Motor.nearest(g25, modern, 1)[0];
    const localizado = /Spain|Portugal|France|Italy|Basque|Cantab|Galician|Andalus|Aragon|Catal|Valencia|Castile|Murcia|Balearic/i.test(top.name) ? 'sur-europa'
      : /German|Austria|Dutch|Belgian|Swiss|England|Scottish|Irish|Welsh|Danish|Norwegian|Swedish|Finnish|Iceland/i.test(top.name) ? 'norte-europa'
      : /Poland|Czech|Hungary|Romania|Bulgaria|Serbia|Croatia|Slovenia|Slovakia|Ukraine|Belarus|Lithuania|Latvia|Estonia|Russian/i.test(top.name) ? 'este-europa'
      : /Greek|Greek|Albania|Turkey|Armenia|Georgian|Azerbaijan|Kurd|Iran|Iraq|Syria|Lebanon|Israel|Jordan|Palestinian|Assyrian/i.test(top.name) ? 'mediterraneo-este'
      : /Morocc|Algeria|Algerian|Tunisia|Tunisian|Libya|Egypt|Sahara|Saharawi|Mozabite|Berber/i.test(top.name) ? 'norte-africa'
      : /Yemen|Saudi|Emirati|Oman|Qatar|Kuwait|Bedouin/i.test(top.name) ? 'arabia'
      : /Uzbek|Tajik|Kyrgyz|Kazakh|Turkmen|Mongol|Yakut|Evenk|Buryat|Tibetan|Chinese|Han|Japanese|Korean|Tungus|Nenets|Selkup|Komi|Siberia/i.test(top.name) ? 'asia-central-este'
      : /India|Indian|Bengali|Gujarati|Punjabi|Telugu|Tamil|Sri|Kalash|Burusho|Pathan|Sindhi|Makrani|Brahui|Nepal|Bhutan/i.test(top.name) ? 'sur-asia'
      : /Nigeria|Yoruba|Igbo|Gambian|Sierra|Mende|Senegal|Mandenka|Ethiopia|Somali|Kenya|Tanzania|Dinka|Nuer|Luo|Bantu|Zulu|Xhosa|Sotho|Tswana|Angola|Congo|Biaka|Mbuti|San|Nama|Hada|Mbuti|Khoisan/i.test(top.name) ? 'africa-sub'
      : /America|Maya|Pima|Karitiana|Surui|Colombian|Peruvian|Mexican|Piapoco|Ticuna|Quechua|Bolivian/i.test(top.name) ? 'america'
      : /Samoan|Tongan|Maori|Papuan|Aboriginal|Melanesian|Micronesian|Polynesian|Filipino|Indonesian|Malay|Thai|Vietnamese|Khmer|Dusun|Atayal|Ami/i.test(top.name) ? 'oceania-se-asia'
      : 'otro';
    nombres.push({ indice: c, pico: pico === c ? true : pico, region: localizado, color: PALETA[localizado] || PALETA.otro, ejemplo: top.name, dist: +top.d.toFixed(4) });
    console.log(`k${String(c).padStart(2)} → ${localizado.padEnd(18)} ej: ${top.name.slice(0, 40).padEnd(40)} d=${top.d.toFixed(3)} pico=k${pico}`);
  }
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'k36-names.json'), JSON.stringify({ version: '1.0', nota: 'región empírica por proyección; sin nombres propietarios', componentes: nombres }, null, 1));
  console.log('\nOK → data/k36-names.json');
})().catch(e => { console.error('ERROR:', e); process.exit(2); });
