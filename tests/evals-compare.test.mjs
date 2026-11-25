// Comparador de evals (H4): resumen, referencia, regresión de score y aviso de coste. Sin gastar tokens.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { summarize, compare, readHistory } from '../scripts/evals-compare.mjs';

const SCRIPT = path.resolve('scripts/evals-compare.mjs');
const kase = (name, score, cost, extra = {}) => ({
  name, dir: '/ruta/secreta', promptMarkdown: 'PROMPT SECRETO',
  aggregates: { score, passRate: score, ...extra },
  arms: { with: [{ costUsd: cost, judgeCostUsd: 0 }] },
});
const result = (cases, over = {}) => ({
  startedAt: '2026-11-25T10:00:00Z', claudeVersion: '2.9.9', costUsd: cases.reduce((s, c) => s + c.arms.with[0].costUsd, 0), partial: false,
  suite: { ablation: 'none', plugins: [{ name: 'lf', version: '1.0.4', path: '/ruta/secreta' }] }, cases, ...over,
});

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'lf-evals-')); }
function run(dir, res, ...flags) {
  const f = path.join(dir, `r${fs.readdirSync(dir).length}.json`);
  fs.writeFileSync(f, JSON.stringify(res));
  const p = spawnSync('node', [SCRIPT, '--summary', path.join(dir, 'summary.jsonl'), ...flags, f], { encoding: 'utf8' });
  return { code: p.status, out: p.stdout + p.stderr };
}

test('summarize: score y coste por caso, sin rutas ni prompts', () => {
  const e = summarize([result([kase('06-a', 1, 0.1), kase('07-b', 0.5, 0.2)])]);
  assert.deepEqual(Object.keys(e.cases), ['06-a', '07-b']);
  assert.equal(e.cases['07-b'].score, 0.5);
  assert.equal(e.costUsd, 0.3);
  assert.equal(e.plugin, '1.0.4');
  assert.ok(!JSON.stringify(e).includes('secret'));
});

test('summarize: une varias ejecuciones y recoge la ablación', () => {
  const e = summarize([result([kase('06-a', 1, 0.1, { scoreWithout: 0.6, delta: 0.4 })]), result([kase('07-b', 1, 0.2)])]);
  assert.equal(e.costUsd, 0.3);
  assert.equal(e.cases['06-a'].delta, 0.4);
});

test('compare: sin histórico es «sin referencia» y no hay regresión', () => {
  const c = compare(summarize([result([kase('06-a', 0, 0.1)])]), []);
  assert.deepEqual(c.regressions, []);
  assert.match(c.notes[0], /sin referencia/);
});

test('compare: igual → sin regresión; bajada de 0,10 exacto no cuenta; mayor de 0,10 sí', () => {
  const prev = summarize([result([kase('06-a', 1, 0.1)])]);
  assert.deepEqual(compare(summarize([result([kase('06-a', 1, 0.1)])]), [prev]).regressions, []);
  assert.deepEqual(compare(summarize([result([kase('06-a', 0.9, 0.1)])]), [prev]).regressions, []);
  assert.equal(compare(summarize([result([kase('06-a', 0.85, 0.1)])]), [prev]).regressions.length, 1);
});

test('compare: caso nuevo en 0 es regresión; caso nuevo > 0 no', () => {
  const prev = summarize([result([kase('06-a', 1, 0.1)])]);
  assert.equal(compare(summarize([result([kase('07-b', 0, 0.1)])]), [prev]).regressions.length, 1);
  assert.deepEqual(compare(summarize([result([kase('07-b', 0.5, 0.1)])]), [prev]).regressions, []);
});

test('compare: la referencia de un caso es su última línea, aunque sea de otra selección', () => {
  const h = [summarize([result([kase('06-a', 1, 0.1), kase('07-b', 1, 0.1)])]), summarize([result([kase('07-b', 0.5, 0.1)])])];
  assert.deepEqual(compare(summarize([result([kase('07-b', 0.5, 0.1)])]), h).regressions, []);
  assert.equal(compare(summarize([result([kase('07-b', 0.2, 0.1)])]), h).regressions.length, 1);
});

test('compare: coste +30 % solo avisa (misma selección)', () => {
  const prev = summarize([result([kase('06-a', 1, 0.10)])]);
  const c = compare(summarize([result([kase('06-a', 1, 0.14)])]), [prev]);
  assert.deepEqual(c.regressions, []);
  assert.equal(c.warnings.length, 1);
  assert.deepEqual(compare(summarize([result([kase('06-a', 1, 0.12)])]), [prev]).warnings, []);
});

test('CLI: primera ejecución exit 0 y registra; igual exit 0; regresión exit 1 y NO registra (la referencia no baja)', () => {
  const d = tmp();
  assert.equal(run(d, result([kase('06-a', 1, 0.1)])).code, 0);
  assert.equal(run(d, result([kase('06-a', 1, 0.1)])).code, 0);
  const bad = run(d, result([kase('06-a', 0.5, 0.1)]));
  assert.equal(bad.code, 1);
  assert.match(bad.out, /REGRESIÓN/);
  assert.equal(run(d, result([kase('06-a', 0.5, 0.1)])).code, 1, 'un segundo run igual de malo sigue fallando');
  assert.equal(readHistory(path.join(d, 'summary.jsonl')).length, 2);
  fs.rmSync(d, { recursive: true });
});

test('CLI: un caso con runs en error se excluye, no registra ni da regresión falsa y sale con 2', () => {
  const d = tmp();
  assert.equal(run(d, result([kase('06-a', 1, 0.1)])).code, 0);
  const broken = kase('06-a', 0, 0);
  broken.arms.with[0].error = 'Not logged in';
  const r = run(d, result([broken, kase('07-b', 1, 0.1)]));
  assert.equal(r.code, 2);
  assert.match(r.out, /excluidos: 06-a/);
  assert.doesNotMatch(r.out, /REGRESIÓN/);
  const h = readHistory(path.join(d, 'summary.jsonl'));
  assert.equal(h.length, 2);
  assert.deepEqual(Object.keys(h[1].cases), ['07-b']);
  fs.rmSync(d, { recursive: true });
});

test('compare: with-without no se compara en coste con una selección sin ablación', () => {
  const prev = summarize([result([kase('06-a', 1, 0.10)])]);
  const cur = summarize([result([kase('06-a', 1, 0.20)], { suite: { ablation: 'with-without', plugins: [] } })]);
  assert.deepEqual(compare(cur, [prev]).warnings, []);
});

test('CLI: --no-record no escribe; run parcial no registra y sale con 2', () => {
  const d = tmp();
  assert.equal(run(d, result([kase('06-a', 1, 0.1)]), '--no-record').code, 0);
  assert.equal(fs.existsSync(path.join(d, 'summary.jsonl')), false);
  const p = run(d, result([kase('06-a', 1, 0.1)], { partial: true }));
  assert.equal(p.code, 2);
  assert.equal(fs.existsSync(path.join(d, 'summary.jsonl')), false);
  fs.rmSync(d, { recursive: true });
});

test('CLI: sin ficheros o JSON ilegible → exit 1', () => {
  const d = tmp();
  assert.equal(spawnSync('node', [SCRIPT], { encoding: 'utf8' }).status, 1);
  assert.equal(spawnSync('node', [SCRIPT, '--summary'], { encoding: 'utf8' }).status, 1);
  const f = path.join(d, 'x.json'); fs.writeFileSync(f, 'no json');
  assert.equal(spawnSync('node', [SCRIPT, '--summary', path.join(d, 's.jsonl'), f], { encoding: 'utf8' }).status, 1);
  fs.rmSync(d, { recursive: true });
});
