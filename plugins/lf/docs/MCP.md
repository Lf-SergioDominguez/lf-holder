# MCP opcionales

Fuente única de `/lf:mcp`. Todos con alcance `user`, sin versión fija ni tokens literales en comandos o ficheros. Claude ejecuta el `Comando` con aviso de permiso; si lo deniegas, ejecútalo tú con `! …`.
Cada herramienta MCP pide permiso por defecto. Mide el coste real con `/context`; Claude Code carga las definiciones bajo demanda (tool search). Deshacer: `claude mcp remove <n> -s user` (y antes `claude mcp logout <n>` si el MCP usa login OAuth: Atlassian, Figma).

## Playwright

**Para qué**: automatizar y probar un navegador (navegar, rellenar, capturar).
**Vía**: servidor local por `npx`; sin cuenta.
**Requisitos**: Node 20+ (`node -v`).
**Comando**: `claude mcp add --scope user playwright -- npx @playwright/mcp@latest`. En Windows nativo usa `cmd /c npx` en lugar de `npx`. Flags opcionales del servidor (van en `args`): `--headless` (por defecto abre ventana), `--browser=chrome|firefox|webkit|msedge`, `--isolated` (perfil en memoria).
**Auth**: ninguna.
**Verificar**: `claude mcp get playwright` en estado conectado; las herramientas aparecen al reiniciar la sesión. Prueba: «abre example.com y dime el título».
**Contexto**: alto, expone muchas herramientas.
**Permisos**: pide permiso por herramienta. Nunca habilites `browser_run_code_unsafe`: equivale a ejecución remota de código.
**CLI mejor cuando**: hay suites ya escritas; usa `npx playwright test`.

## GitHub

**Para qué**: issues, PR y API de GitHub.
**Vía**: servidor remoto `https://api.githubcopilot.com/mcp`; GitHub Enterprise Server no está soportado (GHE Cloud con residencia de datos, `*.ghe.com`, usa su propia URL). `gh` primero: el MCP solo si hace falta API sin CLI.
**Requisitos**: `gh auth status` correcto (si no, `gh auth login`).
**Comando**: `claude mcp add-json --scope user github '{"type":"http","url":"https://api.githubcopilot.com/mcp","headersHelper":"echo \"{\\\"Authorization\\\": \\\"Bearer $(gh auth token)\\\"}\""}'`. Si `add-json` da «Invalid input» (Claude Code ≤2.1.0 o Windows), consulta `docs/installation-guides/install-claude.md` del repo github/github-mcp-server.
**Auth**: `headersHelper` ejecuta `gh auth token` en cada conexión; el token no se guarda en ningún fichero. `--read-only` y los toolsets solo existen en el servidor local.
**Verificar**: `claude mcp get github` en estado conectado. Prueba: «lista mis issues asignadas».
**Contexto**: medio, conjunto amplio de herramientas.
**Permisos**: pide permiso por herramienta; la escritura (comentar, crear, fusionar) conviene aprobarla caso a caso.
**CLI mejor cuando**: casi siempre: `gh pr`, `gh issue` y `gh api` cubren el caso sin coste de contexto.

## Atlassian

**Para qué**: leer y actualizar Jira y Confluence.
**Vía**: servidor remoto v2 (`https://mcp.atlassian.com/v2/mcp`); el endpoint SSE `/v1/sse` ya no funciona desde 2026-06-30 y las conexiones v1 pasan solas a las herramientas v2 el 2027-03-01. Si tu cuenta ya tiene el conector claude.ai de Atlassian, no lo dupliques.
**Requisitos**: cuenta Atlassian Cloud con acceso al sitio; Teamwork Graph/Rovo consume créditos.
**Comando**: `claude mcp add --scope user --transport http atlassian https://mcp.atlassian.com/v2/mcp`.
**Auth**: OAuth 2.1: `/mcp` → atlassian → Authenticate (sin navegador en WSL: `claude mcp login atlassian --no-browser`).
**Verificar**: `claude mcp get atlassian` en estado conectado. Prueba: «busca mis issues abiertas en Jira».
**Contexto**: medio/alto, varía con las herramientas expuestas.
**Permisos**: pide permiso por herramienta; revisa las de escritura y las destructivas antes de aprobarlas.
**CLI mejor cuando**: basta una consulta puntual por API REST con credenciales ya configuradas fuera del arnés.

## Figma

**Para qué**: leer diseños (contexto, capturas) y llevarlos a código.
**Vía**: servidor remoto `https://mcp.figma.com/mcp` (Gov: `mcp.figma-gov.com`). Alternativa: plugin `figma@claude-plugins-official` (trae skills, más contexto). Si ya tienes el conector claude.ai de Figma, no lo dupliques.
**Requisitos**: cuenta Figma; escribir en el canvas exige plan de pago o asiento Full; algunas organizaciones exigen aprobación de un admin.
**Comando**: `claude mcp add --scope user --transport http figma https://mcp.figma.com/mcp`.
**Auth**: OAuth: `/mcp` → figma → Authenticate (sin navegador en WSL: `claude mcp login figma --no-browser`).
**Verificar**: `claude mcp get figma` en estado conectado. Prueba: «dame el contexto de diseño de <URL de Figma>».
**Contexto**: medio/alto, las respuestas de diseño son voluminosas.
**Permisos**: pide permiso por herramienta; las de escritura en el fichero de Figma, caso a caso.
**CLI mejor cuando**: los tokens y assets ya están exportados al repo y basta leerlos del disco.
