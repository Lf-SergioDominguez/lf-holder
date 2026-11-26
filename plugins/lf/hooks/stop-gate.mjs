#!/usr/bin/env node
// stop-gate.mjs — quality gates locales (H3): hook Stop + carga del bloque `gates` y casado de globs.
//
//   node stop-gate.mjs                                 hook Stop (JSON por stdin; perfil de <config>/lf/config.json)
//   node stop-gate.mjs --check <perfil.md> <ruta>...   imprime "<ruta>\tcode|test|ignored|none" por ruta
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const GATE_KEYS = ['code', 'test', 'ignore', 'commands', 'checks'];

// Sin librería YAML: el bloque solo usa mapas por sangría, listas en línea ["a", "b"] y escalares entre comillas.
export function loadGates(profileMd) {
  const m = /^```yaml gates\r?\n([\s\S]*?)^```/m.exec(profileMd);
  if (!m) return null;
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    const kv = /^([\w-]+):\s*(.*)$/.exec(line.trim());
    if (!kv) throw new Error(`gates: línea no reconocida: "${line.trim()}" (solo mapas por sangría, listas en línea ["a"] y escalares)`);
    while (stack.at(-1).indent >= indent) stack.pop();
    const parent = stack.at(-1).obj;
    const [, key, raw] = kv;
    const depth = stack.length - 1; // 0: raíz, 1: dentro de `gates`
    if (depth === 0 && key !== 'gates') throw new Error(`gates: clave desconocida "${key}" (solo "gates")`);
    if (depth === 1 && !GATE_KEYS.includes(key)) throw new Error(`gates: clave desconocida "${key}" (válidas: ${GATE_KEYS.join(', ')})`);
    if (raw === '') { parent[key] = {}; stack.push({ indent, obj: parent[key] }); }
    else if (raw === '{}') parent[key] = {};
    else if (raw.startsWith('[')) parent[key] = [...raw.matchAll(/"([^"]*)"/g)].map((x) => x[1]);
    else parent[key] = raw.replace(/^"(.*)"$/, '$1');
  }
  const g = root.gates;
  if (!g || typeof g !== 'object') throw new Error('gates: falta la clave "gates"');
  for (const k of ['code', 'test', 'ignore']) {
    g[k] ??= [];
    if (!Array.isArray(g[k])) throw new Error(`gates.${k} debe ser una lista en línea ["a", "b"]`);
  }
  g.commands ??= {};
  if (typeof g.commands !== 'object' || Array.isArray(g.commands)) throw new Error('gates.commands debe ser un mapa');
  if (g.checks !== undefined) validateChecks(g.checks);
  return g;
}

const CHECK_STACKS = ['symfony', 'wordpress', 'node'];
const CHECK_STRINGS = ['gate', 'stack', 'blocks', 'fix', 'github'];
const CHECK_LISTS = ['files', 'composer', 'npm', 'ci'];
const CHECK_GITHUB = ['secret-scanning', 'ruleset-main'];

// Checklist de /lf:quality-gates (H7): el hook Stop no la usa, pero `loadGates` falla si está mal formada.
function validateChecks(checks) {
  if (typeof checks !== 'object' || Array.isArray(checks)) throw new Error('gates.checks debe ser un mapa');
  for (const [id, c] of Object.entries(checks)) {
    const at = `gates.checks.${id}`;
    if (typeof c !== 'object' || Array.isArray(c)) throw new Error(`${at} debe ser un mapa`);
    for (const k of Object.keys(c)) {
      if (![...CHECK_STRINGS, ...CHECK_LISTS].includes(k)) throw new Error(`${at}: clave desconocida "${k}" (válidas: ${[...CHECK_STRINGS, ...CHECK_LISTS].join(', ')})`);
    }
    for (const k of ['gate', 'stack', 'fix']) {
      if (typeof c[k] !== 'string' || !c[k]) throw new Error(`${at}: falta "${k}"`);
    }
    for (const k of ['blocks', 'github']) {
      if (c[k] !== undefined && typeof c[k] !== 'string') throw new Error(`${at}.${k} debe ser un escalar`);
    }
    for (const k of CHECK_LISTS) {
      if (c[k] !== undefined && !Array.isArray(c[k])) throw new Error(`${at}.${k} debe ser una lista en línea ["a", "b"]`);
    }
    if (!CHECK_STACKS.includes(c.stack)) throw new Error(`${at}: stack "${c.stack}" no válido (${CHECK_STACKS.join('|')})`);
    if (c.github !== undefined && !CHECK_GITHUB.includes(c.github)) throw new Error(`${at}: github "${c.github}" no válido (${CHECK_GITHUB.join('|')})`);
    if (!CHECK_LISTS.some((k) => c[k]?.length) && !c.github) throw new Error(`${at}: necesita al menos un detector (${[...CHECK_LISTS, 'github'].join(', ')})`);
  }
}

