// plugins/modelo.ts — plugin `modelo` para OpenCode.
//
// Resuelve alias de rol en la config: `opencode/estandar:latest`,
// `opencode/planificacion:latest`, `opencode/ligero:latest` → el modelo
// gratuito más reciente que models.dev liste para esa familia.
//
// Por qué: el catálogo de modelos gratuitos de OpenCode rota cada pocas
// semanas (los `-free` viejos pasan a `deprecated` y entran nuevos). Un arnés
// que fija el identificador se queda apuntando a un modelo retirado sin
// avisar. El alias se resuelve al arrancar, así que la política "el modelo
// gratuito más nuevo de esa categoría" se cumple sola.
//
// Reglas de resolución, en orden:
//   1. Se lee models.dev/api.json (fuente que ya usa OpenCode para listar
//      modelos). Se cachea 24 h en ~/.cache/opencode/lf-modelos.json; si la
//      red falla se usa la caché, y si no hay caché se deja el alias sin
//      tocar (OpenCode caerá al modelo por defecto).
//   2. Se filtran los modelos del provider `opencode` de la familia pedida
//      con coste 0 y estado distinto de `deprecated`/`alpha`/`beta`. El filtro
//      de coste es lo que mantiene la promesa del arnés: solo modelos
//      gratuitos, nunca uno de pago por el mismo alias.
//   3. Gana el de `release_date` más reciente; a igualdad de fecha, el
//      identificador más corto.
//
// Solo se sustituyen valores con forma exacta `opencode/<rol>:latest`.
// Cualquier otra cosa se deja intacta.

import type { Plugin } from "@opencode-ai/plugin"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

type ModelEntry = {
  id: string
  release_date?: string
  family?: string
  status?: string | null
  cost?: { input?: number; output?: number } | null
}

type Catalog = Record<string, { models?: Record<string, ModelEntry> }>

// De models.dev (5 MB) solo guardamos el provider `opencode` y, de él, solo
// los modelos gratuitos (coste 0). La caché pasa de 5 MB a unos pocos KB.
function slim(catalog: Catalog): Catalog {
  const out: Catalog = {}
  for (const [provider, entry] of Object.entries(catalog)) {
    if (provider !== "opencode") continue
    const models: Record<string, ModelEntry> = {}
    for (const [id, model] of Object.entries(entry.models ?? {})) {
      if (!isFree(model)) continue
      models[id] = { id, family: model.family, release_date: model.release_date, status: model.status ?? null, cost: model.cost ?? null }
    }
    if (Object.keys(models).length) out[provider] = { models }
  }
  return out
}

// Solo entra en el catálogo lo que no cuesta dinero: el arnés se sostiene
// sobre el nivel gratuito de OpenCode y un alias nunca debe resolver a un
// modelo de pago aunque el catálogo lo liste.
function isFree(model: ModelEntry): boolean {
  const cost = model.cost
  if (!cost) return false
  return (cost.input ?? 0) === 0 && (cost.output ?? 0) === 0
}

type Cache = { at: number; catalog: Catalog }

const ALIAS = /^opencode\/(?<role>estandar|planificacion|ligero):latest$/
const PROVIDER = "opencode"
const CACHE_TTL = 24 * 60 * 60 * 1000
const MODELS_DEV = "https://models.dev/api.json"

// Rol → familia en el catálogo. Se eligen familias distintas para que el
// "ruido" nunca hereda el modelo de planificación aunque uno se retire:
//   estandar       trabajo diario, el modelo asentado
//   planificacion  razonamiento largo para tareas L
//   ligero         subagentes de ruido, contexto amplio y respuesta corta
const FAMILIES: Record<string, string> = {
  estandar: "big-pickle",
  planificacion: "muse",
  ligero: "nemotron-free",
}

const CACHE_PATH = join(homedir(), ".cache", "opencode", "lf-modelos.json")

async function loadCatalog(): Promise<Catalog | undefined> {
  const now = Date.now()
  try {
    const cached = JSON.parse(await readFile(CACHE_PATH, "utf8")) as Cache
    if (now - cached.at < CACHE_TTL) return cached.catalog
  } catch {}

  try {
    const res = await fetch(MODELS_DEV, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const catalog = slim((await res.json()) as Catalog)
    await mkdir(join(homedir(), ".cache", "opencode"), { recursive: true })
    await writeFile(CACHE_PATH, JSON.stringify({ at: now, catalog }))
    return catalog
  } catch {}

  try {
    return (JSON.parse(await readFile(CACHE_PATH, "utf8")) as Cache).catalog
  } catch {
    return undefined
  }
}

function newest(catalog: Catalog | undefined, family: string): string | undefined {
  const models = catalog?.[PROVIDER]?.models
  if (!models) return undefined
  let best: { id: string; date: string } | undefined
  for (const model of Object.values(models)) {
    if (model.family !== family) continue
    if (!isFree(model)) continue
    if (model.status === "deprecated" || model.status === "alpha" || model.status === "beta") continue
    const date = model.release_date ?? ""
    if (
      !best ||
      date > best.date ||
      (date === best.date && model.id.length < best.id.length)
    )
      best = { id: model.id, date }
  }
  return best?.id
}

async function resolve(value: unknown, catalog: Catalog | undefined): Promise<string> {
  if (typeof value !== "string") return value
  const match = ALIAS.exec(value)
  if (!match?.groups) return value
  const id = newest(catalog, FAMILIES[match.groups.role])
  return id ? `${PROVIDER}/${id}` : value
}

export const ModeloPlugin: Plugin = async ({ client }) => {
  const catalog = await loadCatalog()
  if (!catalog) return {}

  const patch = async (value: unknown) => {
    const next = await resolve(value, catalog)
    if (next !== value) await client.app.log({ body: { service: "modelo", level: "info", message: `${value} → ${next}` } })
    return next
  }

  return {
    config: async (input) => {
      input.model = await patch(input.model)
      input.small_model = await patch(input.small_model)
      for (const agent of Object.values(input.agent ?? {}))
        if (agent) agent.model = await patch(agent.model)
      for (const command of Object.values(input.command ?? {}))
        if (command) command.model = await patch(command.model)
    },
  }
}
