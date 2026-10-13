---
name: triage
description: Clasifica una tarea (S/M/L), propone flujo, ficheros, contrato y skills, y espera tu OK antes de tocar nada.
disable-model-invocation: true
argument-hint: "[descripción de la tarea]"
effort: medium
allowed-tools: Read Grep Glob Bash(git status*) Bash(git log*) Bash(ls *) Bash(rg *)
---

Tarea a triar: **$ARGUMENTS**

Actúa como triaje de ingeniería. No edites nada hasta recibir un OK explícito.

1. **Explora lo mínimo** (≤5 lecturas, Grep/Glob primero) para estimar: ficheros afectados, capas implicadas (dato / servicio / API / vista), contratos que cambian (esquema, rutas, DTO, props/emits), y cómo se ejecuta el proyecto (local o `docker compose exec`, según su CLAUDE.md).

2. **Clasifica** con la heurística de las reglas globales:
   - **S**: ≤3 ficheros, una capa, sin contrato. Flujo directo sin preguntas; entrega para revisión.
   - **M**: 4–12 ficheros o cruza capas o cambia un contrato dentro de un módulo. Contrato de ≤15 líneas y ejecución autónoma con `lf:reviewer` al final.
   - **L**: módulo nuevo, >12 ficheros, varios contratos o decisiones de arquitectura reales. Flujo `lf:l` (entrevista ≤5 preguntas → ARCHITECTURE.md → GSD por hitos).
     Duda S/M → M. Duda M/L → plantea la pregunta que resolvería la duda.

3. **Responde en ≤12 líneas** con este formato:

```
Triaje: S|M|L — <motivo>
Ficheros previstos: <lista corta o patrón>
Contrato (solo M/L): <entidades/endpoints/props/migración>
Herramientas: <skills lf y agentes que usarás; GSD solo si L>
Modelo sugerido: <Sonnet effort high para S/M; Opus effort high/xhigh en modo Plan para L>
Riesgos: <1–2 líneas o "ninguno relevante">
Pregunta única (si la hay): <…>
¿Adelante con flujo X? (responde "ok", o "S"/"M"/"L" para forzar otro)
```

4. Tras el OK, ejecuta el flujo elegido tal como lo describen las reglas globales, sin volver a preguntar salvo en L.