// Soportado: `*` (no cruza `/`), `**`, `**/` y `{a,b}`. NO soportado: `?` ni `[]` (se toman como literales).
export function globToRegExp(glob) {
  let re = '';
  let inBrace = false;
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (glob.startsWith('**/', i)) { re += '(?:.*/)?'; i += 2; }
    else if (glob.startsWith('**', i)) { re += '.*'; i += 1; }
    else if (c === '*') re += '[^/]*';
    else if (c === '{') { re += '(?:'; inBrace = true; }
    else if (c === '}') { re += ')'; inBrace = false; }
    else if (c === ',' && inBrace) re += '|';
    else re += c.replace(/[.+?^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export const matchesAny = (globs, file) => (globs ?? []).some((g) => globToRegExp(g).test(file));

// Un test cuenta como test aunque caiga en `ignore`; `ignore` solo descarta código.
export function classify(gates, file) {
  if (!gates || !gates.code?.length) return 'none';
  if (matchesAny(gates.test, file)) return 'test';
  if (matchesAny(gates.ignore, file)) return 'ignored';
  return matchesAny(gates.code, file) ? 'code' : 'none';
}

// Rutas de `git status --porcelain -uall -z`: entradas "XY ruta\0"; renombrados/copias añaden "origen\0".
// Los borrados no cuentan: quitar código no pide un test.
export function parsePorcelain(out) {
  const parts = out.split('\0');
  const files = [];
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    if (e.length < 4) continue;
    const xy = e.slice(0, 2);
    if (/[RC]/.test(xy)) i++;
    if (!xy.includes('D')) files.push(e.slice(3));
  }
  return files;
}

const SAFE_NAME = /^[\w-]+$/;
const BLOCK_LIMIT = 5;

// Decide sobre una lista de ficheros cambiados: devuelve el motivo del bloqueo o null.
export function decide(gates, files) {
  if (!gates?.code?.length) return null;
  const kinds = files.map((f) => [f, classify(gates, f)]);
  if (kinds.some(([, k]) => k === 'test')) return null;
  const code = kinds.filter(([, k]) => k === 'code').map(([f]) => f);
  if (!code.length) return null;
  const shown = code.slice(0, BLOCK_LIMIT).map((f) => `- ${f}`).join('\n');
  const more = code.length > BLOCK_LIMIT ? `\n- … y ${code.length - BLOCK_LIMIT} más` : '';
  return `Has cambiado código sin tocar ningún test:\n${shown}${more}\n` +
    'Escribe el test que lo cubra o da una justificación de una línea de por qué no hace falta (refactor, config…). Este aviso no se repite en la sesión.';
}

// Hook Stop. Nunca rompe la sesión: ante cualquier error, exit 0 y log en <config>/lf-metrics/stop-gate.log.
function runHook() {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const log = (msg) => {
    try {
      const dir = path.join(configDir, 'lf-metrics');
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(path.join(dir, 'stop-gate.log'), `${new Date().toISOString()} ${msg}\n`);
    } catch { /* el log es opcional */ }
  };
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
    if (input.stop_hook_active === true) return;
    const sid = String(input.session_id ?? '');
    if (!SAFE_NAME.test(sid)) return; // sin id válido no se puede garantizar «una vez»
    const marker = path.join(process.env.TMPDIR || os.tmpdir(), `lf-stop-gate-${sid}`);
    if (fs.existsSync(marker)) return;

    let cfg = {};
    try { cfg = JSON.parse(fs.readFileSync(path.join(configDir, 'lf', 'config.json'), 'utf8')); } catch { /* sin config → generic */ }
    const profile = typeof cfg.profile === 'string' && SAFE_NAME.test(cfg.profile) ? cfg.profile : 'generic';
    let md;
    try { md = fs.readFileSync(path.join(configDir, 'lf', 'profiles', `${profile}.md`), 'utf8'); } catch { return; }
    const gates = loadGates(md);
    if (!gates?.code.length) return;

    let out;
    try {
      out = execFileSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', 'status', '--porcelain', '-uall', '-z'], { cwd: input.cwd || process.cwd(), encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch { return; } // sin git o fuera de repo
    const reason = decide(gates, parsePorcelain(out));
    if (!reason) return;
    fs.writeFileSync(marker, '', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  } catch (e) {
    log(`error: ${e.message}`);
  }
}

const realArgv1 = (() => { try { return fs.realpathSync(process.argv[1]); } catch { return process.argv[1] ?? ''; } })();
if (import.meta.url === pathToFileURL(realArgv1).href) {
  const [flag, profile, ...files] = process.argv.slice(2);
  if (flag === undefined) runHook();
  else {
    if (flag !== '--check' || !profile) { console.error('uso: stop-gate.mjs [--check <perfil.md> <ruta>...]'); process.exit(2); }
    let gates;
    try { gates = loadGates(fs.readFileSync(profile, 'utf8')); }
    catch (e) { console.error(`stop-gate: ${profile}: ${e.message}`); process.exit(1); }
    for (const f of files) console.log(`${f}\t${classify(gates, f)}`);
  }
}
