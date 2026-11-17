// classify.mjs — clasificador de comandos Bash de bash-gate (plugin lf).
// Función pura: classify(command, ctx) → {decision: allow|ask|deny|none, reason}. Sin E/S, sin dependencias, Node 18.
//
// Principio: lee → allow; edita datos o estado compartido → ask; destruye trabajo no recuperable → deny;
// lo que no se reconoce → none (lo resuelve el sandbox). `allow` significa «puede ejecutarse fuera del sandbox
// sin preguntar», así que ante la duda nunca es allow. Es una barandilla contra accidentes, no una frontera.
// Composición de segmentos: deny > ask > none > allow.

const SEV = { allow: 0, none: 1, ask: 2, deny: 3 };
const R = (decision, reason) => ({ decision, reason });
const worse = (a, b) => (SEV[b.decision] > SEV[a.decision] ? b : a);
const worst = (list, fallback) => list.reduce((a, b) => (a ? worse(a, b) : b), null) || fallback;
const capNone = (r, why) => (r.decision === 'allow' ? R('none', why || r.reason) : r);

const MAX_DEPTH = 8;
const MAX_LEN = 100000;

// ───────────────────────── Léxico ─────────────────────────
// Parte el comando en segmentos (separados por && || ; | |& & salto de línea y paréntesis) respetando comillas,
// $(…), `…`, <(…) y heredocs. Cada palabra queda sin comillas; `dyn` marca expansiones ($VAR, $(…)).

const newSeg = (pipedIn, depth) => ({
  words: [], redirs: [], subs: [], herestrings: [], heredoc: false, unsure: false, pipedIn, depth,
});

// Índice tras el `)` que cierra el `(` de s[i], o -1. Salta comillas, backticks, comentarios y cuerpos de heredoc
// (un apóstrofo dentro de un heredoc de `$(cat <<EOF …)` no debe romper el emparejado).
function scanParen(s, i) {
  let depth = 0;
  let j = i;
  const pend = [];
  while (j < s.length) {
    const ch = s[j];
    if (ch === '\\') { j += 2; continue; }
    if (ch === "'") { const k = s.indexOf("'", j + 1); if (k < 0) return -1; j = k + 1; continue; }
    if (ch === '"') { j = skipDq(s, j + 1); if (j < 0) return -1; continue; }
    if (ch === '`') { j = skipBt(s, j); if (j < 0) return -1; continue; }
    if (ch === '#' && (s[j - 1] === undefined || /[\s;&|(]/.test(s[j - 1]))) {
      const k = s.indexOf('\n', j); j = k < 0 ? s.length : k; continue;
    }
    if (ch === '<' && s[j + 1] === '<' && s[j + 2] !== '<') {
      const d = parseDelim(s, j + 2);
      if (d) { pend.push(d); j = d.end; continue; }
    }
    if (ch === '\n' && pend.length) { j = readBodies(s, j + 1, pend.splice(0)).end; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth === 0) return j + 1; }
    j++;
  }
  return -1;
}

function skipDq(s, j) {
  while (j < s.length) {
    const ch = s[j];
    if (ch === '\\') { j += 2; continue; }
    if (ch === '"') return j + 1;
    if (ch === '$' && s[j + 1] === '(') { const e = scanParen(s, j + 1); if (e < 0) return -1; j = e; continue; }
    if (ch === '`') { j = skipBt(s, j); if (j < 0) return -1; continue; }
    j++;
  }
  return -1;
}

function skipBt(s, j) {
  j++;
  while (j < s.length) {
    if (s[j] === '\\') { j += 2; continue; }
    if (s[j] === '`') return j + 1;
    j++;
  }
  return -1;
}

function readBacktick(s, i) {
  const out = [];
  let j = i + 1;
  while (j < s.length) {
    const ch = s[j];
    if (ch === '\\' && j + 1 < s.length && '`\\$'.includes(s[j + 1])) { out.push(s[j + 1]); j += 2; continue; }
    if (ch === '`') return { inner: out.join(''), end: j + 1, ok: true };
    out.push(ch); j++;
  }
  return { inner: out.join(''), end: s.length, ok: false };
}

function parseDelim(s, k) {
  let strip = false;
  if (s[k] === '-') { strip = true; k++; }
  while (s[k] === ' ' || s[k] === '\t') k++;
  let delim = '';
  const q = s[k];
  if (q === "'" || q === '"') {
    const e = s.indexOf(q, k + 1);
    if (e < 0) return null;
    return { delim: s.slice(k + 1, e), strip, end: e + 1 };
  }
  while (k < s.length && !/[\s;&|<>()]/.test(s[k])) { if (s[k] !== '\\') delim += s[k]; k++; }
  return delim ? { delim, strip, end: k } : null;
}

// Lee los cuerpos de los heredocs pendientes a partir de j (inicio de línea).
function readBodies(s, j, pend) {
  const bodies = [];
  for (const p of pend) {
    const lines = [];
    while (j < s.length) {
      const e = s.indexOf('\n', j);
      const line = s.slice(j, e < 0 ? s.length : e);
      j = e < 0 ? s.length : e + 1;
      const cmp = (p.strip ? line.replace(/^\t+/, '') : line).replace(/\r$/, '');
      if (cmp === p.delim) break;
      lines.push(line);
    }
    bodies.push(lines.join('\n'));
  }
  return { end: j, bodies };
}

// Sustituciones de comando dentro de un texto que el shell expandiría (cuerpo de heredoc sin comillas, ${…}).
function extractSubs(s) {
  const out = [];
  let bad = false;
  let j = 0;
  while (j < s.length) {
    const ch = s[j];
    if (ch === '\\') { j += 2; continue; }
    if (ch === '$' && s[j + 1] === '(') {
      const e = scanParen(s, j + 1);
      if (e < 0) { out.push(s.slice(j + 2)); bad = true; break; }
      out.push(s.slice(j + 2, e - 1)); j = e; continue;
    }
    if (ch === '`') {
      const b = readBacktick(s, j);
      out.push(b.inner); if (!b.ok) bad = true;
      j = b.end; continue;
    }
    j++;
  }
  return { out, bad };
}

// Decodifica los escapes de $'…' como lo hace bash; el texto resultante es el que verá el comando.
const ANSI_SIMPLE = { a: '\x07', b: '\b', e: '\x1b', E: '\x1b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\', "'": "'", '"': '"', '?': '?' };
function ansiC(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '\\' || i + 1 >= s.length) { out += c; continue; }
    const d = s[++i];
    const num = (re, max, radix) => {
      let j = i + (radix === 8 ? 0 : 1);
      let v = '';
      while (j < s.length && v.length < max && re.test(s[j])) v += s[j++];
      if (!v) return false;
      out += String.fromCodePoint(Math.min(parseInt(v, radix), 0x10ffff));
      i = j - 1;
      return true;
    };
    if (ANSI_SIMPLE[d] !== undefined) out += ANSI_SIMPLE[d];
    else if (/[0-7]/.test(d)) num(/[0-7]/, 3, 8);
    else if (d === 'x' ? num(/[0-9a-fA-F]/, 2, 16) : d === 'u' ? num(/[0-9a-fA-F]/, 4, 16) : d === 'U' ? num(/[0-9a-fA-F]/, 8, 16) : false) { /* decodificado */ }
    else out += '\\' + d;
  }
  const z = out.indexOf('\0');
  return z < 0 ? out : out.slice(0, z);
}

function lex(src) {
  const n = src.length;
  const segs = [];
  let depth = 0;
  let seg = newSeg(false, 0);
  let buf = [];
  let has = false, quoted = false, dyn = false, glob = false;
  let pendingRedir = null;
  const pendingHere = [];
  let i = 0;

  const resetWord = () => { buf = []; has = false; quoted = false; dyn = false; glob = false; };

  function finishRedir(w) {
    const r = pendingRedir;
    pendingRedir = null;
    if (r.op === '<<' || r.op === '<<-') {
      pendingHere.push({ delim: w.text, expand: !w.quoted, strip: r.op === '<<-', seg });
      seg.heredoc = true;
      return;
    }
    if (r.op === '<<<') { seg.herestrings.push(w); seg.redirs.push({ kind: 'in', target: w, here: true }); return; }
    let kind = 'in';
    if (['>', '>>', '>|', '&>', '&>>', '<>'].includes(r.op)) kind = 'out';
    else if (r.op === '>&') kind = /^(\d+|-)$/.test(w.text) && !w.dyn ? 'dup' : 'out';
    else if (r.op === '<&') kind = 'dup';
    seg.redirs.push({ kind, target: w });
  }

  function endWord() {
    if (!has) return;
    const w = { text: buf.join(''), quoted, dyn, glob };
    resetWord();
    if (pendingRedir) finishRedir(w); else seg.words.push(w);
  }

  function endSegment(op) {
    endWord();
    if (pendingRedir) { seg.unsure = true; pendingRedir = null; }
    const pipe = op === '|' || op === '|&';
    if (seg.words.length || seg.redirs.length || seg.subs.length) {
      segs.push(seg);
      seg = newSeg(pipe, depth);
    } else {
      if (pipe) seg.pipedIn = true; else if (op !== 'nl') seg.pipedIn = false;
      seg.depth = depth;
    }
  }

  function addSub(inner, ok) {
    seg.subs.push(inner);
    if (!ok) seg.unsure = true;
    buf.push('$(…)'); has = true; dyn = true;
  }

  function readDollar(k, inDq) {
    const nx = src[k + 1];
    if (nx === '(') {
      const e = scanParen(src, k + 1);
      if (src[k + 2] === '(') { // $(( aritmética ))
        buf.push(src.slice(k, e < 0 ? n : e)); has = true; dyn = true;
        if (e < 0) seg.unsure = true;
        return e < 0 ? n : e;
      }
      if (e < 0) { addSub(src.slice(k + 2), false); return n; }
      addSub(src.slice(k + 2, e - 1), true);
      return e;
    }
    if (nx === '{') {
      let j = k + 2, d = 1;
      while (j < n && d > 0) { if (src[j] === '{') d++; else if (src[j] === '}') d--; j++; }
      if (d > 0) seg.unsure = true;
      const text = src.slice(k, j);
      buf.push(text); has = true; dyn = true;
      const x = extractSubs(text);
      for (const s of x.out) seg.subs.push(s);
      if (x.bad) seg.unsure = true;
      return j;
    }
    if (!inDq && nx === "'") { // $'…' (ANSI-C)
      let j = k + 2;
      while (j < n && src[j] !== "'") j += src[j] === '\\' ? 2 : 1;
      if (j >= n) seg.unsure = true;
      buf.push(ansiC(src.slice(k + 2, Math.min(j, n)))); has = true; quoted = true;
      return j + 1;
    }
    if (!inDq && nx === '"') return k + 1; // $"…": se trata como "…"
    if (nx !== undefined && /[A-Za-z_]/.test(nx)) {
      let j = k + 1;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      buf.push(src.slice(k, j)); has = true; dyn = true;
      return j;
    }
    if (nx !== undefined && /[0-9@*#?$!-]/.test(nx)) { buf.push(src.slice(k, k + 2)); has = true; dyn = true; return k + 2; }
    buf.push('$'); has = true;
    return k + 1;
  }

  function readBt(k) {
    const b = readBacktick(src, k);
    addSub(b.inner, b.ok);
    return b.end;
  }

  function readDq(k) {
    has = true; quoted = true;
    let j = k + 1;
    while (j < n) {
      const ch = src[j];
      if (ch === '"') return j + 1;
      if (ch === '\\') {
        const nx = src[j + 1];
        if (nx === undefined) { buf.push('\\'); j++; continue; }
        if (nx === '\n') { j += 2; continue; }
        if ('$`"\\'.includes(nx)) { buf.push(nx); j += 2; continue; }
        buf.push('\\'); j++; continue;
      }
      if (ch === '$') { j = readDollar(j, true); continue; }
      if (ch === '`') { j = readBt(j); continue; }
      buf.push(ch); j++;
    }
    seg.unsure = true;
    return n;
  }

  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\v' || c === '\f') { endWord(); i++; continue; }
    if (c === '\n') {
      endWord();
      endSegment('nl');
      i++;
      if (pendingHere.length) {
        const pend = pendingHere.splice(0);
        const r = readBodies(src, i, pend);
        pend.forEach((p, idx) => {
          if (!p.expand) return;
          const x = extractSubs(r.bodies[idx]);
          for (const s of x.out) p.seg.subs.push(s);
          if (x.bad) p.seg.unsure = true;
        });
        i = r.end;
      }
      continue;
    }
    if (c === '\\') {
      if (src[i + 1] === '\n') { i += 2; continue; }
      if (i + 1 < n) { buf.push(src[i + 1]); has = true; quoted = true; i += 2; } else { buf.push('\\'); has = true; i++; }
      continue;
    }
    if (c === "'") {
      const j = src.indexOf("'", i + 1);
      if (j < 0) { seg.unsure = true; buf.push(src.slice(i + 1)); i = n; } else { buf.push(src.slice(i + 1, j)); i = j + 1; }
      has = true; quoted = true;
      continue;
    }
    if (c === '"') { i = readDq(i); continue; }
    if (c === '$') { i = readDollar(i, false); continue; }
    if (c === '`') { i = readBt(i); continue; }
    if (c === '#' && !has) { const j = src.indexOf('\n', i); i = j < 0 ? n : j; continue; }
    if (c === ';') { endSegment(';'); i++; continue; }
    if (c === '&') {
      if (src[i + 1] === '&') { endSegment('&&'); i += 2; continue; }
      if (src[i + 1] === '>' && !has) {
        const op = src[i + 2] === '>' ? '&>>' : '&>';
        pendingRedir = { op }; i += op.length; continue;
      }
      endSegment('&'); i++; continue;
    }
    if (c === '|') {
      if (src[i + 1] === '|') { endSegment('||'); i += 2; continue; }
      if (src[i + 1] === '&') { endSegment('|&'); i += 2; continue; }
      endSegment('|'); i++; continue;
    }
    if (c === '(') {
      if (has && '?*+@!'.includes(buf[buf.length - 1] || '')) { // extglob
        let j = i, d = 0;
        while (j < n) { if (src[j] === '(') d++; else if (src[j] === ')') { d--; if (d === 0) break; } j++; }
        buf.push(src.slice(i, Math.min(j + 1, n))); glob = true; i = j + 1;
        continue;
      }
      endSegment('('); depth++; seg.depth = depth; i++; continue;
    }
    if (c === ')') { endSegment(')'); depth = Math.max(0, depth - 1); seg.depth = depth; i++; continue; }
    if (c === '<' || c === '>') {
      if (src[i + 1] === '(') { // <(…) y >(…)
        const e = scanParen(src, i + 1);
        addSub(src.slice(i + 2, e < 0 ? n : e - 1), e >= 0);
        i = e < 0 ? n : e;
        continue;
      }
      if (has && !quoted && /^\d+$/.test(buf.join(''))) resetWord(); else endWord();
      let op;
      if (c === '>') op = src[i + 1] === '>' ? '>>' : src[i + 1] === '&' ? '>&' : src[i + 1] === '|' ? '>|' : '>';
      else if (src.startsWith('<<<', i)) op = '<<<';
      else if (src.startsWith('<<-', i)) op = '<<-';
      else if (src.startsWith('<<', i)) op = '<<';
      else op = src[i + 1] === '&' ? '<&' : src[i + 1] === '>' ? '<>' : '<';
      pendingRedir = { op };
      i += op.length;
      continue;
    }
    if (c === '*' || c === '?' || c === '[') glob = true;
    buf.push(c); has = true; i++;
  }
  endSegment('end');
  return segs;
}

// ───────────────────────── Rutas ─────────────────────────

function normalize(p) {
  const out = [];
  for (const c of p.split('/')) {
    if (c === '' || c === '.') continue;
    if (c === '..') { out.pop(); continue; }
    out.push(c);
  }
  return '/' + out.join('/');
}

const inside = (p, root) => root === '/' || p === root || p.startsWith(root + '/');
const BRACE_RE = /\{[^{}]*(,|\.\.)[^{}]*\}/;
const TMP_RE = /^(?:\$TMPDIR|\$\{TMPDIR(?::?[-?=+][^}]*)?\})(?=\/|$)/;

