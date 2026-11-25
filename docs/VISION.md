# Visión del arnés

Qué es **Lefebvriano holder**, en qué punto está y hacia dónde va. Lo revisa el mantenedor en cada versión menor.

## Qué es

**Lefebvriano holder** es un arnés de Claude Code: un plugin (`lf`) más una configuración global que se aplica igual en el CLI y en la extensión de VS Code. Su objetivo es que Claude resuelva tareas pequeñas y medianas **sin interrupciones**, gastando **la mitad o menos de tokens** y **sin bajar la calidad**.

- **Eficiencia medida**: ~57 % menos coste por petición y contexto fijo de ~21K tokens (antes 41–47K). Se consigue con sesiones cortas, handoff entre sesiones, una statusline que avisa antes del autocompact y hooks que recortan salidas largas.
- **Triaje S/M/L**: cada tarea sigue un flujo proporcional a su tamaño. Opus planifica lo grande, Sonnet ejecuta y Haiku atiende a los subagentes.
- **Permisos sin fricción y seguros**: el hook `bash-gate` deja pasar lo rutinario, pregunta lo sensible (commit, push, migraciones, `rm`) y bloquea lo destructivo.
- **Calidad integrada**:
  - Subagentes de revisión (`lf:reviewer`) y de ejecución ruidosa (`lf:verbose-runner`).
  - Tests como parte del flujo: PHPUnit, y Vitest para Vite, Astro, Vue y React.
  - Skills de seguridad (OWASP), SEO/WPO y accesibilidad.
- **Encaje con CI/CD**: los tests que genera el arnés son los que ejecuta el pipeline de cada proyecto. Si fallan, no se despliega y queda registrado. El gate de deploy vive en el CI del proyecto; el arnés produce lo que ese gate comprueba.

## Dónde está hoy (autoevaluación: 7/10)

**Bien:**
- El ahorro está medido (`scripts/measure.sh`, ADR 0007, 0008 y 0016), no supuesto.
- Los permisos se aplican con un hook que clasifica cada comando, no con buenas intenciones.
- La disciplina de sesión ataca la causa real del gasto: el 97–98 % eran relecturas de contexto.

**Falta para el 9:**
- La medición sale de un solo desarrollador. Falta una línea base de equipo.
- Los tests son una norma del flujo, pero ningún hook comprueba que existan.
- Los quality gates del CI y lo que exige el arnés en local no están alineados.
- Las evals existen (`plugins/lf/evals`), pero no se ejecutan con regularidad. Si una skill se degrada, nadie se entera.

### Matices a la descripción habitual

| Se suele decir | Lo exacto |
|---|---|
| «Elimina decir sí a todo» | Elimina los permisos rutinarios. Commit, push, migraciones y `rm` siguen preguntando, y lo destructivo está bloqueado. |
| «Según el triaje usa un modelo u otro» | Opus planifica las tareas L, Sonnet ejecuta y Haiku se usa en subagentes. El triaje decide sobre todo el *flujo*. |
| «Crea tests sin ser consciente» | Claude añade un test cuando la lógica no es trivial, como norma. En 1.1.0 pasa a comprobarse (ver hoja de ruta). |
| «En el deploy se corren los tests» | Eso lo hace el CI del proyecto. El arnés produce los tests que ese CI ejecuta. |

## Declaración de intenciones

El arnés tiene que mejorar con el uso: cada versión, más eficiente, más fiable y más cerca de los quality gates del equipo. Seguimos cinco pautas para agentes que se automejoran.

1. **Principios antes que reglas.** CLAUDE.md, skills y perfiles dan dirección aplicable a casos nuevos (triaje, código mínimo, una verificación por cambio), no un caso por regla. Todo lo que se añade cuesta tokens a todo el equipo: si no cabe en un principio, probablemente sobra.
2. **Feedback donde ya se trabaja.** Telemetría opt-in, agregada y anónima, enviada a GitHub (donde ya está el equipo), sin servidores ni bases de datos nuevas. Cada usuario puede ver exactamente qué se envía antes de enviarlo.
3. **Benchmarks con tareas reales.** Las evals se construyen con tareas reales del equipo (anonimizadas), no con ejemplos de juguete. Las lanza el mantenedor, para no cargar gasto a quien usa el arnés.
4. **Medir lo que importa.** Calidad (evals aprobadas, gates en verde a la primera), coste (tokens y $ por petición, contexto fijo) y fiabilidad (sesiones que llegan al autocompact, errores de hooks, bloqueos de permisos), por versión.
5. **Proponer, medir y mejorar.** Cada cambio entra con una hipótesis y una métrica. Se mide con evals y telemetría y se queda solo si mejora. La decisión se registra en `docs/decisions/`.

