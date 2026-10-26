# Modelos, esfuerzo y atajos

Política de modelos del arnés. Los tres únicos permitidos son **Sonnet**, **Opus** y **Haiku**. **Fable está prohibido** en cualquier fase, incluida la planificación: no es la mejor relación calidad/precio de la gama y el arnés no lo usa en ningún flujo.

## Quién hace qué

| Trabajo | Modelo | Esfuerzo | Dónde se fija |
| --- | --- | --- | --- |
| Typos, renombrados, cambios de configuración | Sonnet | low | por sesión |
| Desarrollo diario: features, tests, bugs | Sonnet | high | `"model"` + `"effortLevel"` en `settings.lf.json` |
| Búsquedas, tests, builds, logs, ruido | Haiku | low/medium | `model:` en `agents/verbose-runner.md` y `CLAUDE_CODE_SUBAGENT_MODEL` |
| Planificación y arquitectura (tarea L) | Opus | high / xhigh | `model:` en `agents/planner.md`, `/model` en la sesión |
| Bug que se resiste, refactor multi-fichero | Opus | xhigh | `model:` en `agents/planner.md` |
| Revisión final del diff | Haiku | high | `model:` y `effort:` en `agents/reviewer.md` |

Regla de oro: **Opus planifica, Sonnet ejecuta**. Un `planner` que escribe código es un `planner` mal configurado.

El `reviewer` va en Haiku con `effort: high`: es la puerta de calidad del diff y pensar más cuesta poco a este precio. Riesgo asumido: revisiones menos finas que con Sonnet; se vigila. Sonnet costaría unas 20 veces más.

## Modelos concretos: identificadores fijos

Anthropic publica versiones cada pocas semanas (`claude-sonnet-5` → `claude-sonnet-5-5`, `claude-haiku-4-5` → `claude-haiku-5-5`). En Claude Code, `settings.lf.json` lleva el identificador fijo (`claude-sonnet-5-5` para la sesión, `claude-haiku-5-5` para los subagentes) y hay que actualizarlo a mano cuando sale una versión; luego `/lf:setup` lo propaga a `~/.claude/settings.json`. Fable nunca se usa.

En OpenCode no hay identificadores fijos: los roles se resuelven por alias contra el catálogo. Ver [opencode-lf/MODELOS.md](../opencode-lf/MODELOS.md).

## Subagentes: modelo explícito siempre

Un subagente sin `model:` hereda el de la sesión, y eso es exactamente lo que dispara el gasto. El arnés lo fija por dos sitios:

- `CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-5-5` en `settings.lf.json` — valor por defecto de cualquier subagente sin modelo propio.
- `model:` en la cabecera de cada subagente del plugin, que manda sobre el valor por defecto.

Haiku 5.5 cuesta 0,10 $ / 0,50 $ por MTok con prompts de hasta 100k tokens (10 veces menos que Haiku 4.5 y 20 veces menos que Sonnet 5.5). El umbral se aplica por petición y cuenta input más lecturas y escrituras de caché: por encima de 100k, toda la petición paga 0,50 $ / 2,50 $, que sigue siendo unas 4 veces menos que Sonnet. Los subagentes suelen quedarse por debajo; los de muchos turnos, como el reviewer (`maxTurns: 15`), pueden cruzarlo a medida que se acumula la caché, y `measure.sh` lo cobra en el tramo largo.

El tokenizador de los modelos 4.7 y posteriores genera ≈ +30 % de tokens con el mismo texto: al comparar métricas de `scripts/measure.sh` anteriores a Haiku 5.5, parte de la diferencia es el tokenizador, no un cambio de uso.

Al añadir un subagente nuevo, ponle `model:` siempre. Y recuerda: un subagente trabaja con su contexto propio y devuelve un resumen, así que lo que lee no ensucia la conversación principal. Por eso son baratos y útiles; por eso los agent teams no lo son (ver más abajo).

## Atajos

| Atajo | Qué hace | Cuándo |
| --- | --- | --- |
| `/lf:opusplan <tarea>` | Opus planifica, Sonnet ejecuta, sin cambiar de modelo a mano | Atajo de una invocación para una tarea L mediana |
| `/lf:ultrathink <pregunta>` | Razona a fondo **en un turno**, sin subir el modelo ni el esfuerzo de la sesión | Una decisión difícil puntual |
| `/lf:ultracode <tarea>` | Sesión completa a xhigh y flujo multiagente | Trabajo de días con presupuesto holgado |
| `/lf:handoff` | Escribe `handoff.md` / `to-do.md` para retomar otro día | Al 75–80 % de contexto, o al cerrar el día |
| `/lf:triage`, `/lf:s`, `/lf:m`, `/lf:l` | Forzar el flujo de trabajo | Cuando la clasificación no está clara |

`ultrathink` y `ultracode` no son sinónimos: `ultrathink` gasta más en un turno y nada más; `ultracode` sube el coste de **toda** la sesión y multiplica agentes. Ante la duda, `ultrathink`.

## La trampa de la caché

La caché de prompts está atada al modelo. Cambiar de Opus a Sonnet a mitad de sesión invalida lo acumulado, y hay que volver a pagarlo.

- **Barato (recomendado) para tarea L:** sesión Opus → plan en `.planning/ARCHITECTURE.md` → `/lf:handoff` → `/clear` → sesión Sonnet → ejecutar el plan. Dos sesiones limpias, ninguna pierde caché.
- **Cómodo (más caro):** `/lf:opusplan` hace las dos fases en la misma sesión. Paga una invalidación de caché a cambio de no cambiar de modelo a mano. Para una L de varios días, no compensa.
- **Caro e innecesario:** mantener la sesión viva días, encadenando tareas distintas, usando `/compact` cada vez que se llena. Además, las sesiones largas dejan de aprovechar la caché.

## `autoCompactWindow`

`"autoCompactWindow": 200000` en `settings.lf.json` no es la estrategia: es la red de seguridad. El umbral operativo es el 75–80 % de la ventana, donde se escribe el handoff y se abre sesión nueva. Si la compactación automática salta, significa que la sesión ya se pasó de larga y la sesión limpia era la respuesta.

`/compact` solo como último recurso, y siempre con instrucciones explícitas de qué conservar (decisiones, enfoques descartados, ficheros modificados). La compactación automática no sabe qué partes importan; sin instrucciones las pierde.
