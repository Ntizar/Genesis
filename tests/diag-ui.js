/* Diagnóstico UI con jsdom: carga index.html con sus scripts y pulsa la demo */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// jsdom no descarga recursos externos; ejecuto los scripts yo mismo en orden
const htmlSin = html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>\s*/g, '');

// recursos locales: leemos los ficheros que index.html pedía
const srcs = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g)].map(m => m[1]);
// recursos CSS no hacen falta para la lógica

const dom = new JSDOM(htmlSin, { url: 'http://localhost:8614/app/index.html?demo=1&tab=mapa', runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
w.scrollTo = () => {};
w.HTMLCanvasElement.prototype.getContext = () => null; // sin canvas: vistas.js/mapas.js deben tolerarlo
w.requestAnimationFrame = fn => setTimeout(fn, 0);

const errores = [];
w.addEventListener('error', e => errores.push('window.onerror: ' + e.message));
// polyfills del runtime de Node (jsdom no trae streams/fetch)
w.Response = Response; w.DecompressionStream = DecompressionStream;
w.Blob = Blob; w.TextDecoder = TextDecoder; w.fetch = fetch;

// carga de los scripts: concatenados en un solo eval (los scripts clásicos comparten scope global;
// evals separados en strict mode no — así replicamos fielmente el comportamiento del navegador)
const base = p => path.join(ROOT, p);
const files = srcs.map(base);
const todo = files.map(f => fs.readFileSync(f, 'utf8')).join('\n;\n');
try { w.eval(todo); } catch (e) { errores.push(`[scripts] ${e.message}`); }

setTimeout(async () => {
  try {
    if (errores.length) { console.log('ERRORES AL CARGAR:\n' + errores.join('\n')); process.exit(2); }
    console.log('DOMContentLoaded pasado; init wiring OK');
    // la demo ya se dispara sola por ?demo=1 cuando el motor carga; esperamos al resultado
    setTimeout(() => {
      const d = w.document;
      console.log('Título:', d.title);
      console.log('tab activa:', (d.querySelector('.nz-tab--active') || {}).textContent);
      console.log('seccion mapa visible:', !d.getElementById('tab-mapa').hidden);
      console.log('mundoCanvas (mapaMundo):', d.getElementById('mapaMundo') ? 'sí' : 'NO EXISTE');
      console.log('mapaIberia len:', (d.getElementById('mapaIberia') || {innerHTML:''}).innerHTML.length);
      console.log('mapaIberia tiene pane Leaflet:', d.querySelector('#mapaIberia .leaflet-pane') ? 'sí' : 'no');
      console.log('kpiSnp:', d.getElementById('kpiSnp').textContent);
      console.log('modeloEpocas len:', d.getElementById('modeloEpocas').innerHTML.length);
      const mr = d.getElementById('modeloRaices'), mv = d.getElementById('modeloVecinos');
      console.log('modeloRaices len:', mr ? mr.innerHTML.length : 'FALTA', '| modeloVecinos len:', mv ? mv.innerHTML.length : 'FALTA');
      const ok = mr && mv && mr.innerHTML.length > 200 && mv.innerHTML.length > 200;
      console.log(ok ? 'MODELOS ALTERNATIVOS OK' : 'MODELOS ALTERNATIVOS FAIL');
      let informe = 'INFORME FAIL: no ejecutado';
      try{
        global.window = w; global.document = w.document; global.Blob = w.Blob;
        if (!w.URL.createObjectURL) w.URL.createObjectURL = () => 'blob:x';
        if (!w.URL.revokeObjectURL) w.URL.revokeObjectURL = () => {};
        w.eval('descargarInforme()');
        informe = 'INFORME OK (descarga disparada sin error)';
      }catch(e){ informe = 'INFORME FAIL: ' + e.message; }
      console.log(informe);
      process.exit(ok && informe.startsWith('INFORME OK') ? 0 : 1);
    }, 12000);
  } catch (e) { console.log('ERROR post-click:', e.message); process.exit(1); }
}, 300);
