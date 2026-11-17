// trim-output.mjs — hook PostToolUse(Bash) del plugin lf.
// Recorta la salida ruidosa (tests, linters, builds, installs) y limita las consultas (mysql, wp,
// bin/console) con `updatedToolOutput`. Sustituye al antiguo filter-output.sh: ya no envuelve el
// comando, trabaja sobre la salida completa que recibe el hook.
// Cada vez que recorta añade `[lf: N líneas omitidas; salida completa en <log>]`; la salida completa
// queda en ${TMPDIR}/lf-out-<session_id>.log. LF_TRIM=0 lo desactiva. Cualquier fallo → sin cambios.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MIN_LINES = 40;       // por debajo de esto no se toca nada
const QUERY_MAX = 200;      // consultas: límite amplio

const head = (n) => (ls) => ls.slice(0, n);
const tail = (n) => (ls) => ls.slice(-n);
const grepHead = (re, n) => (ls) => ls.filter((l) => re.test(l)).slice(0, n);
const grepTail = (re, n) => (ls) => ls.filter((l) => re.test(l)).slice(-n);
const withContext = (re, after, n, keepLast) => (ls) => {
  const keep = new Set();
  ls.forEach((l, i) => { if (re.test(l)) for (let k = 0; k <= after && i + k < ls.length; k++) keep.add(i + k); });
  const out = ls.filter((_, i) => keep.has(i)).slice(0, n);
  for (const l of ls.slice(-keepLast)) if (!out.includes(l)) out.push(l);
  return out;
};

// [regex sobre el comando interior, filtro]. El primero que casa gana.
const FILTERS = [
  [/vendor\/bin\/(phpunit|pest|paratest)|bin\/phpunit/, grepHead(/FAILURES|ERRORS|Tests:|OK \(|^\d+\) |Error|Failed|Exception|Deprecat|:\d+$|Time:/, 120)],
  [/vendor\/bin\/(phpstan|psalm)/, grepHead(/Line|ERROR|error|Found|No errors|\[/, 100)],
  [/vendor\/bin\/(php-cs-fixer|phpcs|rector)/, tail(40)],
  [/\b(vitest|jest)\b|\b(npm|pnpm|yarn|bun) (run )?test\b/, grepHead(/FAIL|✗|×|✕|Tests?:|Test Files|Error|expected|received|AssertionError/i, 100)],
  [/\b(astro (build|check)|vite build)\b|\b(npm|pnpm|yarn|bun) (run )?build\b/, withContext(/error|warn|fail|✘|×/i, 4, 80, 3)],
  [/\b(vue-tsc|tsc)\b/, grepHead(/error TS|Found /, 80)],
  [/\bcomposer (dump-autoload|validate|show|outdated|why)\b/, tail(20)],
  [/\b(npm (install|ci|i)|yarn( install| add)?|bun install|pnpm (install|i))\b/, grepTail(/error|warn|added|removed|audited|up to date|done|packages/i, 15)],
  // consultas: solo un tope amplio
  [/\bbin\/console\b|\bsymfony console\b|\bwp\b|\bmysql\b|\bmariadb\b/, head(QUERY_MAX)],
];

// Quita envoltorios para ver el comando real: cd X &&, VAR=x, docker compose exec svc, etc.
function inner(cmd) {
  let c = cmd.trim();
  c = c.replace(/^cd\s+\S+\s*&&\s*/, '');
  c = c.replace(/^(\w+=\S*\s+)+/, '');
  c = c.replace(/^(docker[ -]compose|docker)\s+exec(\s+-\S+(\s+[^\s-]\S*)?)*\s+\S+\s+/, '');
  return c;
}

function main() {
  if (process.env.LF_TRIM === '0') return;
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const cmd = input?.tool_input?.command;
  const resp = input?.tool_response;
  if (typeof cmd !== 'string' || !resp || typeof resp.stdout !== 'string' || resp.isImage) return;
  const lines = resp.stdout.split('\n');
  if (lines.length <= MIN_LINES) return;

  const c = inner(cmd);
  const hit = FILTERS.find(([re]) => re.test(c));
  if (!hit) return;
  let kept = hit[1](lines);
  if (kept.length >= lines.length) return;

  const sid = String(input.session_id || '').replace(/[^A-Za-z0-9_-]/g, '');
  const log = path.join(process.env.TMPDIR || os.tmpdir(), sid ? `lf-out-${sid}.log` : 'lf-last-output.log');
  fs.writeFileSync(log, resp.stdout);
  kept = kept.concat(`[lf: ${lines.length - kept.length} líneas omitidas; salida completa en ${log}]`);

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      updatedToolOutput: { ...resp, stdout: kept.join('\n') },
    },
  }) + '\n');
}

try { main(); } catch { /* sin cambios */ }
process.exit(0);
