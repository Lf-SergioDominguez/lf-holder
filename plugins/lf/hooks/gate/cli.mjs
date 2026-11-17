// cli.mjs — entrada del hook PreToolUse(Bash) de bash-gate (plugin lf).
// Lee el JSON del hook por stdin y actúa según LF_GATE: on (por defecto, decide), shadow (solo registra), off.
// Siempre sale 0; en `on`, cualquier error interno se traduce en `ask`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classify } from './classify.mjs';

const mode = (process.env.LF_GATE || 'on').toLowerCase();

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

const clean = (s, max) => String(s ?? '').replace(/[\t\r\n]+/g, ' ').slice(0, max);
const ts = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

// Una fila por llamada; si no se puede escribir, se ignora (es solo telemetría).
function logRow(sessionId, decision, reason, command) {
  try {
    const dir = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'lf-metrics');
    fs.mkdirSync(dir, { recursive: true });
    const row = [ts(), clean(sessionId, 100), decision, clean(reason, 200), clean(command, 600)].join('\t') + '\n';
    fs.appendFileSync(path.join(dir, 'gate.tsv'), row);
  } catch { /* sin log */ }
}

function emit(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: `lf-gate: ${reason}`,
    },
  }) + '\n');
}

// Con `allow` y un prefijo `cd <cwd> &&` redundante (prueba T3: la exclusión del sandbox se calcula
// sobre updatedInput), se quita el prefijo para que docker/mysql/gh/git de red no se queden dentro.
// Solo si el resto es un único comando simple.
function stripRedundantCd(command, cwd) {
  const m = /^cd\s+(\S+)\s*&&\s*(\S.*)$/.exec(command);
  if (!m) return null;
  const dir = m[1].replace(/^(['"])(.*)\1$/, '$2').replace(/\/+$/, '');
  if (dir !== cwd.replace(/\/+$/, '')) return null;
  if (/&&|\|\||[;|&<>`\n]|\$\(/.test(m[2])) return null;
  return m[2];
}

function emitAllow(reason, toolInput, command) {
  const out = {
    hookEventName: 'PreToolUse',
    permissionDecision: 'allow',
    permissionDecisionReason: `lf-gate: ${reason}`,
  };
  if (command) out.updatedInput = { ...toolInput, command };
  process.stdout.write(JSON.stringify({ hookSpecificOutput: out }) + '\n');
}

function main() {
  if (mode === 'off') return;
  let input = {};
  let command = '';
  try {
    input = JSON.parse(readStdin());
    command = input && input.tool_input && typeof input.tool_input.command === 'string' ? input.tool_input.command : '';
  } catch (e) {
    if (mode === 'on') emit('ask', `entrada del hook ilegible (${e.message})`);
    else logRow('', 'error', `entrada ilegible: ${e.message}`, '');
    return;
  }
  const sessionId = input.session_id || '';
  if (!command) return;
  try {
    const cwd = typeof input.cwd === 'string' && input.cwd ? input.cwd : process.cwd();
    const r = classify(command, {
      cwd,
      projectDir: process.env.CLAUDE_PROJECT_DIR || cwd,
      tmpdir: process.env.TMPDIR || '/tmp',
      home: process.env.HOME || os.homedir(),
    });
    if (mode === 'on') {
      if (r.decision === 'allow') emitAllow(r.reason, input.tool_input, stripRedundantCd(command, cwd));
      else if (r.decision !== 'none') emit(r.decision, r.reason);
    } else {
      logRow(sessionId, r.decision, r.reason, command);
    }
  } catch (e) {
    if (mode === 'on') emit('ask', `error interno del gate: ${e.message}`);
    else logRow(sessionId, 'error', e.message, command);
  }
}

try { main(); } catch { /* nunca falla */ }
process.exit(0);
