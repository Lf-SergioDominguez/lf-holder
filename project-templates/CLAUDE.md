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

## Zonas delicadas

- Ficheros/módulos que no se tocan sin preguntar (facturación, auth, migraciones legadas…).
- Integraciones externas (APIs, colas) y cómo se simulan en local.

## Verificación mínima antes de entregar

1. `php -l` en ficheros PHP tocados / `vue-tsc --noEmit` en frontend.
2. Test del módulo afectado (comando exacto arriba).
3. `bin/console lint:twig templates/` si se tocaron plantillas.
