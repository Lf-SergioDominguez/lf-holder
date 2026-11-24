#!/usr/bin/env node
// telemetry.mjs — informe agregado y anónimo del uso del arnés (H2, ADR 0023).
//
//   node telemetry.mjs collect|preview [--config <dir>] [--now <ISO>]   imprime el informe (JSON) validado contra la lista blanca
//   node telemetry.mjs status          [--config <dir>] [--now <ISO>]   estado: activada, frecuencia, periodo, último envío
//   node telemetry.mjs send            [--config <dir>] [--now <ISO>] [--force]   abre la issue en METRICS_REPO con el informe validado
//   node telemetry.mjs off             [--config <dir>]                 desactiva la telemetría en config.json
//
// Lee ~/.claude/projects/*/*.jsonl y lf-metrics/permissions.tsv solo para CONTAR: nada de texto,
// rutas, nombres de proyecto ni identificadores de sesión llega al informe. Si el informe trae una
// clave fuera de telemetry-schema.json, aborta (exit 2) y no imprime nada por stdout.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400000;
export const PERIOD_DAYS = { weekly: 7, monthly: 30 };
export const METRICS_REPO = 'Lf-SergioDominguez/lf-holder-metrics';
export const SCHEMA = JSON.parse(fs.readFileSync(path.join(HERE, 'telemetry-schema.json'), 'utf8'));

const NOISE = /^(<command-|<local-command|<system-reminder|This session is being continued|\[Request interrupted)/;

// --- validación: subconjunto de JSON Schema ---------------------------------------------------
export function validate(value, schema = SCHEMA, at = '$') {
  const err = [];
  if ('const' in schema && value !== schema.const) err.push(`${at}: debe ser ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) err.push(`${at}: valor fuera de ${JSON.stringify(schema.enum)}`);
  if (schema.type === 'integer' && !Number.isInteger(value)) err.push(`${at}: debe ser entero`);
  if (schema.type === 'string' && typeof value !== 'string') err.push(`${at}: debe ser texto`);
  if (schema.type === 'object' && (value === null || typeof value !== 'object' || Array.isArray(value))) err.push(`${at}: debe ser objeto`);
  if (err.length) return err;
  if (typeof value === 'string' && schema.pattern && !new RegExp(schema.pattern).test(value)) err.push(`${at}: no casa con ${schema.pattern}`);
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) err.push(`${at}: menor que ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) err.push(`${at}: mayor que ${schema.maximum}`);
  }
  if (schema.type === 'object') {
    const props = schema.properties ?? {};
    for (const k of schema.required ?? []) if (!(k in value)) err.push(`${at}.${k}: falta`);
    for (const [k, v] of Object.entries(value)) {
      if (k in props) err.push(...validate(v, props[k], `${at}.${k}`));
      else if (schema.additionalProperties === false) err.push(`${at}.${k}: clave fuera de la lista blanca`);
    }
  }
  return err;
}

// --- utilidades -------------------------------------------------------------------------------
const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};
const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };
const lines = (f) => fs.readFileSync(f, 'utf8').split('\n');

export function paths(configDir) {
  return {
    config: path.join(configDir, 'lf', 'config.json'),
    state: path.join(configDir, 'lf', 'telemetry-state.json'),
    projects: path.join(configDir, 'projects'),
    permissions: path.join(configDir, 'lf-metrics', 'permissions.tsv'),
  };
}

export function readSettings(configDir) {
  const p = paths(configDir);
  const cfg = readJson(p.config, {});
  // 'month-ends' (1.1.0 previa) ya no existe: se lee como monthly
  const every = Object.hasOwn(PERIOD_DAYS, cfg.telemetryEvery) ? cfg.telemetryEvery : cfg.telemetryEvery === 'month-ends' ? 'monthly' : 'weekly';
  return { enabled: cfg.telemetry === true, every, profile: typeof cfg.profile === 'string' ? cfg.profile : 'generic', state: readJson(p.state, {}) };
}