Además:
- **Calidad por defecto, no por voluntad**: lo que Claude entrega debe pasar los quality gates del equipo sin que nadie lo pida.
- **Proporcionalidad**: el esfuerzo, el modelo y la ceremonia se ajustan al tamaño de la tarea.
- **Cero fricción, cero riesgo**: menos interrupciones sin ceder en datos, seguridad y producción.
- **Genérico y adaptable**: el núcleo sirve a cualquier equipo de tecnología. Cada equipo concreta su stack, su flujo de deploy y sus gates en un *perfil*, no en un fork.
- **Paridad**: las versiones privada y pública tienen las mismas capacidades. Solo cambian los datos de empresa.

## Hoja de ruta 1.1.0

Cada hito se hace en su propia sesión.

| Hito | Qué | Pauta |
|---|---|---|
| **H1 — `/lf:setup` guiado + perfiles** | Asistente con preguntas: perfil de equipo, telemetría sí/no, opcionales y Windows. Las elecciones se guardan en `~/.claude/lf/config.json`. El primer perfil es `profiles/web.md` (stack, ramas, flujo de deploy y gates que bloquean); hay además un perfil `generic`. Otros equipos añaden el suyo por PR. | 1 |
| **H2 — Telemetría opt-in** | `/lf:telemetry status\|preview\|send\|off`. El informe es agregado (semanal o mensual, a elegir en el setup; ADR 0023), sin sessionId, rutas, proyectos ni texto, y se valida contra una lista blanca de claves. Se envía como issue a `lf-holder-metrics`; una GitHub Action lo guarda en `lefebvriano-holder[-public]/<versión>/<timestamp>/report.json`. | 2, 4 |
| **H3 — Quality gates en local** (hecho, 1.0.4; ADR 0025) | Hook `Stop`: si el cambio toca lógica y ningún test, pide el test (o una justificación) una vez. Los comandos y las rutas salen del bloque `gates` del perfil. Plantilla de pipeline `project-templates/quality-gates.yml` para que local y CI exijan lo mismo. | 1, 4 |
| **H4 — Evals reales** | Casos sacados de tareas reales: un bug Symfony con test, un componente Vue, un N+1, un gate que debe bloquear. `scripts/evals.sh` guarda un resumen, lo compara con la ejecución anterior y marca regresiones. Lo lanza el mantenedor. | 3, 4 |
| **H5 — Bucle de automejora** | `/lf:improve`, solo para el mantenedor. Cruza la telemetría con las evals, propone 1–3 cambios con hipótesis y métrica, se miden y se registran como ADR. | 5 |
| **H6 — MCP opcionales en el setup** | `/lf:setup` pregunta qué MCP montar (ninguno por defecto): Playwright (QA), GitHub, Atlassian (Jira) y Figma. Cada uno se instala con alcance de usuario y tiene una ficha en `plugins/lf/docs/MCP.md`: para qué sirve, coste de contexto, permisos (`allow`/`ask`) y cuándo es mejor la CLI (`gh` antes que el MCP de GitHub). Atlassian y Figma existen como conectores de claude.ai: se documenta esa vía antes que un servidor local. | 1, 4 |
| **H7 — Auditoría de quality gates** | Skill `lf:quality-gates`: comprueba el repo o portal actual contra los gates del equipo y lista qué cumple, qué falta y el paso para corregirlo, para dejarlo a punto rápido. El checklist vive en el perfil (`profiles/web.md`, sacado del informe Quality Gates del equipo web) y se actualiza con cada versión del informe; comparte fuente con H3. | 1, 4 |

### Privacidad de la telemetría

- Desactivada por defecto. Se activa en `/lf:setup` con un texto claro de qué se envía y para qué: medir y mejorar el arnés.
- Solo datos agregados del periodo: versión, variante, perfil, sesiones, turnos, coste por petición, contexto fijo, % de autocompact, recuentos de `ask`/`deny` y errores de hooks.
- Nunca: prompts, código, rutas, nombres de proyecto, identificadores de sesión ni datos personales.
- `preview` muestra el JSON exacto antes de enviarlo. Si aparece cualquier clave fuera del esquema, el envío se aborta.
- La issue de GitHub la abre la cuenta de quien envía, así que el usuario de GitHub es visible aunque el contenido sea anónimo. Así se explica en el setup.
