// gate.test.mjs — pruebas de bash-gate (node --test tests/).
// (a) tabla de casos tests/gate-cases.tsv, (b) fuzz: classify nunca lanza, (c) corpus local opcional.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from '../plugins/lf/hooks/gate/classify.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CTX = { cwd: '/work/proj', projectDir: '/work/proj', tmpdir: '/tmp/claude-1000', home: '/home/u' };
const VALID = new Set(['allow', 'ask', 'deny', 'none']);

function loadCases() {
  const rows = [];
  const lines = fs.readFileSync(path.join(here, 'gate-cases.tsv'), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.trim() === '' && !line.includes('\t')) return;
    if (line.startsWith('#')) return;
    const [decision, command = '', note = ''] = line.split('\t');
    rows.push({
      line: i + 1,
      decision,
      command: command.replaceAll('<NL>', '\n').replaceAll('<TAB>', '\t'),
      note,
    });
  });
  return rows;
}

test('gate-cases.tsv: cada caso da la decisión esperada', () => {
  const cases = loadCases();
  assert.ok(cases.length >= 200, `se esperaban >=200 casos, hay ${cases.length}`);
  const failures = [];
  for (const c of cases) {
    if (!VALID.has(c.decision)) { failures.push(`línea ${c.line}: decisión inválida «${c.decision}»`); continue; }
    const r = classify(c.command, CTX);
    if (r.decision !== c.decision) {
      failures.push(`línea ${c.line}: esperado ${c.decision}, salió ${r.decision} (${r.reason}) :: ${JSON.stringify(c.command)}`);
    }
  }
  assert.equal(failures.length, 0, `${failures.length} de ${cases.length} casos fallan:\n${failures.join('\n')}`);
});

function assertSafe(input, label) {
  let r;
  assert.doesNotThrow(() => { r = classify(input, CTX); }, `lanzó con ${label}`);
  assert.ok(r && VALID.has(r.decision), `decisión inválida con ${label}: ${JSON.stringify(r)}`);
  assert.equal(typeof r.reason, 'string', `reason no es string con ${label}`);
  assert.ok(!r.reason.startsWith('error interno'), `error interno con ${label}: ${r.reason}`);
}

test('fuzz: entradas basura no lanzan y devuelven decisión válida', () => {
  const fixed = [
    '', ' ', '\n', '\t', ';', '&&', '||', '|', '&', '(', ')', '((', '))', '{', '}', '`', '``', '$(', '$((', '${', '$',
    "'", '"', "'''", '"""', "echo 'abc", 'echo "abc', 'echo `abc', 'echo $(abc', 'echo ${abc', 'echo <(abc',
    'rm -rf', 'rm -rf "', "rm -rf '", 'git', 'git -C', 'git -c', 'docker', 'docker compose exec', 'docker exec -it',
    'mysql -e', 'mysql -e "', 'mysql -e \'SELECT', 'mysql -e "SELECT \'', 'mysql -e "/*', 'mysql -e "-- ', 'mysql <<',
    'cat <<', 'cat <<EOF', 'cat <<EOF\nabc', 'cat <<-', 'cat <<<', '> ', '>', '<', '2>', '2>&', '&>',
    'find -exec', 'find . -exec rm', 'find . -exec rm {} ', 'xargs', 'env', 'env -u', 'timeout', 'timeout 30', 'nice -n',
    'sudo', 'eval', 'sh -c', 'bash -c "', "sh -c 'sh -c \"sh -c ls\"'", 'wp', 'wp --path', 'curl', 'curl -X', 'gh api -X',
    'gh', 'composer', 'npm', 'php', 'php -d', 'bin/console', 'bin/console ::', 'bin/console a:b:c:d:e',
    '\0', '\u0001\u0002', '￿', '‮', '😀 rm -rf /', 'é'.repeat(50), '\r\n', 'a\\', '\\', '\\\n', '$\'x',
    '# only comment', ' # c\n ls', ';;', ';; ;;', '|&', '& &', '$(( 1 + 1 ))', '$((', '${A:?}', '${TMPDIR:?', '~', '~root/x',
    'rm -rf $TMPDIR/', 'rm -rf ${TMPDIR', 'rm -rf "${TMPDIR:?}"', 'cd', 'cd -', 'cd ~', 'cd ""', 'cd $(', 'pushd', 'popd',
  ];
  fixed.forEach((s, i) => assertSafe(s, `fixed#${i}`));

  assertSafe('a'.repeat(10000), 'a*10000');
  assertSafe('ls ' + 'x '.repeat(5000), 'ls args*5000');
  assertSafe('('.repeat(10000), '(*10000');
  assertSafe('$('.repeat(3000), '$(*3000');
  assertSafe('"'.repeat(10001), '"*10001');
  assertSafe("'".repeat(10001), "'*10001");
  assertSafe('`'.repeat(10001), '`*10001');
  assertSafe('echo ' + '$('.repeat(500) + 'ls' + ')'.repeat(500), 'subs anidadas');
  assertSafe('sh -c "'.repeat(200) + 'ls' + '"'.repeat(200), 'sh -c anidado');
  assertSafe('; '.repeat(5000), ';*5000');
  assertSafe('ls && '.repeat(2000) + 'ls', 'ls && *2000');
  assertSafe('mysql -e "' + "SELECT '".repeat(1500) + '"', 'sql comillas');
  assertSafe('mysql -e "' + '/*'.repeat(3000) + '"', 'sql comentarios');
  assertSafe('sed ' + "'s/" + 'a'.repeat(9000) + "/b/'", 'sed largo');
  assertSafe('cat <<EOF\n' + 'x\n'.repeat(5000), 'heredoc sin cerrar');
  assertSafe('rm ' + '-r '.repeat(3000) + '/', 'rm flags');

  // pseudoaleatorio con semilla fija: reproducible
  let seed = 123456789;
  const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  const alphabet = ['rm', 'git', 'push', '-rf', '--force', 'docker', 'compose', 'exec', 'mysql', '-e', 'DROP', 'select',
    '"', "'", '`', '$(', ')', '(', '&&', '||', ';', '|', '>', '<', '<<', '\n', ' ', '\\', '$', '${', '}', '/', '..', '~',
    '*', '.env.local', 'sh -c', 'sudo', 'find', '-delete', '{}', 'bin/console', 'doctrine:schema:update', 'wp', 'db', 'curl',
    '\u0000', 'é', '😀', '\t', '2>&1', '/dev/null', '$TMPDIR', 'cd', 'xargs', 'eval', 'EOF'];
  for (let i = 0; i < 4000; i++) {
    const n = 1 + Math.floor(rnd() * 14);
    let s = '';
    for (let j = 0; j < n; j++) s += alphabet[Math.floor(rnd() * alphabet.length)] + (rnd() < 0.6 ? ' ' : '');
    assertSafe(s, `random#${i} ${JSON.stringify(s)}`);
  }
  // bytes aleatorios
  for (let i = 0; i < 300; i++) {
    let s = '';
    const n = Math.floor(rnd() * 80);
    for (let j = 0; j < n; j++) s += String.fromCharCode(Math.floor(rnd() * 0x300));
    assertSafe(s, `bytes#${i}`);
  }
});