// Ruta absoluta (sin normalizar) o null si no se puede resolver sin ejecutar nada.
function resolveAbs(text, ctx, cwd) {
  let s = text;
  const m = TMP_RE.exec(s);
  if (m) s = (ctx.tmpdir || '/tmp') + s.slice(m[0].length);
  else if (s.includes('$') || s.includes('`')) return null;
  if (BRACE_RE.test(s)) return null; // {a,b} / {1..3}: el shell expande a varias rutas
  if (s === '~' || s.startsWith('~/')) { if (!ctx.home) return null; s = ctx.home + s.slice(1); }
  else if (s.startsWith('~')) return null;
  if (s === '') return null;
  if (!s.startsWith('/')) { if (!cwd) return null; s = cwd + '/' + s; }
  return s;
}

const UNKNOWN = { scope: 'unknown' };

// Credenciales: nunca cuentan como repo ni tmp, aunque el cwd o el projectDir las contengan.
const CRED_DIRS = ['/.ssh', '/.config/gh', '/.aws', '/.gnupg'];
const CRED_FILES = ['/.netrc', '/.claude/.credentials.json'];
const isCred = (p, home) => !!home && home !== '/' && (CRED_DIRS.some((d) => inside(p, home + d)) || CRED_FILES.some((f) => p === home + f));

function pathInfo(text, ctx, cwd) {
  const abs = resolveAbs(text, ctx, cwd);
  if (abs === null) return UNKNOWN;
  const comps = normalize(abs).split('/').filter(Boolean);
  const gi = comps.findIndex((c) => /[*?[]/.test(c));
  const base = '/' + (gi < 0 ? comps : comps.slice(0, gi)).join('/');
  // Con $TMPDIR delante, `..` no puede escapar hacia /tmp: la única raíz válida es ctx.tmpdir.
  const viaTmp = TMP_RE.test(text);
  const repoRoots = viaTmp ? [] : ctx.repoRoots;
  const tmpRoots = viaTmp ? [ctx.tmpdir] : ctx.tmpRoots;
  const scope = isCred(base, ctx.home) ? 'outside'
    : repoRoots.some((r) => inside(base, r)) ? 'repo' : tmpRoots.some((r) => inside(base, r)) ? 'tmp' : 'outside';
  const rel = text.replace(/^(\.\/)+/, '');
  const c0 = rel.split('/')[0];
  return {
    scope,
    root: repoRoots.includes(base) || tmpRoots.includes(base),
    glob: gi >= 0,
    wildOnly: gi >= 0 && gi === comps.length - 1 && /^[*?.]+$/.test(comps[gi]) && /[*?]/.test(comps[gi]),
    lead: !/^[/~$]/.test(text) && /^[*?.]+$/.test(c0) && /[*?]/.test(c0),
    git: gi < 0 && comps[comps.length - 1] === '.git',
    dot: /(^|\/)\.\.?\/*$/.test(text) ? (/\.\.\/*$/.test(text) ? 'parent' : 'cur') : null,
  };
}

// repo | tmp | outside | unknown. `cwd` por defecto es ctx.cwd; las rutas relativas dependen de él.
export function pathScope(arg, ctx, cwd = ctx.cwd) {
  return pathInfo(arg, ctx, cwd).scope;
}

const ENV_LOCAL_RE = /^\.env(\..+)?\.local$/;
// Nombres a los que puede expandirse un glob sin comillas para que cuente como lectura de .env*.local.
const ENV_CANDS = ['.env.local', '.env.dev.local', '.env.test.local', '.env.prod.local', '.env.production.local', '.env.staging.local', '.env.development.local'];
function envGlobHit(p) {
  if (/^[*?]/.test(p)) return false; // `*` y `?` no casan con el punto inicial
  if (p.includes('(')) return p.startsWith('.'); // extglob: no se interpreta
  let re = '^';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*') re += '.*';
    else if (c === '?') re += '.';
    else if (c === '[') {
      const j = p.indexOf(']', i + 2);
      if (j < 0) { re += '\\['; continue; }
      let cls = p.slice(i + 1, j).replace(/\\/g, '\\\\');
      if (cls[0] === '!') cls = '^' + cls.slice(1);
      re += `[${cls}]`; i = j;
    } else re += c.replace(/[.+^${}()|\\\]]/g, '\\$&');
  }
  try { const rx = new RegExp(`${re}$`); return ENV_CANDS.some((n) => rx.test(n)); } catch { return true; }
}
const isEnvLocal = (w) => {
  const base = w.text.split('/').pop();
  return ENV_LOCAL_RE.test(base) || (!!w.glob && envGlobHit(base));
};

// ───────────────────────── Utilidades de argumentos ─────────────────────────

const isFlag = (w) => w.text.length > 1 && w.text[0] === '-';
// GNU getopt, popt y parse-options aceptan abreviaturas únicas de las opciones largas (`--upl` = `--upload-pack`):
// una opción peligrosa se detecta también abreviada. `min` incluye los dos guiones.
const abbr = (t, full, min = 3) => {
  const n = t.split('=')[0];
  return n.startsWith('--') && n.length >= min && full.startsWith(n);
};
const texts = (ws) => ws.map((w) => w.text);
const base = (t) => t.slice(t.lastIndexOf('/') + 1);
const clusterHas = (rest, ch) => rest.some((t) => /^-[A-Za-z]+$/.test(t) && t.includes(ch));

// ───────────────────────── SQL ─────────────────────────

// Quita comentarios, cadenas e identificadores entre backticks. null si algo queda sin cerrar.
function sqlStrip(t) {
  const out = [];
  const n = t.length;
  let i = 0;
  while (i < n) {
    const c = t[i];
    if (c === "'" || c === '"') {
      let j = i + 1;
      for (;;) {
        if (j >= n) return null;
        if (t[j] === '\\') { j += 2; continue; }
        if (t[j] === c) { if (t[j + 1] === c) { j += 2; continue; } break; }
        j++;
      }
      out.push(' '); i = j + 1; continue;
    }
    if (c === '`') {
      const j = t.indexOf('`', i + 1);
      if (j < 0) return null;
      out.push(' x '); i = j + 1; continue;
    }
    if (c === '#' || (c === '-' && t[i + 1] === '-' && (i + 2 >= n || /\s/.test(t[i + 2])))) {
      const j = t.indexOf('\n', i);
      out.push(' '); i = j < 0 ? n : j; continue;
    }
    if (c === '/' && t[i + 1] === '*') {
      const exec = t[i + 2] === '!' || (t[i + 2] === 'M' && t[i + 3] === '!');
      const j = t.indexOf('*/', i + 2);
      if (j < 0) return null;
      if (exec) { // /*! … */ se ejecuta: el contenido cuenta
        const inner = sqlStrip(t.slice(i + (t[i + 2] === '!' ? 3 : 4), j).replace(/^\d+/, ''));
        if (inner === null) return null;
        out.push(' ', inner, ' ');
      } else out.push(' ');
      i = j + 2; continue;
    }
    out.push(c); i++;
  }
  return out.join('');
}

