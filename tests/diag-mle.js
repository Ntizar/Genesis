
const path = require('path'); const fs = require('fs');
const Motor = require('../js/motor.js');
function extraerConst(n, s){const m=s.match(new RegExp('const\\s+'+n+'\\s*=\\s*"([A-Za-z0-9+/=]+)"'));if(!m)throw new Error('no '+n);return m[1]}
(async()=>{
const DATA = path.join(__dirname,'..','js');
const src = fs.readFileSync(path.join(DATA,'data_payload.js'),'utf8');
const [st,fb] = await Promise.all([Motor.ungzip(extraerConst('K36_SNPS_GZ_B64',src)),Motor.ungzip(extraerConst('K36_FREQ_GZ_B64',src),false)]);
const snps=st.trim().split(/\r?\n/).map(x=>x.split('\t'));
const freq=new Float32Array(fb);
const MIX=[[3,0.50],[5,0.20],[20,0.15],[0,0.15]];
let _s=1013904223;
const rnd=()=>{_s|=0;_s=_s+0x6D2B79F5|0;let t=Math.imul(_s^_s>>>15,1|_s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
for (const W of [800, 5000, snps.length]) {
  _s=1013904223; // misma semilla para comparar
  const lines=[];
  for(let s=0;s<W;s++){
    const i=Math.floor(rnd()*snps.length);
    const [rs,a,b]=snps[i];
    let r=rnd(),c=MIX[0][0],acc=0;
    for(const[k,w]of MIX){acc+=w;if(r<=acc){c=k;break}}
    const f=freq[i*36+c];let nB=0;if(rnd()<f)nB++;if(rnd()<f)nB++;
    const gt=nB===0?a+a:nB===1?a+b:b+b;
    lines.push(`${rs}\t${a}\t${b}\t${gt[0]}\t${gt[1]}`);
  }
  const raw=Motor.parseRaw('rsid\tc\tp\tallele1\tallele2\n'+lines.join('\n'),'diag');
  const model={snps,freq,index:new Map(snps.map((x,i)=>[x[0],i]))};
  const ex=Motor.extractCalls(raw,model);
  const fit=await Motor.mle(ex.calls,freq);
  const q=[...fit.q];
  const top=q.map((v,i)=>[i,v]).sort((x,y)=>y[1]-x[1]).slice(0,6);
  console.log(`W=${W}: top=`+top.map(([i,v])=>`k${i}:${v.toFixed(3)}`).join(' '));
}
})().catch(e=>{console.error(e);process.exit(2)});
