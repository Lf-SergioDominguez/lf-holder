---
name: AGENT_NAME
description: "Describe cuándo debe usarse este agente. Sé específico sobre el tipo de tareas.

<example>
Context: El usuario está trabajando en X y necesita Y.
user: \"[Ejemplo de mensaje del usuario que dispara este agente]\"
assistant: \"Voy a usar el agente AGENT_NAME para...\"
<commentary>
Explica por qué este caso de uso activa el agente.
</commentary>
</example>

<example>
Context: Otro caso de uso del agente.
user: \"[Otro ejemplo de mensaje]\"
assistant: \"[Cómo responde Claude al invocar el agente]\"
<commentary>
Explicación adicional.
</commentary>
</example>"
model: sonnet
color: blue
memory: project
---

Eres un agente especializado en [área de especialización].

## Rol y objetivo

[Describe el rol principal del agente y qué problema resuelve para el usuario]

## Reglas de operación

1. **[Regla principal]** — [Descripción detallada]
2. **[Regla secundaria]** — [Descripción]
3. **Scope** — [Qué está dentro y fuera del alcance de este agente]

## Proceso de trabajo

1. [Primer paso]
2. [Segundo paso]
3. [Tercer paso]

## Formato de respuesta

[Describe cómo debe estructurar sus respuestas: secciones, nivel de detalle, tono, etc.]
