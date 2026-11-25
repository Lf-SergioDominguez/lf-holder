---
name: web
description: Perfil del equipo Web: PHP/Symfony, WordPress, Node, Astro, React, Vue y MySQL; CI/CD en GitHub Actions y quality gates.
---

# Perfil web

## Stack

- Backend: PHP/Symfony (Doctrine, Twig), WordPress (plugins y temas), Node.
- Frontend: Astro, React, Vue 3 con TypeScript.
- Datos: MySQL; migraciones reversibles, BD reales en solo lectura.
- Skills de stack: `lf:symfony`, `lf:wordpress`, `lf:frontend-astro-vue-react`, `lf:mysql-doctrine`.

## Forma de trabajar

- Cada cambio nace de un ticket de Jira (obligatorio) y llega a producción en 8 pasos, guiados por un asistente de terminal del equipo (Git y despliegues): rama → desarrollo con Claude y este arnés → commit guiado → push (nunca desde `main`) → PR con revisión de Claude → merge con auditoría → deploy a PRE → deploy a PRO.
- Rama por tipo (`feature`, `bugfix`, `hotfix`, `infra`, `integration`) desde `main` actualizado; Conventional Commits y tests junto al código.
- Merge con auditoría: si la revisión de Claude está en curso o halla errores críticos, el asistente no deja mergear y el cambio vuelve al desarrollo. Al mergear versiona y deja Jira al día. El merge clásico y la web de GitHub aún no bloquean, y GitHub no exige PR para llegar a `main`: tenderemos a exigirlo (ruleset) con 1 aprobación humana (2 en zonas críticas).
- No se pisa `main` ni se borra. Cada repo lleva su `CLAUDE.md` con los estándares del equipo.

## CI/CD y deploy

- Hoy: un merge en una rama de despliegue (`deploy-pre`, `deploy-pro` o `deploy-<web>-pre|pro`) lanza su GitHub Action, que llama a un repo central de despliegues, donde vive el YAML y la lógica de cada portal: acceso a Google Cloud sin contraseñas → monta la web → migraciones → tests (solo en los portales que ya los tienen) → imagen Docker a Artifact Registry → redespliegue en Kubernetes → aviso al equipo (entorno, OK/KO, autor, log). Un portal nuevo se da de alta añadiendo su workflow ahí.
- PRE: `main` o una rama temporal que el asistente monta sobre `main` limpio. PRO: siempre `main`, con doble confirmación; después marca los tickets como desplegados.
- Tendencia: tests en cada PR y antes de construir la imagen (si fallan, no se despliega) → imagen etiquetada con su versión/SHA, inmutable, que pasa por PRE y PRO cambiando solo la configuración → aprobación para PRO y vuelta atrás.
- El deploy debe fallar si el portal no arranca: `kubectl rollout status --timeout` tras `rollout restart`. El `|| true` del restart evita que el primer despliegue de un portal nuevo salga como fallido; se conserva.
- Secretos: hoy se escriben en `.env.local` antes del build y quedan en la imagen; el objetivo es sacarlos de la imagen. El arnés no despliega.

## Gates

| Gate | PHP/Symfony | WordPress | JS/TS | Bloquea |
|---|---|---|---|---|
| Formato | PHP-CS-Fixer | PHPCS + WPCS | Prettier, ESLint, Stylelint | Sí |
| Estático | PHPStan ≥6 | PHPStan + stubs WP | `tsc --noEmit`, `vue-tsc`, `astro check` | Sí (primero avisa) |
| Tests | PHPUnit | PHPUnit (suite WP) | Vitest o Jest | Sí |
| Cobertura del cambio | 80 % de líneas modificadas | igual | igual | Aviso, luego sí |
| BD | `doctrine:schema:validate`; migración reversible | esquema versionado | — | Sí |
| SAST y SCA | Semgrep, `composer audit` | Semgrep, WPScan | CodeQL, `npm audit` | Críticos y altos |
| Secretos | secret scanning con push protection | igual | igual | Sí |
| E2E y a11y | Playwright + axe (WCAG 2.2 AA) | igual | igual | Sí, en staging |

En local, el arnés aplica los de formato, estático y tests antes de entregar; la migración se genera con `make:migration` y no se ejecuta desde el arnés.

Fuente máquina de los gates locales (la lee el hook `Stop`; la tabla de arriba es la versión humana):

```yaml gates
gates:
  code: ["src/**/*.php", "assets/**/*.{ts,tsx,vue,js}", "src/**/*.{ts,tsx,vue,astro,js}"]
  test: ["tests/**", "**/*.{test,spec}.{ts,tsx,js}", "**/*Test.php"]
  ignore: ["**/*.md", "migrations/**", "config/**", "docs/**"]
  commands:
    symfony:
      format: "vendor/bin/php-cs-fixer fix --dry-run --diff"
      static: "vendor/bin/phpstan analyse"
      test: "vendor/bin/phpunit"
    node:
      format: "npx prettier --check . && npx eslint ."
      # subconjunto local: solo `tsc --noEmit`; `vue-tsc --noEmit` y `astro check` quedan para CI (ver tabla)
      static: "npx tsc --noEmit"
      test: "npx vitest run"
```
