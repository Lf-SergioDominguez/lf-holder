---
name: mysql-doctrine
description: Esquemas, migraciones reversibles, índices y consultas eficientes en MySQL con Doctrine ORM; solo lectura contra bases de datos reales.
---

# MySQL + Doctrine — guía operativa

## Regla de seguridad

Contra cualquier base de datos real (local o remota) solo ejecuto **lecturas**: `SELECT`, `SHOW`, `DESCRIBE`, `EXPLAIN`. Nada de `DROP`, `TRUNCATE`, `DELETE`, `ALTER`, `UPDATE` ni `doctrine:schema:update --force`, `doctrine:fixtures:load`, `doctrine:database:drop`. Los cambios de esquema van **siempre** en una migración que el usuario ejecuta.

## Inspección barata

- `bin/console doctrine:schema:validate` — mapping vs. base de datos.
- `bin/console doctrine:migrations:status` / `doctrine:migrations:list`.
- `mysql -e 'SHOW CREATE TABLE <tabla>\G'`, `SHOW INDEX FROM <tabla>`, `EXPLAIN <consulta>` (usa `lf:verbose-runner` si la salida es larga).
- `bin/console doctrine:query:sql 'SELECT …'` para comprobaciones rápidas (solo lectura).

## Diseño de esquema

- `utf8mb4` + `utf8mb4_unicode_ci`; `InnoDB`; claves primarias `BIGINT UNSIGNED AUTO_INCREMENT` o UUID binario (`BINARY(16)`) según convención del proyecto: no mezcles.
- Tipos estrictos: `DECIMAL(10,2)` para dinero, `DATETIME` (UTC) o `TIMESTAMP` según el proyecto, `TINYINT(1)` para booleanos, `ENUM` evitado (usa tabla de referencia o `VARCHAR` + enum PHP).
- Índices: uno por cada columna usada en `WHERE`/`JOIN`/`ORDER BY` frecuentes; compuestos en el orden de selectividad; `UNIQUE` para invariantes de negocio. Nada de índices sobre `TEXT` sin prefijo.
- Claves foráneas con `ON DELETE` explícito (`RESTRICT` por defecto; `CASCADE` solo en composición real).

## Migraciones (Doctrine Migrations)

- Una migración = un cambio coherente. Revisa el SQL generado por `make:migration`; añade `$this->addSql('CREATE INDEX …')` cuando el diff no lo incluya.
- Implementa `down()` siempre. Cambios destructivos en dos fases (expand → migrar datos → contract) si hay datos en producción.
- Datos de referencia (seeds) en migraciones separadas de las de esquema, idempotentes (`INSERT … ON DUPLICATE KEY UPDATE`).
- `postUp()` para backfills grandes por lotes; nunca un `UPDATE` masivo sin `LIMIT` en una transacción única.

## Consultas con Doctrine

- N+1: `JOIN FETCH`/`addSelect` en el `QueryBuilder`, o `fetch: 'EAGER'` puntual; verifica con el profiler o contando consultas en el test.
- Paginación con `setFirstResult/setMaxResults` + `Paginator` si hay `JOIN` a colecciones.
- Hidratación parcial (`select('partial …')`, arrays o DTO con `NEW`) para listados; entidades completas solo para escribir.
- Lotes: `flush()` cada N elementos y `clear()`; nunca `flush()` dentro de un bucle por elemento.
- Consultas complejas: DQL o SQL nativo con `ResultSetMapping`; nunca concatenar parámetros (usa `setParameter`).

## Entrega

Incluye siempre: migración generada, SQL relevante revisado, y el comando exacto que el usuario debe lanzar (`bin/console doctrine:migrations:migrate --no-interaction`), sin ejecutarlo.
