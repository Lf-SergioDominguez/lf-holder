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

En local, el arnés aplica los de formato, estático y tests antes de entregar; la migración se genera con `make:migration` y no se ejecuta desde el arnés. Para saber si un repo cumple la tabla entera (y qué le falta), `/lf:quality-gates [carpeta]`: solo informa.

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
  # Checklist de `/lf:quality-gates`: una entrada por gate × stack de la tabla de arriba. El hook Stop la ignora.
  # Obligatorios: gate, stack (symfony|wordpress|node), fix y al menos un detector (files, composer, npm, ci, github).
  checks:
    cs-fixer-symfony:
      gate: "Formato"
      stack: "symfony"
      blocks: "Sí"
      files: [".php-cs-fixer.dist.php", ".php-cs-fixer.php"]
      composer: ["friendsofphp/php-cs-fixer"]
      ci: ["php-cs-fixer"]
      fix: "composer require --dev friendsofphp/php-cs-fixer, crea .php-cs-fixer.dist.php y añade el paso Formato de project-templates/quality-gates.yml del arnés"
    phpstan-symfony:
      gate: "Estático"
      stack: "symfony"
      blocks: "Sí (primero avisa)"
      files: ["phpstan.neon", "phpstan.neon.dist"]
      composer: ["phpstan/phpstan"]
      ci: ["phpstan"]
      fix: "composer require --dev phpstan/phpstan, crea phpstan.neon.dist (nivel 6 o más) y añade el paso Estático de project-templates/quality-gates.yml del arnés"
    phpunit-symfony:
      gate: "Tests"
      stack: "symfony"
      blocks: "Sí"
      files: ["phpunit.xml", "phpunit.xml.dist"]
      composer: ["phpunit/phpunit", "symfony/phpunit-bridge"]
      ci: ["phpunit"]
      fix: "composer require --dev phpunit/phpunit, crea phpunit.xml.dist y añade el paso Tests de project-templates/quality-gates.yml del arnés"
    coverage-symfony:
      gate: "Cobertura del cambio"
      stack: "symfony"
      blocks: "Aviso, luego sí"
      ci: ["coverage"]
      fix: "genera cobertura en CI (phpunit --coverage-clover) y exige 80 % de las líneas modificadas"
    schema-symfony:
      gate: "BD"
      stack: "symfony"
      blocks: "Sí"
      files: ["migrations/*.php"]
      ci: ["schema:validate"]
      fix: "versiona el esquema con make:migration (reversible) y añade php bin/console doctrine:schema:validate a CI"
    semgrep-symfony:
      gate: "SAST y SCA"
      stack: "symfony"
      blocks: "Críticos y altos"
      ci: ["semgrep"]
      fix: "añade Semgrep a CI y que falle con hallazgos críticos y altos"
    composer-audit-symfony:
      gate: "SAST y SCA"
      stack: "symfony"
      blocks: "Críticos y altos"
      ci: ["composer audit"]
      fix: "añade composer audit a CI"
    secrets-symfony:
      gate: "Secretos"
      stack: "symfony"
      blocks: "Sí"
      github: "secret-scanning"
      fix: "activa secret scanning con push protection en Settings > Code security del repo"
    playwright-symfony:
      gate: "E2E y a11y"
      stack: "symfony"
      blocks: "Sí, en staging"
      files: ["playwright.config.*"]
      npm: ["@playwright/test"]
      ci: ["playwright"]
      fix: "npm init playwright@latest y lanza los E2E contra staging"
    axe-symfony:
      gate: "E2E y a11y"
      stack: "symfony"
      blocks: "Sí, en staging"
      npm: ["@axe-core/playwright"]
      fix: "npm i -D @axe-core/playwright y comprueba WCAG 2.2 AA en los E2E"
    phpcs-wordpress:
      gate: "Formato"
      stack: "wordpress"
      blocks: "Sí"
      files: ["phpcs.xml", "phpcs.xml.dist", ".phpcs.xml", ".phpcs.xml.dist"]
      composer: ["squizlabs/php_codesniffer", "wp-coding-standards/wpcs"]
      ci: ["phpcs"]
      fix: "composer require --dev wp-coding-standards/wpcs, crea phpcs.xml.dist con el ruleset WordPress y añádelo a CI"
    phpstan-wordpress:
      gate: "Estático"
      stack: "wordpress"
      blocks: "Sí (primero avisa)"
      files: ["phpstan.neon", "phpstan.neon.dist"]
      composer: ["phpstan/phpstan", "szepeviktor/phpstan-wordpress", "php-stubs/wordpress-stubs"]
      ci: ["phpstan"]
      fix: "composer require --dev phpstan/phpstan szepeviktor/phpstan-wordpress, crea phpstan.neon.dist con los stubs de WP y añádelo a CI"
    phpunit-wordpress:
      gate: "Tests"
      stack: "wordpress"
      blocks: "Sí"
      files: ["phpunit.xml", "phpunit.xml.dist"]
      composer: ["phpunit/phpunit", "yoast/phpunit-polyfills"]
      ci: ["phpunit"]
      fix: "monta la suite de tests de WP (wp scaffold plugin-tests), con phpunit.xml.dist, y añádela a CI"
    coverage-wordpress:
      gate: "Cobertura del cambio"
      stack: "wordpress"
      blocks: "Aviso, luego sí"
      ci: ["coverage"]
      fix: "genera cobertura en CI (phpunit --coverage-clover) y exige 80 % de las líneas modificadas"
    schema-wordpress:
      gate: "BD"
      stack: "wordpress"
      blocks: "Sí"
      files: ["db/**", "migrations/**", "sql/**"]
      fix: "versiona el esquema (db/ o migrations/) en vez de cambiarlo a mano en cada entorno"
    semgrep-wordpress:
      gate: "SAST y SCA"
      stack: "wordpress"
      blocks: "Críticos y altos"
      ci: ["semgrep"]
      fix: "añade Semgrep a CI y que falle con hallazgos críticos y altos"
    wpscan-wordpress:
      gate: "SAST y SCA"
      stack: "wordpress"
      blocks: "Críticos y altos"
      ci: ["wpscan"]
      fix: "añade WPScan a CI para plugins, temas y núcleo"
    secrets-wordpress:
      gate: "Secretos"
      stack: "wordpress"
      blocks: "Sí"
      github: "secret-scanning"
      fix: "activa secret scanning con push protection en Settings > Code security del repo"
    playwright-wordpress:
      gate: "E2E y a11y"
      stack: "wordpress"
      blocks: "Sí, en staging"
      files: ["playwright.config.*"]
      npm: ["@playwright/test"]
      ci: ["playwright"]
      fix: "npm init playwright@latest y lanza los E2E contra staging"
    axe-wordpress:
      gate: "E2E y a11y"
      stack: "wordpress"
      blocks: "Sí, en staging"
      npm: ["@axe-core/playwright"]
      fix: "npm i -D @axe-core/playwright y comprueba WCAG 2.2 AA en los E2E"
    prettier-node:
      gate: "Formato"
      stack: "node"
      blocks: "Sí"
      files: [".prettierrc*", "prettier.config.*"]
      npm: ["prettier"]
      ci: ["prettier"]
      fix: "npm i -D prettier, crea .prettierrc y añade el paso Formato de project-templates/quality-gates.yml del arnés"
    eslint-node:
      gate: "Formato"
      stack: "node"
      blocks: "Sí"
      files: ["eslint.config.*", ".eslintrc*"]
      npm: ["eslint"]
      ci: ["eslint"]
      fix: "npm i -D eslint, crea eslint.config.js y añade el paso Formato de project-templates/quality-gates.yml del arnés"
    stylelint-node:
      gate: "Formato"
      stack: "node"
      blocks: "Sí"
      files: ["stylelint.config.*", ".stylelintrc*"]
      npm: ["stylelint"]
      ci: ["stylelint"]
      fix: "npm i -D stylelint stylelint-config-standard, crea stylelint.config.js y añade npx stylelint a CI"
    typecheck-node:
      gate: "Estático"
      stack: "node"
      blocks: "Sí (primero avisa)"
      files: ["tsconfig.json"]
      npm: ["typescript", "vue-tsc", "@astrojs/check"]
      ci: ["tsc", "vue-tsc", "astro check"]
      fix: "npm i -D typescript (vue-tsc o @astrojs/check según el framework), crea tsconfig.json y añade el paso Estático de project-templates/quality-gates.yml del arnés"
    tests-node:
      gate: "Tests"
      stack: "node"
      blocks: "Sí"
      files: ["vitest.config.*", "jest.config.*"]
      npm: ["vitest", "jest"]
      ci: ["vitest", "jest"]
      fix: "npm i -D vitest y añade el paso Tests de project-templates/quality-gates.yml del arnés"
    coverage-node:
      gate: "Cobertura del cambio"
      stack: "node"
      blocks: "Aviso, luego sí"
      ci: ["coverage"]
      fix: "ejecuta los tests con --coverage en CI y exige 80 % de las líneas modificadas"
    codeql-node:
      gate: "SAST y SCA"
      stack: "node"
      blocks: "Críticos y altos"
      ci: ["codeql"]
      fix: "activa CodeQL (Settings > Code security > Code scanning) o añade un workflow codeql-analysis.yml"
    npm-audit-node:
      gate: "SAST y SCA"
      stack: "node"
      blocks: "Críticos y altos"
      ci: ["npm audit"]
      fix: "añade npm audit --audit-level=high a CI"
    secrets-node:
      gate: "Secretos"
      stack: "node"
      blocks: "Sí"
      github: "secret-scanning"
      fix: "activa secret scanning con push protection en Settings > Code security del repo"
    playwright-node:
      gate: "E2E y a11y"
      stack: "node"
      blocks: "Sí, en staging"
      files: ["playwright.config.*"]
      npm: ["@playwright/test"]
      ci: ["playwright"]
      fix: "npm init playwright@latest y lanza los E2E contra staging"
    axe-node:
      gate: "E2E y a11y"
      stack: "node"
      blocks: "Sí, en staging"
      npm: ["@axe-core/playwright"]
      fix: "npm i -D @axe-core/playwright y comprueba WCAG 2.2 AA en los E2E"
```
