---
name: frontend-astro-vue-react
description: Convenciones para Astro, Vue 3 y React con TypeScript — islas, componentes, estado, accesibilidad, verificación barata sin builds completos.
paths: "**/*.astro, **/*.vue, **/*.tsx, **/*.jsx, astro.config.*, vite.config.*, **/src/components/**, **/src/pages/**"
---

# Frontend (Astro / Vue / React) — guía operativa

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

## Comunes

- Accesibilidad mínima: elementos semánticos (`button`, `nav`, `main`), `alt` en imágenes, labels asociados, foco visible, contraste AA. Sin `div` clicables.
- Sin dependencias nuevas para lo que ya hace el stack (fechas, fetch, utilidades): pregunta con `Asumo:` antes de añadir una librería.
- Ficheros >300 líneas: propone partirlos, no los engordes.
- Nunca leas `dist/`, `node_modules/`, `.astro/` ni `.output/`.
- Diseño visual: si la tarea es crear UI nueva o rediseñar, usa además la skill `frontend-design` (plugin oficial) para las decisiones estéticas.
