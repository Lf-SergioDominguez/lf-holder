---
name: frontend-astro-vue-react
description: Convenciones Astro, Vue 3 y React con TypeScript: islas, componentes, estado, accesibilidad, verificación.
paths: "**/*.astro, **/*.vue, **/*.tsx, **/*.jsx, astro.config.*, vite.config.*, **/src/components/**, **/src/pages/**"
---

# Frontend (Astro / Vue / React) — guía operativa

## Marca

Antes de maquetar o estilar, lee `~/.claude/lf/house-style/INDEX.md` (si no existe, no hay house style instalado: sigue el del proyecto). Tokens `--lf-*` en lugar de hex sueltos y la checklist del índice antes de entregar. Manda sobre `frontend-design` y `taste-skill`.

## Verificación barata (en este orden)

1. `npx tsc --noEmit` (React/TS) o `npx vue-tsc --noEmit` (Vue) o `npx astro check` (Astro): tipos sin compilar.
2. `npx eslint <fichero>` solo sobre los ficheros tocados.
3. Test unitario del componente: `npx vitest run <fichero>` (o `npm test -- <patrón>`).
4. `npm run build` **solo al final** de la tarea y vía `lf:verbose-runner` (la salida es enorme).
   No abras el navegador ni levantes `dev` salvo que el usuario lo pida.

## Astro

- Contenido estático por defecto; **islas** solo donde hay interactividad real: `client:load` (crítico), `client:idle`, `client:visible` (bajo el pliegue), `client:only` (sin SSR).
- Datos en el frontmatter del `.astro` (`await fetch`, colecciones `getCollection`); nada de fetch en cliente si se puede resolver en build/SSR.
- `src/pages/` = rutas; `src/layouts/` para estructura; `src/components/` para UI; `src/content/` con `content.config.ts` y esquema Zod.
- Imágenes con `<Image />` de `astro:assets`; fuentes locales o `preload`. Revisa `astro.config.*` (`output`, `integrations`, `adapter`) antes de proponer cambios de rendering.

## Vue 3

- `<script setup lang="ts">`; `defineProps` y `defineEmits` **tipados** con interfaces; `withDefaults` para valores por defecto.
- Estado local con `ref`/`reactive`/`computed`; compartido con composables (`useX()`) o Pinia. Nada de `this`, nada de Options API en código nuevo.
- `v-for` siempre con `:key` estable; `v-if` y `v-for` nunca en el mismo elemento.
- Estilos `scoped` o CSS Modules; tokens/variables globales en un único fichero.

## React

- Componentes funcionales con props tipadas (`interface Props`); sin `any`.
- Estado derivado con `useMemo` solo si hay coste medido; efectos con dependencias completas; no hacer fetch en `useEffect` si el framework (Next/Astro) ofrece carga en servidor.
- Composición sobre herencia; hooks personalizados para lógica reutilizable (`useX`).

## Web moderna: skill `modern-web-guidance` (Google)

El arnés activa por defecto el plugin `modern-web-guidance@googlechrome`, que se actualiza solo. Sus guías (más de 200, en HTML/CSS/JS sin framework y con datos de Baseline) salen del CLI `npx -y modern-web-guidance@latest`, así que siempre están al día. Úsala **por iniciativa propia**: el usuario no tiene que nombrarla ni conocer sus comandos. El CLI requiere Node.js 22 o superior. Las reglas de esta sección prevalecen sobre la descripción del plugin, que la declara obligatoria en cualquier tarea de HTML/CSS.

- **Cuándo**: al implementar o cambiar un patrón de UI o una capacidad de la plataforma, como modal, popover, tooltip, tabla responsive, formulario o validación, dark mode, container queries, anchor positioning, view transitions, animaciones de scroll, LCP/INP/CLS, imágenes, accesibilidad, saneado de HTML, CSP o passkeys. **Cuándo no**: textos, colores o espaciados sueltos; config de Vite, tsconfig o ESLint; tests; backend.
- **Cómo**: `npx -y modern-web-guidance@latest search "<2–5 palabras en inglés, sin framework>"` → `npx -y modern-web-guidance@latest retrieve "<id>[,<id>]"` (`pnpx modern-web-guidance@latest …` si el proyecto usa pnpm). Si `retrieve` guarda la salida en un fichero temporal, léelo con Read por rangos. Las guías se cargan en el contexto principal, nunca en un subagente, porque tienen que dar forma al código. Pide solo las guías que apliquen a la tarea.
- **Triaje**: no cambia la clasificación. En S cuenta como parte del paso 1, sin preguntar. En M, las guías consultadas se citan en el contrato.
- **Navegadores**: si el repo tiene `.mwgrc`, el CLI ya inyecta su objetivo en las guías, y ese objetivo manda. Si no lo tiene, usa la sección «Navegadores» del CLAUDE.md del proyecto. Si tampoco existe, aplica Baseline Widely available con los fallbacks que indique la guía, sin preguntar. Solo si el objetivo es dudoso (Electron, una exclusión de navegador, un polyfill pesado), propón añadir esa línea en la entrega.
- **Adaptación**: las guías son vanilla; adáptalas al framework sin quitar la feature moderna (`useId()` para ids y `anchor-name`, `showModal()` vía ref, guarda de `window` en SSR o en el frontmatter de Astro).
- **Modernizar código existente**: solo si el usuario pide modernizar o auditar patrones legacy en general, sin nombrar un componente. Es una tarea M o L. Ejecuta `npx -y modern-web-guidance@latest legacy-scan <ruta> --json > "${TMPDIR:-/tmp}/mwg-scan.json"` y lee el resultado con `jq`. Descarta los falsos positivos según `keepWhen`/`dropWhen` y aplica la guía de cada hallazgo. Si solo se pidió auditar, informa sin editar.
- **Entrega**: la sección `### Modern Web Guidance` que pide la skill (una viñeta por guía aplicada) va después del resumen y no cuenta para el límite de 3–6 líneas del flujo S.
- **Subcomandos prohibidos**: no ejecutes `install`, `update`, `uninstall`, `set-baseline` ni `set-allow-*`. Instalan skills o escriben `.mwgrc` en el repo. Si una guía los sugiere, díselo al usuario. Las actualizaciones las hace el marketplace.
- **Sin red o sin permiso**: si el CLI no responde, sigue sin él y dilo en la línea de «no comprobado». No inventes ids ni citas de guías.

## Comunes

- Accesibilidad mínima: elementos semánticos (`button`, `nav`, `main`), `alt` en imágenes, labels asociados, foco visible, contraste AA. Sin `div` clicables.
- Sin dependencias nuevas para lo que ya hace el stack (fechas, fetch, utilidades): pregunta con `Asumo:` antes de añadir una librería.
- Ficheros >300 líneas: propone partirlos, no los engordes.
- Nunca leas `dist/`, `node_modules/`, `.astro/` ni `.output/`.
- Diseño visual: si la tarea es crear UI nueva o rediseñar, usa además la skill `frontend-design` (plugin oficial) para las decisiones estéticas. Si el usuario tiene habilitado `taste-skill` (opcional, `/lf:setup --with-taste`), úsala en su lugar cuando pida diseño anti-slop o dirección artística; respeta siempre el sistema de diseño del proyecto si existe.
