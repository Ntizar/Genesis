/* GÉNESIS — utilidades y constructores visuales (Aurora 7) */
'use strict';

var $ = s => document.querySelector(s);
var $$ = s => [...document.querySelectorAll(s)];
var esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtPct = x => (x*100).toLocaleString('es-ES',{maximumFractionDigits:1}) + ' %';
const fmtNum = x => Math.round(x).toLocaleString('es-ES');
const fmtDist = d => (d*100).toLocaleString('es-ES',{maximumFractionDigits:2}) + ' %';

/* paleta por épocas (del pools.json) y fallback de tonos */
function tonos(n){
  const base = ['#1d4ed8','#2563eb','#3b82f6','#60a5fa','#0ea5e9','#0284c7','#155e75','#1e40af'];
  return Array.from({length:n},(_,i)=>base[i%base.length]);
}

/* donut por segmentos: datos [{valor, color, etiqueta}] → markup Aurora 7 */
function donutHTML(datos, centroValor, centroLabel, tam){
  const total = datos.reduce((s,d)=>s+d.valor,0) || 1;
  let acc = 0, segs = '';
  for(const d of datos){
    const pct = d.valor/total*100;
    if(pct < 0.5) continue;
    segs += `<circle class="nz-chart-donut__seg" cx="21" cy="21" r="15.9" stroke="${d.color}" stroke-dasharray="${pct.toFixed(2)} ${(100-pct).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}"></circle>`;
    acc += pct;
  }
  const centro = centroValor != null ? `<div class="nz-chart-donut__center"><span class="nz-chart-donut__value">${esc(centroValor)}</span><span class="nz-chart-donut__label">${esc(centroLabel||'')}</span></div>` : '';
  return `<div class="nz-chart-donut ${tam||''}"><svg class="nz-chart-donut__svg" viewBox="0 0 42 42" role="img" aria-label="${esc(centroLabel||'reparto')}">${segs}</svg>${centro}</div>`;
}

/* leyenda del donut */
function leyendaHTML(datos){
  const total = datos.reduce((s,d)=>s+d.valor,0) || 1;
  return datos.map(d=>`<span class="genes-leyenda__item"><i style="background:${d.color}"></i>${esc(d.etiqueta)} <b>${fmtPct(d.valor/total)}</b></span>`).join('');
}

/* tabla de barras Aurora 7: filas [{nombre, valor, texto, color}] */
function tablebarHTML(filas){
  const max = Math.max(...filas.map(f=>f.valor), 1e-9);
  return `<div class="nz-chart-tablebar">` + filas.map(f=>
    `<div class="nz-chart-tablebar__row"><span class="nz-chart-tablebar__name" title="${esc(f.nombre)}">${esc(f.nombre)}</span>`+
    `<span class="nz-chart-tablebar__track"><span class="nz-chart-tablebar__bar" style="width:${(f.valor/max*100).toFixed(1)}%;${f.color?`background:${f.color}`:''}"></span></span>`+
    `<span class="nz-chart-tablebar__num">${esc(f.texto ?? fmtNum(f.valor))}</span></div>`).join('') + `</div>`;
}

/* scatter PC1·PC2: puntos [{x,y,clase,tooltip}], ejes con etiquetas */
function scatterHTML(puntos, ejex, ejey){
  const pts = puntos.map(p=>
    `<span class="nz-chart-scatter__dot ${p.clase||''}" style="left:${p.x.toFixed(1)}%;bottom:${p.y.toFixed(1)}%" title="${esc(p.tooltip||'')}"></span>`).join('');
  return `<div class="nz-chart-scatter"><div class="nz-chart-scatter__area">${pts}</div><span class="nz-chart-scatter__x">${esc(ejex)}</span><span class="nz-chart-scatter__y">${esc(ejey)}</span></div>`;
}

/* escala de un conjunto 25D a porcentajes de pantalla (con margen 8%) */
function escalaPCA(vals){
  const xs = vals.map(v=>v[0]), ys = vals.map(v=>v[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const mx = Math.max((x1-x0)*0.08, 0.005), my = Math.max((y1-y0)*0.08, 0.005);
  x0-=mx; x1+=mx; y0-=my; y1+=my;
  return v => ({x:(v[0]-x0)/(x1-x0)*100, y:(v[1]-y0)/(y1-y0)*100});
}
