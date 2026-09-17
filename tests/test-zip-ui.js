/* Test e2e del flujo real: subir el ZIP del usuario por la UI (input file → leerFichero → estudio).
   Reproduce el caso "le he dado y no carga": sin ?demo=1, sin fixture, el zip de verdad.
   Si el zip no está en Downloads, el test se salta (SKIP). */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');

const ZIP = process.env.DAC_ZIP || 'C:/Users/d_ant/Downloads/DAC_raw_dna_data.zip';
if (!fs.existsSync(ZIP)) { console.log('SKIP: ' + ZIP + ' no existe'); process.exit(0); }

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const htmlSin = html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>\s*/g, '');
const srcs = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g)].map(m => m[1]);

const dom = new JSDOM(htmlSin, { url: 'http://localhost:8614/index.html', runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
w.scrollTo = () => {};
w.HTMLCanvasElement.prototype.getContext = () => null;
w.requestAnimationFrame = fn => setTimeout(fn, 0);
w.Response = Response; w.DecompressionStream = DecompressionStream;
w.Blob = Blob; w.TextDecoder = TextDecoder; w.fetch = fetch;
w.setImmediate = setImmediate; // JSZip lo detecta y evita su shim postMessage (no arranca en jsdom)

const base = p => path.join(ROOT, p);
const todo = srcs.map(base).map(f => fs.readFileSync(f, 'utf8')).join('\n;\n');
try { w.eval(todo); } catch (e) { console.log('ERRORES AL CARGAR: ' + e.message); process.exit(2); }

setTimeout(async () => {
  try {
    // 1) JSZip debe existir porque index.html lo carga (el bug era que no)
    if (typeof w.JSZip === 'undefined') { console.log('FAIL: JSZip no está definido — index.html no carga vendor/jszip.min.js'); process.exit(1); }
    // 2) crear un File real con el zip completo y meterlo en el input
    const buf = fs.readFileSync(ZIP);
    const file = new w.File([buf], path.basename(ZIP), { type: 'application/zip' });
    const fi = w.document.getElementById('fichero');
    Object.defineProperty(fi, 'files', { value: [file], configurable: true });
    // 3) disparar el change (el mismo camino que el usuario al elegir el fichero)
    fi.dispatchEvent(new w.Event('change', { bubbles: true }));
    // 4) esperar al estudio (el título pasa a OK: …)
    const t0 = Date.now();
    const tick = () => {
      const t = w.document.title;
      if (t.startsWith('OK:')) {
        const d = w.document;
        console.log('Título: ' + t);
        console.log('kpiSnp: ' + d.getElementById('kpiSnp').textContent);
        console.log('modeloRaices len: ' + (d.getElementById('modeloRaices') || { innerHTML: '' }).innerHTML.length);
        console.log('modeloVecinos len: ' + (d.getElementById('modeloVecinos') || { innerHTML: '' }).innerHTML.length);
        const ok = (d.getElementById('modeloRaices') || { innerHTML: '' }).innerHTML.length > 200;
        console.log(ok ? 'ZIP REAL E2E OK' : 'ZIP REAL E2E FAIL');
        process.exit(ok ? 0 : 1);
      }
      if (/Error|error/i.test(t)) { console.log('FAIL: título de error: ' + t); process.exit(1); }
      if (Date.now() - t0 > 90000) { console.log('FAIL: timeout, título = ' + t); process.exit(1); }
      setTimeout(tick, 1000);
    };
    tick();
  } catch (e) { console.log('ERROR e2e zip: ' + e.message); process.exit(1); }
}, 300);
