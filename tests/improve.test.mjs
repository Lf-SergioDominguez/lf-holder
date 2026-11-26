import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evalsByVersion, noSignal, findRegressions, render, readReports, telemetryByVersion, withTelemetry, NO_SIGNAL } from '../scripts/improve.mjs';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/improve.mjs');
const line = (ts, plugin, ablation, cases) => ({ ts, plugin, claudeVersion: '2', ablation, cases, costUsd: 1 });
const history = [
  line('2026-01-01', '1.0.4', 'none', { a: { score: 1, costUsd: 0.1 }, b: { score: 1, costUsd: 0.1 } }),
  line('2026-01-02', '1.0.5', 'none', { a: { score: 0.7, costUsd: 0.1 }, b: { score: 1, costUsd: 0.2 } }),
  line('2026-01-03', '1.0.5', 'with-without', { b: { score: 1, costUsd: 0.2, scoreWithout: 1, delta: 0 }, a: { score: 0.7, costUsd: 0.1, scoreWithout: 0.2, delta: 0.5 } }),
  line('2026-01-04', '1.0.5', 'none', { a: { score: 0.7, costUsd: 0.1 } }),
];

test('evalsByVersion: orden semver, delta de with-without mezclado con none', () => {
  const vs = evalsByVersion([...history].reverse());
  assert.deepEqual(vs.map((v) => v.version), ['1.0.4', '1.0.5']);
  assert.equal(vs[0].evals.cases.a.delta, null);
  assert.equal(vs[1].evals.cases.a.delta, 0.5);
  assert.equal(vs[1].evals.cases.b.delta, 0);
  assert.equal(vs[1].evals.lastTs, '2026-01-04');
});

test('semver numérico (1.0.9 < 1.0.10) y coste: media de líneas none, sin with-without', () => {
  const vs = evalsByVersion([
    line('2026-02-03', '1.0.10', 'none', { a: { score: 1, costUsd: 0.1 } }),
    line('2026-02-01', '1.0.9', 'none', { a: { score: 1, costUsd: 0.1 } }),
    line('2026-02-02', '1.0.9', 'none', { a: { score: 1, costUsd: 0.3 } }),
    line('2026-02-02', '1.0.9', 'with-without', { a: { score: 1, costUsd: 0.9, delta: 0 } }),
  ]);
  assert.deepEqual(vs.map((v) => v.version), ['1.0.9', '1.0.10']);
  assert.equal(vs[0].evals.cases.a.costUsd, 0.2);
  assert.equal(vs[0].evals.costUsd, 0.2);
  assert.deepEqual(findRegressions(vs), []);
});

test('regresión de score y caso sin señal', () => {
  const vs = evalsByVersion(history);
  const reg = findRegressions(vs);
  assert.deepEqual(reg.map((r) => r.metric), ['score a', 'costUsd b']);
  assert.deepEqual(noSignal(vs), [{ version: '1.0.5', case: 'b', delta: 0 }]);
  assert.equal(NO_SIGNAL, 0.05);
});

test('render sin rutas absolutas y una sola versión', () => {
  const vs = evalsByVersion(history.slice(0, 1));
  const out = render({ sources: { reports: 0 }, versions: vs, noSignal: [], regressions: [] }, 'dir');
  assert.match(out, /una sola versión: sin comparación/);
  assert.match(out, /sin datos de telemetría \(0 informes en dir\)/);
  assert.doesNotMatch(out, /\/(root|home|tmp)\//);
});

test('CLI: metrics inexistente avisa y sale 0; argumento inválido sale 1', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'improve-'));
  const summary = path.join(tmp, 's.jsonl');
  fs.writeFileSync(summary, history.map((h) => JSON.stringify(h)).join('\n') + '\n');
  const r = spawnSync('node', [script, '--summary', summary, '--metrics', path.join(tmp, 'no-existe')], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /sin datos de telemetría/);
  assert.ok(!r.stdout.includes(tmp));
  const j = spawnSync('node', [script, '--summary', summary, '--metrics', tmp, '--json'], { encoding: 'utf8' });
  assert.equal(JSON.parse(j.stdout).schema, 1);
  assert.equal(spawnSync('node', [script, '--nope'], { encoding: 'utf8' }).status, 1);
  fs.rmSync(tmp, { recursive: true });
});