// Periodo del informe: desde el último envío (o un periodo atrás) hasta ahora.
export function period(settings, now) {
  const last = Date.parse(settings.state.lastSent ?? '');
  const to = now.getTime();
  const from = Number.isNaN(last) ? to - PERIOD_DAYS[settings.every] * DAY : last;
  return { from: new Date(from), to: new Date(to) };
}

function pluginInfo() {
  const pj = readJson(path.join(HERE, '..', '.claude-plugin', 'plugin.json'), {});
  const profilesDir = path.join(HERE, '..', 'profiles');
  const shipped = fs.existsSync(profilesDir) ? fs.readdirSync(profilesDir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)) : [];
  return { version: pj.version ?? '0.0.0', variant: /public/i.test(pj.repository ?? '') ? 'public' : 'private', shipped };
}

const userPrompt = (e) => {
  const c = e.message?.content;
  const texts = typeof c === 'string' ? [c] : Array.isArray(c) ? c.filter((b) => b?.type === 'text').map((b) => b.text) : [];
  return texts.some((t) => t.trim() && !NOISE.test(t.trim()));
};

// --- colector ---------------------------------------------------------------------------------
export function collect({ configDir, now = new Date() }) {
  const p = paths(configDir);
  const settings = readSettings(configDir);
  const { from, to } = period(settings, now);
  const fromMs = from.getTime(), toMs = to.getTime();
  const info = pluginInfo();

  const tok = { input: 0, output: 0, cache_read: 0, cache_write: 0 };
  let sessions = 0, requests = 0, turns = 0, compacted = 0, deny = 0, hookErrors = 0;
  const firstCtx = [];

  const files = [];
  if (fs.existsSync(p.projects)) {
    for (const d of fs.readdirSync(p.projects)) {
      const dir = path.join(p.projects, d);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const f of fs.readdirSync(dir)) if (f.endsWith('.jsonl')) files.push(path.join(dir, f));
    }
  }
  for (const file of files) {
    if (fs.statSync(file).mtimeMs < fromMs) continue;
    const reqs = new Map(); // una petición a la API puede repetirse por bloque de contenido: gana la última
    let first = null, active = false, compact = false;
    for (const line of lines(file)) {
      if (!line) continue;
      let e; try { e = JSON.parse(line); } catch { continue; }
      const ts = Date.parse(e.timestamp);
      if (Number.isNaN(ts) || ts < fromMs || ts >= toMs) continue;
      if (e.type === 'assistant' && e.message?.usage) {
        const u = e.message.usage;
        reqs.set(e.requestId ?? e.uuid, u);
        if (!e.isSidechain) {
          active = true;
          first ??= (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
        }
      } else if (e.type === 'user' && !e.isMeta && !e.isSidechain) {
        if (e.permissionDecision?.decision === 'reject') deny++;
        if (userPrompt(e)) { requests++; active = true; }
      } else if (e.type === 'system' && e.subtype === 'compact_boundary') compact = true;
      else if (e.type === 'attachment' && ['hook_non_blocking_error', 'hook_blocking_error'].includes(e.attachment?.type)) hookErrors++;
    }
    for (const u of reqs.values()) {
      tok.input += u.input_tokens ?? 0; tok.output += u.output_tokens ?? 0;
      tok.cache_read += u.cache_read_input_tokens ?? 0; tok.cache_write += u.cache_creation_input_tokens ?? 0;
      turns++;
    }
    if (active) { sessions++; if (compact) compacted++; if (first !== null) firstCtx.push(first); }
  }

  let ask = 0;
  if (fs.existsSync(p.permissions)) {
    for (const row of lines(p.permissions)) {
      const ts = Date.parse(row.split('\t', 1)[0]);
      if (!Number.isNaN(ts) && ts >= fromMs && ts < toMs) ask++;
    }
  }

  const iso = (d) => d.toISOString();
  return {
    schema: 1,
    plugin_version: info.version,
    variant: info.variant,
    profile: info.shipped.includes(settings.profile) ? settings.profile : 'custom',
    frequency: settings.every,
    period: { from: iso(from), to: iso(to) },
    sessions, requests, turns,
    tokens: { ...tok, per_request: requests ? Math.round((tok.input + tok.output + tok.cache_read + tok.cache_write) / requests) : 0 },
    first_turn_context_tokens: median(firstCtx),
    autocompact_sessions_pct: sessions ? Math.round((compacted / sessions) * 100) : 0,
    permissions: { ask, deny },
    hook_errors: hookErrors,
  };
}

