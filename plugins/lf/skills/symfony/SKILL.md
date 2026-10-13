---
name: symfony
description: Convenciones y comandos para proyectos Symfony 6/7 (PHP 8): console, Doctrine, Twig, tests, ejecución local o en Docker.
paths: "**/composer.json, src/**/*.php, config/**/*.yaml, config/**/*.php, templates/**/*.twig, migrations/**/*.php, tests/**/*.php"
---

# Symfony — guía operativa

## Cómo se ejecuta este proyecto

Antes del primer comando, comprueba en el `CLAUDE.md` del proyecto (o en `docker-compose.yml`) si PHP corre en local o en contenedor. Usa **siempre el mismo prefijo** en toda la tarea:

- Local: `php bin/console …`, `vendor/bin/phpunit …`
- Docker: `docker compose exec <servicio-php> php bin/console …` (habitualmente `php`, `app` o `web`)
  Salidas largas (tests, `cache:clear`, `composer install`) → agente `lf:verbose-runner`.

## Inspección barata (antes de leer ficheros enteros)

- `bin/console debug:router --format=txt | grep <ruta>` — rutas y controladores.
- `bin/console debug:container <Servicio> --show-arguments` — servicios y wiring.
- `bin/console debug:config <bundle>` / `debug:autowiring <Tipo>`.
- `bin/console doctrine:mapping:info` y `doctrine:schema:validate` — entidades y drift del esquema.
- `bin/console doctrine:migrations:status` — migraciones pendientes.

## Convenciones de código

- PHP 8.1+: `readonly`, enums, atributos (`#[Route]`, `#[ORM\Entity]`, `#[Assert\NotBlank]`), tipos estrictos, `declare(strict_types=1)`.
- Controladores finos: validan entrada (DTO + `ValidatorInterface` o `#[MapRequestPayload]`), delegan a servicios, devuelven `Response`/`JsonResponse`. Nada de lógica de negocio ni consultas en el controlador.
- Servicios autowired por constructor; interfaces cuando hay más de una implementación. Config en `config/services.yaml` solo para casos no autowireables.
- Doctrine: repositorios para consultas (`createQueryBuilder`), `fetch: 'EXTRA_LAZY'`/`JOIN` explícito para evitar N+1; nunca `flush()` en bucles.
- Twig: `{{ var|e }}` por defecto (autoescape activo); `|raw` solo con contenido saneado. Extensiones para lógica de presentación, no `{% if %}` anidados.
- Formularios: `FormType` + `handleRequest`; CSRF activo.
- Eventos: `#[AsEventListener]`; mensajería con Messenger para tareas asíncronas.

## Migraciones

- Genera con `bin/console make:migration` (o `doctrine:migrations:diff`), revisa el SQL generado, añade índices explícitos.
- **Nunca ejecutes `doctrine:migrations:migrate` sin que el usuario lo pida.** Deja el comando listo en la entrega.
- Migraciones reversibles: implementa `down()`; renombrados de columnas en dos pasos (expand/contract) si hay datos en producción.

## Tests

- `vendor/bin/phpunit --filter <Clase|método>` o `vendor/bin/phpunit tests/<ruta>`; nunca la suite completa tras cada edición.
- `WebTestCase` para controladores, `KernelTestCase` para servicios; fixtures mínimas en el propio test.
- `vendor/bin/phpstan analyse src --level=<nivel del proyecto>` antes de entregar si el proyecto lo usa.

## Dónde suele romperse

- Cache de contenedor tras tocar `services.yaml` o atributos: `bin/console cache:clear` (env correcto: `--env=test` para tests).
- Autowiring ambiguo → alias en `services.yaml` o `#[Autowire(service: …)]`.
- Entidades sin `#[ORM\Index]` en columnas filtradas; `EXPLAIN` la consulta antes de optimizar a ciegas.
- `.env.local` contiene secretos: no lo leas ni lo copies; usa `.env` (sin secretos) para conocer variables.

## WordPress dentro de Symfony / Phalcon

Si el proyecto es Phalcon (`app/config/`, `Phalcon\Mvc`), aplica los mismos principios (controlador fino, servicio, modelo); comandos vía `php app/cli.php` o el runner del proyecto.
