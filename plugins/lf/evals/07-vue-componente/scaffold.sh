#!/usr/bin/env bash
# Monta un mini repo git sintético (Vue 3 + TS, sin dependencias instaladas) con un componente de referencia.
# Escribe solo en el directorio de trabajo del eval (cwd) y no borra nada.
set -euo pipefail
[ -z "$(ls -A .)" ] || { echo "scaffold: el directorio de trabajo no está vacío" >&2; exit 1; }
mkdir -p src/components
cat > package.json <<'JSON'
{
  "name": "fixture-ui",
  "private": true,
  "type": "module",
  "scripts": { "typecheck": "vue-tsc --noEmit" }
}
JSON
cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noImplicitAny": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
JSON
cat > src/components/BaseButton.vue <<'VUE'
<script setup lang="ts">
const props = defineProps<{
  label: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

function onClick(event: MouseEvent): void {
  if (!props.disabled) emit('click', event)
}
</script>

<template>
  <button type="button" :disabled="disabled" :aria-label="label" @click="onClick">
    {{ label }}
  </button>
</template>
VUE
git init -q
git add -A
git -c user.name=eval -c user.email=eval@example.invalid commit -q -m "fixture"
