#!/usr/bin/env node
// dream-digest.mjs — resumen SIN tokens de las sesiones posteriores a la última consolidación.
// /lf:dream lo ejecuta primero para que el modelo nunca lea JSONL en crudo.
//
//   node dream-digest.mjs [--cwd <dir>] [--config <dir>] [--out <fichero>]   escribe el digest y imprime JSON con las rutas
//   node dream-digest.mjs --mark [--at <ISO>] [--cwd <dir>] [--config <dir>]  guarda la consolidación (memory/.dream-state.json); --at = `generatedAt` del digest
//
// Proyecto → ~/.claude/projects/<cwd con todo lo no alfanumérico a «-»>/ ; memoria → <proyecto>/memory/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_SESSIONS = 20;
const MAX_REQUESTS = 12;
const MAX_FILES = 25;
const MAX_DENIALS = 8;

const NOISE = /^(<command-|<local-command|<system-reminder|This session is being continued|\[Request interrupted)/;
const CORRECTION = /^(no[\s,.!]|eso no|otra vez|te dije|mejor |en vez de|pero |corrige|incorrecto|mal[\s,.]|wrong|don't|do not|stop\b|that's not)/i;
const INTERRUPT = /\[Request interrupted by user/;

// Credenciales pegadas en un prompt no deben acabar en una nota que se inyecta en todas las sesiones.
const SECRET = /\b(?:sk|ghp|gho|github_pat|xox[bp]|AKIA)[-_A-Za-z0-9]{12,}|\b(?:password|passwd|token|secret|api[_-]?key)\s*[=:]\s*\S+|Bearer\s+\S+/gi;

const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').replace(SECRET, '[REDACTADO]').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

export function projectDir(cwd, configDir) {
  return path.join(configDir, 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'));
}

export function readState(memoryDir) {
  try { return JSON.parse(fs.readFileSync(path.join(memoryDir, '.dream-state.json'), 'utf8')); }
  catch { return {}; }
}

const userTexts = (m) => {
  const c = m?.content;
  if (typeof c === 'string') return [c];
  if (!Array.isArray(c)) return [];
  return c.filter((b) => b?.type === 'text').map((b) => b.text);
};

export function summarizeSession(file, cwd, sinceMs) {
  const s = { id: path.basename(file, '.jsonl').slice(0, 8), start: null, end: null,
    requests: [], corrections: [], interrupts: 0, denials: [], files: new Set(), closing: '' };
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    const ts = Date.parse(e.timestamp);
    if (!Number.isNaN(ts)) {
      if (ts <= sinceMs) continue;
      s.start ??= e.timestamp; s.end = e.timestamp;
    }
    if (e.isSidechain) continue;
    if (e.type === 'user' && !e.isMeta) {
      if (e.permissionDecision?.decision === 'reject') {
        const r = e.message?.content?.[0]?.content ?? e.toolUseResult;
        s.denials.push(clip(typeof r === 'string' ? r : JSON.stringify(r), 160));
      }
      for (const t of userTexts(e.message)) {
        if (INTERRUPT.test(t)) { s.interrupts++; continue; }
        if (NOISE.test(t.trim())) continue;
        const text = clip(t, 200);
        s.requests.push(text);
        if (CORRECTION.test(text)) s.corrections.push(text);
      }
    } else if (e.type === 'assistant') {
      for (const b of e.message?.content ?? []) {
        if (b?.type === 'tool_use' && ['Edit', 'Write', 'NotebookEdit'].includes(b.name)) {
          const p = b.input?.file_path ?? b.input?.notebook_path;
          if (p) s.files.add(path.isAbsolute(p) ? path.relative(cwd, p) || p : p);
        } else if (b?.type === 'text' && b.text?.trim()) s.closing = clip(b.text, 300);
      }
    }
  }
  return s;
}

export function digest({ cwd, configDir, now = new Date() }) {
  const proj = projectDir(cwd, configDir);
  const memoryDir = path.join(proj, 'memory');
  const last = readState(memoryDir).lastRun;
  const sinceMs = last ? Date.parse(last) : 0;
  const files = fs.existsSync(proj)
    ? fs.readdirSync(proj).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(proj, f))
      .filter((f) => fs.statSync(f).mtimeMs > sinceMs)
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    : [];
  const sessions = files.slice(0, MAX_SESSIONS).map((f) => summarizeSession(f, cwd, sinceMs))
    .filter((s) => s.requests.length || s.files.size).sort((a, b) => String(a.start).localeCompare(String(b.start)));

  const out = [`# Digest de sesiones — ${path.basename(cwd)}`,
    `Desde: ${last ?? 'nunca consolidado'} · generado ${now.toISOString()} · ${sessions.length} sesión(es) con actividad`
      + (files.length > MAX_SESSIONS ? ` (de ${files.length}; solo las ${MAX_SESSIONS} más recientes)` : ''), ''];
  for (const s of sessions) {
    out.push(`## Sesión ${s.id} (${s.start} → ${s.end})`);
    out.push('Peticiones:', ...s.requests.slice(0, MAX_REQUESTS).map((r) => `- ${r}`));
    if (s.requests.length > MAX_REQUESTS) out.push(`- … y ${s.requests.length - MAX_REQUESTS} más`);
    if (s.corrections.length || s.interrupts) {
      out.push(`Correcciones e interrupciones (${s.interrupts} interrupción(es)):`, ...s.corrections.slice(0, 6).map((r) => `- ${r}`));
    }
    if (s.denials.length) out.push('Permisos denegados:', ...s.denials.slice(0, MAX_DENIALS).map((d) => `- ${d}`));
    if (s.files.size) out.push(`Ficheros editados: ${[...s.files].slice(0, MAX_FILES).join(', ')}${s.files.size > MAX_FILES ? ` … (+${s.files.size - MAX_FILES})` : ''}`);
    if (s.closing) out.push(`Cierre: ${s.closing}`);
    out.push('');
  }
  return { text: out.join('\n'), sessions: sessions.length, generatedAt: now.toISOString().replace(/\.\d+Z$/, 'Z'), memoryDir, projectDir: proj };
}

function main() {
  const a = process.argv.slice(2);
  const opt = (n) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined; };
  const cwd = path.resolve(opt('--cwd') ?? process.cwd());
  const configDir = opt('--config') ?? process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude');
  const memoryDir = path.join(projectDir(cwd, configDir), 'memory');
  if (a.includes('--mark')) {
    fs.mkdirSync(memoryDir, { recursive: true });
    // El instante del digest, no el de ahora: lo escrito entre ambos por otra sesión se consolidará la próxima vez.
    const lastRun = opt('--at') ?? new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    if (Number.isNaN(Date.parse(lastRun))) { console.error('--at no es una fecha ISO'); process.exit(1); }
    fs.writeFileSync(path.join(memoryDir, '.dream-state.json'), `${JSON.stringify({ lastRun })}\n`);
    console.log(JSON.stringify({ marked: lastRun, memoryDir }));
    return;
  }
  const r = digest({ cwd, configDir });
  const outFile = opt('--out') ?? path.join(process.env.TMPDIR || os.tmpdir(), 'lf-dream-digest.md');
  fs.writeFileSync(outFile, r.text);
  console.log(JSON.stringify({ digest: outFile, sessions: r.sessions, memoryDir: r.memoryDir, generatedAt: r.generatedAt }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
