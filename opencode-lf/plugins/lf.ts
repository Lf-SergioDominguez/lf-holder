// plugins/lf.ts — plugin `lf` para OpenCode.
//
// Puerto de dos de los tres hooks del arnés original:
//   - filtrado de salida (PreToolUse/Bash)     -> hook "tool.execute.before"
//   - log de permisos (PermissionRequest)      -> hook "permission.ask"
// El tercero detectaba que una herramienta externa del ecosistema original
// volvía a registrar hooks en su configuración global. Esa herramienta no
// existe en OpenCode, así que ese hook no tiene equivalente y no se ha
// portado.
//
// Añado un cuarto, sin equivalente original: OpenCode compacta solo y en
// segundo plano, sin acción del usuario, y el resumen por defecto pierde
// justo lo que más caro sale perder (un enfoque que ya falló, una decisión
// descartada). El hook "experimental.session.compacting" inyecta esas
// secciones en el prompt de compactación. No lo evita: lo hace recuperable.
// La estrategia real es /handoff + /new (ver AGENTS.md, sección 5).
//
// Envuelve comandos ruidosos que el resto de la configuración no filtra
// (Symfony console, builds de Astro/Vite, tsc/vue-tsc, composer, npm/yarn/bun
// install, wp-cli, mysql -e) y, sobre todo, los que van dentro de
// `docker compose exec <servicio> …`, invisibles para un filtro que solo
// mire el primer token del comando.
//
// Nunca toca: comandos ya prefijados con `rtk`, pipes, redirecciones,
// heredocs, sustituciones de comando, encadenados (&&, ||, ;), multilínea,
// ni asignaciones de variables — en esos casos reescribir el string a ciegas
// es más peligroso que no tocarlo.

import type { Plugin } from "@opencode-ai/plugin"
import { appendFile, mkdir } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

type ToolExecuteBeforeInput = { tool: string; sessionID: string; callID: string }
type ToolExecuteBeforeOutput = { args: Record<string, unknown> }
type PermissionAskInput = { tool?: string; sessionID?: string; permission?: string; patterns?: readonly string[]; metadata?: Record<string, unknown> }
type PermissionAskOutput = { status: "ask" | "deny" | "allow" }
type CompactingInput = { sessionID?: string }
type CompactingOutput = { context: string[]; prompt?: string }

type Filter = { pattern: RegExp; filter: string; note: string }

// Orden de evaluación: la primera coincidencia gana (igual que el `case` de bash).
const FILTERS: Filter[] = [
  // Symfony console
  { pattern: /^(php bin\/console|bin\/console|symfony console) debug:/, filter: "head -n 120", note: "Symfony debug (120 líneas)" },
  { pattern: /^(php bin\/console|bin\/console|symfony console) /, filter: "grep -vE '^[[:space:]]*$' | tail -n 40", note: "Symfony console (40 líneas)" },
  // PHP: tests / análisis estático (dentro de docker, invisibles para filtros por prefijo)
  { pattern: /vendor\/bin\/(phpunit|pest|paratest)|bin\/phpunit/, filter: "tee $LF_LOG | grep -E 'FAILURES|ERRORS|Tests:|OK \\(|^[0-9]+\\) |Error|Failed|Exception|Deprecat|:[0-9]+$|Time:' | head -n 120", note: "PHPUnit: solo fallos y resumen" },
  { pattern: /vendor\/bin\/(phpstan|psalm)/, filter: "tee $LF_LOG | grep -E 'Line|ERROR|error|Found|No errors|\\[' | head -n 100", note: "phpstan/psalm resumido" },
  { pattern: /vendor\/bin\/(php-cs-fixer|phpcs|rector)/, filter: "tee $LF_LOG | tail -n 40", note: "lint PHP (40 líneas)" },
  // Builds frontend
  { pattern: /^(npx astro build|astro build|npx astro check|astro check|npm run build|bun run build|pnpm run build|pnpm build|yarn build|npx vite build|vite build)/, filter: "tee $LF_LOG | grep -Ei -A4 'error|warn|fail|✘|×' | head -n 80; tail -n 3 $LF_LOG", note: "build: errores/avisos + 3 últimas líneas" },
  { pattern: /^(npx vue-tsc|vue-tsc|npx tsc|tsc)(\s|$)/, filter: "tee $LF_LOG | grep -E 'error TS|Found ' | head -n 80", note: "tsc: solo errores" },
  // Gestores de dependencias
  { pattern: /^composer (dump-autoload|validate|show|outdated|why)/, filter: "tail -n 20", note: "composer (20 líneas)" },
  { pattern: /^(npm (install|ci|i\b)|npm i$|yarn$|yarn install|yarn add |bun install|pnpm install|pnpm i)/, filter: "tee $LF_LOG | grep -Ei 'error|warn|added|removed|audited|up to date|done|packages' | tail -n 15", note: "install: resumen" },
  // WordPress CLI y MySQL
  { pattern: /^wp /, filter: "head -n 60", note: "wp-cli (60 líneas)" },
  { pattern: /^mysql .*(-e |--execute)/, filter: "head -n 60", note: "mysql (60 filas)" },
]

