# NOMBRE-DEL-PROYECTO

<!-- Plantilla lefebvriano-holder. Máximo ~50 líneas: solo lo que NO se deduce del código.
     Las reglas de trabajo (S/M/L, economía de contexto, git) ya vienen del CLAUDE.md global. -->

## Qué es

Una frase: qué hace este proyecto y para quién. Stack principal (p. ej. Symfony 6.4 + PHP 8.2 + MySQL 8 + Vue 3).

## Cómo se ejecuta

- PHP/consola: `docker compose exec php php bin/console …` ← o `php bin/console …` si es local. **Usa siempre este prefijo.**
- Tests: `docker compose exec php vendor/bin/phpunit --filter <Clase>`
- Frontend: `npm run dev` / `npm run build` (carpeta `assets/` o `frontend/`)
- Base de datos: `docker compose exec db mysql -u app app -e '<SELECT …>'` (solo lectura)
- Levantar entorno: `docker compose up -d` (pídelo al usuario; no lo hagas por tu cuenta)

## Mapa rápido

- `src/Controller/` → `src/Service/` → `src/Repository/`; entidades en `src/Entity/`; vistas en `templates/`.
- Módulos con nombre propio: `src/<Modulo>/…` (di aquí los 2–3 que más se tocan).
- Config relevante: `config/packages/<x>.yaml`.

## Convenciones propias (solo las que difieren de lo habitual)

- Ej.: los DTO llevan sufijo `Input`/`Output`; las rutas se declaran en `config/routes/*.yaml`, no con atributos.
- Ej.: no usar `EntityManager` fuera de repositorios.

## Navegadores

- Baseline objetivo: Baseline Widely available ← cámbialo si aplica (p. ej. «Baseline 2024», «Safari 17.4+», «sin polyfills; fallback propio ≤20 líneas»). El agente lo aplica a las guías de `modern-web-guidance` para decidir fallbacks. Si el repo tiene `.mwgrc`, que es la config del CLI, ese fichero manda: mantenlos iguales o deja solo uno. Borra la sección si el proyecto no tiene frontend.

## Zonas delicadas

- Ficheros/módulos que no se tocan sin preguntar (facturación, auth, migraciones legadas…).
- Integraciones externas (APIs, colas) y cómo se simulan en local.

## Verificación mínima antes de entregar

1. `php -l` en ficheros PHP tocados / `vue-tsc --noEmit` en frontend.
2. Test del módulo afectado (comando exacto arriba).
3. `bin/console lint:twig templates/` si se tocaron plantillas.
4. CI: `.github/workflows/quality-gates.yml` (copia de `project-templates/quality-gates.yml` del arnés); mismos comandos que los gates del perfil.

## Hecho significa

- Ej.: el test del módulo pasa, `php -l` limpio y el cambio se ha probado a mano en la ruta afectada. Si algo no se ha podido comprobar, se dice.

## Patrones a evitar

- Ej.: lógica de negocio en controladores; consultas dentro de bucles Twig; `EntityManager` fuera de repositorios.

## Estilo de la casa

- Ej.: respuestas cortas, ficheros tocados y cómo probarlo; commits en inglés (Conventional Commits).
