// GÉNESIS — motor v2 (extraído y verificado del G25-Local v2.3 auditado)
// Sin DOM: funciona en navegador y en Node (tests). Sin red.
'use strict';

// ---------- utilidades base64/gzip ----------
function b64bytes(s){const bin=atob(s),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u}
async function ungzip(b64,text=true){
  const ab=await new Response(new Blob([b64bytes(b64)]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return text?new TextDecoder().decode(ab):ab;
}

// ---------- distancia 25D ----------
function dist(a,b){let s=0;for(let i=0;i<25;i++){const d=a[i]-b[i];s+=d*d}return Math.sqrt(s)}
function nearest(v,data,n=25){
  return data.map(x=>({name:x.name,d:dist(v,x.v),v:x.v,derived:!!x.derived}))
    .sort((a,b)=>a.d-b.d).slice(0,n);
}

// ---------- parseo de raws de consumidor ----------
function cleanGT(g){return (g||'').toUpperCase().replace(/[^ACGT]/g,'').slice(0,2)}
function comp(g){return g.replace(/[ATCG]/g,c=>({A:'T',T:'A',C:'G',G:'C'})[c])}

function parseRaw(text,name='muestra'){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/),map=new Map();let fmt='genérico';
  for(const line of lines){
    if(!line||line[0]==='#')continue;
    let x=line.includes('\t')?line.split('\t'):line.split(',');
    x=x.map(v=>v.trim().replace(/^"|"$/g,''));
    let rs=x.find(v=>/^rs\d+$/i.test(v));
    if(!rs&&x[0]&&/^\d+:\d+/.test(x[0]))continue; // posiciones sin rsID
    if(!rs)continue;
    let gt='';
    if(x.length>=10&&x[2]===rs&&/^[ACGT]$/.test(x[3])&&/^[ACGT](,[ACGT])*$/.test(x[4])){
      // VCF: REF,ALT y genotipo "0/1"
      const al=[x[3],...x[4].split(',')],ix=(x[9].split(':')[0].match(/[0-9.]+/g)||[]).map(Number);
      if(ix.length>=2&&ix.every(i=>Number.isInteger(i)&&al[i]))gt=al[ix[0]]+al[ix[1]];
      fmt='VCF';
    }else if(x.length>=5&&cleanGT(x[x.length-2]).length===1&&cleanGT(x[x.length-1]).length===1){
      gt=x[x.length-2]+x[x.length-1];
    }else{
      gt=x.slice().reverse().map(cleanGT).find(v=>v.length===2)||'';
    }
    if(gt.length===2)map.set(rs.toLowerCase(),gt);
    if(fmt!=='VCF'&&x.length===4&&line.includes('\t'))fmt='23andMe/LivingDNA';
    else if(fmt!=='VCF'&&x.length===5&&line.includes('\t'))fmt='Ancestry';
    else if(fmt!=='VCF'&&line.includes(','))fmt='MyHeritage/FTDNA CSV';
  }
  return {name:name.replace(/\.(txt|csv|vcf)(\.gz)?$/i,''),map,format:fmt,total:map.size};
}

// ---------- puntuación "¿es esto un raw de ADN?" (para elegir la entrada correcta de un ZIP) ----------
function puntuaRaw(t){
  if (!t || t.length < 500) return {puntos: 0, rs: 0};
  const rs = (t.match(/rs\d+/gi) || []).length;
  let puntos = Math.min(rs, 2_000_000);
  const cab = t.slice(0, 4000);
  if (/rsid/i.test(cab)) puntos += 500;
  if (/chromosome|chrom|pos(ition)?/i.test(cab)) puntos += 200;
  if (/23andMe|AncestryDNA|MyHeritage|LivingDNA|FTDNA|fileformat/i.test(cab)) puntos += 300;
  return {puntos, rs};
}

// ---------- cruce con el panel K36 ----------
function extractCalls(raw,model){
  const {snps,index}=model,calls=[];let flips=0,discord=0;
  for(const [rs,g0] of raw.map){
    const i=index.get(rs);if(i===undefined)continue;
    const a=snps[i][1],b=snps[i][2];
    let g=g0;
    if([...g].some(c=>c!==a&&c!==b)){
      const z=comp(g);
      if([...z].every(c=>c===a||c===b)){g=z;flips++}
      else{discord++;continue}
    }
    let maj=0,min=0;
    for(const c of g){if(c===b)maj++;else if(c===a)min++}
    calls.push([i,maj,min]);
  }
  return {calls,flips,discord};
}

// ---------- MLE K36 (100 iteraciones fijas, fiel al original) ----------
async function mle(calls,freq,onstep){
  const K=36,q=new Float64Array(K).fill(1/K),n2=calls.length*2;
  const idx=new Int32Array(calls.length),maj=new Uint8Array(calls.length),min=new Uint8Array(calls.length);
  calls.forEach((x,i)=>{idx[i]=x[0];maj[i]=x[1];min[i]=x[2]});
  let delta=1,iter=0;
  for(;iter<100;iter++){
    const next=new Float64Array(K);
    for(let c=0;c<idx.length;c++){
      const off=idx[c]*K;let p=0;
      for(let k=0;k<K;k++)p+=q[k]*FREQ_AT(freq,off,k);
      p=Math.min(.999999,Math.max(.000001,p));
      const a=maj[c]/p,b=min[c]/(1-p);
      for(let k=0;k<K;k++){
        const f=FREQ_AT(freq,off,k);
        next[k]+=q[k]*(a*f+b*(1-f));
      }
    }
    delta=0;
    for(let k=0;k<K;k++){next[k]/=n2;delta=Math.max(delta,Math.abs(next[k]-q[k]));q[k]=next[k]}
    onstep&&onstep(iter,delta);
    if(iter%2===1)await new Promise(r=>setTimeout(r,0));
  }
  return {q,iter,delta,used:calls.length,total:calls.length};
}
function FREQ_AT(freq,off,k){return freq[off+k]}

// ---------- proyección ridge v2 → G25 25D ----------
function project(q,REG,INT){
  return Float64Array.from({length:25},(_,j)=>INT[j]+q.reduce((s,x,k)=>s+x*100*REG[k][j],0));
}

// ---------- parseo de datasheets y coordenadas oficiales ----------
function parseG25(s){
  return s.trim().split(/\r?\n/).slice(1)
    .map(line=>{const x=line.split(',');return {name:x[0],v:Float32Array.from(x.slice(1,26),Number)}})
    .filter(x=>x.v.length===25&&!Number.isNaN(x.v[0]));
}
function parseDerived(s){
  return s.trim().split(/\r?\n/).slice(1)
    .map(line=>{const x=line.split(',');return {name:x[0],pop:x[1],lat:+x[2],lon:+x[3],cov:+x[4],v:Float32Array.from(x.slice(5,30),Number),derived:true}})
    .filter(x=>x.v.length===25&&!Number.isNaN(x.v[0]));
}
function parseOfficialLines(s){
  // Acepta el pegado tal cual de Vahaduo/G25-Davidski: bloques «Scaled» y/o «Raw»,
  // cabeceras sueltas, líneas en blanco, separadores , ; o tab (y espacios),
  // varias muestras y nombres con espacios. Devuelve [{name, v, escala}] con
  // Scaled primero (es la escala estándar para distancias y NNLS).
  const lineas = String(s).replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  const esNum = t => /^[+-.]?\d/.test(t);
  const out = []; let escala = null; const ignoradas = [];
  for (const l of lineas){
    const t = l.trim();
    if (!t) continue;
    // cabecera de bloque («Scaled», «Raw», «G25 Scaled Avg», …): solo si NO lleva números
    if (!/\d/.test(t)){
      const low = t.toLowerCase().replace(/[:*#]+$/,'').trim();
      if (low === 'scaled' || low.startsWith('scaled ') || low.startsWith('g25 scaled')) { escala = 'scaled'; continue; }
      if (low === 'raw' || low === 'unscaled' || low.startsWith('raw ') || low.startsWith('g25 raw')) { escala = 'raw'; continue; }
      if (/^[#;<>]/.test(t)) continue; // comentario
    }
    // separador: coma/punto y coma/tab; si no parte en suficientes trozos, espacios
    let x = t.split(/\s*[,;\t]\s*/).map(v=>v.replace(/^"|"$/g,'').trim()).filter(Boolean);
    if (x.length < 2) x = t.split(/\s+/);
    // el nombre es todo lo que va antes del primer número
    let j = 0; while (j < x.length && !esNum(x[j])) j++;
    const name = j > 0 ? x.slice(0, j).join(' ') : (x[0] || 'muestra');
    const nums = [];
    for (let k = j; k < x.length && nums.length < 25; k++){
      const v = Number(x[k]);
      if (!Number.isFinite(v)){ nums.length = 0; break; }
      nums.push(v);
    }
    if (nums.length !== 25){ ignoradas.push(t.slice(0, 40)); continue; }
    out.push({name, v: Float64Array.from(nums), escala: escala || 'scaled'});
  }
  if (!out.length){
    throw new Error('No veo ninguna muestra (nombre + 25 coordenadas). Pega el bloque Scaled de Vahaduo: «nombre,0.12,0.14,…» — ignoro ' + ignoradas.length + ' línea(s) no válida(s).');
  }
  out.sort((a, b) => (a.escala === 'scaled' ? 0 : 1) - (b.escala === 'scaled' ? 0 : 1));
  return out;
}

// ---------- escala Raw->Scaled de G25 ----------
// Ley empírica calibrada el 2026-09 con dos pares oficiales Raw+Scaled de Davidski
// (david_ntizar y lolo_casona): Scaled[i] = K[i] * Raw[i], con K constante por eje
// y estable entre personas (error de reconstrucción < 1e-6 en ambos pares).
const G25_RAW2SCALED = [11.382315,10.155282,3.771189,3.23,3.077491,2.79,2.35,2.307949,2.045243,1.822371,1.623889,1.498688,1.4866,1.376231,1.357209,1.325865,1.303841,1.26691,1.256918,1.250512,1.247768,1.236482,1.232474,1.20494,1.197547];
function escalarRawOficial(v){
  return Float64Array.from({length:25},(_,i)=>v[i]*G25_RAW2SCALED[i]);
}

// export Node / navegador
if(typeof module!=='undefined'){
  module.exports={b64bytes,ungzip,dist,nearest,cleanGT,comp,parseRaw,puntuaRaw,extractCalls,mle,project,parseG25,parseDerived,parseOfficialLines,escalarRawOficial};
}
if(typeof window!=='undefined'){
  window.Motor={b64bytes,ungzip,dist,nearest,cleanGT,comp,parseRaw,puntuaRaw,extractCalls,mle,project,parseG25,parseDerived,parseOfficialLines,escalarRawOficial};
}
