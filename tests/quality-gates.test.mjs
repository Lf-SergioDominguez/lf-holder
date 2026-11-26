// quality-gates.test.mjs — pruebas de scripts/quality-gates.mjs (node --test tests/).
// Repos de prueba en $TMPDIR; el script solo lee ficheros.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { audit, githubRepo } from '../plugins/lf/scripts/quality-gates.mjs';
import { loadGates } from '../plugins/lf/hooks/stop-gate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(here, '..', 'plugins', 'lf', 'scripts', 'quality-gates.mjs');
const WEB_MD = path.join(here, '..', 'plugins', 'lf', 'profiles', 'web.md');
const gates = loadGates(fs.readFileSync(WEB_MD, 'utf8'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-qg-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function repo(name, files) {
  const root = path.join(tmp, name);
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return root;
}
const byId = (res) => Object.fromEntries(res.checks.map((c) => [c.id, c]));

test('Symfony completo: ok, missing y gate de GitHub', () => {
  const root = repo('symfony', {
    'composer.json': { require: { 'symfony/framework-bundle': '^7.0' }, 'require-dev': { 'phpstan/phpstan': '^2', 'phpunit/phpunit': '^11', 'friendsofphp/php-cs-fixer': '^3' } },
    '.php-cs-fixer.dist.php': '<?php',
    'phpstan.neon.dist': '',
    'phpunit.xml.dist': '',
    'migrations/Version1.php': '<?php',
    '.github/workflows/ci.yml': 'run: vendor/bin/PHP-CS-Fixer fix\nrun: vendor/bin/phpstan\nrun: vendor/bin/phpunit --coverage-clover x\n',
    '.git/config': '[core]\n\tbare = false\n[remote "origin"]\n\turl = git@github.com:lefebvre/app.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n',
  });
  const res = audit(root, gates, WEB_MD);
  assert.deepEqual(res.stacks, ['symfony']);
  assert.ok(res.checks.every((c) => c.stack === 'symfony'));
  const c = byId(res);
  assert.equal(c['cs-fixer-symfony'].status, 'ok');
  assert.equal(c['phpstan-symfony'].status, 'ok');
  assert.equal(c['phpunit-symfony'].status, 'ok');
  assert.deepEqual(c['phpstan-symfony'].evidence, ['phpstan.neon.dist', 'composer:phpstan/phpstan', '.github/workflows/ci.yml']);
  assert.equal(c['coverage-symfony'].status, 'ok');
  assert.equal(c['coverage-symfony'].local, null);
  assert.equal(c['semgrep-symfony'].status, 'missing');
  assert.equal(c['secrets-symfony'].status, 'github');
  assert.deepEqual(res.github, { repo: 'lefebvre/app', calls: ['gh api repos/lefebvre/app'] });
});

test('WordPress a medias: partial y missing', () => {
  const root = repo('wp', {
    'wp-content/plugins/x/x.php': '<?php',
    'phpstan.neon': '',
    'composer.json': { 'require-dev': { 'squizlabs/php_codesniffer': '^3' } },
  });
  const res = audit(root, gates, WEB_MD);
  assert.deepEqual(res.stacks, ['wordpress']);
  const c = byId(res);
  assert.equal(c['phpstan-wordpress'].status, 'partial'); // fichero sí, CI no
  assert.equal(c['phpstan-wordpress'].local, true);
  assert.equal(c['phpstan-wordpress'].ci, false);
  assert.equal(c['phpcs-wordpress'].status, 'partial'); // paquete sí, CI no
  assert.equal(c['phpunit-wordpress'].status, 'missing');
  assert.deepEqual(res.github, { repo: null, calls: [] });
});

test('WordPress por cabecera Plugin Name en la raíz', () => {
  const root = repo('wp-header', { 'mi-plugin.php': '<?php\n/**\n * Plugin Name: Mi plugin\n */\n' });
  assert.deepEqual(audit(root, gates, WEB_MD).stacks, ['wordpress']);
});

test('Node sin CI: local true, ci false y stacks combinados', () => {
  const root = repo('node', {
    'package.json': { devDependencies: { eslint: '^9', prettier: '^3' } },
    'eslint.config.js': '',
    'composer.json': { require: { 'symfony/framework-bundle': '^7.0' } },
  });
  const res = audit(root, gates, WEB_MD);
  assert.deepEqual(res.stacks, ['symfony', 'node']);
  const c = byId(res);
  assert.equal(c['eslint-node'].status, 'partial');
  assert.equal(c['eslint-node'].ci, false);
  assert.equal(c['prettier-node'].status, 'partial'); // dep sí, fichero y CI no
  assert.equal(c['stylelint-node'].status, 'missing');
});

test('sin perfil o sin checks: checks vacío con reason', () => {
  const root = repo('plain', { 'package.json': {} });
  for (const g of [null, { code: [], test: [], ignore: [], commands: {} }]) {
    const res = audit(root, g);
    assert.deepEqual(res.checks, []);
    assert.match(res.reason, /gates\.checks/);
  }
});

test('sin stack detectado: checks vacío con reason', () => {
  const res = audit(repo('empty', { 'README.md': '' }), gates, WEB_MD);
  assert.deepEqual(res.checks, []);
  assert.match(res.reason, /ningún stack/);
});

test('el recorrido ignora vendor/, node_modules/ y más de 4 niveles', () => {
  const root = repo('walk', {
    'package.json': {},
    'vendor/x/phpstan.neon': '',
    'node_modules/y/vitest.config.js': '',
    'a/b/c/d/e/tsconfig.json': '',
    'a/b/c/d/tsconfig.json': '',
  });
  const files = byId(audit(root, { checks: { t: { gate: 'g', stack: 'node', fix: 'f', files: ['**/tsconfig.json', '**/phpstan.neon', '**/vitest.config.*'] } } }));
  assert.deepEqual(files.t.evidence, ['a/b/c/d/tsconfig.json']);
});

test('ruleset-main añade su llamada gh', () => {
  const root = repo('ruleset', {
    'package.json': {},
    '.git/config': '[remote "origin"]\n\turl = https://github.com/o/n\n',
  });
  const g = { checks: { r: { gate: 'g', stack: 'node', fix: 'f', github: 'ruleset-main' }, s: { gate: 'g', stack: 'node', fix: 'f', github: 'secret-scanning' } } };
  assert.deepEqual(audit(root, g).github.calls, ['gh api repos/o/n/rules/branches/main', 'gh api repos/o/n']);
});

test('githubRepo: formatos de url y remotos no GitHub', () => {
  const cases = [
    ['git@github.com:o/n.git', 'o/n'],
    ['https://github.com/o/n.git', 'o/n'],
    ['https://user@github.com/o/n.js', 'o/n.js'],
    ['ssh://git@github.com/o/n.git', 'o/n'],
    ['git@gitlab.com:o/n.git', null],
    ['https://example.com/github.com/o/n', null],
  ];
  for (const [url, want] of cases) {
    const root = repo(`git-${Buffer.from(url).toString('hex').slice(0, 16)}`, { '.git/config': `[remote "origin"]\n\turl = ${url}\n` });
    assert.equal(githubRepo(root), want, url);
  }
  assert.equal(githubRepo(repo('no-git', { 'a.txt': '' })), null);
});

test('CLI: JSON válido con el perfil real; sin perfil, exit 0 con reason; perfil roto, exit 1', () => {
  const root = repo('cli', { 'package.json': { devDependencies: { eslint: '^9' } } });
  const ok = JSON.parse(execFileSync('node', [SCRIPT, '--profile', WEB_MD, root], { encoding: 'utf8' }));
  assert.deepEqual(ok.stacks, ['node']);
  assert.ok(ok.checks.length > 0);

  const none = spawnSync('node', [SCRIPT, '--profile', path.join(tmp, 'no-existe.md'), root], { encoding: 'utf8' });
  assert.equal(none.status, 0);
  assert.deepEqual(JSON.parse(none.stdout).checks, []);

  const bad = path.join(tmp, 'bad.md');
  fs.writeFileSync(bad, '```yaml gates\ngates:\n  checks:\n    x:\n      gate: "G"\n```\n');
  const broken = spawnSync('node', [SCRIPT, '--profile', bad, root], { encoding: 'utf8' });
  assert.equal(broken.status, 1);
  assert.match(broken.stderr, /falta "stack"|falta "fix"/);

  assert.equal(spawnSync('node', [SCRIPT, path.join(tmp, 'nada')], { encoding: 'utf8' }).status, 2);
});
