#!/usr/bin/env node
// improve.mjs — cruza evals y telemetría por versión del plugin y señala
// regresiones y casos sin señal. Solo datos: determinista, sin red, exit 0 aunque no haya datos.
//
// Uso: node scripts/improve.mjs [--summary RUTA] [--metrics DIR] [--project NOMBRE] [--json]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readHistory, SCORE_DROP, COST_RISE } from './evals-compare.mjs';
import { validate } from '../plugins/lf/scripts/telemetry.mjs';

export const NO_SIGNAL = 0.05;
export const AUTOCOMPACT_PP = 5;

const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const semver = (v) => String(v).split(/[.-]/).map((p) => parseInt(p, 10) || 0);
const cmpVersion = (a, b) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return (x[i] ?? 0) - (y[i] ?? 0); return 0; };

// Por versión y caso: score de la línea más reciente que lo contenga; costUsd = media de las líneas
// `none` (las with-without cuestan ~2x y no son comparables; solo si no hay ninguna `none`, las demás);
// delta de la línea with-without más reciente (null si no hay). Versiones en semver ascendente.
export function evalsByVersion(history) {
  const byVersion = new Map();
  const costs = new Map(); // `${version}\0${id}` → { none: [], other: [] }
  for (const line of [...history].filter((h) => h?.plugin && h.cases).sort((a, b) => String(a.ts).localeCompare(String(b.ts)))) {
    const v = byVersion.get(line.plugin) ?? { version: line.plugin, evals: { lastTs: null, costUsd: 0, cases: {} }, telemetry: null };
    byVersion.set(line.plugin, v);
    v.evals.lastTs = line.ts;
    for (const [id, c] of Object.entries(line.cases)) {
      const prev = v.evals.cases[id];
      v.evals.cases[id] = { score: c.score, costUsd: 0, delta: typeof c.delta === 'number' ? c.delta : (prev?.delta ?? null) };
      // delta solo de with-without: una línea `none` posterior no lo borra, y uno antiguo no se pisa con null
      const k = `${line.plugin}\0${id}`;
      const bucket = costs.get(k) ?? { none: [], other: [] };
      costs.set(k, bucket);
      if (typeof c.costUsd === 'number') bucket[line.ablation === 'none' ? 'none' : 'other'].push(c.costUsd);
    }
  }
  for (const v of byVersion.values()) {
    for (const [id, c] of Object.entries(v.evals.cases)) {
      const b = costs.get(`${v.version}\0${id}`);
      const xs = b.none.length ? b.none : b.other;
      c.costUsd = xs.length ? round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0;
    }
    v.evals.costUsd = round(Object.values(v.evals.cases).reduce((s, c) => s + c.costUsd, 0));
  }
  return [...byVersion.values()].sort((a, b) => cmpVersion(a.version, b.version));
}

// Informes `<metrics>/<proyecto>/<versión>/<ejecución>/report.json`. Descarta (skipped) los que no
// pasan validate() o tienen sessions = 0. `project` limita a un proyecto. Sin directorio: vacío.
export function readReports(dir, project) {
  const out = { reports: [], skipped: 0 };
  const subdirs = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name).sort(); } catch { return []; } };
  for (const p of subdirs(dir)) {
    if (project && p !== project) continue;
    for (const ver of subdirs(path.join(dir, p))) {
      for (const run of subdirs(path.join(dir, p, ver))) {
        let r;
        try { r = JSON.parse(fs.readFileSync(path.join(dir, p, ver, run, 'report.json'), 'utf8')); } catch (e) { if (e.code === 'ENOENT') continue; out.skipped++; continue; }
        if (validate(r).length || r.sessions === 0) out.skipped++; else out.reports.push(r);
      }
    }
  }
  return out;
}

// Por plugin_version (Map): sumas y medias ponderadas; ask/deny/hook_errors por 100 sesiones.
export function telemetryByVersion(reports) {
  const groups = new Map();
  for (const r of reports) groups.set(r.plugin_version, [...(groups.get(r.plugin_version) ?? []), r]);
  const sum = (rs, f) => rs.reduce((s, r) => s + f(r), 0);
  const out = new Map();
  for (const [version, rs] of groups) {
    const sessions = sum(rs, (r) => r.sessions), requests = sum(rs, (r) => r.requests);
    const bySessions = (f) => round(sum(rs, (r) => f(r) * r.sessions) / sessions, 2);
    const per100 = (f) => round(sum(rs, f) / sessions * 100, 2);
    out.set(version, {
      reports: rs.length, sessions, requests,
      tokensPerRequest: requests ? round(sum(rs, (r) => r.tokens.per_request * r.requests) / requests, 0) : 0,
      firstTurnContextTokens: round(bySessions((r) => r.first_turn_context_tokens), 0),
      autocompactSessionsPct: bySessions((r) => r.autocompact_sessions_pct),
      askPer100Sessions: per100((r) => r.permissions.ask),
      denyPer100Sessions: per100((r) => r.permissions.deny),
      hookErrorsPer100Sessions: per100((r) => r.hook_errors),
    });
  }
  return out;
}

// Une la telemetría (Map de telemetryByVersion) a las versiones de evals; crea las que solo tienen telemetría.
export function withTelemetry(versions, tel) {
  const byV = new Map(versions.map((v) => [v.version, v]));
  for (const [version, t] of tel) byV.set(version, { ...(byV.get(version) ?? { version, evals: null }), telemetry: t });
  return [...byV.values()].sort((a, b) => cmpVersion(a.version, b.version));
}

const TEL_RISE = ['tokensPerRequest', 'firstTurnContextTokens', 'hookErrorsPer100Sessions', 'denyPer100Sessions'];
const ZERO_BASE = ['hookErrorsPer100Sessions', 'denyPer100Sessions'];