// Construcciones que no se pueden envolver sin riesgo: passthrough.
const UNSAFE = /[|><;`]|&&|\|\||<<|\$\(|\n/
// Prefijo de una herramienta externa de compresión: si ya viene aplicado, el
// filtro no debe tocar el comando.
const RTK_PREFIXED = /^rtk\s|\srtk\s/
const VAR_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
const DOCKER_EXEC = /^((?:docker\s+compose|docker-compose)\s+exec(?:\s+-[A-Za-z]+(?:\s+[^\s-][^\s]*)?)*\s+[A-Za-z0-9_.-]+\s+)(.+)$/s

function wrapCommand(cmd: string): { command: string; note: string } | null {
  if (RTK_PREFIXED.test(cmd)) return null
  if (UNSAFE.test(cmd)) return null
  if (VAR_ASSIGNMENT.test(cmd)) return null

  let prefix = ""
  let inner = cmd
  const dockerMatch = cmd.match(DOCKER_EXEC)
  if (dockerMatch) {
    prefix = dockerMatch[1]
    inner = dockerMatch[2]
  }

  for (const { pattern, filter, note } of FILTERS) {
    if (pattern.test(inner)) {
      const wrapped = `LF_LOG="\${TMPDIR:-/tmp}/lf-last-output.log"; { ${prefix}${inner}; } 2>&1 | ${filter}; exit \${PIPESTATUS[0]}`
      return { command: wrapped, note }
    }
  }
  return null
}

// Ficheros que ningún agente debe leer. `opencode.json` → `permission.read`
// ya lo cubre con globs (secretos y basura: logs, vendor, node_modules,
// dist, .git), pero el hook se mantiene como red de seguridad: si alguien
// sobrescribe la config global, los secretos siguen bloqueados.
const BLOCKED_READ_PATTERNS = [
  /\.env(\.[^/]+)?\.local$/,
  /\.env\.local$/,
  /(^|\/)\.env$/,
  /(^|\/)\.ssh\//,
  /(^|\/)\.aws\//,
  /\.pem$/,
  /\.key$/,
]

// Lo que el resumen por defecto de OpenCode tira y que en este arnés es
// caro perder. Se inyecta como contexto en el prompt de compactación.
const COMPACTION_CONTEXT = `## Contexto que no se debe perder (arnés lf)

Esta sesión se está compactando. El resumen por defecto pierde lo que no se le
pide expresamente, así que conserva, aunque no sea obvio:

1. **Tarea en curso y punto exacto**: qué se está haciendo y hasta dónde.
2. **Decisiones tomadas y por qué**, incluidas las alternativas descartadas.
   Un enfoque que ya falló es lo primero que se pierde y lo que más caro sale
   no volver a probar.
3. **Ficheros modificados**, con su ruta y qué cambió en cada uno.
4. **Enfoques descartados**, con una línea de por qué.
5. **Bloqueos**: qué espera a un humano o a un tercero.
6. **Próximo paso concreto**: la primera acción a tomar, con fichero:línea.
7. **Ficheros de estado**: si existen \`handoff.md\` o \`to-do.md\` en el
   proyecto, remember que mandan sobre este resumen.

Formato: las secciones 1-6 en un bloque, máximo 30 líneas. Sin relato y sin
repetir lo que se deduce leyendo el código.

Además, recuerda en el resumen: ante la duda, \`/handoff\` y \`/new\` antes que
compactar.`

export const LfPlugin: Plugin = async () => {
  const metricsDir = join(homedir(), ".config", "opencode", "lf-metrics")
  const permissionsFile = join(metricsDir, "permissions.tsv")
  let metricsDirReady = false

  return {
    "tool.execute.before": async (input: ToolExecuteBeforeInput, output: ToolExecuteBeforeOutput) => {
      if (input.tool === "read") {
        const filePath = String(output.args?.filePath ?? "")
        if (BLOCKED_READ_PATTERNS.some((re) => re.test(filePath))) {
          throw new Error(`lf: lectura bloqueada — ${filePath} parece contener secretos`)
        }
        return
      }

      if (input.tool !== "bash") return
      const command = output.args?.command
      if (typeof command !== "string" || command.length === 0) return

      const result = wrapCommand(command)
      if (!result) return

      ;(output.args as { command: string }).command = result.command
      // Puramente informativo; no aborta ni pide confirmación.
      console.log(`lf: salida filtrada — ${result.note}`)
    },

    // Registra cada prompt de permiso en un TSV para medir la fricción
    // (objetivo: 0 en tareas S/M). No toma ninguna decisión: nunca toca
    // `output.status`.
    "permission.ask": async (input: PermissionAskInput, _output: PermissionAskOutput) => {
      try {
        if (!metricsDirReady) {
          await mkdir(metricsDir, { recursive: true })
          metricsDirReady = true
        }
        const row = [
          new Date().toISOString(),
          input.sessionID ?? "",
          input.tool ?? input.permission ?? "",
          JSON.stringify(input.metadata ?? input.patterns ?? {}).slice(0, 200),
        ]
        await appendFile(permissionsFile, row.join("\t") + "\n")
      } catch {
        // Igual que el original: si falla el logging, no bloquea nada.
      }
    },

    // Inyecta en la compactación lo que el resumen por defecto tiraría.
    // No cancela la compactación ni toca `output.prompt`: si el usuario
    // llegase a fijar un prompt propio, este contexto se ignora en vez de
    // pisarlo.
    "experimental.session.compacting": async (_input: CompactingInput, output: CompactingOutput) => {
      try {
        if (Array.isArray(output.context)) output.context.push(COMPACTION_CONTEXT)
      } catch {
        // El hook nunca debe romper la sesión por inyectar texto.
      }
    },
  }
}

export default LfPlugin
