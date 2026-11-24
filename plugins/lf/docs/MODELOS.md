# Modelos, esfuerzo y atajos

Política de modelos del arnés. Los tres únicos permitidos son **Sonnet**, **Opus** y **Haiku**. **Fable está prohibido** en cualquier fase, incluida la planificación.

## Quién hace qué

| Trabajo | Modelo | Esfuerzo | Dónde se fija |
| --- | --- | --- | --- |
| Typos, renombrados, configuración | Sonnet | low | `/effort low` en la sesión |
| Desarrollo diario: features, tests, bugs | Sonnet | medium | `"model"` y `"modelSettings"` en `settings.lf.json` |
| Búsquedas, tests, builds, logs, ruido | Haiku | low | `model:` en `agents/verbose-runner.md` y `CLAUDE_CODE_SUBAGENT_MODEL` |
| Planificación y arquitectura (tarea L) | Opus | high | `model:` y `effort:` en `agents/planner.md`, `/model` en la sesión |
| Bug que se resiste, refactor multi-fichero | Opus | xhigh | `/effort xhigh`, solo tras aprobación |
| Revisión final del diff | Haiku | medium | `model:` y `effort:` en `agents/reviewer.md` |

Regla de oro: **Opus planifica, Sonnet ejecuta**. Un `planner` que escribe código está mal configurado.

El esfuerzo por defecto es `medium` y se escala solo si la tarea se atasca: más esfuerzo cuesta más en cada turno y en tareas S/M rara vez cambia el resultado. Para un turno difícil, escribe `ultrathink` en el prompt (palabra nativa de Claude Code: sube el razonamiento de ese turno sin tocar el modelo ni el esfuerzo de la sesión). Para subirlo de forma persistente, `/effort high`.

## Identificadores fijos

Anthropic publica versiones cada pocas semanas. `settings.lf.json` lleva el identificador fijo (`claude-sonnet-5-5` para la sesión, `claude-haiku-5-5` para los subagentes) y hay que actualizarlo a mano cuando sale una versión; luego `/lf:setup` lo propaga a `~/.claude/settings.json`. `modelSettings` fija el esfuerzo por modelo.

En OpenCode no hay identificadores fijos: los roles se resuelven por alias contra el catálogo. Ver [opencode-lf/MODELOS.md](../../../opencode-lf/MODELOS.md).

## Subagentes: modelo explícito siempre

Un subagente sin `model:` hereda el de la sesión, y eso es lo que dispara el gasto. El arnés lo fija en dos sitios:

- `CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-5-5` en `settings.lf.json`: valor por defecto de cualquier subagente.
- `model:` en la cabecera de cada subagente del plugin, que manda sobre el valor por defecto.

Haiku 5.5 cuesta 0,10 $ / 0,50 $ por MTok con prompts de hasta 100k tokens; por encima, toda la petición paga 0,50 $ / 2,50 $ (sigue siendo ~4 veces menos que Sonnet). Los subagentes de muchos turnos, como el reviewer, pueden cruzar ese umbral por la caché acumulada. Los modelos 4.7 y posteriores generan ≈ +30 % de tokens con el mismo texto: al comparar métricas antiguas, parte de la diferencia es el tokenizador.

Al añadir un subagente, ponle `model:` y `effort:`. Un subagente trabaja con su contexto propio y devuelve un resumen, así que lo que lee no ensucia la conversación principal; por eso son baratos y los agent teams no.

## Atajos

| Atajo | Qué hace | Cuándo |
| --- | --- | --- |
| `/lf:opusplan <tarea>` | Opus planifica y Sonnet ejecuta en la misma sesión | Tarea L mediana |
| `/lf:ultracode <tarea>` | Sube el esfuerzo del turno y fija el método multiagente | Trabajo de días con presupuesto holgado |
| `/lf:handoff` | Escribe `handoff.md` / `to-do.md` | Al 75–80 % de contexto o al cerrar el día |
| `/lf:triage`, `/lf:s`, `/lf:m`, `/lf:l` | Fuerza el flujo de trabajo | Cuando la clasificación no está clara |

## Concisión

El output style integrado `Concise` va por defecto (`"outputStyle": "Concise"` en `settings.lf.json`). `/lf:caveman full` es opt-in para sesiones muy largas; `/lf:caveman off` lo quita.

## La trampa de la caché

La caché de prompts está atada al modelo. Cambiar de Opus a Sonnet a mitad de sesión invalida lo acumulado.

- **Barato (L):** sesión Opus → plan en `.planning/ARCHITECTURE.md` → `/lf:handoff` → `/clear` → sesión Sonnet → ejecutar. Dos sesiones limpias, ninguna pierde caché.
- **Cómodo (más caro):** `/lf:opusplan` hace las dos fases en la misma sesión y paga una invalidación.
- **Caro e innecesario:** mantener la sesión viva días, encadenar tareas y usar `/compact` cada vez que se llena.

## Compactación

`idleCompaction` está desactivado y `"autoCompactWindow": 253000` es solo red de seguridad: Claude Code compacta hacia `window − ~33K`, es decir, hacia los 220K. La statusline del arnés mide sobre el límite de trabajo de 200K (amarillo al 75 %, rojo con «→ /lf:handoff» al 80 %), así que desde el rojo quedan ~60K hasta el autocompact. Si un settings de proyecto fija una ventana menor (p. ej. 200000 → compacta a ~167K), la statusline mide sobre ese umbral real y `session-start` lo avisa. En rojo se escribe el handoff y se abre sesión nueva. `/compact` solo como último recurso y con instrucciones explícitas de qué conservar (decisiones, enfoques descartados, ficheros modificados).
