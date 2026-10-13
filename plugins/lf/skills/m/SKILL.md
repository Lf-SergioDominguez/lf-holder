---
name: m
description: Fuerza el flujo M (tarea mediana) — contrato de un minuto, implementación autónoma por capas y revisión final.
disable-model-invocation: true
argument-hint: "[tarea]"
effort: high
---

Aplica el **flujo M** de las reglas globales a: **$ARGUMENTS**

Recordatorio del flujo M:

1. **Contrato** en ≤15 líneas: entidades y campos, endpoints o props/emits, migración sí/no, ficheros que tocarás. Decisiones con impacto real → `Asumo: X` y continúa (no esperes respuesta).
2. **Implementa por capas**: dato (entidad/migración/esquema) → servicio → controlador/API → vista/componente. Verifica cada capa con el comando más barato; salidas largas vía `lf:verbose-runner`.
3. **Revisión final** con `lf:reviewer` (solo lectura). Corrige los hallazgos de severidad alta antes de entregar; los medios/bajos, lístalos.
4. **Entrega**: resumen, asunciones tomadas, ficheros, cómo probarlo. Cierra con `Tarea cerrada — recomiendo /clear antes de la siguiente`.

Sin commit salvo petición explícita. Una única pregunta al usuario solo si dos lecturas del contrato llevan a implementaciones incompatibles.
