---
description: Escribe o actualiza handoff.md y to-do.md para retomar la sesión en otro día o desde otro agente.
argument-hint: "[motivo del corte]"
---

Motivo del corte: **$ARGUMENTS**

Escribe el punto de retorno de esta sesión. Es la **primera instrucción que recibe la sesión siguiente**, así que tiene que ser legible por alguien que no ha visto nada de esta conversación.

## Paso 1 — Qué fichero tocar

- `handoff.md`: el estado de la tarea. **Sobrescribe** el anterior; no lo archives con fecha ni lo acumules.
- `to-do.md`: solo si hay trabajo que sobrevive a la tarea (pendientes de otros, ideas, seguimientos). Se puede omitir.
- Ubicación: raíz del repo, junto al `CLAUDE.md` del proyecto. En la raíz de las skills del arnés, `docs/templates/`.

## Paso 2 — Recopila, sin leer en exceso

`git status --short`, `git diff --stat`, y lo que ya sabes de esta sesión. Nada de `git log` completo ni de diffs enteros: con el `--stat` y los nombres basta.

## Paso 3 — Escribe `handoff.md`

Estructura exacta, por debajo de una página:

```md
# Handoff - [proyecto/tarea]

## Estado actual

Qué está hecho, qué está a medias, qué falta. 2-4 líneas, sin relato.

## Decisiones tomadas

Decisión + por qué. Si se descartó una alternativa, decirlo.

## Bloqueos / pendientes de terceros

Qué espera respuesta de quién, o qué está bloqueado y por qué

## Próximo paso concreto

La primera acción a tomar en la siguiente sesión, sin ambigüedad.

## Solo lo que no se puede reconstruir leyendo código, git log o Jira.
```

## Paso 4 — Reglas (no negociables)

- **No dupliques lo recuperable en `git log`, código o Jira.** Si se puede deducir leyendo, no va aquí.
- **Una sola fuente de verdad:** sobrescribe, nunca acumules con fecha.
- **Próximo paso siempre concreto.** «Revisar el endpoint de pagos» no vale; `src/Controller/PaymentController.php:Pay() — falta validar el idempotency key` sí.
- **Fechas absolutas**, nunca relativas («ayer», «la semana pasada»).
- **Por debajo de una página.** Lo terminado se archiva, no se acumula.
- **Enfoques descartados también se anotan**, con una línea cada uno: es lo primero que una compactación perdería.

## Paso 5 — Cierre

Muestra el fichero escrito y termina con:

```
Handoff escrito. Ahora /clear y abre sesión nueva.
```

No hagas commit del handoff salvo que se te pida.
