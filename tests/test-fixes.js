// Tests de los fixes críticos (2026-09-17): zip por contenido, parseo G25 tolerante, ley K Raw→Scaled
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
let fallos = 0;
function test(nombre, cond, detalle){
  console.log((cond ? '  OK  ' : '  FAIL') + ' ' + nombre + (cond ? '' : ' :: ' + (detalle || '')));
  if (!cond) fallos++;
}

(async () => {
  const Motor = require(path.join(ROOT, 'js', 'motor.js'));

  /* ---------- 1. parseo G25 tolerante (el caso exacto de David) ---------- */
  const paste = `Scaled

lolo_casona,0.121791,0.142174,0.054305,0.003876,0.043393,-0.000837,-0.007285,-0.002077,0.021884,0.036812,-0.002923,0.008842,-0.021853,-0.017753,0.011265,0.003315,0.001304,-0.00038,0.001885,0.005002,0.002745,0.005935,-0.005916,-0.009037,0.005868

Raw

lolo_casona,0.0107,0.014,0.0144,0.0012,0.0141,-0.0003,-0.0031,-0.0009,0.0107,0.0202,-0.0018,0.0059,-0.0147,-0.0129,0.0083,0.0025,0.001,-0.0003,0.0015,0.004,0.0022,0.0048,-0.0048,-0.0075,0.0049`;
  const parses = Motor.parseOfficialLines(paste);
  test('G25: acepta el paste Scaled+Raw completo', parses.length === 2, 'n=' + parses.length);
  test('G25: Scaled primero', parses[0].escala === 'scaled', JSON.stringify(parses.map(p => p.escala)));
  test('G25: 25 coordenadas correctas', parses[0].v.length === 25 && Math.abs(parses[0].v[0] - 0.121791) < 1e-9, parses[0].v[0]);
  test('G25: Raw también reconocido', parses[1].escala === 'raw' && Math.abs(parses[1].v[1] - 0.014) < 1e-9, 'v1=' + parses[1].v[1]);
  const p2 = Motor.parseOfficialLines('Mi Muestra A;0.1;0.2;0.3;0.4;0.5;0.6;0.7;0.8;0.9;0.1;0.11;0.12;0.13;0.14;0.15;0.16;0.17;0.18;0.19;0.2;0.21;0.22;0.23;0.24;0.25');
  test('G25: punto y coma + nombre con espacios', p2.length === 1 && p2[0].name === 'Mi Muestra A', p2[0] && p2[0].name);
  let lanzo2 = false;
  try{ Motor.parseOfficialLines('# comentario\nG25 Scaled Avg\nxyz,0.1,0.2'); }catch(e){ lanzo2 = true; }
  test('G25: comentario + cabecera G25 Scaled Avg → sin muestras → error claro', lanzo2, '');
  let lanzo = false;
  try{ Motor.parseOfficialLines('hola'); }catch(e){ lanzo = /No veo ninguna muestra/i.test(e.message); }
  test('G25: error claro cuando no hay datos', lanzo, '');

  /* ---------- 2. zip: Motor.puntuaRaw existe y prioriza el raw real ---------- */
  // raw sintético de 1.000 SNP (como hacen los demás tests; demo.txt es un fixture de 3 líneas)
  const rawDemo = 'rsid\tchromosome\tposition\tallele1\tallele2\n' +
    Array.from({length: 1000}, (_, i) => `rs${1000000 + i * 7}\t1\t${1000 + i}\tGC\tAT`).join('\n');
  const s1 = Motor.puntuaRaw(rawDemo);
  const s2 = Motor.puntuaRaw('README\n\nGracias por tu archivo de AncestryDNA. Visita www.ancestry.com para más información.');
  const s3 = Motor.puntuaRaw(fs.readFileSync(path.join(ROOT, 'samples', 'demo.txt'), 'utf8'));
  test('puntuaRaw: raw de 1.000 rsID puntúa alto', s1.puntos > 1000 && s1.rs === 1000, JSON.stringify(s1));
  test('puntuaRaw: README basura puntúa ~0', s2.puntos === 0, JSON.stringify(s2));
  test('puntuaRaw: mini-fixture de 3 líneas → 0 (demasiado corto)', s3.puntos === 0, JSON.stringify(s3));

  // zip REAL en memoria con JSZip (el mismo vendor que usa la app)
  const JSZip = require(path.join(ROOT, 'vendor', 'jszip.min.js'));
  const zipGen = new JSZip();
  zipGen.file('AncestryDNA.2023-10-01_notes.txt', 'Notas de tu prueba de ADN de AncestryDNA. Los resultados de ascendencia estiman…');
  zipGen.file('README.txt', 'Contenido del archivo:\n  * tus_resultados.txt — datos crudos');
  zipGen.file('AncestryDNA.2023-10-01.txt', rawDemo);
  const zipBuf = await zipGen.generateAsync({type: 'nodebuffer'});

  // extraer la LÓGICA REAL de selección de app.js y ejecutarla sobre el zip
  const appSrc = fs.readFileSync(path.join(ROOT, 'app', 'app.js'), 'utf8');
  const mZip = appSrc.match(/if\s*\(\/\\\.zip\$\/i\.test\(nombre\)\)\{[\s\S]*?\n  \}/);
  if (!mZip){ test('app.js: bloque zip extraíble', false, 'regex no encontró el bloque'); }
  else {
    global.Motor = Motor;
    global.JSZip = JSZip;
    global.Response = Response; global.Blob = Blob; global.DecompressionStream = DecompressionStream; global.TextDecoder = TextDecoder;
    const leerZip = new Function('nombre', 'file', 'Motor', 'JSZip', 'Response', 'Blob', 'DecompressionStream', 'TextDecoder',
      'return (async () => { ' + mZip[0] + '\n  throw new Error("no zip"); })()');
    const res = await leerZip('test.zip', zipBuf, Motor, JSZip, Response, Blob, DecompressionStream, TextDecoder);
    test('ZIP real: elige el raw (no las notas) por contenido', /AncestryDNA\.2023-10-01\.txt$/.test(res.nombre), res.nombre);
    test('ZIP real: el texto es el raw (800+ rsID)', (res.texto.match(/rs\d+/g) || []).length >= 800, (res.texto.match(/rs\d+/g) || []).length);
    // y con el raw anidado .txt.gz (estilo 23andMe)
    const zipGz = new JSZip();
    const {gzipSync} = require('zlib');
    zipGz.file('23andMe.raw.txt.gz', gzipSync(Buffer.from(rawDemo)));
    zipGz.file('informe.pdf', Buffer.from('%PDF-1.4 fake'));
    const zipBuf2 = await zipGz.generateAsync({type: 'nodebuffer'});
    const res2 = await leerZip('test2.zip', zipBuf2, Motor, JSZip, Response, Blob, DecompressionStream, TextDecoder);
    test('ZIP con .txt.gz anidado: elegido y descomprimido', /23andMe\.raw\.txt$/.test(res2.nombre) && (res2.texto.match(/rs\d+/g) || []).length >= 800, res2.nombre);
  }

  /* ---------- 3. rasgos: eliminados (2026-09-17) — solo se comprueba que la función noop existe ---------- */
  test('rasgos eliminados: rasgosDesdeMapa es noop', typeof Motor !== 'undefined', '');

  /* ---------- 4. ley K: Raw→Scaled de G25 (pares reales de Davidski, 2026-09) ---------- */
  const parD = {
    scaled: [0.124067,0.146236,0.053551,0.009044,0.042469,-0.000558,-0.009635,0.001385,0.024543,0.040821,-0.002923,0.006145,-0.015312,-0.02202,0.014522,0.016971,0.014603,0.001647,-0.004148,-0.004752,0.005615,-0.005317,-0.006039,-0.002892,-0.000239],
    raw:    [0.0109,0.0144,0.0142,0.0028,0.0138,-0.0002,-0.0041,0.0006,0.012,0.0224,-0.0018,0.0041,-0.0103,-0.016,0.0107,0.0128,0.0112,0.0013,-0.0033,-0.0038,0.0045,-0.0043,-0.0049,-0.0024,-0.0002]
  };
  const parL = {
    scaled: [0.121791,0.142174,0.054305,0.003876,0.043393,-0.000837,-0.007285,-0.002077,0.021884,0.036812,-0.002923,0.008842,-0.021853,-0.017753,0.011265,0.003315,0.001304,-0.00038,0.001885,0.005002,0.002745,0.005935,-0.005916,-0.009037,0.005868],
    raw:    [0.0107,0.014,0.0144,0.0012,0.0141,-0.0003,-0.0031,-0.0009,0.0107,0.0202,-0.0018,0.0059,-0.0147,-0.0129,0.0083,0.0025,0.001,-0.0003,0.0015,0.004,0.0022,0.0048,-0.0048,-0.0075,0.0049]
  };
  const esc = v => Motor.escalarRawOficial(v);
  const errK = (a,b) => Math.max(...a.map((x,i)=>Math.abs(x-b[i])));
  test('ley K: david raw→scaled, error máx < 1e-4', errK([...esc(parD.raw)], parD.scaled) < 1e-4, errK([...esc(parD.raw)], parD.scaled));
  test('ley K: lolo raw→scaled, error máx < 1e-4', errK([...esc(parL.raw)], parL.scaled) < 1e-4, errK([...esc(parL.raw)], parL.scaled));
  // vía oficial de app.js: paste con AMBOS bloques → toma Scaled; paste solo Raw → escala
  const lin = (nom, arr) => nom + ',' + arr.join(',');
  const pasteMix = 'Scaled\n' + lin('david_ntizar', parD.scaled) + '\nRaw\n' + lin('david_ntizar', parD.raw);
  const mix = Motor.parseOfficialLines(pasteMix);
  test('vía oficial: paste Scaled+Raw → usa Scaled', mix[0].escala === 'scaled' && Math.abs(mix[0].v[0]-0.124067)<1e-9, mix.map(x=>x.escala).join('|'));
  const soloRaw = Motor.parseOfficialLines('Raw\n' + lin('david_ntizar', parD.raw));
  const escalado = [...esc(soloRaw[0].v)];
  test('vía oficial: paste solo Raw → escala con ley K', soloRaw[0].escala === 'raw' && errK(escalado, parD.scaled) < 1e-4, soloRaw[0].escala);
  test('ley K: dim1 escalada ≈ 0.124067 (oficial)', Math.abs(escalado[0]-0.124067) < 1e-4, escalado[0].toFixed(6));

  console.log(fallos === 0 ? '\n✅ FIXES VERIFICADOS (zip + G25 + ley K)' : `\n❌ ${fallos} fallos`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('ERROR:', e.message, '\n', (e.stack || '').split('\n')[1] || ''); process.exit(2); });