export const noSignal = (versions) => versions.flatMap((v) => Object.entries(v.evals?.cases ?? {})
  .filter(([, c]) => c.delta !== null && Math.abs(c.delta) < NO_SIGNAL).map(([id, c]) => ({ version: v.version, case: id, delta: c.delta })));

// Entre versiones consecutivas con dato: score de caso baja > SCORE_DROP; coste de caso y métricas de
// telemetría (TEL_RISE) suben > COST_RISE; autocompactSessionsPct sube > AUTOCOMPACT_PP puntos.
export function findRegressions(versions) {
  const out = [];
  const withEvals = versions.filter((v) => v.evals);
  for (let i = 1; i < withEvals.length; i++) {
    const a = withEvals[i - 1], b = withEvals[i];
    for (const [id, cur] of Object.entries(b.evals.cases)) {
      const prev = a.evals.cases[id];
      if (!prev) continue;
      if (round(prev.score - cur.score) > SCORE_DROP) out.push({ from: a.version, to: b.version, metric: `score ${id}`, before: prev.score, after: cur.score });
      if (prev.costUsd > 0 && cur.costUsd / prev.costUsd - 1 > COST_RISE) out.push({ from: a.version, to: b.version, metric: `costUsd ${id}`, before: prev.costUsd, after: cur.costUsd });
    }
  }
  const withTel = versions.filter((v) => v.telemetry);
  for (let i = 1; i < withTel.length; i++) {
    const a = withTel[i - 1], b = withTel[i];
    for (const m of TEL_RISE) {
      const [x, y] = [a.telemetry[m], b.telemetry[m]];
      // base 0: cualquier subida cuenta (de 0 a N errores de hooks o denegaciones es regresión clara)
      if (x > 0 ? y / x - 1 > COST_RISE : y > 0 && ZERO_BASE.includes(m)) out.push({ from: a.version, to: b.version, metric: m, before: a.telemetry[m], after: b.telemetry[m] });
    }
    const [x, y] = [a.telemetry.autocompactSessionsPct, b.telemetry.autocompactSessionsPct];
    if (round(y - x, 2) > AUTOCOMPACT_PP) out.push({ from: a.version, to: b.version, metric: 'autocompactSessionsPct', before: x, after: y });
  }
  return out;
}

// metricsName: nombre (no ruta) del directorio de métricas, solo para el aviso.
export function render(data, metricsName = 'métricas') {
  const L = ['## Datos', ''];
  const f = (n) => (typeof n === 'number' ? n.toFixed(2) : '-');
  if (data.versions.length === 0) L.push('sin datos de evals', '');
  for (const v of data.versions) {
    L.push(`### Versión ${v.version}`, '');
    if (v.evals) {
      L.push('| Caso | Score | Coste USD | Δ |', '|---|---|---|---|');
      for (const [id, c] of Object.entries(v.evals.cases)) L.push(`| ${id} | ${f(c.score)} | ${(c.costUsd ?? 0).toFixed(3)} | ${c.delta === null ? '-' : f(c.delta)} |`);
      L.push('');
    }
    if (v.telemetry) {
      const t = v.telemetry;
      L.push('| Informes | Sesiones | Tokens/petición | Contexto 1.er turno | Autocompact % | ask/100 | deny/100 | hook err/100 |', '|---|---|---|---|---|---|---|---|');
      L.push(`| ${t.reports} | ${t.sessions} | ${t.tokensPerRequest} | ${t.firstTurnContextTokens} | ${t.autocompactSessionsPct} | ${t.askPer100Sessions} | ${t.denyPer100Sessions} | ${t.hookErrorsPer100Sessions} |`, '');
    }
  }
  if (data.versions.length === 1) L.push('una sola versión: sin comparación', '');
  if (data.versions.every((v) => !v.telemetry)) L.push(`sin datos de telemetría (${data.sources.reports} informes en ${metricsName}${data.sources.skipped ? `, ${data.sources.skipped} descartados` : ''})`, '');
  L.push('### Sin señal', '');
  L.push(...(data.noSignal.length ? data.noSignal.map((n) => `- ${n.version} ${n.case}: Δ ${f(n.delta)}`) : ['- ninguno']), '');
  L.push('### Regresiones', '');
  L.push(...(data.regressions.length ? data.regressions.map((r) => `- ${r.from} → ${r.to} ${r.metric}: ${r.before} → ${r.after}`) : ['- ninguna']), '');
  return L.join('\n');
}

function main(argv) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  let summary = path.join(root, 'plugins/lf/evals/results/summary.jsonl');
  let metrics = process.env.LF_METRICS_DIR || path.join(os.homedir(), 'proyectos/claude-harness-metrics');
  let project;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') json = true;
    else if (a === '--summary' || a === '--metrics' || a === '--project') {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) { console.error(`${a} necesita un valor`); return 1; }
      const val = argv[++i];
      if (a === '--summary') summary = val; else if (a === '--metrics') metrics = val; else project = val;
    } else { console.error(`argumento no válido: ${a}`); return 1; }
  }
  const history = readHistory(summary);
  const { reports, skipped } = readReports(metrics, project);
  const versions = withTelemetry(evalsByVersion(history), telemetryByVersion(reports));
  const data = {
    schema: 1,
    sources: { summaryLines: history.length, metricsFound: fs.existsSync(metrics), reports: reports.length, skipped },
    versions, noSignal: noSignal(versions), regressions: findRegressions(versions),
  };
  console.log(json ? JSON.stringify(data, null, 2) : render(data, path.basename(metrics)));
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) process.exit(main(process.argv.slice(2)));