function sqlStatement(s) {
  const st = s.replace(/^[\s(]+/, '');
  const w = st.match(/[A-Za-z0-9_$@]+/g) || [];
  const up = w.map((x) => x.toUpperCase());
  const first = up[0];
  const into = up.findIndex((x, k) => x === 'INTO' && (up[k + 1] === 'OUTFILE' || up[k + 1] === 'DUMPFILE'));
  if (first === 'SELECT') return into >= 0 ? R('ask', 'SQL: SELECT INTO OUTFILE') : R('allow', 'SQL de lectura');
  // EXPLAIN ANALYZE (MySQL 8) y ANALYZE (MariaDB) ejecutan la sentencia interior: se clasifica ella.
  const ana = /^(explain|analyze)((?:\s+(?:analyze|extended|partitions|verbose|format\s*=\s*\w+))*)\s+([\s\S]*)$/i.exec(st);
  if (ana && (ana[1].toLowerCase() === 'analyze' || /analyze/i.test(ana[2]))) return sqlStatement(ana[3]);
  if (['SHOW', 'EXPLAIN', 'DESCRIBE', 'DESC', 'USE'].includes(first)) return R('allow', 'SQL de lectura');
  if (first === 'WITH') {
    if (into >= 0 || up.some((x) => x === 'INSERT' || x === 'UPDATE' || x === 'REPLACE')) return R('ask', 'SQL: WITH con DML');
    return R('allow', 'SQL de lectura');
  }
  if (first === 'SET') {
    // `SET @a=1, GLOBAL x=1`: el ámbito puede aparecer en cualquier asignación, no solo en la primera.
    const scoped = up.some((x) => x === 'GLOBAL' || x === 'PERSIST' || x === 'PERSIST_ONLY' || /^@@(GLOBAL|PERSIST)/.test(x));
    if (!scoped && /^set\s+(names\b|session\b|@(?!@)|@@session\.)/i.test(st)) return R('allow', 'SET de sesión');
    return R('ask', 'SQL: SET fuera de sesión');
  }
  return R('ask', `SQL que modifica o no reconocido (${first || 'vacío'})`);
}

export function classifySql(text) {
  const clean = sqlStrip(text);
  if (clean === null) return R('ask', 'SQL no analizable (comilla o comentario sin cerrar)');
  if ((clean.match(/[A-Za-z0-9_$]+/g) || []).some((x) => /^(delete|drop|truncate)$/i.test(x))) {
    return R('deny', 'SQL con DELETE/DROP/TRUNCATE');
  }
  const stmts = clean.split(';').map((s) => s.trim()).filter(Boolean);
  if (!stmts.length) return R('ask', 'SQL vacío');
  return worst(stmts.map(sqlStatement), R('ask', 'SQL vacío'));
}

// SQL de un argumento: las expansiones ($VAR, $(…)) impiden asegurar que sea lectura.
function sqlWord(w) {
  const r = classifySql(w.text);
  return w.dyn && r.decision === 'allow' ? R('ask', 'SQL con expansión de shell') : r;
}

// Literal que una tubería entrega por stdin (echo/printf con argumentos literales).
function pipedLiteral(prev) {
  if (!prev) return null;
  const ws = prev.words;
  if (!ws.length) return null;
  const cmd = ws[0].text;
  if (cmd !== 'echo' && cmd !== 'printf') return null;
  const args = ws.slice(1).filter((w) => !(cmd === 'echo' && /^-[neE]+$/.test(w.text)));
  if (!args.length) return null;
  // Los escapes (\n, \x3b, \073) se decodifican al imprimir: el literal real no es el texto que se ve.
  if (args.some((w) => w.text.includes('\\'))) return null;
  if (cmd === 'printf') {
    if (args[0].text.includes('%')) return null;
    return args[0];
  }
  return { text: args.map((w) => w.text).join(' '), dyn: args.some((w) => w.dyn) };
}

// ───────────────────────── Familias ─────────────────────────

// -- lectores y filtros --
const READERS = new Set(['cat', 'head', 'tail', 'grep', 'rg', 'wc', 'sort', 'uniq', 'cut', 'tr', 'jq', 'column', 'ls', 'stat', 'file', 'diff']);
const ENV_CMDS = new Set(['wc', 'tr', 'cat', 'head', 'tail', 'grep', 'rg', 'sort', 'uniq', 'cut', 'jq', 'column', 'diff', 'less', 'more', 'tac', 'nl', 'bat',
  'awk', 'sed', 'strings', 'xxd', 'od', 'egrep', 'fgrep']);

// Palabras que son rutas leídas (se descartan patrón/script/filtro y valores que no lo son).
function readerArgs(name, args) {
  const words = [];
  const flags = [];
  const scripts = [];
  const files = [];
  let endFlags = false;
  let patternFlag = false;
  for (let i = 0; i < args.length; i++) {
    const w = args[i];
    const t = w.text;
    if (!endFlags && t === '--') { endFlags = true; continue; }
    if (!endFlags && isFlag(w)) {
      flags.push(t);
      if ((name === 'grep' || name === 'rg') && (t === '-e' || t === '-f' || /^--(regexp|file)/.test(t) || /^-[A-Za-z]*[ef]$/.test(t))) patternFlag = true;
      if (name === 'jq' && (t === '-f' || t === '--from-file')) patternFlag = true;
      if (name === 'grep' || name === 'rg') {
        // -f<fichero> / --file=<fichero>: el fichero se lee; -e<patrón> y -f<fichero> pegados ya traen el patrón.
        const fm = /^-[A-Za-z]*f(.+)$/.exec(t);
        if (fm) { patternFlag = true; files.push({ text: fm[1], dyn: w.dyn, glob: w.glob }); }
        else if (/^-[A-Za-z]*e.+$/.test(t)) patternFlag = true;
        else if (abbr(t, '--file', 4) && t.includes('=')) { patternFlag = true; files.push({ text: t.slice(t.indexOf('=') + 1), dyn: w.dyn, glob: w.glob }); }
      }
      if (name === 'jq' && (t === '--arg' || t === '--argjson')) i += 2;
      if (name === 'jq' && (t === '--slurpfile' || t === '--rawfile')) { if (args[i + 2]) files.push(args[i + 2]); i += 2; } // nombre + fichero leído
      if (name === 'sed') {
        const eq = t.indexOf('=');
        if (/^-[nEszru]*e$/.test(t) || (abbr(t, '--expression') && eq < 0)) { patternFlag = true; if (args[i + 1]) scripts.push(args[i + 1].text); i++; }
        else if (abbr(t, '--expression') && eq > 0) { patternFlag = true; scripts.push(t.slice(eq + 1)); }
        else if (/^-[nEszru]*e./.test(t)) { patternFlag = true; scripts.push(t.replace(/^-[nEszru]*e/, '')); }
        else if (/^-[nEszru]*f$/.test(t) || abbr(t, '--file')) { patternFlag = true; if (eq < 0 && args[i + 1]) i++; }
      }
      const eq = t.indexOf('=');
      if (t.startsWith('--') && eq > 0 && /^[/~]/.test(t.slice(eq + 1))) words.push({ text: t.slice(eq + 1), dyn: w.dyn });
      continue;
    }
    words.push(w);
  }
  if (name === 'tr') words.length = 0;
  else if ((name === 'grep' || name === 'rg') && !patternFlag && !(name === 'rg' && flags.includes('--files'))) words.shift();
  else if ((name === 'jq' || name === 'sed') && !patternFlag) { const s = words.shift(); if (s && name === 'sed') scripts.push(s.text); }
  return { words, flags, scripts, files };
}

// Recorre el guion de sed saltando direcciones, patrones y textos; true si aparece un comando que escribe,
// lee o ejecuta (w W r R e, flags w/e de `s`) o algo que no se sabe interpretar.
function sedDangerous(s) {
  const n = s.length;
  if (n > 2000) return true;
  let i = 0;
  const skipTo = (d) => {
    while (i < n && s[i] !== d) { if (s[i] === '\\') i++; i++; }
    if (i >= n) return false;
    i++;
    return true;
  };
  while (i < n) {
    const c = s[i];
    if (/[\s;{}!,$~+0-9]/.test(c)) { i++; continue; }
    if (c === '/' || c === '\\') {
      let d = '/';
      if (c === '\\') { d = s[i + 1]; if (d === undefined) return true; i += 2; } else i++;
      if (!skipTo(d)) return true;
      while (i < n && (s[i] === 'I' || s[i] === 'M')) i++;
      continue;
    }
    i++;
    if (c === 's' || c === 'y') {
      const d = s[i++];
      if (d === undefined || d === '\n' || d === '\\' || !skipTo(d) || !skipTo(d)) return true;
      while (i < n && /[A-Za-z0-9]/.test(s[i])) { if (c === 's' && (s[i] === 'w' || s[i] === 'e')) return true; i++; }
      continue;
    }
    if ('wWrRe'.includes(c)) return true;
    if ('aic'.includes(c)) { while (i < n && s[i] !== '\n') { if (s[i] === '\\') i++; i++; } continue; }
    if ('bBtT:'.includes(c)) { while (i < n && !/[;\n}]/.test(s[i])) i++; continue; }
    if ('dDgGhHlLnNpPqQxz=F'.includes(c)) continue;
    if (c === '#') { while (i < n && s[i] !== '\n') i++; continue; }
    return true;
  }
  return false;
}

function hReader(a, name) {
  const { st, seg } = a;
  const { words, flags, scripts, files } = readerArgs(name, a.args);
  const inFiles = seg.redirs.filter((r) => r.kind === 'in' && !r.here).map((r) => r.target);
  const paths = words.concat(files, inFiles);
  if (ENV_CMDS.has(name) && paths.some(isEnvLocal)) return R('deny', 'lectura de .env*.local');
  if (!READERS.has(name) && name !== 'sed') return null;
  if (name === 'sed') {
    if (flags.some((f) => abbr(f, '--in-place', 3) || /^-[A-Za-z]*i/.test(f))) return R('none', 'sed -i');
    if (flags.some((f) => /^-[nEszru]*f$/.test(f) || abbr(f, '--file'))) return R('none', 'sed -f: guion externo');
    if (scripts.some(sedDangerous)) return R('none', 'sed con w/r/e');
  }
  if (name === 'sort' && flags.some((f) => abbr(f, '--output') || abbr(f, '--compress-program') || /^-[A-Za-z]*o/.test(f))) return R('none', 'sort -o/--compress-program');
  if (name === 'file' && flags.some((f) => f === '--compile' || /^-[A-Za-z]*C/.test(f))) return R('none', 'file -C escribe un fichero');
  if (name === 'uniq' && words.length > 1) return R('none', 'uniq con fichero de salida');
  if (name === 'rg' && flags.some((f) => /^--(pre|hostname-bin)/.test(f))) return R('none', 'rg ejecuta un preprocesador');
  // -u/-uu/-uuu y --no-ignore* quitan el filtro de ignorados (.gitignore, .ignore): leería secretos ignorados.
  if (name === 'rg' && flags.some((f) => /^--(no-ignore|unrestricted)/.test(f) || (!f.startsWith('--') && /^-[A-Za-z]*u/.test(f)))) return R('none', 'rg sin filtro de ignorados');
  const recursive = flags.some((f) => f === '--recursive' || f === '-R' || (/^-[A-Za-z]+$/.test(f) && /[rR]/.test(f)));
  const implicit = !paths.length && (name === 'ls' || name === 'rg' || (name === 'grep' && recursive));
  const targets = implicit ? [{ text: '.', dyn: false }] : paths;
  for (const p of targets) {
    const sc = pathInfo(p.text, st.ctx, st.cwd).scope;
    if (sc !== 'repo' && sc !== 'tmp') return R('none', `lectura fuera del proyecto (${p.text})`);
  }
  return R('allow', `lectura (${name})`);
}

function hFind(a) {
  const { st } = a;
  const args = a.args;
  const idx = args.findIndex((w) => /^-(delete|exec|execdir|ok|okdir|fprint\w*|fls)$/.test(w.text));
  let k = 0;
  while (k < args.length && /^-[HLPDO]/.test(args[k].text) && !/^-(name|path|type)/.test(args[k].text)) k += args[k].text === '-D' ? 2 : 1;
  const starts = [];
  while (k < args.length && !isFlag(args[k]) && args[k].text !== '(' && args[k].text !== '!') starts.push(args[k++]);
  const expr = args.slice(k);
  const et = texts(expr);
  if (et.some((t) => /^-(fprint\w*|fls)$/.test(t))) return R('none', 'find escribe a fichero');
  const filtered = et.some((t) => /^-(i?name|i?path|i?wholename|i?regex|type|newer\w*|[mac]time|[mac]min|size|user|group|perm|empty|i?lname)$/.test(t));
  const roots = starts.length ? starts : [{ text: '.', dyn: false }];
  const child = { ...st, soft: filtered };
  const out = [];
  if (et.includes('-delete')) out.push(hRm({ ...a, st: child, args: [{ text: '-r', dyn: false }, ...roots] }, 'rm'));
  for (let i = 0; i < expr.length; i++) {
    if (!/^-(exec|execdir|ok|okdir)$/.test(expr[i].text)) continue;
    let e = i + 1;
    while (e < expr.length && !(expr[e].text === ';' || expr[e].text === '+')) e++;
    if (e >= expr.length) { out.push(R('none', 'find -exec sin terminador')); break; }
    const inner = [];
    for (const w of expr.slice(i + 1, e)) { if (w.text === '{}') inner.push(...roots); else inner.push(w); }
    if (inner.length) out.push(capNone(classifyCommand(inner, child, a.seg, null, a.depth + 1), 'find -exec'));
    i = e;
  }
  if (idx >= 0 || out.length) return worst(out, R('none', 'find con acción'));
  return worstRoots(roots, a);
}

