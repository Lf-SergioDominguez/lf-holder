#!/usr/bin/env node
'use strict';
/**
 * gsd-surface.cjs — aplica un perfil de superficie de GSD (core|standard|full) sin sesión interactiva.
 *
 * Replica lo que hace la skill /gsd-surface profile <name> usando los módulos internos de GSD
 * instalados en ~/.claude/gsd-core. Escribe ~/.claude/.gsd-surface.json y re-stagea
 * ~/.claude/skills/gsd-* y ~/.claude/agents/gsd-* según el perfil.
 *
 * Uso: node plugins/lf/scripts/gsd-surface.cjs <core|standard|full|reset|status> [--config-dir ~/.claude]
 */
const path = require('node:path');
const fs = require('node:fs');

const args = process.argv.slice(2);
const cmd = args[0];
const cfgIdx = args.indexOf('--config-dir');
const configDir = path.resolve(
  cfgIdx >= 0 ? args[cfgIdx + 1] : (process.env.CLAUDE_CONFIG_DIR || path.join(require('node:os').homedir(), '.claude'))
);
const lib = path.join(configDir, 'gsd-core', 'bin', 'lib');

if (!['core', 'standard', 'full', 'reset', 'status'].includes(cmd)) {
  console.error('uso: gsd-surface.cjs <core|standard|full|reset|status> [--config-dir DIR]');
  process.exit(2);
}
if (!fs.existsSync(lib)) {
  console.error(`GSD no encontrado en ${configDir}/gsd-core`);
  process.exit(3);
}

const req = (m) => require(path.join(lib, m));
let surface, clusters, layoutMod, registry, profiles;
try {
  surface = req('surface.cjs');
  clusters = req('clusters.cjs');
  layoutMod = req('runtime-artifact-layout.cjs');
  registry = req('capability-registry.cjs');
  profiles = req('install-profiles.cjs');
} catch (e) {
  console.error(`No se pudieron cargar los módulos de GSD (${e.message}). Ejecuta en una sesión: /gsd-surface profile ${cmd}`);
  process.exit(4);
}

const manifestPath = path.join(configDir, 'gsd-file-manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { files: {} };

if (cmd === 'status') {
  const st = surface.readSurface(configDir);
  const install = profiles.readActiveProfile ? profiles.readActiveProfile(configDir) : null;
  const skills = fs.existsSync(path.join(configDir, 'skills'))
    ? fs.readdirSync(path.join(configDir, 'skills')).filter((d) => d.startsWith('gsd-')).length : 0;
  const agents = fs.existsSync(path.join(configDir, 'agents'))
    ? fs.readdirSync(path.join(configDir, 'agents')).filter((d) => d.startsWith('gsd-')).length : 0;
  console.log(JSON.stringify({ installProfile: install, surface: st, gsdSkills: skills, gsdAgentFiles: agents }, null, 2));
  process.exit(0);
}

const layout = layoutMod.resolveRuntimeArtifactLayout('claude', configDir, 'global', registry);
let surfaceState = null;
if (cmd !== 'reset') {
  const current = surface.readSurface(configDir) || {
    baseProfile: (profiles.readActiveProfile && profiles.readActiveProfile(configDir)) || 'full',
    disabledClusters: [], explicitAdds: [], explicitRemoves: [],
  };
  surfaceState = { ...current, baseProfile: cmd };
}

try {
  surface.applySurface(configDir, layout, manifest, clusters.CLUSTERS, registry, { surfaceState });
} catch (e) {
  console.error(`applySurface falló: ${e.message}\nAlternativa: en una sesión de Claude Code ejecuta /gsd-surface profile ${cmd}`);
  process.exit(5);
}
const skills = fs.readdirSync(path.join(configDir, 'skills')).filter((d) => d.startsWith('gsd-')).length;
console.log(cmd === 'reset'
  ? `GSD surface reseteada al perfil de instalación (${skills} skills gsd-*).`
  : `GSD surface: perfil '${cmd}' aplicado (${skills} skills gsd-*).`);
