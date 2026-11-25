#!/usr/bin/env node
// evals-compare.mjs — resume uno o varios aggregate-result.json de `claude plugin eval`,
// añade una línea a results/summary.jsonl y la compara con la referencia anterior.
//
// Uso: node scripts/evals-compare.mjs [--summary RUTA] [--no-record] aggregate-result.json...
//   --summary    histórico (por defecto plugins/lf/evals/results/summary.jsonl, ignorado por git)
//   --no-record  compara sin añadir la línea
//
// Regresión (exit 1): el score de un caso baja más de 0,10 respecto a su última línea
// registrada, o un caso sin registro previo (con histórico ya creado) puntúa 0.
// Coste total > +30 % sobre la última línea de la misma selección: solo avisa.
// Sin histórico → «sin referencia», exit 0. Solo se registra un run completo y sin regresión.
// Run parcial (tope de coste) o caso con runs en error (se omite del resumen): exit 2 si no hay regresión.
// El resumen no guarda rutas ni prompts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCORE_DROP = 0.1;
export const COST_RISE = 0.3;

const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

// Une los resultados (uno por caso o por selección) en una sola entrada de resumen.
// Un caso con algún run con `error` (auth, infraestructura) no mide el plugin: se excluye.
export const erroredCases = (results) => results.flatMap((r) => (r.cases ?? []).filter((c) => Object.values(c.arms ?? {}).flat().some((run) => run?.error)).map((c) => c.name));

export function summarize(results) {
  const cases = {};
  let costUsd = 0;
  const bad = new Set(erroredCases(results));
  for (const r of results) {
    costUsd += r.costUsd ?? 0;
    for (const c of r.cases ?? []) {
      if (bad.has(c.name)) continue;
      const a = c.aggregates ?? {};
      cases[c.name] = { score: round(a.score ?? 0), costUsd: round((c.arms?.with ?? []).reduce((s, run) => s + (run.costUsd ?? 0) + (run.judgeCostUsd ?? 0), 0), 6) };
      if (typeof a.scoreWithout === 'number') { cases[c.name].scoreWithout = round(a.scoreWithout); cases[c.name].delta = round(a.delta ?? a.score - a.scoreWithout); }
    }
  }
  const first = results[0] ?? {};
  return {
    ts: first.startedAt ?? new Date().toISOString(),
    plugin: first.suite?.plugins?.[0]?.version ?? null,
    claudeVersion: first.claudeVersion ?? null,
    ablation: first.suite?.ablation ?? null,
    cases,
    costUsd: round(costUsd, 6),
  };
}

// La ablación entra en la clave: with-without cuesta ~2x y no es comparable con un run sin ella.
const selectionKey = (entry) => `${entry.ablation ?? ''}|${Object.keys(entry.cases).sort().join(',')}`;

// history: líneas previas (de más antigua a más reciente). Devuelve { regressions, warnings, notes }.
export function compare(entry, history) {
  const out = { regressions: [], warnings: [], notes: [] };
  if (history.length === 0) { out.notes.push('sin referencia: esta línea queda como primera'); return out; }
  for (const [name, cur] of Object.entries(entry.cases)) {
    const prev = [...history].reverse().find((h) => h.cases?.[name])?.cases[name];
    if (!prev) {
      if (cur.score === 0) out.regressions.push(`${name}: caso nuevo con score 0`);
      else out.notes.push(`${name}: caso nuevo (${cur.score.toFixed(2)}), sin referencia`);
      continue;
    }
    const drop = round(prev.score - cur.score);
    if (drop > SCORE_DROP) out.regressions.push(`${name}: score ${prev.score.toFixed(2)} → ${cur.score.toFixed(2)} (−${drop.toFixed(2)})`);
    else out.notes.push(`${name}: ${prev.score.toFixed(2)} → ${cur.score.toFixed(2)}`);
  }
  const prevSame = [...history].reverse().find((h) => selectionKey(h) === selectionKey(entry));
  if (prevSame && prevSame.costUsd > 0) {
    const rise = entry.costUsd / prevSame.costUsd - 1;
    if (rise > COST_RISE) out.warnings.push(`coste total ${prevSame.costUsd.toFixed(2)} → ${entry.costUsd.toFixed(2)} USD (+${Math.round(rise * 100)} %)`);
  }
  return out;
}

export function readHistory(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
}

function main(argv) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  let summary = path.join(root, 'plugins/lf/evals/results/summary.jsonl');
  let record = true;
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--summary') { if (!argv[i + 1]) { console.error('--summary necesita una ruta'); return 1; } summary = argv[++i]; }
    else if (argv[i] === '--no-record') record = false;
    else if (argv[i] === '-h' || argv[i] === '--help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 15).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); return 0; }
    else files.push(argv[i]);
  }
  if (files.length === 0) { console.error('falta aggregate-result.json (ver --help)'); return 1; }
  const results = [];
  for (const f of files) {
    try { results.push(JSON.parse(fs.readFileSync(f, 'utf8'))); } catch (e) { console.error(`no se puede leer ${f}: ${e.message}`); return 1; }
  }
  const errored = erroredCases(results);
  const entry = summarize(results);
  if (errored.length > 0) console.error(`AVISO casos con runs en error (auth o infraestructura), excluidos: ${errored.join(', ')}`);
  if (Object.keys(entry.cases).length === 0) { console.error(errored.length > 0 ? 'ningún caso válido' : 'los resultados no contienen casos'); return errored.length > 0 ? 2 : 1; }
  const res = compare(entry, readHistory(summary));
  const partial = results.some((r) => r.partial);
  // Un run parcial o con regresión no se registra: no puede convertirse en la nueva referencia.
  if (partial) console.error('AVISO run parcial (tope de coste o abortado): no se registra y la comparación no es fiable');
  else if (res.regressions.length > 0) console.error('AVISO con regresión: no se registra (la referencia no baja)');
  else if (record) { fs.mkdirSync(path.dirname(summary), { recursive: true }); fs.appendFileSync(summary, JSON.stringify(entry) + '\n'); }
  for (const n of res.notes) console.log(`  ${n}`);
  for (const w of res.warnings) console.log(`AVISO ${w}`);
  for (const r of res.regressions) console.log(`REGRESIÓN ${r}`);
  console.log(`coste ${entry.costUsd.toFixed(2)} USD · plugin ${entry.plugin ?? '?'} · claude ${entry.claudeVersion ?? '?'}`);
  if (res.regressions.length > 0) return 1;
  return partial || errored.length > 0 ? 2 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) process.exit(main(process.argv.slice(2)));