// Informe validado: lanza si trae algo fuera de la lista blanca.
export function report(opts) {
  const r = collect(opts);
  const errors = validate(r);
  if (errors.length) throw Object.assign(new Error(`informe fuera de la lista blanca:\n  ${errors.join('\n  ')}`), { code: 'WHITELIST' });
  return r;
}

export function status({ configDir, now = new Date() }) {
  const s = readSettings(configDir);
  const last = Date.parse(s.state.lastSent ?? '');
  return {
    enabled: s.enabled, frequency: s.every,
    lastSent: Number.isNaN(last) ? null : new Date(last).toISOString(),
    nextDue: Number.isNaN(last) ? null : new Date(last + PERIOD_DAYS[s.every] * DAY).toISOString(),
    periodFrom: period(s, now).from.toISOString(),
  };
}

// Envío: una issue en METRICS_REPO abierta con la cuenta de gh de quien envía. lastSent solo avanza si gh tuvo éxito.
export function send({ configDir, now = new Date(), force = false, gh = process.env.LF_TELEMETRY_GH || 'gh' }) {
  const s = readSettings(configDir);
  if (!s.enabled) throw Object.assign(new Error('telemetría desactivada; actívala con /lf:setup --telemetry=on'), { code: 'OFF' });
  const st = status({ configDir, now });
  if (!force && st.nextDue && Date.parse(st.nextDue) > now.getTime()) return { sent: false, reason: `no toca hasta ${st.nextDue}` };
  const r = report({ configDir, now });
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'lf-telemetry-'));
  const body = path.join(dir, 'report.md');
  fs.writeFileSync(body, '```json\n' + JSON.stringify(r, null, 2) + '\n```\n');
  try {
    const url = execFileSync(gh, ['issue', 'create', '--repo', METRICS_REPO, '--label', 'telemetry', '--title', `telemetry ${r.variant} ${r.plugin_version}`, '--body-file', body], { encoding: 'utf8' }).trim();
    const p = paths(configDir);
    fs.mkdirSync(path.dirname(p.state), { recursive: true });
    fs.writeFileSync(p.state, JSON.stringify({ ...s.state, lastSent: r.period.to }, null, 2) + '\n');
    return { sent: true, url, period: r.period };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

export function off({ configDir }) {
  const f = paths(configDir).config;
  const cfg = readJson(f, null);
  if (cfg === null) return { changed: false };
  fs.writeFileSync(f, JSON.stringify({ ...cfg, telemetry: false }, null, 2) + '\n');
  return { changed: cfg.telemetry === true };
}

// --- CLI --------------------------------------------------------------------------------------
function main(argv) {
  const [cmd, ...rest] = argv;
  const opt = (n) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };
  const configDir = opt('config') ?? process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude');
  const now = opt('now') ? new Date(opt('now')) : new Date();
  try {
    if (cmd === 'collect' || cmd === 'preview') console.log(JSON.stringify(report({ configDir, now }), null, 2));
    else if (cmd === 'status') console.log(JSON.stringify(status({ configDir, now }), null, 2));
    else if (cmd === 'send') console.log(JSON.stringify(send({ configDir, now, force: rest.includes('--force') }), null, 2));
    else if (cmd === 'off') console.log(JSON.stringify(off({ configDir }), null, 2));
    else { console.error('uso: telemetry.mjs collect|preview|status|send|off [--config <dir>]'); process.exit(1); }
  } catch (e) {
    console.error(e.message);
    process.exit(e.code === 'WHITELIST' ? 2 : 1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
