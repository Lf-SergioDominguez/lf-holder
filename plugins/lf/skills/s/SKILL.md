---
name: s
description: Fuerza el flujo S (tarea pequeña) — implementa, verifica y entrega sin preguntas ni commit.
disable-model-invocation: true
argument-hint: "[tarea]"
effort: medium
---

Aplica el **flujo S** de las reglas globales a: **$ARGUMENTS**

Recordatorio del flujo S:

1. Localiza con Grep/Glob; lee solo el rango necesario.
2. Implementa el cambio mínimo que resuelve la tarea.
3. Verifica con el comando más barato (test con `--filter`, `php -l`, `tsc --noEmit`, `vue-tsc`); salidas largas vía `lf:verbose-runner`.
4. Entrega: resumen de 3–6 líneas, ficheros tocados, cómo probarlo. Cierra con `Tarea cerrada — recomiendo /clear antes de la siguiente`.

Sin AskUserQuestion, sin commit, sin subagentes salvo `lf:verbose-runner`. Si falta un dato, asúmelo, dilo en una línea y sigue.
