# Modelos, esfuerzo y atajos

Política de modelos del arnés. Hay **tres roles**, no una gama de modelos: cada rol apunta a una familia del catálogo gratuito de OpenCode y se resuelve al identificador más reciente en esa familia. **Ningún modelo de pago**: el arnés se sostiene sobre el nivel gratuito y un alias nunca resuelve a algo que cueste dinero.

## Quién hace qué

| Trabajo | Rol | Modelo resuelto | Esfuerzo | Dónde se fija |
| --- | --- | --- | --- | --- |
| Typos, renombrados, cambios de configuración | estándar | `opencode/big-pickle` | low | por sesión |
| Desarrollo diario: features, tests, bugs | estándar | `opencode/big-pickle` | high | `"model"` + `"reasoningEffort"` en `opencode.json` |
| Búsquedas, tests, builds, logs, ruido | ligero | `opencode/nemotron-3.5-lightning-free` | low/medium | `"small_model"` y `model:` en `agents/verbose-runner.md` |
| Planificación y arquitectura (tarea L) | planificación | `opencode/muse-spark-1.3-free` | high / xhigh | `model:` en `agents/planner.md`, `/models` en la sesión |
| Bug que se resiste, refactor multi-fichero | planificación | `opencode/muse-spark-1.3-free` | xhigh | `model:` en `agents/planner.md` |
| Revisión final del diff | estándar | `opencode/big-pickle` | medium | `model:` en `agents/reviewer.md` |

Regla de oro: **el modelo de planificación planifica, el estándar ejecuta**. Un `planner` que escribe código es un `planner` mal configurado.

Los tres modelos resueltos son de coste cero, aceptan tool calls y razonan. `big-pickle` tiene 200K de contexto; el ligero, 262K; el de planificación, 200K. Los tres caben de sobra en el presupuesto de contexto que impone la sección 5.

## Roles: alias, no identificadores

| Rol | Alias en la config | Familia en models.dev |
| --- | --- | --- |
| estándar | `opencode/estandar:latest` | `big-pickle` |
| planificación | `opencode/planificacion:latest` | `muse` |
| ligero | `opencode/ligero:latest` | `nemotron-free` |

El catálogo de modelos gratuitos de OpenCode rota cada pocas semanas: los `-free` viejos pasan a `deprecated` y entran otros nuevos. Un arnés que fija el identificador se queda apuntando a un modelo retirado sin avisar, así que la config **no** lleva identificadores: lleva alias de rol, y `plugins/modelo.ts` los resuelve al arrancar contra el catálogo de models.dev.

Detalles:

- El hook `config` del plugin sustituye el alias en `model`, `small_model`, `agent.*.model` y `command.*.model`. Solo toca valores con la forma exacta `opencode/<rol>:latest`; cualquier otra cosa se deja intacta.
- La resolución filtra por **coste 0** y por estado distinto de `alpha`/`beta`/`deprecated`, y gana el `release_date` más reciente de la familia. El filtro de coste es lo que sostiene la promesa del arnés: si el catálogo listara un modelo de pago en esa familia, el alias lo saltaría.
- El catálogo se cachea 24 h en `~/.cache/opencode/lf-modelos.json` (recortado a los gratuitos del provider `opencode`, unos pocos KB). Sin red y sin caché, el alias se queda sin resolver y OpenCode usa su modelo por defecto: degradación suave, no arranque roto.
- **El alias solo se resuelve al arrancar.** `/model opencode/estandar:latest` en caliente no funciona: en el TUI hay que elegir en `/models` el modelo gratuito más reciente. Por eso `/opusplan` lo dice así en su texto.
- Si un rol se retira del catálogo, el alias se queda sin resolver. Añadir una familia nueva a `FAMILIES` en `plugins/modelo.ts` es el único sitio que hay que tocar.

## Subagentes: modelo explícito siempre

Un subagente sin `model:` hereda el de la sesión, y eso es exactamente lo que dispara el gasto. El arnés lo fija por dos sitios:

- `small_model` en `opencode.json` — valor por defecto de cualquier operación auxiliar de OpenCode (títulos, resúmenes, compactación).
- `model:` en la cabecera de cada subagente del plugin, que manda sobre el valor por defecto.

Al añadir un subagente nuevo, ponle `model:` siempre, apuntando a un alias gratuito. Y recuerda: un subagente trabaja con su contexto propio y devuelve un resumen, así que lo que lee no ensucia la conversación principal. Por eso son baratos y útiles; por eso los agent teams no lo son (ver más abajo).

## Atajos

| Atajo | Qué hace | Cuándo |
| --- | --- | --- |
| `/opusplan <tarea>` | El modelo de planificación planifica, el estándar ejecuta, sin cambiar de modelo a mano | Atajo de una invocación para una tarea L mediana |
| `/ultrathink <pregunta>` | Razona a fondo **en un turno**, sin subir el modelo ni el esfuerzo de la sesión | Una decisión difícil puntual |
| `/ultracode <tarea>` | Sesión completa a xhigh y flujo multiagente | Trabajo de días con presupuesto holgado |
| `/handoff` | Escribe `handoff.md` / `to-do.md` para retomar otro día | Al 75–80 % de contexto, o al cerrar el día |
| `/triage`, `/s`, `/m`, `/l` | Forzar el flujo de trabajo | Cuando la clasificación no está clara |

`ultrathink` y `ultracode` no son sinónimos: `ultrathink` gasta más en un turno y nada más; `ultracode` sube el coste de **toda** la sesión y multiplica agentes. Ante la duda, `ultrathink`.

## La trampa de la caché

La caché de prompts está atada al modelo. Cambiar del modelo de planificación al estándar a mitad de sesión invalida lo acumulado, y volver a elegirlo lo vuelve a pagar.

- **Barato (recomendado) para tarea L:** sesión de planificación → plan en `.planning/ARCHITECTURE.md` → `/handoff` → `/new` → sesión estándar → ejecutar el plan. Dos sesiones limpias, ninguna pierde caché.
- **Cómodo (más caro):** `/opusplan` hace las dos fases en la misma sesión. Paga una invalidación de caché a cambio de no cambiar de modelo a mano. Para una L de varios días, no compensa.
- **Caro e innecesario:** mantener la sesión viva días, encadenando tareas distintas, dejando que OpenCode compacte cada vez que se llena. Además, las sesiones largas dejan de aprovechar la caché.

## Compactación

OpenCode no expone `/compact`; compacta sola cuando el contexto se llena, y el hook `experimental.session.compacting` de `plugins/lf.ts` inyecta en el resumen las decisiones, los enfoques descartados, los ficheros modificados y el próximo paso. No evita la compactación: la hace recuperable.

El umbral operativo sigue siendo el 75–80 % del contexto, donde se escribe el handoff y se abre sesión nueva. Si la compactación automática salta, significa que la sesión ya se pasó de larga y la sesión limpia era la respuesta.
