#!/usr/bin/env node
// quality-gates.mjs — detección determinista para /lf:quality-gates (H7).
//
//   node quality-gates.mjs [--profile <perfil.md>] [<dir>]
//
// Lee el bloque `gates.checks` del perfil, detecta stacks en <dir> y evalúa cada check sobre el árbol.
// Saca JSON por stdout. No usa red ni ejecuta nada del repo (solo lee ficheros).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadGates, matchesAny } from '../hooks/stop-gate.mjs';

const MAX_DEPTH = 4;
const MAX_FILES = 20000;
const SKIP_DIRS = new Set(['vendor', 'node_modules', '.git', 'var', 'dist']);
const SAFE_NAME = /^[\w-]+$/;
const HEADER = /^\s*(?:\*|\/\/|#)?\s*(?:Plugin|Theme) Name:/m;

// Rutas relativas (con `/`) de ficheros hasta MAX_DEPTH, sin seguir enlaces simbólicos.
function walk(root) {
  const files = [];
  const visit = (rel, depth) => {
    let entries;
    try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (files.length >= MAX_FILES) return;
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (depth < MAX_DEPTH && !SKIP_DIRS.has(e.name)) visit(p, depth + 1); }
      else if (e.isFile()) files.push(p);
    }
  };
  visit('', 0);
  return files;
}

const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const readHead = (file) => { try { return fs.readFileSync(file, 'utf8').slice(0, 8192); } catch { return ''; } };
const depNames = (json, keys) => new Set(keys.flatMap((k) => Object.keys(json?.[k] ?? {})));

export function detectStacks(root, files, composer) {
  const stacks = [];
  if (depNames(composer, ['require', 'require-dev']).has('symfony/framework-bundle')) stacks.push('symfony');
  const top = files.filter((f) => !f.includes('/'));
  const wp = files.some((f) => f.startsWith('wp-content/'))
    || top.some((f) => /^wp-config.*\.php$/.test(f))
    || top.some((f) => /\.(php|css)$/.test(f) && HEADER.test(readHead(path.join(root, f))));
  if (wp) stacks.push('wordpress');
  if (top.includes('package.json')) stacks.push('node');
  return stacks;
}

// owner/name del remoto `origin` leyendo .git/config (sin ejecutar git); null si no es github.com.
export function githubRepo(root) {
  let cfg;
  try { cfg = fs.readFileSync(path.join(root, '.git', 'config'), 'utf8'); } catch { return null; }
  const section = /^\[remote "origin"\]\s*\r?\n((?:[ \t]+.*\r?\n?)*)/m.exec(cfg);
  const url = section && /^\s*url\s*=\s*(\S+)/m.exec(section[1])?.[1];
  const m = url && /^(?:https?:\/\/(?:[^@/]+@)?|ssh:\/\/git@|git@)github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(url);
  return m ? `${m[1]}/${m[2]}` : null;
}

function readWorkflows(root, files) {
  return files
    .filter((f) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f))
    .map((f) => ({ file: f, text: fs.readFileSync(path.join(root, f), 'utf8').toLowerCase() }));
}

const GITHUB_CALLS = {
  'secret-scanning': (repo) => `gh api repos/${repo}`,
  'ruleset-main': (repo) => `gh api repos/${repo}/rules/branches/main`,
};

export function audit(root, gates, profile = null) {
  const out = { profile, stacks: [], checks: [], github: { repo: null, calls: [] } };
  const checks = Object.entries(gates?.checks ?? {});
  if (!checks.length) return { ...out, reason: 'el perfil no define gates.checks' };

  const files = walk(root);
  const composer = readJson(path.join(root, 'composer.json'));
  const pkg = readJson(path.join(root, 'package.json'));
  out.stacks = detectStacks(root, files, composer);
  if (!out.stacks.length) return { ...out, reason: 'no se detectó ningún stack (symfony, wordpress, node)' };

  const composerDeps = depNames(composer, ['require', 'require-dev']);
  const npmDeps = depNames(pkg, ['dependencies', 'devDependencies']);
  const workflows = readWorkflows(root, files);
  const calls = new Set();
  out.github.repo = githubRepo(root);

  for (const [id, c] of checks) {
    if (!out.stacks.includes(c.stack)) continue;
    const evidence = [];
    const localParts = [];
    if (c.files?.length) { const hit = files.filter((f) => matchesAny(c.files, f)); localParts.push(hit.length > 0); evidence.push(...hit.slice(0, 5)); }
    if (c.composer?.length) { const hit = c.composer.filter((p) => composerDeps.has(p)); localParts.push(hit.length > 0); evidence.push(...hit.map((p) => `composer:${p}`)); }
    if (c.npm?.length) { const hit = c.npm.filter((p) => npmDeps.has(p)); localParts.push(hit.length > 0); evidence.push(...hit.map((p) => `npm:${p}`)); }
    const local = localParts.length ? localParts.some(Boolean) : null;

    let ci = null;
    if (c.ci?.length) {
      const hit = workflows.filter((w) => c.ci.some((s) => w.text.includes(s.toLowerCase())));
      ci = hit.length > 0;
      evidence.push(...hit.map((w) => w.file));
    }

    const defined = [local, ci].filter((v) => v !== null);
    const status = !defined.length ? 'github' : defined.every(Boolean) ? 'ok' : defined.some(Boolean) ? 'partial' : 'missing';
    if (c.github && out.github.repo) calls.add(GITHUB_CALLS[c.github](out.github.repo));
    out.checks.push({ id, gate: c.gate, stack: c.stack, blocks: c.blocks ?? null, local, ci, status, evidence, fix: c.fix });
  }
  out.github.calls = [...calls];
  return out;
}

// Mismo criterio que el hook Stop: perfil de <config>/lf/config.json → <config>/lf/profiles/<perfil>.md.
function defaultProfile() {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const cfg = readJson(path.join(configDir, 'lf', 'config.json')) ?? {};
  const name = typeof cfg.profile === 'string' && SAFE_NAME.test(cfg.profile) ? cfg.profile : 'generic';
  return path.join(configDir, 'lf', 'profiles', `${name}.md`);
}

function main(argv) {
  let profile = null;
  let dir = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) profile = argv[++i];
    else if (!argv[i].startsWith('--') && dir === null) dir = argv[i];
    else { console.error('uso: quality-gates.mjs [--profile <perfil.md>] [<dir>]'); return 2; }
  }
  const root = path.resolve(dir ?? '.');
  if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) { console.error(`quality-gates: ${root} no es una carpeta`); return 2; }

  profile ??= defaultProfile();
  let md;
  try { md = fs.readFileSync(profile, 'utf8'); }
  catch { console.log(JSON.stringify(audit(root, null, null), null, 2)); return 0; } // sin perfil → checks: [] con reason
  let gates;
  try { gates = loadGates(md); }
  catch (e) { console.error(`quality-gates: ${profile}: ${e.message}`); return 1; }
  console.log(JSON.stringify(audit(root, gates, profile), null, 2));
  return 0;
}

const realArgv1 = (() => { try { return fs.realpathSync(process.argv[1]); } catch { return process.argv[1] ?? ''; } })();
if (import.meta.url === pathToFileURL(realArgv1).href) process.exitCode = main(process.argv.slice(2));