function worstRoots(roots, a) {
  for (const p of roots) {
    const sc = pathInfo(p.text, a.st.ctx, a.st.cwd).scope;
    if (sc !== 'repo' && sc !== 'tmp') return R('none', `find fuera del proyecto (${p.text})`);
  }
  return R('allow', 'find de lectura');
}

// -- borrado --
function rmVerdict(info, soft) {
  if (info.scope !== 'repo' && info.scope !== 'tmp') return R('deny', 'borrado recursivo fuera del repo/tmp o con ruta sin resolver');
  if (info.git) return R('deny', 'borrado recursivo de .git');
  if (info.dot === 'parent' || (info.dot === 'cur' && !soft)) return R('deny', 'borrado recursivo de . o ..');
  if (info.glob) {
    if (info.lead || (info.wildOnly && info.root)) return R('deny', 'borrado recursivo con comodín sobre toda la raíz');
    return R('ask', 'borrado recursivo con comodín');
  }
  if (info.root && !soft) return R('deny', 'borrado recursivo de la raíz del repo/tmp');
  return R('ask', 'borrado recursivo en el repo/tmp');
}

function hRm(a, name) {
  let rec = false;
  let noPreserve = false;
  let endFlags = false;
  const paths = [];
  for (const w of a.args) {
    const t = w.text;
    if (!endFlags && t === '--') { endFlags = true; continue; }
    if (!endFlags && t.startsWith('--')) { if (t === '--recursive') rec = true; if (t === '--no-preserve-root') noPreserve = true; continue; }
    if (!endFlags && isFlag(w)) { if (/[rR]/.test(t)) rec = true; continue; }
    paths.push(w);
  }
  if (noPreserve) return R('deny', 'rm --no-preserve-root');
  if (!rec || name !== 'rm') return R('ask', `${name} borra ficheros`);
  if (!paths.length) return R('ask', 'rm -r sin rutas');
  const soft = !!a.st.soft;
  return worst(paths.map((p) => rmVerdict(pathInfo(p.text, a.st.ctx, a.st.cwd), soft)), R('ask', 'rm -r'));
}

// shred/truncate: destruyen contenido sin posibilidad de recuperarlo; fuera del repo/tmp → deny.
function hShred(a, name) {
  const paths = a.args.filter((w) => !isFlag(w));
  if (!paths.length) return R('ask', `${name} sin rutas`);
  return worst(paths.map((p) => {
    const sc = pathInfo(p.text, a.st.ctx, a.st.cwd).scope;
    return sc === 'repo' || sc === 'tmp' ? R('ask', `${name} en repo/tmp`) : R('deny', `${name} fuera del repo`);
  }), R('ask', name));
}

function hDd(a) {
  const of = a.args.find((w) => w.text.startsWith('of='));
  if (!of) return R('none', 'dd sin of=');
  const sc = pathInfo(of.text.slice(3), a.st.ctx, a.st.cwd).scope;
  return sc === 'repo' || sc === 'tmp' ? R('ask', 'dd of= en repo/tmp') : R('deny', 'dd of= fuera del repo');
}

// -- git --
// Opciones globales: solo -C, --no-pager, -P, --git-dir y --work-tree se consideran inocuas; cualquier otra
// (-c, --exec-path, --config-env, --namespace…) puede cambiar qué programa ejecuta git y impide `allow`.
const GIT_GLOBAL_VAL = new Set(['-c', '--namespace', '--config-env', '--super-prefix', '--attr-source']);
const TRANSPORT_SUBS = new Set(['fetch', 'pull', 'ls-remote', 'push', 'clone']);
const EXEC_OPTS = ['--upload-pack', '--receive-pack', '--exec'];

function hGit(a) {
  const args = a.args;
  let i = 0;
  let risky = false;
  let outside = false;
  // -C/--git-dir/--work-tree fuera del repo: el .git/config de otro repo puede ejecutar programas (core.fsmonitor, hooks).
  let cur = a.st.cwd;
  const chk = (w, isC) => {
    const info = pathInfo(w ? w.text : '', a.st.ctx, cur);
    if (info.scope !== 'repo') outside = true;
    else if (isC) cur = normalize(resolveAbs(w.text, a.st.ctx, cur));
  };
  while (i < args.length) {
    const t = args[i].text;
    if (t === '-C' || t === '--git-dir' || t === '--work-tree') { chk(args[i + 1], t === '-C'); i += 2; continue; }
    if (/^--(git-dir|work-tree)=/.test(t)) { chk({ text: t.slice(t.indexOf('=') + 1) }, false); i++; continue; }
    if (t === '--no-pager' || t === '-P') { i++; continue; }
    if (!isFlag(args[i])) break;
    risky = true;
    i += GIT_GLOBAL_VAL.has(t) ? 2 : 1;
  }
  const sub = args[i] && args[i].text;
  if (!sub) return risky || outside ? R('none', 'git con opción global') : R('allow', 'git sin subcomando');
  const rest = texts(args.slice(i + 1));
  let r = gitSub(sub, rest);
  if (risky) r = capNone(r, 'git con opción global (-c, --exec-path…)');
  if (outside) r = capNone(r, 'git con -C/--git-dir/--work-tree fuera del repo');
  // --upload-pack/--receive-pack/--exec (también abreviadas) ejecutan el programa indicado; ext:: también.
  if (TRANSPORT_SUBS.has(sub) && rest.some((t) => EXEC_OPTS.some((f) => abbr(t, f, 3)) || (sub === 'clone' && /^-u/.test(t)) || t.startsWith('ext::'))) {
    r = capNone(r, `git ${sub} con opción que ejecuta un programa`);
  }
  return r;
}

const GIT_READ = new Set(['status', 'diff', 'log', 'show', 'blame', 'rev-parse', 'ls-files', 'describe', 'shortlog', 'rev-list', 'ls-tree',
  'cat-file', 'grep', 'show-ref', 'for-each-ref', 'merge-base', 'name-rev', 'diff-tree', 'diff-files', 'diff-index', 'show-branch',
  'count-objects', 'cherry', 'range-diff', 'help', 'version', 'check-ignore', 'ls-remote', 'fetch', 'add']);

