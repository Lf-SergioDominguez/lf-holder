// dream-digest.test.mjs — pruebas de scripts/dream-digest.mjs (node --test tests/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { digest, projectDir, readState } from '../plugins/lf/scripts/dream-digest.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(here, '../plugins/lf/scripts/dream-digest.mjs');
const CWD = '/work/mi proyecto';

const ev = (type, ts, extra) => JSON.stringify({ type, timestamp: ts, isSidechain: false, ...extra });
const user = (ts, content, extra = {}) => ev('user', ts, { message: { role: 'user', content }, ...extra });
const asst = (ts, content) => ev('assistant', ts, { message: { role: 'assistant', content } });

function fixture() {
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'dream-'));
  const proj = projectDir(CWD, config);
  fs.mkdirSync(proj, { recursive: true });
  const lines = [
    '{"type":"mode","mode":"normal"}',
    'esto no es json',
    user('2026-11-10T10:00:00Z', 'Añade el endpoint de pagos'),
    user('2026-11-10T10:00:01Z', '<command-name>/clear</command-name>'),
    user('2026-11-10T10:00:02Z', 'caveat', { isMeta: true }),
    asst('2026-11-10T10:01:00Z', [
      { type: 'tool_use', name: 'Edit', input: { file_path: `${CWD}/src/Pay.php` } },
      { type: 'tool_use', name: 'Write', input: { file_path: `${CWD}/tests/PayTest.php` } },
      { type: 'text', text: 'Hecho el endpoint.' },
    ]),
    user('2026-11-10T10:02:00Z', [{ type: 'text', text: 'No, usa el servicio existente' }]),
    user('2026-11-10T10:02:30Z', [{ type: 'text', text: '[Request interrupted by user]' }]),
    user('2026-11-10T10:03:00Z', [{ type: 'tool_result', content: 'rechazado por lf-gate: rm -rf' }],
      { permissionDecision: { decision: 'reject' } }),
    asst('2026-11-10T10:04:00Z', [{ type: 'text', text: 'Cierre final de la sesión.' }]),
    asst('2026-11-10T10:05:00Z', [{ type: 'tool_use', name: 'Edit', input: { file_path: '/otro/side.php' } }]).replace('"isSidechain":false', '"isSidechain":true'),
  ];
  fs.writeFileSync(path.join(proj, 'aaaaaaaa-1111.jsonl'), `${lines.join('\n')}\n`);
  return { config, proj };
}

test('extrae peticiones, correcciones, interrupciones, denegaciones, ficheros y cierre', () => {
  const { config } = fixture();
  const r = digest({ cwd: CWD, configDir: config, now: new Date('2026-11-17T00:00:00Z') });
  assert.equal(r.sessions, 1);
  assert.match(r.text, /Añade el endpoint de pagos/);
  assert.match(r.text, /No, usa el servicio existente/);
  assert.match(r.text, /1 interrupción/);
  assert.match(r.text, /rechazado por lf-gate/);
  assert.match(r.text, /src\/Pay\.php, tests\/PayTest\.php/);
  assert.match(r.text, /Cierre: Cierre final de la sesión\./);
  assert.doesNotMatch(r.text, /command-name|caveat|side\.php/);
});

test('solo cuenta lo posterior a la última consolidación', () => {
  const { config, proj } = fixture();
  fs.mkdirSync(path.join(proj, 'memory'));
  fs.writeFileSync(path.join(proj, 'memory', '.dream-state.json'), '{"lastRun":"2026-11-11T00:00:00Z"}');
  assert.equal(readState(path.join(proj, 'memory')).lastRun, '2026-11-11T00:00:00Z');
  assert.equal(digest({ cwd: CWD, configDir: config }).sessions, 0);
});

test('proyecto sin transcripts: 0 sesiones y no lanza', () => {
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'dream-'));
  assert.equal(digest({ cwd: CWD, configDir: config }).sessions, 0);
});

test('CLI: escribe el digest y --mark guarda lastRun', () => {
  const { config, proj } = fixture();
  const out = path.join(config, 'digest.md');
  const j = JSON.parse(execFileSync('node', [SCRIPT, '--cwd', CWD, '--config', config, '--out', out], { encoding: 'utf8' }));
  assert.equal(j.sessions, 1);
  assert.match(fs.readFileSync(out, 'utf8'), /# Digest de sesiones — mi proyecto/);
  assert.match(j.generatedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  execFileSync('node', [SCRIPT, '--mark', '--at', j.generatedAt, '--cwd', CWD, '--config', config]);
  assert.equal(readState(path.join(proj, 'memory')).lastRun, j.generatedAt);
  execFileSync('node', [SCRIPT, '--mark', '--cwd', CWD, '--config', config]);
  assert.match(readState(path.join(proj, 'memory')).lastRun, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
});

test('--mark con cwd dentro de la memoria del proyecto no crea otro proyecto', () => {
  const { config, proj } = fixture();
  const memoryDir = path.join(proj, 'memory');
  fs.mkdirSync(memoryDir);
  assert.equal(projectDir(memoryDir, config), proj);
  execFileSync('node', [SCRIPT, '--mark', '--at', '2026-11-20T00:00:00Z', '--config', config], { cwd: memoryDir });
  assert.equal(readState(memoryDir).lastRun, '2026-11-20T00:00:00Z');
  assert.deepEqual(fs.readdirSync(path.join(config, 'projects')), [path.basename(proj)]);
});

test('enmascara credenciales pegadas en un prompt', () => {
  const { config, proj } = fixture();
  fs.appendFileSync(path.join(proj, 'aaaaaaaa-1111.jsonl'),
    `${user('2026-11-10T11:00:00Z', 'usa token=abc123SECRET y ghp_abcdefghijklmnop1234 con Bearer eyJhbGciOi')}\n`);
  const t = digest({ cwd: CWD, configDir: config }).text;
  assert.match(t, /\[REDACTADO\]/);
  assert.doesNotMatch(t, /abc123SECRET|ghp_abcdefghijklmnop1234|eyJhbGciOi/);
});
