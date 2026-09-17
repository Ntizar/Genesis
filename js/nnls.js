// GÉNESIS — NNLS 25D (Lawson-Hanson, conjunto activo)
// min ||A·x - b||₂ con x ≥ 0. A: k fuentes × n dims (k≤30), b: n.
// Devuelve {w, residuo, r2, iter}.
'use strict';

function _solveGS(M, v) {
  // Eliminación gaussiana con pivoteo parcial: resuelve M·x = v
  const k = M.length;
  const A = M.map((fila, i) => fila.concat(v[i]));
  for (let col = 0; col < k; col++) {
    let piv = col;
    for (let f = col + 1; f < k; f++) if (Math.abs(A[f][col]) > Math.abs(A[piv][col])) piv = f;
    if (Math.abs(A[piv][col]) < 1e-12) return null; // singular
    if (piv !== col) { const t = A[piv]; A[piv] = A[col]; A[col] = t; }
    for (let f = col + 1; f < k; f++) {
      const fac = A[f][col] / A[col][col];
      for (let c = col; c <= k; c++) A[f][c] -= fac * A[col][c];
    }
  }
  const x = new Array(k).fill(0);
  for (let f = k - 1; f >= 0; f--) {
    let s = A[f][k];
    for (let c = f + 1; c < k; c++) s -= A[f][c] * x[c];
    x[f] = s / A[f][f];
  }
  return x;
}

function _matTmul(A, b) {
  // A^T·b con A como filas
  const k = A.length, n = A[0].length;
  const out = new Array(k).fill(0);
  for (let i = 0; i < k; i++) { let s = 0; for (let j = 0; j < n; j++) s += A[i][j] * b[j]; out[i] = s; }
  return out;
}

function _gram(A) {
  const k = A.length, n = A[0].length;
  const G = Array.from({length: k}, () => new Array(k).fill(0));
  for (let i = 0; i < k; i++)
    for (let j = i; j < k; j++) {
      let s = 0;
      for (let d = 0; d < n; d++) s += A[i][d] * A[j][d];
      G[i][j] = G[j][i] = s;
    }
  return G;
}

function nnls(A, b, maxIter) {
  const k = A.length, n = A[0].length;
  maxIter = maxIter || 30 * k || 300;
  const G = _gram(A);            // A^T·A (k×k)
  const Atb = _matTmul(A, b);    // A^T·b
  const P = new Array(k).fill(false); // conjunto activo (x>0)
  const x = new Array(k).fill(0);
  let iter = 0;

  const residuo = () => {
    let s = 0;
    for (let d = 0; d < n; d++) {
      let v = -b[d];
      for (let i = 0; i < k; i++) v += x[i] * A[i][d];
      s += v * v;
    }
    return Math.sqrt(s);
  };

  for (; iter < maxIter; iter++) {
    // gradiente w = A^T(b - A·x)
    const r = new Array(n);
    for (let d = 0; d < n; d++) {
      let v = b[d];
      for (let i = 0; i < k; i++) v -= x[i] * A[i][d];
      r[d] = v;
    }
    const w = _matTmul(A, r);
    // ¿algún x_i=0 con w_i>tol?
    let idx = -1, best = 1e-10;
    for (let i = 0; i < k; i++) if (!P[i] && w[i] > best) { best = w[i]; idx = i; }
    if (idx === -1) break;
    P[idx] = true;
    // resolver en el conjunto activo; si algún peso ≤0, quitar el peor y repetir (paso interior)
    for (;;) {
      const act = []; for (let i = 0; i < k; i++) if (P[i]) act.push(i);
      const M = act.map(i => G[i].filter((_, j) => P[j]));
      const v = act.map(i => Atb[i]);
      const sol = _solveGS(M, v);
      if (!sol) { // singular: retirar el candidato recién añadido
        P[idx] = false; break;
      }
      let todoPositivo = true, minVal = Infinity, minPos = -1;
      for (let a = 0; a < act.length; a++) {
        if (sol[a] <= 1e-12) { todoPositivo = false; if (sol[a] < minVal) { minVal = sol[a]; minPos = a; } }
      }
      if (todoPositivo) {
        act.forEach((i, a) => { x[i] = sol[a]; });
        break;
      }
      // recortar: x = x + alpha*(sol - x) hasta tocar 0 en minPos
      act.forEach((i, a) => { if (x[i] === 0) x[i] = 0; });
      const xi = act.map(i => x[i]);
      let alpha = 1;
      for (let a = 0; a < act.length; a++) {
        if (sol[a] <= 1e-12 && xi[a] > 0) alpha = Math.min(alpha, xi[a] / (xi[a] - sol[a]));
      }
      act.forEach((i, a) => { x[i] = xi[a] + alpha * (sol[a] - xi[a]); if (x[i] < 1e-14) x[i] = 0; });
      P[act[minPos]] = false;
      act.forEach((i) => { if (!P[i]) x[i] = 0; });
    }
  }
  const res = residuo();
  const nb = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return { w: x.map(v => (v < 1e-6 ? 0 : v)), residuo: res, r2: nb > 0 ? 1 - (res * res) / (nb * nb) : 0, iter };
}

// Normaliza pesos a suma 1 (para presentación), conservando ceros
function normalizar(w) {
  const s = w.reduce((a, v) => a + v, 0);
  return s > 0 ? w.map(v => v / s) : w.slice();
}

if (typeof module !== 'undefined') module.exports = { nnls, normalizar };