function gitSub(sub, rest) {
  const has = (...f) => rest.some((t) => f.includes(t));
  const dd = rest.indexOf('--');
  const head = dd < 0 ? rest : rest.slice(0, dd);
  const pos = head.filter((t) => !t.startsWith('-'));
  if (GIT_READ.has(sub)) {
    if (rest.some((t) => /^--(output|no-index|ext-diff|open-files-in-pager|exec)/.test(t) || /^-O/.test(t))) return R('none', `git ${sub} con opción de riesgo`);
    return R('allow', `git ${sub}`);
  }
  switch (sub) {
    case 'commit':
      if (has('--dry-run')) return R('allow', 'git commit --dry-run');
      if (has('--amend')) return R('deny', 'git commit --amend');
      return R('ask', 'git commit');
    case 'push': {
      if (has('--dry-run', '-n') || clusterHas(head, 'n')) return R('allow', 'git push --dry-run');
      if (rest.some((t) => /^--(force|delete|mirror|prune)/.test(t)) || clusterHas(head, 'f') || clusterHas(head, 'd')) return R('deny', 'git push destructivo (force/delete/mirror)');
      if (pos.some((t) => t.startsWith(':') || t.startsWith('+'))) return R('deny', 'git push de refspec destructivo');
      return R('ask', 'git push');
    }
    case 'pull': case 'merge': case 'cherry-pick': case 'revert': case 'clone':
      return R('ask', `git ${sub}`);
    case 'rm': return R('ask', 'git rm');
    case 'tag':
      if (has('-d', '--delete') || clusterHas(head, 'd')) return R('ask', 'git tag -d');
      if (has('-l', '--list') || (!pos.length && !has('-a', '-s', '-m', '-f', '-u'))) return R('allow', 'git tag (listar)');
      return R('ask', 'git tag <n>');
    case 'branch': {
      if (has('-D') || clusterHas(head, 'D') || ((has('-d', '--delete') || clusterHas(head, 'd')) && (has('-f', '--force') || clusterHas(head, 'f')))) return R('deny', 'git branch -D');
      if (has('-d', '--delete') || clusterHas(head, 'd')) return R('ask', 'git branch -d');
      if (has('-m', '-M', '-c', '-C', '--move', '--copy', '-u', '--set-upstream-to', '--unset-upstream', '--edit-description') || rest.some((t) => t.startsWith('--set-upstream-to'))) return R('none', 'git branch modifica');
      const list = has('-l', '--list', '--contains', '--no-contains', '--merged', '--no-merged', '--points-at');
      if (pos.length && !list) return R('none', 'git branch <n> crea rama');
      return R('allow', 'git branch (listar)');
    }
    case 'remote':
      if (!pos.length || pos[0] === 'show' || pos[0] === 'get-url') return R('allow', 'git remote (leer)');
      return R('none', 'git remote modifica');
    case 'stash':
      if (pos[0] === 'list' || pos[0] === 'show') return R('allow', 'git stash list/show');
      if (pos[0] === 'drop' || pos[0] === 'clear') return R('deny', 'git stash drop/clear');
      return R('none', 'git stash');
    case 'reset': {
      if (rest.some((t) => t === '--hard' || /^--ha(r(d)?)?$/.test(t))) return R('deny', 'git reset --hard');
      if (has('--keep', '--merge')) return R('ask', 'git reset --keep/--merge toca el árbol de trabajo');
      // quitar del stage (sin commit, `HEAD`, o solo rutas tras `--`) no pierde nada: none
      if (rest[0] === '--' || !pos.length || pos[0] === 'HEAD') return R('none', 'git reset: quitar del stage');
      const p = pos[0];
      // otro commit-ish (HEAD~1, hash, origin/x, rama sin punto ni barra) mueve HEAD: ask; con punto o barra se toma por ruta
      if (/[./]/.test(p) && !/^(HEAD|ORIG_HEAD|FETCH_HEAD|MERGE_HEAD|@)([~^@{].*)?$/.test(p) && !/[~^]/.test(p) && !/^(origin|upstream|refs)\//.test(p)) return R('none', 'git reset de ruta');
      return R('ask', 'git reset <commit>');
    }
    case 'clean':
      // dry-run (-n, --dry-run, o cluster solo de f d x X n q): no borra nada; `-e` no entra porque `-en` es un patrón.
      if (rest.some((t) => abbr(t, '--dry-run', 4)) || head.some((t) => /^-[fdxXnq]*n[fdxXnq]*$/.test(t))) return R('allow', 'git clean --dry-run');
      return R('deny', 'git clean');
    case 'rebase': case 'filter-branch': case 'filter-repo': case 'prune': return R('deny', `git ${sub}`);
    case 'gc': return rest.some((t) => t.startsWith('--prune')) ? R('deny', 'git gc --prune') : R('none', 'git gc');
    case 'reflog': return pos[0] === 'expire' || pos[0] === 'delete' ? R('deny', 'git reflog expire/delete') : R('allow', 'git reflog');
    case 'config':
      return has('--get', '--get-all', '--get-regexp', '--list', '-l') ? R('allow', 'git config (leer)') : R('none', 'git config');
    case 'checkout': {
      if (has('-f', '--force')) return R('deny', 'git checkout -f');
      if (dd >= 0 && dd < rest.length - 1) return R('deny', 'git checkout -- <ruta>');
      if (has('-b', '-B', '--orphan')) return R('none', 'git checkout -b');
      if (has('--ours', '--theirs') || pos.includes('.')) return R('deny', 'git checkout descarta cambios');
      if (pos.length >= 2) return R('deny', 'git checkout <ref> <ruta>');
      return R('none', 'git checkout <rama>');
    }
    case 'restore': {
      if (!pos.length && !(dd >= 0 && dd < rest.length - 1)) return R('none', 'git restore sin ruta');
      const staged = has('--staged', '-S') || clusterHas(head, 'S');
      const wt = has('--worktree', '-W') || clusterHas(head, 'W');
      return wt || !staged ? R('deny', 'git restore sobrescribe el árbol de trabajo') : R('none', 'git restore --staged');
    }
    case 'switch':
      return has('-f', '--force', '--discard-changes') ? R('deny', 'git switch --discard-changes') : R('none', 'git switch');
    default:
      return R('none', `git ${sub}`);
  }
}

// -- docker --
const EXEC_VAL = new Set(['-u', '--user', '-e', '--env', '-w', '--workdir', '--index', '--env-file', '--detach-keys']);

function hExec(a, rest) {
  let i = 0;
  for (; i < rest.length; i++) {
    const t = rest[i].text;
    if (t === '--') { i++; break; }
    if (!isFlag(rest[i])) break;
    if (EXEC_VAL.has(t)) { i++; continue; }
    if (!t.startsWith('--') && /^-[A-Za-z]+$/.test(t)) {
      const k = t.search(/[uew]/);
      if (k > 0 && k === t.length - 1) i++; // -u/-e/-w al final del grupo: el valor va en la palabra siguiente
    }
  }
  const inner = rest.slice(i + 1); // rest[i] es el contenedor/servicio
  if (!rest[i] || !inner.length) return R('ask', 'docker exec sin comando');
  const r = classifyCommand(inner, { ...a.st, inExec: true }, a.seg, null, a.depth + 1);
  return r.decision === 'none' ? R('ask', `docker exec con comando no reconocido (${r.reason})`) : r;
}

const COMPOSE_VAL = new Set(['-f', '--file', '-p', '--project-name', '--env-file', '--profile', '--project-directory', '--ansi', '--progress', '--parallel', '-c', '--context']);

function hCompose(a, rest) {
  let i = 0;
  while (i < rest.length && isFlag(rest[i])) i += COMPOSE_VAL.has(rest[i].text) ? 2 : 1;
  const sub = rest[i] && rest[i].text;
  const tail = rest.slice(i + 1);
  const tt = texts(tail);
  if (!sub) return R('allow', 'docker compose sin subcomando');
  if (sub === 'exec') return hExec(a, tail);
  if (['ps', 'logs', 'config', 'top', 'images', 'ls', 'version', 'port'].includes(sub)) {
    // `config -o fichero` escribe a disco
    return tt.some((t) => t === '-o' || /^--output(=|$)/.test(t)) ? R('none', `docker compose ${sub} escribe a fichero`) : R('allow', `docker compose ${sub}`);
  }
  if (sub === 'down' && tt.some((t) => t === '-v' || t === '--volumes' || t.startsWith('--rmi'))) return R('deny', 'docker compose down -v/--rmi');
  if (sub === 'rm' && tt.some((t) => t === '-v' || t === '--volumes')) return R('deny', 'docker compose rm -v');
  if (['up', 'start', 'stop', 'restart', 'build', 'pull', 'push', 'run', 'down', 'rm', 'create', 'kill', 'pause', 'unpause', 'cp', 'scale', 'watch'].includes(sub)) return R('ask', `docker compose ${sub}`);
  return R('none', `docker compose ${sub}`);
}

const DOCKER_GLOBAL_VAL = new Set(['-H', '--host', '--context', '-c', '--config', '-l', '--log-level', '--tlscacert', '--tlscert', '--tlskey']);

// --config apunta a otro directorio de configuración: `docker --config X compose …` carga X/cli-plugins/ y ejecuta ese binario.
function hDocker(a, composeOnly) {
  let risky = false;
  for (let k = 0; !composeOnly && k < a.args.length && isFlag(a.args[k]); k += DOCKER_GLOBAL_VAL.has(a.args[k].text) ? 2 : 1) {
    if (/^--config(=|$)/.test(a.args[k].text)) risky = true;
  }
  const r = dockerCore(a, composeOnly);
  return risky ? capNone(r, 'docker con --config') : r;
}

function dockerCore(a, composeOnly) {
  const args = a.args;
  if (composeOnly) return hCompose(a, args);
  const GV = DOCKER_GLOBAL_VAL;
  let i = 0;
  while (i < args.length && isFlag(args[i])) i += GV.has(args[i].text) ? 2 : 1;
  const sub = args[i] && args[i].text;
  if (!sub) return R('allow', 'docker sin subcomando');
  const rest = args.slice(i + 1);
  const rt = texts(rest);
  const sub2 = rt.find((t) => !t.startsWith('-'));
  const rmForce = () => (rt.some((t) => t === '--force' || t === '--volumes') || clusterHas(rt, 'f') || clusterHas(rt, 'v'))
    ? R('deny', 'docker rm -f/-v') : R('ask', 'docker rm');
  switch (sub) {
    case 'compose': return hCompose(a, rest);
    case 'exec': return hExec(a, rest);
    case 'ps': case 'images': case 'logs': case 'inspect': case 'version': case 'info': case 'top': case 'port':
      return R('allow', `docker ${sub}`);
    case 'rm': return rmForce();
    case 'rmi': return R('ask', 'docker rmi');
    case 'container': case 'image': case 'volume': case 'network': case 'builder': case 'system': {
      if (sub2 === 'prune') return R('deny', `docker ${sub} prune`);
      if (sub === 'volume' && sub2 === 'rm') return R('deny', 'docker volume rm');
      if (sub === 'container' && sub2 === 'rm') return rmForce();
      if (sub === 'container' && sub2 === 'exec') return hExec(a, rest.slice(rt.indexOf('exec') + 1));
      if (['ls', 'ps', 'logs', 'inspect', 'top', 'port', 'history'].includes(sub2)) return R('allow', `docker ${sub} ${sub2}`);
      if (sub === 'container') return R('ask', `docker container ${sub2 || ''}`.trim());
      return R('none', `docker ${sub}`);
    }
    case 'run': case 'build': case 'cp': case 'start': case 'stop': case 'restart': case 'kill': case 'pull': case 'push': case 'tag':
    case 'login': case 'logout': case 'commit': case 'create': case 'rename': case 'update': case 'save': case 'load': case 'import':
    case 'export': case 'pause': case 'unpause':
      return R('ask', `docker ${sub}`);
    default: return R('none', `docker ${sub}`);
  }
}

// Herramientas de desarrollo conocidas: dentro de `docker exec` se permiten aunque el gate no las reconozca.
const DEV_TOOLS = new Set(['phpunit', 'pest', 'phpstan', 'psalm', 'phpcs', 'phpcbf', 'php-cs-fixer', 'rector']);
const PHP_RE = /^php(\d+(\.\d+)*)?$/;

// Nombre de la herramienta si el token es un nombre desnudo o vendor/bin/<x>, node_modules/.bin/<x> o bin/<x> (con ./ opcional).
function toolName(tok) {
  const rel = tok.replace(/^(\.\/)+/, '');
  return !rel.includes('/') || /^(vendor\/bin|node_modules\/\.bin|bin)\/[^/]+$/.test(rel) ? base(rel) : null;
}

function devTool(argv) {
  const t = texts(argv);
  if (!t.length) return false;
  const b = toolName(t[0]);
  if (b === null) return false;
  if (DEV_TOOLS.has(b)) return true;
  const rest = t.slice(1);
  const sub = rest.find((x) => !x.startsWith('-'));
  if (PHP_RE.test(b)) {
    if (phpIniRisky(rest)) return false;
    let i = 0;
    while (i < rest.length && rest[i].startsWith('-')) i += rest[i] === '-d' ? 2 : 1;
    const tool = rest[i] === undefined ? null : toolName(rest[i]);
    return tool !== null && DEV_TOOLS.has(tool);
  }
  if (b === 'composer' || b === 'composer.phar') return ['install', 'dump-autoload', 'dumpautoload', 'validate', 'show', 'outdated', 'why', 'audit'].includes(sub);
  if (['npm', 'pnpm', 'yarn', 'bun'].includes(b)) {
    if (rest.some((x) => /^(--prefix|--cwd|--dir|--userconfig|--globalconfig)(=|$)/.test(x) || /^-C/.test(x))) return false; // apuntan a otro proyecto
    if (sub === undefined) return b === 'yarn';
    if (['test', 't', 'tst', 'ci', 'clean-install', 'run', 'run-script', 'rum', 'urn'].includes(sub)) return true;
    if (['install', 'i', 'in'].includes(sub)) return !rest.slice(rest.indexOf(sub) + 1).some((x) => !x.startsWith('-'));
  }
  return false;
}

// -- php / symfony console / composer / wp --
const CONSOLE_KNOWN = ['doctrine:database:drop', 'doctrine:database:create', 'doctrine:schema:drop', 'doctrine:schema:update',
  'doctrine:schema:create', 'doctrine:schema:validate', 'doctrine:fixtures:load', 'doctrine:migrations:migrate',
  'doctrine:migrations:execute', 'doctrine:migrations:version', 'doctrine:migrations:diff', 'doctrine:migrations:status',
  'doctrine:migrations:list', 'doctrine:migrations:current', 'doctrine:migrations:latest', 'doctrine:migrations:up-to-date',
  'doctrine:migrations:generate', 'doctrine:migrations:rollup', 'doctrine:migrations:sync-metadata-storage',
  'doctrine:query:sql', 'doctrine:mapping:info', 'dbal:run-sql'];

// Symfony admite abreviar (d:s:u): se expande contra los comandos conocidos y se toma el peor.
function expandConsole(name) {
  if (CONSOLE_KNOWN.includes(name) || !name.includes(':')) return [name];
  const parts = name.split(':');
  const m = CONSOLE_KNOWN.filter((k) => {
    const kp = k.split(':');
    return kp.length === parts.length && parts.every((p, i) => p !== '' && kp[i].startsWith(p));
  });
  return m.length ? m : [name];
}

const CONSOLE_READ = new Set(['list', 'help', 'about', 'router:match', 'doctrine:migrations:status', 'doctrine:migrations:list',
  'doctrine:migrations:current', 'doctrine:migrations:latest', 'doctrine:migrations:up-to-date', 'doctrine:schema:validate',
  'doctrine:mapping:info']);

function consoleCmd(c, rest, restWords) {
  const r = consoleCore(c, rest, restWords);
  // --write-sql[=fichero] escribe un fichero aunque sea --dry-run
  return rest.some((t) => abbr(t, '--write-sql', 7)) ? capNone(r, 'console --write-sql escribe un fichero') : r;
}

function consoleCore(c, rest, restWords) {
  const has = (...f) => rest.some((t) => f.includes(t) || f.some((x) => x.length > 2 && t.startsWith(x + '=')));
  const pos = rest.filter((t) => !t.startsWith('-'));
  if (CONSOLE_READ.has(c) || /^(debug|lint|cache|make):/.test(c)) return R('allow', `console ${c}`);
  switch (c) {
    case 'doctrine:migrations:migrate':
      if (has('--dry-run')) return R('allow', 'migrate --dry-run');
      if (pos[0] === 'first' || pos[0] === '0') return R('deny', 'migrate first/0 revierte todas las migraciones');
      return R('ask', 'doctrine:migrations:migrate');
    case 'doctrine:schema:update':
      if (has('--force')) return R('deny', 'doctrine:schema:update --force');
      if (has('--dump-sql')) return R('allow', 'doctrine:schema:update --dump-sql');
      return R('ask', 'doctrine:schema:update');
    case 'doctrine:database:drop': case 'doctrine:schema:drop': case 'doctrine:fixtures:load':
      return R('deny', `console ${c}`);
    case 'doctrine:query:sql': case 'dbal:run-sql': {
      const w = restWords.find((x) => !x.text.startsWith('-'));
      return w ? sqlWord(w) : R('ask', 'SQL sin sentencia');
    }
    case 'messenger:consume': return R('ask', 'messenger:consume');
    default:
      if (/^(app|secrets|doctrine):/.test(c)) return R('ask', `console ${c}`);
      return R('none', `console ${c}`);
  }
}

function hConsole(a, args) {
  let i = 0;
  while (i < args.length && isFlag(args[i])) i += args[i].text === '-e' || args[i].text === '--env' ? 2 : 1;
  const nameW = args[i];
  if (!nameW) return R('allow', 'console sin comando');
  if (nameW.dyn) return R('none', 'comando de console dinámico');
  const restWords = args.slice(i + 1);
  const rest = texts(restWords);
  return worst(expandConsole(nameW.text).map((c) => consoleCmd(c, rest, restWords)), R('none', 'console'));
}

// `-d clave=valor` solo se admite para ajustes inocuos: extension=, zend_extension=, auto_prepend_file=… cargan código.
const INI_OK = /^(memory_limit|max_execution_time|display_errors|error_reporting|date\.timezone|zend\.assertions|xdebug\.mode|opcache\.enable_cli)=/;
function phpIniRisky(t) {
  for (let i = 0; i < t.length && t[i].startsWith('-') && t[i].length > 1; i++) {
    if (t[i] === '-d') { if (!INI_OK.test(t[i + 1] || '')) return true; i++; continue; }
    if (/^-d./.test(t[i])) { if (!INI_OK.test(t[i].slice(2))) return true; continue; }
    if (/^-[cz]/.test(t[i]) || t[i] === '--php-ini' || t[i].startsWith('--php-ini=')) return true;
  }
  return false;
}

function hPhp(a) {
  const r = phpCore(a);
  return phpIniRisky(texts(a.args)) ? capNone(r, 'php con -d/-c/-z que puede cargar código') : r;
}

function phpCore(a) {
  const args = a.args;
  let i = 0;
  while (i < args.length && isFlag(args[i])) {
    const t = args[i].text;
    if (t === '-l') {
      if (args.slice(i + 1).some(isFlag)) return R('none', 'php -l con más opciones'); // p. ej. `-r código` detrás
      const files = args.slice(i + 1);
      const bad = files.find((w) => { const s = pathInfo(w.text, a.st.ctx, a.st.cwd).scope; return s !== 'repo' && s !== 'tmp'; });
      return bad ? R('none', 'php -l fuera del proyecto') : R('allow', 'php -l');
    }
    if (t === '-v' || t === '--version' || t === '-m' || t === '--modules') {
      return args.length > i + 1 ? R('none', `php ${t} con más argumentos`) : R('allow', `php ${t}`);
    }
    if (/^-[rRBEFfiS]$/.test(t) || /^--r[fie]/.test(t) || t === '-s' || t === '-a') return R('none', `php ${t}`);
    i += t === '-d' ? 2 : 1;
  }
  const script = args[i];
  if (!script) return R('none', 'php desde stdin');
  const b = base(script.text);
  const rest = args.slice(i + 1);
  if (/^composer(\.phar)?$/.test(b)) return hComposer(a, rest);
  if (b === 'console') return hConsole(a, rest);
  return R('none', 'php <script>');
}

function hComposer(a, args) {
  const flag = { outside: false };
  const r = composerCore(a, args, flag);
  return flag.outside ? capNone(r, 'composer con -d fuera del proyecto') : r;
}

function composerCore(a, args, flag) {
  let i = 0;
  while (i < args.length && isFlag(args[i])) {
    const t = args[i].text;
    if (t === '--version' || t === '-V') return R('allow', 'composer --version');
    if (t === '-d' || t === '--working-dir') {
      // otro directorio de trabajo: se cargarían los plugins y scripts de su composer.json/vendor
      const sc = args[i + 1] ? pathInfo(args[i + 1].text, a.st.ctx, a.st.cwd).scope : 'unknown';
      if (sc !== 'repo') flag.outside = true;
      i += 2;
      continue;
    }
    if (/^(-d.|--working-dir=)/.test(t)) flag.outside = true;
    i++;
  }
  const sub = args[i] && args[i].text;
  if (!sub) return R('allow', 'composer sin subcomando');
  const rest = texts(args.slice(i + 1));
  if (['require', 'r', 'remove', 'rm', 'uninstall', 'update', 'u', 'upgrade', 'reinstall'].includes(sub)) {
    return rest.includes('--dry-run') ? R('allow', `composer ${sub} --dry-run`) : R('ask', `composer ${sub}`);
  }
  if (['config', 'global', 'self-update', 'selfupdate', 'create-project', 'init'].includes(sub)) return R('ask', `composer ${sub}`);
  if (['show', 'info', 'validate', 'outdated', 'why', 'why-not', 'depends', 'prohibits', 'audit', 'licenses', 'check-platform-reqs', 'list', 'help', 'diagnose', 'search', 'fund'].includes(sub)) return R('allow', `composer ${sub}`);
  return R('none', `composer ${sub}`);
}

const WP_VAL = new Set(['--path', '--url', '--user', '--ssh', '--http', '--require', '--exec', '--context', '--blog']);

function hWp(a) {
  const args = a.args;
  const pos = [];
  const flags = [];
  for (let i = 0; i < args.length; i++) {
    const t = args[i].text;
    if (isFlag(args[i])) { flags.push(t); if (WP_VAL.has(t)) i++; continue; }
    pos.push(args[i]);
  }
  const P = texts(pos);
  const [g, s, s2] = P;
  // --exec/--require ejecutan PHP; --ssh/--http cargan WordPress desde otro sitio; --export escribe un fichero
  if (flags.some((f) => /^--(exec|require|ssh|http|export)(=|$)/.test(f))) return R('none', 'wp con --exec/--require/--ssh/--http/--export');
  if (!g) return flags.includes('--info') || flags.includes('--version') || !flags.length ? R('allow', 'wp info') : R('none', 'wp');
  if (g === 'help') return R('allow', 'wp help');
  if (g === 'cli') return ['version', 'info', 'has-command'].includes(s) ? R('allow', 'wp cli') : R('ask', 'wp cli');
  if (P.slice(1).some((x) => ['delete', 'reset', 'destroy'].includes(x)) && g !== 'db') return R('deny', `wp ${g} ${s} destructivo`);
  if ((g === 'plugin' || g === 'theme') && s === 'uninstall') return R('deny', `wp ${g} uninstall`);
  if (g === 'site' && (s === 'empty' || s === 'delete')) return R('deny', `wp site ${s}`);
  if (g === 'db') {
    if (['drop', 'import', 'reset', 'clean'].includes(s)) return R('deny', `wp db ${s}`);
    if (['tables', 'size', 'check', 'search', 'prefix'].includes(s)) return R('allow', `wp db ${s}`);
    if (s === 'query') return pos[2] ? sqlWord(pos[2]) : R('ask', 'wp db query sin SQL');
    return R('ask', `wp db ${s || ''}`.trim());
  }
  if (['eval', 'eval-file', 'shell'].includes(g)) return R('ask', `wp ${g}`);
  if (g === 'search-replace') return flags.includes('--dry-run') ? R('allow', 'wp search-replace --dry-run') : R('ask', 'wp search-replace');
  if (g === 'config') return ['get', 'list', 'path', 'has', 'is-true'].includes(s) ? R('none', 'wp config (lectura de credenciales)') : R('ask', 'wp config');
  if (g === 'core') {
    if (['version', 'verify-checksums', 'is-installed', 'check-update'].includes(s)) return R('allow', `wp core ${s}`);
    return R('ask', `wp core ${s || ''}`.trim());
  }
  if (s === 'list' || s === 'get' || (g === 'plugin' || g === 'theme') && ['status', 'path', 'is-active', 'is-installed', 'search'].includes(s)) return R('allow', `wp ${g} ${s}`);
  if (['meta', 'event', 'term', 'cap'].includes(s) && (s2 === 'list' || s2 === 'get')) return R('allow', `wp ${g} ${s} ${s2}`);
  if (['install', 'activate', 'deactivate', 'update', 'upgrade', 'create', 'add', 'set', 'edit', 'patch', 'generate', 'regenerate', 'flush', 'toggle', 'import'].includes(s)) return R('ask', `wp ${g} ${s}`);
  return R('none', `wp ${g}`);
}

// -- mysql / mariadb --
// Opciones de mysql que ejecutan un programa (--pager), escriben ficheros (--tee) o cargan otra configuración.
const mysqlRisky = (args) => args.some((w) => {
  const n = w.text.split('=')[0];
  return abbr(n, '--pager', 5) || abbr(n, '--tee', 4) || n.startsWith('--defaults') || abbr(n, '--plugin-dir', 6);
});

function hMysql(a) {
  const r = mysqlCore(a);
  return mysqlRisky(a.args) ? capNone(r, 'mysql con --pager/--tee/--defaults-*') : r;
}

function mysqlCore(a) {
  const args = a.args;
  const sqls = [];
  let info = false;
  for (let i = 0; i < args.length; i++) {
    const w = args[i];
    const t = w.text;
    if (t.startsWith('--')) {
      const eq = t.indexOf('=');
      const name = eq < 0 ? t : t.slice(0, eq);
      if (abbr(name, '--execute', 4) || abbr(name, '--init-command', 4)) {
        if (eq >= 0) sqls.push({ text: t.slice(eq + 1), dyn: w.dyn });
        else if (args[i + 1]) { sqls.push(args[i + 1]); i++; }
      } else if (name === '--version' || name === '--help') info = true;
      else if (eq < 0 && ['--host', '--user', '--port', '--socket', '--database', '--password'].includes(name)) i++;
      continue;
    }
    if (!isFlag(w)) continue;
    for (let k = 1; k < t.length; k++) {
      const ch = t[k];
      const attached = t.slice(k + 1);
      if (ch === 'e') { if (attached) sqls.push({ text: attached, dyn: w.dyn }); else if (args[i + 1]) { sqls.push(args[i + 1]); i++; } break; }
      if (ch === 'p') break;
      if ('uhPDS'.includes(ch)) { if (!attached) i++; break; }
      if (ch === 'V' || ch === '?' || ch === 'I') info = true;
    }
  }
  if (sqls.length) return worst(sqls.map(sqlWord), R('ask', 'SQL'));
  if (info) return R('allow', 'mysql --version/--help');
  if (a.seg.herestrings.length) return sqlWord(a.seg.herestrings[0]);
  if (a.seg.heredoc) return R('ask', 'SQL por heredoc, no analizable');
  if (a.seg.redirs.some((r) => r.kind === 'in')) return R('ask', 'SQL desde fichero, no analizable');
  if (a.seg.pipedIn) {
    const lit = pipedLiteral(a.prev);
    return lit ? sqlWord(lit) : R('ask', 'SQL por tubería, no analizable');
  }
  return R('ask', 'mysql sin -e');
}

function hMysqladmin(a) {
  const VAL = new Set(['-u', '-h', '-P', '-S', '--user', '--host', '--port', '--socket']);
  const cmds = [];
  for (let i = 0; i < a.args.length; i++) {
    const t = a.args[i].text;
    if (isFlag(a.args[i])) { if (VAL.has(t)) i++; continue; }
    cmds.push(t);
  }
  if (cmds.includes('drop')) return R('deny', 'mysqladmin drop');
  const safe = ['ping', 'status', 'version', 'variables', 'extended-status', 'processlist', 'proc'];
  const r = cmds.length && cmds.every((c) => safe.includes(c)) ? R('allow', 'mysqladmin de lectura') : R('ask', 'mysqladmin');
  return mysqlRisky(a.args) ? capNone(r, 'mysqladmin con opción que carga configuración') : r;
}

// -- npm y compañía --
function hNode(a, name) {
  const VAL = new Set(['--prefix', '-C', '--cwd', '--filter', '-w', '--workspace', '--registry']);
  let i = 0;
  while (i < a.args.length && isFlag(a.args[i])) i += VAL.has(a.args[i].text) ? 2 : 1;
  const sub = a.args[i] && a.args[i].text;
  if (!sub) return R('none', name);
  const rest = texts(a.args.slice(i + 1));
  if (['add', 'remove', 'rm', 'uninstall', 'un', 'update', 'up', 'upgrade', 'publish', 'unpublish', 'deprecate', 'dist-tag', 'owner',
    'access', 'token', 'login', 'logout', 'adduser', 'global'].includes(sub)) return R('ask', `${name} ${sub}`);
  if (['install', 'i', 'in'].includes(sub)) return rest.some((t) => !t.startsWith('-')) ? R('ask', `${name} install <paquete>`) : R('none', `${name} install`);
  if (sub === 'audit') return rest.includes('fix') || rest.includes('--fix') ? R('deny', `${name} audit fix`) : R('none', `${name} audit`);
  return R('none', `${name} ${sub}`);
}

// -- gh --
function hGhApi(args) {
  let method = null;
  let field = false;
  let graphql = false;
  for (let i = 0; i < args.length; i++) {
    const t = args[i].text;
    if (t === '-X' || t === '--method') { method = args[i + 1] ? args[i + 1].text : ''; i++; }
    else if (t.startsWith('--method=')) method = t.slice(9);
    else if (/^-X./.test(t)) method = t.slice(2);
    else if (/^-[fF]/.test(t) || ['--field', '--raw-field', '--input'].includes(t) || /^--(field|raw-field|input)=/.test(t)) field = true;
    else if (t === 'graphql') graphql = true;
  }
  const m = method ? method.toUpperCase() : null;
  if (m === 'DELETE') return R('deny', 'gh api DELETE');
  if (m && m !== 'GET' && m !== 'HEAD') return R('ask', `gh api ${m}`);
  if (!m && (field || graphql)) return R('ask', 'gh api con campos (POST implícito)');
  return R('allow', 'gh api GET');
}

function hGh(a) {
  const VAL = new Set(['-R', '--repo', '--hostname']);
  const pos = [];
  const flags = [];
  for (let i = 0; i < a.args.length; i++) {
    const t = a.args[i].text;
    if (isFlag(a.args[i])) { flags.push(t); if (VAL.has(t)) i++; continue; }
    pos.push(a.args[i]);
  }
  const P = texts(pos);
  const [g, s] = P;
  if (!g) return flags.includes('--version') ? R('allow', 'gh --version') : R('none', 'gh');
  if (g === 'api') return hGhApi(a.args);
  if (g === 'search') return R('allow', 'gh search');
  if (g === 'auth') return s === 'token' ? R('deny', 'gh auth token') : R('none', 'gh auth');
  if (s === 'delete' || s === 'archive') return R('deny', `gh ${g} ${s}`);
  if (g === 'pr' && (s === 'create' || s === 'merge')) return R('deny', `gh pr ${s}`);
  const groups = ['pr', 'issue', 'repo', 'run', 'release', 'workflow', 'gist', 'label', 'secret', 'variable', 'project', 'ruleset', 'cache', 'codespace'];
  if (groups.includes(g)) {
    if (['view', 'list', 'diff', 'checks', 'status'].includes(s)) return R('allow', `gh ${g} ${s}`);
    return R('ask', `gh ${g} ${s || ''}`.trim());
  }
  return R('none', `gh ${g}`);
}

// -- curl --
const CURL_VAL = 'AbcdDeEFHKmoPrTuwxXyYzCQ';
// Igual que con las largas: lista blanca. Una opción corta fuera de ella (proxy, config, netrc) deja el comando fuera de allow.
const CURL_SHORT_VAL = 'AbeEHmruwXyYzCdFToDc';
const CURL_SHORT_FLAG = 'sSfLivkgGN46012#';
// Opciones largas sin efecto sobre ficheros ni procesos; cualquier otra (--config, --trace, --stderr, --libcurl…)
// puede escribir un fichero o cambiar lo que curl hace, y deja el comando fuera de allow.
const CURL_LONG_FLAG = new Set(['--silent', '--show-error', '--fail', '--fail-with-body', '--location', '--location-trusted', '--include',
  '--verbose', '--insecure', '--compressed', '--globoff', '--no-progress-meter', '--progress-bar', '--http1.0', '--http1.1', '--http2',
  '--ipv4', '--ipv6', '--no-buffer', '--get', '--fail-early', '--no-keepalive', '--path-as-is', '--raw', '--tcp-nodelay']);
const CURL_LONG_VAL = new Set(['--header', '--user', '--user-agent', '--referer', '--cookie', '--max-time', '--connect-timeout', '--retry',
  '--retry-delay', '--retry-max-time', '--max-redirs', '--range', '--limit-rate', '--cacert', '--cert', '--key']);
const isLocalUrl = (u) => {
  if (u.includes('\\')) return false;
  let s = u.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//, '').split(/[/?#]/)[0];
  if (s.includes('@')) s = s.slice(s.lastIndexOf('@') + 1);
  const host = (s.startsWith('[') ? s.slice(1, Math.max(1, s.indexOf(']'))) : s.split(':')[0]).toLowerCase();
  return host === 'localhost' || host.endsWith('.localhost') || /^127(\.\d{1,3}){3}$/.test(host) || host === '::1' || host === '0.0.0.0' || host === 'host.docker.internal';
};

function hCurl(a) {
  const args = a.args;
  let method = null;
  let data = false;
  let writes = false;
  const urls = [];
  const out = (v) => { if (v !== '/dev/null') writes = true; };
  for (let i = 0; i < args.length; i++) {
    const w = args[i];
    const t = w.text;
    if (t.startsWith('--')) {
      const eq = t.indexOf('=');
      const name = eq < 0 ? t : t.slice(0, eq);
      const val = () => (eq >= 0 ? t.slice(eq + 1) : (args[++i] || { text: '' }).text);
      if (name === '--request') method = val();
      else if (name === '--head') method = 'HEAD';
      else if (/^--(data|data-raw|data-binary|data-urlencode|data-ascii|json|form|form-string|upload-file)$/.test(name)) { data = true; val(); }
      else if (name === '--output' || name === '--dump-header' || name === '--cookie-jar') out(val());
      else if (name === '--remote-name' || name === '--remote-name-all') writes = true;
      else if (name === '--url') urls.push({ text: val(), dyn: w.dyn });
      else if (name === '--write-out') { if (/%output|%\{stderr\}/.test(val())) writes = true; } // %output{fichero} escribe a disco
      else if (CURL_LONG_VAL.has(name)) val();
      else if (!CURL_LONG_FLAG.has(name)) writes = true;
      continue;
    }
    if (isFlag(w)) {
      for (let k = 1; k < t.length; k++) {
        const ch = t[k];
        if (CURL_VAL.includes(ch)) {
          const v = t.slice(k + 1) || (args[++i] || { text: '' }).text;
          if (ch === 'X') method = v;
          else if (ch === 'd' || ch === 'F' || ch === 'T') data = true;
          else if (ch === 'o' || ch === 'D' || ch === 'c') out(v);
          else if (ch === 'w' && /%output|%\{stderr\}/.test(v)) writes = true;
          else if (!CURL_SHORT_VAL.includes(ch)) writes = true; // -x proxy, -K config, -P, -Q…
          break;
        }
        if (ch === 'I') method = 'HEAD';
        else if (!CURL_SHORT_FLAG.includes(ch)) writes = true; // -O, -J, -n (netrc), -p (túnel)…
      }
      continue;
    }
    urls.push(w);
  }
  const m = method ? method.toUpperCase() : null;
  if (m === 'DELETE') return R('deny', 'curl -X DELETE');
  if (data || (m && !['GET', 'HEAD', 'OPTIONS'].includes(m))) return R('ask', 'curl que modifica (POST/PUT/PATCH/datos)');
  if (writes) return R('none', 'curl escribe a fichero o usa una opción fuera de la lista blanca');
  if (!urls.length || urls.some((u) => u.dyn)) return R('none', 'curl con URL no literal');
  return urls.every((u) => isLocalUrl(u.text)) ? R('allow', 'curl GET/HEAD a localhost') : R('none', 'curl a host remoto');
}

// -- rsync --
function hRsync(a) {
  const t = texts(a.args);
  // -e/--rsh y --rsync-path ejecutan un programa incluso con --dry-run; --write-batch/--log-file escriben ficheros
  let bad = false;
  for (let i = 0; i < t.length; i++) {
    const x = t[i];
    if (/^--(rsync-path|write-batch|only-write-batch|log-file|daemon|config|remote-option|early-input|copy-as|compare-dest|copy-dest|link-dest|partial-dir|temp-dir|backup-dir)/.test(x) || /^-[A-Za-z]*M/.test(x)) bad = true;
    else if (abbr(x, '--rsh', 4)) { if ((x.includes('=') ? x.slice(x.indexOf('=') + 1) : t[++i]) !== 'ssh') bad = true; }
    else if (/^-[A-Za-z]*e/.test(x)) { if ((/e$/.test(x) ? t[++i] : x.replace(/^-[A-Za-z]*e/, '')) !== 'ssh') bad = true; } // -e ssh es lo habitual; otro programa ejecuta código
  }
  if (bad) return R('none', 'rsync con opción que ejecuta un programa o escribe un fichero');
  if (t.includes('--dry-run') || clusterHas(t, 'n')) return R('allow', 'rsync --dry-run');
  if (t.some((x) => /^--(delete|del$|remove-source-files)/.test(x))) return R('deny', 'rsync --delete sin dry-run');
  const pos = [];
  for (let i = 0; i < a.args.length; i++) {
    const x = t[i];
    if (['-e', '--rsh', '-f', '--filter', '--exclude', '--include', '--exclude-from', '--include-from'].includes(x)) { i++; continue; }
    if (!x.startsWith('-')) pos.push(x);
  }
  const dest = pos.length >= 2 ? pos[pos.length - 1] : '';
  return /^[^/]*:/.test(dest) || dest.startsWith('rsync://') ? R('ask', 'rsync a destino remoto') : R('none', 'rsync');
}

// -- shells, eval, xargs --
function hShell(a) {
  const args = a.args;
  // `-c` solo cuenta entre las opciones iniciales: tras el primer operando o `--` es un argumento del script.
  let ci = -1;
  for (let k = 0; k < args.length; k++) {
    const t = args[k].text;
    if (t === '--' || t === '-' || !/^[-+]/.test(t)) break;
    if (/^-[A-Za-z]*c[A-Za-z]*$/.test(t)) { ci = k; break; }
    if (/^[-+][A-Za-z]*[oO]$/.test(t) || t === '--rcfile' || t === '--init-file') k++;
  }
  if (ci >= 0) {
    const lit = args[ci + 1];
    if (!lit) return a.st.inExec ? R('ask', 'shell sin comando') : R('none', 'shell -c sin comando');
    const r = classifyString(lit.text, { ...a.st }, a.depth + 1);
    // --rcfile/--init-file o -i (interactivo) ejecutan ficheros de arranque
    const risky = args.some((w) => /^--(rcfile|init-file)/.test(w.text) || /^-[A-Za-z]*i/.test(w.text));
    return lit.dyn || risky ? capNone(r, 'sh -c con expansión o fichero de arranque') : r;
  }
  if (a.st.inExec) return R('ask', 'shell interactivo o script en exec');
  if (a.seg.pipedIn) return R('ask', 'shell que ejecuta lo recibido por tubería');
  return R('none', 'shell sin -c');
}

function hXargs(a) {
  const VAL = new Set(['-n', '-I', '-P', '-d', '-E', '-L', '-s', '-a', '--max-args', '--max-procs', '--delimiter']);
  let i = 0;
  while (i < a.args.length && isFlag(a.args[i])) i += VAL.has(a.args[i].text) ? 2 : 1;
  const inner = a.args.slice(i);
  if (!inner.length) return R('none', 'xargs');
  // Los argumentos los pone stdin: se añade una ruta sin resolver para que rm -r nunca baje de deny.
  const r = classifyCommand([...inner, { text: '$XARGS', quoted: false, dyn: true, glob: false }], a.st, a.seg, null, a.depth + 1);
  return capNone(r, 'xargs');
}

function hEval(a) {
  const r = classifyString(a.args.map((w) => w.text).join(' '), { ...a.st }, a.depth + 1);
  return capNone(r, 'eval');
}

function hCd(a) {
  const args = a.args.filter((w) => !isFlag(w));
  let dest = null;
  if (args.length === 0) dest = a.st.ctx.home || null;
  else if (args.length === 1 && args[0].text !== '-' && !args[0].glob) {
    const abs = resolveAbs(args[0].text, a.st.ctx, a.st.cwd);
    dest = abs === null ? null : normalize(abs);
  }
  a.st.cwd = a.seg.depth > 0 ? null : dest; // dentro de ( … ) no se sabe dónde acaba
  return R('allow', 'cd');
}

// ───────────────────────── Comando y segmentos ─────────────────────────

// Variables que cambian qué programa o configuración carga un comando: con ellas delante nunca es allow.
const DANGEROUS_VARS = new Set(['PATH', 'ENV', 'HOME', 'IFS', 'CDPATH', 'SHELLOPTS', 'PS4', 'PROMPT_COMMAND', 'PAGER', 'EDITOR', 'VISUAL',
  'NODE_OPTIONS', 'NODE_PATH', 'PHPRC', 'MYSQL_HOME', 'RSYNC_RSH', 'CURL_HOME', 'DOCKER_HOST', 'DOCKER_CONFIG', 'GH_PATH']);
const DANGEROUS_VAR_RE = /^(LD_|DYLD_|BASH|PHP_INI|PYTHON|PERL|RUBY|XDG_|WP_CLI_|GIT_(DIR|WORK_TREE|COMMON_DIR|INDEX|OBJECT|ALTERNATE|CONFIG|SSH|ASKPASS|EXTERNAL|PAGER|EDITOR|SEQUENCE|EXEC|PROXY|TEMPLATE|ALLOW|PROTOCOL))/;
const dangerousVar = (n) => DANGEROUS_VARS.has(n) || DANGEROUS_VAR_RE.test(n);
const ASSIGN_RE = /^([A-Za-z_][A-Za-z0-9_]*)\+?=/;
const GLUE = new Set(['pwd', 'true', 'false', ':', 'echo', 'printf', 'test', '[', '[[', 'exit']);
const KW_SKIP = new Set(['!', 'if', 'then', 'else', 'elif', 'do', 'while', 'until', '{']);
const GLUE_KW = new Set(['for', 'select', 'case', 'done', 'fi', 'esac', '}', 'in']);

// Quita VAR=…, export, env, timeout, time, nice, nohup, setsid, stdbuf, ionice, chrt, taskset, command, builtin y exec. `sudo` corta con deny.
function stripPrefix(words) {
  const out = { argv: words, cap: false, deny: false, read: false };
  let i = 0;
  const cap = (name) => { if (dangerousVar(name)) out.cap = true; };
  for (;;) {
    const w = words[i];
    if (!w) break;
    const t = w.text;
    const m = ASSIGN_RE.exec(t);
    if (m) { cap(m[1]); i++; continue; }
    if (t === 'sudo' || t === 'doas') { out.deny = true; break; }
    if (t === 'export' || t === 'readonly') {
      for (const x of words.slice(i + 1)) { const mm = ASSIGN_RE.exec(x.text); if (mm) cap(mm[1]); }
      i = words.length; break;
    }
    if (t === 'env') {
      i++;
      for (;;) {
        const x = words[i];
        if (!x) break;
        const xt = x.text;
        if (ASSIGN_RE.test(xt)) break;
        if (xt === '-S' || xt === '--split-string') { out.cap = true; i++; continue; }
        if (xt === '-u' || xt === '--unset' || xt === '-C' || xt === '--chdir') { i += 2; continue; }
        if (xt.startsWith('-')) { i++; continue; }
        break;
      }
      if (i >= words.length) out.cap = true; // `env` solo imprime el entorno
      continue;
    }
    if (t === 'timeout') {
      i++;
      while (words[i] && words[i].text.startsWith('-')) i += ['-k', '-s', '--kill-after', '--signal'].includes(words[i].text) ? 2 : 1;
      i++; // duración
      continue;
    }
    if (t === 'time') { i++; while (words[i] && words[i].text === '-p') i++; continue; }
    if (t === 'nohup') { i++; continue; }
    if (t === 'setsid' || t === 'stdbuf' || t === 'ionice' || t === 'chrt' || t === 'taskset') {
      // Si una opción con valor no se reconoce, el valor se toma por nombre de comando y el resultado es `none`, nunca allow.
      const sep = t === 'stdbuf' ? ['-i', '-o', '-e'] : t === 'ionice' ? ['-c', '-n'] : [];
      i++;
      while (words[i] && words[i].text.startsWith('-')) i += sep.includes(words[i].text) ? 2 : 1;
      if (t === 'chrt' || t === 'taskset') i++; // prioridad o máscara
      continue;
    }
    if (t === 'command' || t === 'builtin' || t === 'exec') {
      i++;
      if (t === 'command') {
        const f = words[i] && words[i].text;
        if (f && /^-[pvV]+$/.test(f) && /[vV]/.test(f)) { out.read = true; i = words.length; break; } // command -v/-V solo consulta
        while (words[i] && words[i].text === '-p') i++;
      } else if (t === 'exec') {
        while (words[i] && /^-[cl]+$/.test(words[i].text)) i++;
        if (words[i] && words[i].text === '-a') i += 2;
      }
      if (words[i] && words[i].text === '--') i++;
      continue;
    }
    if (t === 'nice') {
      i++;
      if (words[i] && words[i].text === '-n') i += 2; else if (words[i] && /^-\d+$/.test(words[i].text)) i++;
      continue;
    }
    break;
  }
  out.argv = words.slice(i);
  return out;
}

function dispatch(name, a, viaPath) {
  const pre = hReader(a, name);
  if (pre) return pre; // lectores, sed, y cualquier ENV_CMDS que lea .env*.local
  if (GLUE.has(name)) return R('allow', `${name} (pegamento)`);
  switch (name) {
    case 'cd': return hCd(a);
    case 'pushd': case 'popd': a.st.cwd = null; return R('none', name);
    case 'find': return hFind(a);
    case 'rm': case 'rmdir': case 'unlink': return hRm(a, name === 'rm' ? 'rm' : name);
    case 'shred': case 'truncate': return hShred(a, name);
    case 'dd': return hDd(a);
    case 'git': return hGit(a);
    case 'docker': return hDocker(a, false);
    case 'docker-compose': return hDocker(a, true);
    case 'mysql': case 'mariadb': return hMysql(a);
    case 'mysqldump': case 'mariadb-dump': return R('ask', 'volcado de base de datos');
    case 'mysqladmin': case 'mariadb-admin': return hMysqladmin(a);
    case 'wp': return hWp(a);
    case 'symfony':
      if (a.args[0] && a.args[0].text === 'console') return hConsole(a, a.args.slice(1));
      if (a.args[0] && a.args[0].text === 'php') return hPhp({ ...a, args: a.args.slice(1) });
      return R('none', 'symfony');
    case 'console': return viaPath ? hConsole(a, a.args) : R('none', 'console');
    case 'composer': case 'composer.phar': return hComposer(a, a.args);
    case 'npm': case 'pnpm': case 'yarn': case 'bun': return hNode(a, name);
    case 'gh': return hGh(a);
    case 'curl': return hCurl(a);
    case 'rsync': return hRsync(a);
    case 'sh': case 'bash': case 'zsh': case 'dash': case 'ash': return hShell(a);
    case 'eval': return hEval(a);
    case 'xargs': return hXargs(a);
    default:
      if (PHP_RE.test(name)) return hPhp(a);
      return R('none', `comando no reconocido (${name})`);
  }
}

function classifyCommand(words, st, seg, prev, depth) {
  const pre = stripPrefix(words);
  if (pre.deny) return R('deny', 'sudo');
  const argv = pre.argv;
  let r;
  if (!argv.length) r = R('allow', pre.read ? 'command -v' : 'asignación sin comando');
  else {
    const cmd = argv[0];
    let name = cmd.text;
    let abs = false;
    let viaPath = false;
    if (cmd.dyn) r = R('none', 'comando dinámico');
    else {
      if (name.startsWith('/')) { abs = true; name = base(name); }
      else if (name.includes('/')) {
        const rel = name.replace(/^(\.\/)+/, '');
        if (/^(vendor\/bin|node_modules\/\.bin|bin)\/[^/]+$/.test(rel)) { name = base(rel); viaPath = true; } else name = null;
      }
      r = name === null ? R('none', 'ejecutable por ruta') : dispatch(name, { argv, args: argv.slice(1), st, seg, prev, depth }, viaPath);
      if (st.inExec && !abs && r.decision === 'none' && devTool(argv)) r = R('allow', 'herramienta de desarrollo en contenedor');
      if (abs) r = capNone(r, 'binario por ruta absoluta');
    }
  }
  return pre.cap ? capNone(r, 'variable de entorno peligrosa') : r;
}

const NULL_TARGETS = new Set(['/dev/null', '/dev/stderr', '/dev/stdout']);
const isFileWrite = (rd) => rd.kind === 'out' && !(NULL_TARGETS.has(rd.target.text) && !rd.target.dyn);

function classifySegment(seg, prev, st, depth) {
  let sub = null;
  for (const inner of seg.subs) {
    const r = classifyString(inner, { ...st }, depth + 1);
    sub = sub ? worse(sub, r) : r;
  }
  let words = seg.words;
  let k = 0;
  for (;;) {
    const w = words[k];
    if (!w || w.quoted) break;
    if (KW_SKIP.has(w.text)) { k++; continue; }
    if (w.text === 'function') { k += 2; continue; }
    break;
  }
  words = words.slice(k);
  let r;
  if (!words.length) r = R('allow', 'sin comando');
  else if (GLUE_KW.has(words[0].text) && !words[0].quoted) r = R('allow', 'control de flujo');
  else r = classifyCommand(words, st, seg, prev, depth);
  if (seg.subs.length || seg.unsure) r = capNone(r, seg.unsure ? 'sintaxis no analizable' : 'sustitución de comandos');
  if (seg.redirs.some(isFileWrite)) r = capNone(r, 'redirección a fichero');
  return sub ? worse(r, sub) : r;
}

function classifyString(src, st, depth) {
  if (depth > MAX_DEPTH) return R('ask', 'anidamiento excesivo');
  if (src.length > MAX_LEN) return R('ask', 'comando demasiado largo');
  const segs = lex(src);
  if (!segs.length) return R('none', 'comando vacío');
  const cur = { ...st };
  let acc = null;
  let prev = null;
  for (const seg of segs) {
    const r = classifySegment(seg, prev, cur, depth);
    acc = acc ? worse(acc, r) : r;
    prev = seg;
  }
  return acc;
}

function normCtx(ctx) {
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  const s = (v) => (typeof v === 'string' && v ? v : '');
  const cwd = s(c.cwd) ? normalize(c.cwd) : null;
  const projectDir = s(c.projectDir) ? normalize(c.projectDir) : cwd;
  const tmpdir = s(c.tmpdir) ? normalize(c.tmpdir) : '/tmp';
  const home = s(c.home) ? normalize(c.home) : '';
  // `/` o el home como raíz de repo harían que casi cualquier ruta contara como del proyecto.
  return {
    cwd, projectDir, tmpdir, home,
    repoRoots: [...new Set([projectDir, cwd].filter((r) => r && r !== '/' && r !== home))],
    tmpRoots: [...new Set([tmpdir, '/tmp'])],
  };
}

export function classify(command, ctx) {
  try {
    const c = normCtx(ctx);
    const text = typeof command === 'string' ? command : command == null ? '' : String(command);
    return classifyString(text, { ctx: c, cwd: c.cwd, inExec: false, soft: false }, 0);
  } catch (e) {
    return R('ask', `error interno del gate: ${e && e.message ? e.message : e}`);
  }
}