test('classify tolera entradas que no son string ni ctx completo', () => {
  for (const v of [undefined, null, 42, {}, []]) {
    assert.doesNotThrow(() => classify(v, CTX));
    assert.ok(VALID.has(classify(v, CTX).decision));
  }
  for (const ctx of [undefined, null, {}, { cwd: '/x' }]) {
    assert.doesNotThrow(() => classify('rm -rf build', ctx));
    assert.ok(VALID.has(classify('rm -rf build', ctx).decision));
  }
  // sin ctx no se puede resolver ninguna ruta: rm recursivo nunca baja de deny
  assert.equal(classify('rm -rf build', {}).decision, 'deny');
  assert.equal(classify('git status', {}).decision, 'allow');
});

// Corpus local opcional: comandos reales del usuario. Solo se comprueba que no lanza;
// el contenido no se copia ni se imprime (el repo público es público).
test('corpus local (opcional): classify no lanza con permissions.tsv real', (t) => {
  const dir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const file = path.join(dir, 'lf-metrics', 'permissions.tsv');
  if (!fs.existsSync(file)) { t.skip('no hay permissions.tsv'); return; }
  let n = 0;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const cols = line.split('\t');
    if (cols[3] !== 'Bash' || !cols[4]) continue;
    n++;
    let r;
    try { r = classify(cols[4], { ...CTX, cwd: cols[2] || CTX.cwd, projectDir: cols[2] || CTX.projectDir }); }
    catch { assert.fail(`classify lanzó con la fila Bash #${n} del corpus`); }
    assert.ok(VALID.has(r.decision), `decisión inválida en la fila Bash #${n}`);
    assert.ok(!r.reason.startsWith('error interno'), `error interno en la fila Bash #${n}`);
  }
  t.diagnostic(`${n} filas Bash clasificadas`);
});

// El ctx del TSV es fijo: los casos con cwd/projectDir degenerados (home o raíz) van aparte.
test('raíz de repo degenerada (home o /) y credenciales: nunca allow', () => {
  const home = { cwd: '/home/u', projectDir: '/home/u', tmpdir: '/tmp/claude-1000', home: '/home/u' };
  const root = { cwd: '/', projectDir: '/', tmpdir: '/tmp/claude-1000', home: '/home/u' };
  const cases = [
    ['cat ~/.ssh/id_rsa', home], ['cat .ssh/id_rsa', home], ['cat ~/.config/gh/hosts.yml', home],
    ['cat .aws/credentials', home], ['cat .gnupg/pubring.kbx', home], ['cat .netrc', home],
    ['cat .claude/.credentials.json', home], ['cat /etc/shadow', root],
    ['cat ~/.ssh/id_rsa', { ...home, projectDir: '/work/proj' }],
    // credenciales aunque el proyecto las contenga
    ['cat ~/.ssh/id_rsa', { ...home, cwd: '/home/u/.ssh', projectDir: '/home/u/.ssh' }],
    ['cat /home/u/.aws/credentials', { ...home, cwd: '/home/u/proj', projectDir: '/home/u/proj' }],
  ];
  for (const [cmd, ctx] of cases) {
    assert.notEqual(classify(cmd, ctx).decision, 'allow', `${cmd} con cwd=${ctx.cwd}`);
  }
  // un proyecto dentro del home sigue funcionando
  const sub = { ...home, cwd: '/home/u/proj', projectDir: '/home/u/proj' };
  assert.equal(classify('cat src/a.php', sub).decision, 'allow');
  assert.equal(classify('git status', home).decision, 'allow');
});
