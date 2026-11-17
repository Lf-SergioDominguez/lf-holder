# Errores comunes y checklist diaria

Los fallos que más caro salen al equipo, y la rutina diaria que los evita. No es un sermón: cada punto de abajo se corresponde con una decisión concreta del arnés.

## Los seis errores que más caro salen

### 1. Configuración por defecto

Sin subagentes, sin skills, y todo con Opus, sin preparar nada. Opus para un typo y para una migración por igual. El resultado: una sesión tres veces más cara de lo necesario y sin ninguno de los filtros que ahorran contexto.

**Qué hace el arnés:** modelo Sonnet + esfuerzo `medium` por defecto, Haiku fijado como modelo de subagente, skills de stack que solo se cargan al tocar sus ficheros, hooks que filtran la salida ruidosa.

### 2. Una sesión por proyecto, reutilizada días o semanas

Reutilizar la sesión es lo que dispara la compactación automática, y la compactación automática es exactamente lo que pierde los enfoques que ya fallaron. Además, la caché deja de aprovechar cuando el contexto es tan grande que se relee entero cada turno.

**Qué hace el arnés:** `/clear` al cerrar cada tarea, `/lf:handoff` al 75–80 % de contexto, y la regla de no encadenar tareas no relacionadas en la misma sesión.

### 3. Retomar sesiones antiguas tras pausas largas

Retomar una sesión de hace tres días pierde la caché (el TTL no aguanta) y arrastra contexto que ya no te sirve. Se paga entrada completa por un historial que nadie va a leer.

**Qué hace el arnés:** el handoff es la primera instrucción de la sesión nueva. Sesión nueva, no sesión resucitada.

### 4. Leer salidas enormes

Logs completos, `cat` de ficheros grandes, suite entera tras cada edición, listados de `vendor/` o `node_modules/`. Es la vía más directa para llenar el contexto con cosas que nadie va a volver a mirar.

**Qué hace el arnés:** `lf:verbose-runner` (Haiku) para lo ruidoso, hook `trim-output` (recorta lo ruidoso y avisa con `[lf: N líneas omitidas…]`, la salida completa queda en `$TMPDIR`), y reglas `deny` de lectura sobre logs, `vendor/`, `node_modules/`, `dist/`, `.git/`.

### 5. Paralelo sin control

Agentes en paralelo sin decisiones binarias, bucles autónomos sin límite, suites de CI redundantes en paralelo. Cuando dos agentes escriben en el mismo árbol, el resultado es un diff que nadie entiende.

**Qué hace el arnés:** ejecutores en serie, un hito a la vez; subagentes en paralelo solo cuando son de lectura; agent teams solo para tareas cortas y cerrados al terminar.

### 6. CI sin filtros

Ejecutar todo para probar un cambio de tres líneas. Es lento y caro, y además entrena al modelo para relanzar la suite completa en cada iteración.

**Qué hace el arnés:** un cambio, una verificación, con el comando más barato que lo pruebe (`--filter`, `php -l`, `tsc --noEmit`, `vue-tsc`).

## Dos trampas del ecosistema

- **Agent teams por defecto.** Según estimaciones del equipo salen en torno a **7× más caros** en tokens que una sesión normal; no lo hemos medido en este repo, pero el motivo estructural no depende de la cifra: cada miembro mantiene su propio contexto. Además, casos reales han pasado de horas de ventana de trabajo a 30 minutos. Un subagente normal ya te da la aislación de contexto que necesitas por una fracción del coste.
- **Plugins y proxies que «reducen tokens»** (RTK, que el arnés retiró). Muchos hacen el efecto contrario, porque comprimen lo que no era el cuello de botella y añaden una capa de traducción. **Mide antes de darlo por bueno**, antes y después. Sin medición, es una creencia.

## Checklist diaria

Antes de empezar:

- [ ] Sesión nueva, no arrastrada de ayer. Si había trabajo a medias, he leído `handoff.md` o `to-do.md` primero.
- [ ] Modelo y esfuerzo elegidos antes de la primera petición.
- [ ] Petición con ficheros concretos, resultado esperado y criterio de aceptación.

Durante:

- [ ] Un cambio, una verificación, con el comando más barato.
- [ ] Búsquedas, tests y logs van a subagentes (`lf:verbose-runner`, `Explore`), no a la conversación principal.
- [ ] Nada de agent teams salvo tarea corta, y cerrados al terminar.
- [ ] MCP solo los que esta sesión va a usar.
- [ ] Nada de basura en el repo: logs y temporales a `${TMPDIR:-/tmp}`.

Al cerrar:

- [ ] `/clear` antes de la siguiente tarea, aunque no me quede contexto.
- [ ] Contexto por encima del 75–80 %: `/lf:handoff` y sesión nueva, no `/compact`.
- [ ] Reviso `/usage` si la sesión ha sido larga, para ver el coste real.