const rep = (v, o = {}) => ({
  schema: 1, plugin_version: v, variant: 'private', profile: 'default', frequency: 'weekly',
  period: { from: '2026-01-01T00:00:00Z', to: '2026-01-08T00:00:00Z' },
  sessions: 10, requests: 100, turns: 50,
  tokens: { input: 1, output: 1, cache_read: 1, cache_write: 1, per_request: 1000 },
  first_turn_context_tokens: 20000, autocompact_sessions_pct: 10,
  permissions: { ask: 10, deny: 1 }, hook_errors: 0, ...o,
});
const put = (dir, project, version, run, value) => {
  const d = path.join(dir, project, version, run);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'report.json'), typeof value === 'string' ? value : JSON.stringify(value));
};

test('readReports: válido, inválido y sessions 0 van a skipped, filtro por proyecto, dir inexistente', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'improve-rep-'));
  put(tmp, 'p1', '1.0.5', 'a-1', rep('1.0.5'));
  put(tmp, 'p1', '1.0.5', 'b-2', { ...rep('1.0.5'), extra: 1 });
  put(tmp, 'p1', '1.0.5', 'c-3', rep('1.0.5', { sessions: 0 }));
  put(tmp, 'p1', '1.0.5', 'd-4', '{no json');
  put(tmp, 'p2', '1.0.5', 'e-5', rep('1.0.5'));
  fs.mkdirSync(path.join(tmp, 'p1', '1.0.5', 'vacia'), { recursive: true });
  const all = readReports(tmp);
  assert.equal(all.reports.length, 2);
  assert.equal(all.skipped, 3);
  assert.equal(readReports(tmp, 'p2').reports.length, 1);
  assert.deepEqual(readReports(path.join(tmp, 'no-existe')), { reports: [], skipped: 0 });
  fs.rmSync(tmp, { recursive: true });
});

test('telemetryByVersion pondera y normaliza; regresiones de telemetría', () => {
  const tel = telemetryByVersion([
    rep('1.0.5'),
    rep('1.0.5', { sessions: 30, requests: 300, tokens: { input: 1, output: 1, cache_read: 1, cache_write: 1, per_request: 2000 }, permissions: { ask: 30, deny: 0 }, first_turn_context_tokens: 40000, autocompact_sessions_pct: 30 }),
    rep('1.0.6', { tokens: { input: 1, output: 1, cache_read: 1, cache_write: 1, per_request: 3000 }, autocompact_sessions_pct: 40, hook_errors: 5 }),
  ]);
  const t = tel.get('1.0.5');
  assert.equal(t.reports, 2);
  assert.equal(t.sessions, 40);
  assert.equal(t.tokensPerRequest, 1750);
  assert.equal(t.askPer100Sessions, 100);
  assert.equal(t.firstTurnContextTokens, 35000); // ponderado por sesiones (10×20000 + 30×40000)/40
  assert.equal(t.autocompactSessionsPct, 25);
  const vs = withTelemetry(evalsByVersion(history.slice(0, 1)), tel);
  assert.deepEqual(vs.map((v) => v.version), ['1.0.4', '1.0.5', '1.0.6']);
  assert.equal(vs[0].telemetry, null);
  assert.equal(vs[1].evals, null);
  assert.deepEqual(findRegressions(vs).map((r) => r.metric), ['tokensPerRequest', 'hookErrorsPer100Sessions', 'denyPer100Sessions', 'autocompactSessionsPct']);
  assert.match(render({ sources: { reports: 3, skipped: 0 }, versions: vs, noSignal: [], regressions: [] }), /\| 2 \| 40 \| 1750 \|/);
});

test('CLI: telemetría en --json y --project sin coincidencias', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'improve-cli-'));
  put(tmp, 'p1', '1.0.5', 'a-1', rep('1.0.5'));
  put(tmp, 'p1', '1.0.5', 'b-2', '{no json');
  const none = path.join(tmp, 's.jsonl');
  fs.writeFileSync(none, '');
  const j = JSON.parse(spawnSync('node', [script, '--summary', none, '--metrics', tmp, '--json'], { encoding: 'utf8' }).stdout);
  assert.deepEqual([j.sources.reports, j.sources.skipped], [1, 1]);
  assert.equal(j.versions[0].telemetry.sessions, 10);
  const o = spawnSync('node', [script, '--summary', none, '--metrics', tmp, '--project', 'otro'], { encoding: 'utf8' });
  assert.equal(o.status, 0);
  assert.match(o.stdout, /sin datos de telemetría \(0 informes en /);
  fs.rmSync(tmp, { recursive: true });
});
