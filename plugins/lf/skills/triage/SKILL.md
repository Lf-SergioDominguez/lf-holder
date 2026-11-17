---
name: triage
description: Clasifica una tarea (S/M/L) y espera tu OK antes de tocar nada.
disable-model-invocation: true
argument-hint: "[descripción de la tarea]"
effort: medium
allowed-tools: Read Grep Glob Bash(git status*) Bash(git log*) Bash(ls *) Bash(rg *)
---

Tarea a triar: **$ARGUMENTS**

Clasifica con la heurística de `~/.claude/CLAUDE.md` tras ≤5 lecturas (Grep/Glob primero). No edites nada hasta recibir un OK. Responde en ≤8 líneas:

```
Triaje: S|M|L — <motivo>
Ficheros previstos: <lista corta>
Contrato (M/L): <entidades/endpoints/props/migración>
Hecho cuando: <comprobación ejecutable>
Riesgos: <1–2 líneas o "ninguno relevante">
¿Adelante con flujo X? ("ok", o "S"/"M"/"L" para forzar otro)
```

Tras el OK, ejecuta el flujo elegido (L → skill `lf:l`).
