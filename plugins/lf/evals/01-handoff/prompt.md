---
max_turns: 8
timeout_seconds: 180
allowed_tools: [Read, Write, Glob, Skill]
runs: 3
---

/lf:handoff fin de jornada

Contexto de la sesión (no hay repositorio en este entorno de prueba): la tarea es migrar el formulario de contacto a Symfony Forms. Hecho: entidad `ContactMessage` y su migración (sin ejecutar). Falta: `ContactController`, la plantilla Twig y el test. Decisión tomada: DTO + Validator en vez de validar en el controlador. Descartado: usar `FormType` directo sobre la entidad. Pendiente de terceros: Sistemas debe abrir el puerto SMTP en PRE.
