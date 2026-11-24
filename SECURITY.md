# Política de seguridad

## Versiones soportadas

Solo la última versión menor recibe correcciones de seguridad. La versión vigente está en `.claude-plugin/marketplace.json`.

| Versión | Soportada |
| ------- | --------- |
| 1.0.x   | Sí        |
| < 1.0   | No        |

## Cómo reportar una vulnerabilidad

**No abras un issue, una discusión ni una PR pública con los detalles.**

Usa el reporte privado de GitHub: pestaña **Security → Report a vulnerability** (o directamente [este enlace](https://github.com/Lf-SergioDominguez/lf-holder/security/advisories/new)). Incluye:

- Versión del plugin `lf` y de Claude Code (`claude --version`), sistema operativo y si usas sandbox.
- Qué ocurre y qué debería ocurrir.
- Pasos mínimos para reproducirlo (comando, prompt o fichero de ejemplo, **sin secretos**).
- Impacto que ves (qué podría hacer un atacante o qué se podría perder).

Plazos orientativos: acuse de recibo en 5 días laborables y valoración inicial en 10. Es un proyecto mantenido por una persona; si el reporte se confirma, la corrección sale en una versión de parche, se publica un aviso de seguridad y se te acredita si lo deseas.

## Qué cuenta como vulnerabilidad

- El hook `bash-gate` deja pasar como `allow` un comando que debería ser `ask` o `deny` (ver `plugins/lf/docs/PERMISOS.md` y `tests/gate-cases.tsv`).
- La configuración del arnés (`plugins/lf/home/settings*.json`, `excludedCommands`, `allowWrite`) permite salir del sandbox o escribir donde no debe.
- Inyección de comandos en hooks o scripts (`plugins/lf/hooks/`, `plugins/lf/scripts/install.sh`, `merge-settings.sh`) a partir de rutas, nombres de rama, JSON de entrada o contenido del repo.
- Fuga de secretos (`.env`, credenciales, tokens) hacia transcripts, logs, `handoff.md`, memoria o salidas recortadas.
- El instalador o `/lf:setup` sobrescribe o borra configuración del usuario fuera de lo documentado.
- Contenido de un repo (prompt injection) que, por culpa de una regla o hook del arnés, logra acciones que los permisos deberían haber frenado.

## Fuera de alcance

- Vulnerabilidades de Claude Code, del modelo o de la API: repórtalas a Anthropic según su política de divulgación responsable.
- Plugins y herramientas de terceros que el arnés instala o recomienda (modern-web-guidance, taste-skill): repórtalas a sus mantenedores. Sí nos interesa si el arnés los configura de forma insegura.
- Comportamientos que requieren que el propio usuario desactive las protecciones (`LF_GATE=off`, `--no-sandbox`, `bypassPermissions`).
