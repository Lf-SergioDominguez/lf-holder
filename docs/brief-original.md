# Brief original: por qué nace lefebvriano-holder

Síntesis del planteamiento inicial (septiembre de 2026) que dio origen al proyecto. Recoge el objetivo, el diagnóstico de partida, las herramientas que se evaluaron y las conclusiones que marcaron el diseño. Las decisiones definitivas, con sus motivos, están en [DECISIONS.md](DECISIONS.md).

## Objetivo

Optimizar el arnés de Claude Code de un desarrollador web (PHP/Symfony, algo de WordPress y Phalcon, Node.js, Astro, React, Vue, MySQL) con dos metas simultáneas:

1. **Reducir el gasto de tokens al menos un 60 %.**
2. **Mejorar la calidad y la fluidez del flujo de trabajo** con plugins, skills y hooks, tanto en el agente principal como en los subagentes que genere.

## Diagnóstico de partida

- El flujo se apoyaba en **GSD (Get Shit Done)**, que hace muy bien el trabajo en proyectos grandes pero resulta **tedioso y rígido** para el día a día: obliga a pasar por todas las fases (planificación, ejecución, revisión) incluso en tareas de diez minutos.
- La mayor fuente de cansancio no era revisar el código generado, sino **pulsar «sí» continuamente** a preguntas innecesarias y prompts de permiso.
- El trabajo real se reparte en **muchas tareas pequeñas y medianas** y, de vez en cuando, alguna grande.

## Qué se pedía

- Para tareas **pequeñas y medianas**: que Claude no interrumpa prácticamente nada hasta entregar el código para revisión, y a partir de ahí iterar sobre la petición.
- Para tareas **grandes**: una fase inicial que deje la arquitectura atada, solo las preguntas indispensables durante el desarrollo, y ejecución autónoma por hitos.
- Un **orquestador de triaje**: comentar cada trabajo con él antes de empezar, que clasifique la tarea y proponga qué skills, plugins y flujo usar para resolverla de la forma más eficiente.
- Al menos una herramienta contrastada para **reducir tokens**, una sugerencia para **UI/diseño** y otra para el **flujo de programación**, todo orientado a desarrollo web.

## Herramientas evaluadas

| Herramienta | Qué aporta | Conclusión inicial |
|---|---|---|
| [RTK](https://github.com/rtk-ai/rtk) (Rust Token Killer) | Hook `PreToolUse` que reescribe comandos Bash para comprimir su salida (git, tests, builds, listados) | Candidato principal para reducir tokens; hay que **medir** el ahorro real en factura, no solo en bytes de salida |
| [agent-skills](https://github.com/addyosmani/agent-skills) (Addy Osmani) | Skills de disciplina de ingeniería (spec → plan → build → test → review → ship, debugging sistemático, simplificación) | Aporta calidad, no estructura; útil como capa de buenas prácticas, con cuidado de no cargar 25 descripciones siempre activas |
| GSD | Orquestación anti *context rot* con subagentes de contexto limpio y estado en `.planning/` | Excelente para tareas L/XL; excesivo para el resto. Recortar, no eliminar |
| [Smith](https://github.com/ATTCKDigital/smith) | Gobernanza *contract-first* (esquemas y contratos antes de codificar) | Idea valiosa para tareas medianas y grandes; el paquete completo es pesado y poco maduro. Tomar la idea, no la herramienta |

Otras propuestas iniciales (hooks caseros de compresión por AST, repositorios con pocas estrellas) se descartaron por falta de contraste.

## Conclusiones que guiaron el diseño

1. **Arquitectura por capas**: reducción de tokens en la CLI (RTK y filtros propios), contratos antes de codificar (M/L), ejecución aislada por hitos (GSD solo en L) y reglas de calidad (skills de disciplina).
2. **Cero fricción en tareas S/M**: permisos configurados para no preguntar (modo de aceptación de ediciones, sandbox de Bash, allowlist del stack) y prohibición explícita de las operaciones destructivas.
3. **Triaje S/M/L como comportamiento por defecto**, no como comando que haya que recordar: pequeña (≤2–3 ficheros, sin cambio de esquema ni API) → ejecutar y entregar; mediana (endpoint, componente, entidad) → contrato de un minuto y ejecución autónoma; grande (módulo, migración global) → preguntas de arquitectura indispensables, plan validado y subagentes por hitos.
4. **Medir antes y después** para poder demostrar el objetivo del 60 %.

Estas conclusiones se contrastaron después con investigación propia (documentación oficial de Claude Code, benchmarks independientes de RTK, análisis de cada repositorio) y con una medición real del consumo. El resultado es el arnés que describe el [README](../README.md).
