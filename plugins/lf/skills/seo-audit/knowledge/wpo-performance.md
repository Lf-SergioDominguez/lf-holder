# WPO — Web Performance Optimization

## Render-Blocking Resources

Los recursos render-blocking impiden que el navegador renderice contenido hasta que se hayan descargado y procesado.

### CSS render-blocking

Todo `<link rel="stylesheet">` en el `<head>` bloquea el renderizado por defecto.

```html
<!-- ❌ Bloquea renderizado -->
<link rel="stylesheet" href="styles.css" />

<!-- ✓ CSS no crítico: cargar de forma asíncrona -->
<link
  rel="preload"
  href="non-critical.css"
  as="style"
  onload="this.onload=null;this.rel='stylesheet'"
/>
<noscript><link rel="stylesheet" href="non-critical.css" /></noscript>

<!-- ✓ CSS crítico: inline en <head> -->
<style>
  /* Solo estilos above-the-fold */
  body {
    margin: 0;
    font-family: system-ui;
  }
  .hero {
    min-height: 60vh;
    background: #f0f0f0;
  }
</style>
```

### JavaScript render-blocking

Los scripts síncronos en `<head>` bloquean el parsing y renderizado.

```html
<!-- ❌ Bloquea el parser -->
<head>
  <script src="main.js"></script>
</head>

<!-- ✓ defer: descarga en paralelo, ejecuta tras parsear HTML -->
<script src="main.js" defer></script>

<!-- ✓ async: descarga en paralelo, ejecuta al terminar descarga -->
<script src="analytics.js" async></script>

<!-- defer vs async:
  - defer: mantiene orden, ejecuta al DOMContentLoaded
  - async: no mantiene orden, ejecuta inmediatamente al cargar
  - defer es preferido para scripts de aplicación
  - async es para scripts independientes (analytics, ads) -->
```

---

## Optimización de Imágenes

### Formatos modernos

| Formato  | Ventajas                       | Soporte          |
| -------- | ------------------------------ | ---------------- |
| **WebP** | 25-35% más ligero que JPEG/PNG | >96% navegadores |
| **AVIF** | 40-50% más ligero que JPEG     | >90% navegadores |
| JPEG     | Universal                      | 100%             |
| PNG      | Transparencia sin pérdida      | 100%             |

```html
<!-- ✓ Usar <picture> para servir formato moderno con fallback -->
<picture>
  <source srcset="image.avif" type="image/avif" />
  <source srcset="image.webp" type="image/webp" />
  <img src="image.jpg" alt="Descripción" width="800" height="600" />
</picture>

<!-- ✓ srcset para imágenes responsive -->
<img
  src="image-800.webp"
  srcset="image-400.webp 400w, image-800.webp 800w, image-1200.webp 1200w"
  sizes="(max-width: 600px) 100vw,
         (max-width: 1200px) 50vw,
         33vw"
  alt="Imagen responsive"
  width="800"
  height="600"
/>

<!-- ✓ Lazy loading para imágenes below-the-fold -->
<img
  src="below-fold.webp"
  loading="lazy"
  alt="Imagen secundaria"
  width="600"
  height="400"
/>

<!-- ✓ NUNCA lazy loading en imagen LCP (above-the-fold) -->
<img
  src="hero.webp"
  loading="eager"
  fetchpriority="high"
  alt="Hero image"
  width="1200"
  height="630"
/>
```

### Reglas de imágenes

- Siempre definir `width` y `height` para evitar CLS
- LCP image: `fetchpriority="high"` + `loading="eager"` + preload
- Above-the-fold: `loading="eager"` (por defecto, no hace falta indicarlo)
- Below-the-fold: `loading="lazy"`
- Comprimir antes de servir: objetivo < 200KB para imágenes de contenido

---

## Fuentes Web (Font Loading)

### font-display

```css
@font-face {
  font-family: "MiFuente";
  src: url("/fonts/mifuente.woff2") format("woff2");
  font-display: swap; /* Ver tabla abajo */
}
```

| Valor      | Bloqueo  | Swap     | Cuándo usar                              |
| ---------- | -------- | -------- | ---------------------------------------- |
| `auto`     | Variable | Variable | Comportamiento del navegador             |
| `block`    | 2-3s     | Infinito | Fuente crítica para identidad            |
| `swap`     | 0ms      | Infinito | Texto visible siempre, fuente importante |
| `fallback` | 100ms    | 3s       | Balance entre rendimiento y estética     |
| `optional` | 100ms    | Ninguno  | Máximo rendimiento, fuente prescindible  |

**Recomendación:** Usar `font-display: swap` para fuentes de marca, `font-display: optional` para cuerpo de texto.

### Precargar fuentes críticas

```html
<!-- Precargar fuente crítica (siempre con crossorigin) -->
<link
  rel="preload"
  href="/fonts/font.woff2"
  as="font"
  type="font/woff2"
  crossorigin
/>

<!-- Preconnect para fuentes de terceros (Google Fonts) -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

### Buenas prácticas de fuentes

- **Solo usar WOFF2**: mejor compresión, soporte >96%
- **Subconjuntos (subsetting)**: incluir solo caracteres necesarios
- **Unicode-range**: cargar solo el subconjunto necesario por idioma
- **Sistema de fuentes como fallback**: `font-family: system-ui, sans-serif`
- **Reducir layout shift de fuentes**: usar `size-adjust` para ajustar fallback
- Reemplazar icon fonts con SVGs inline

```css
/* Ajustar fallback para reducir CLS al cargar fuente */
@font-face {
  font-family: "FallbackAjustado";
  src: local("Arial");
  size-adjust: 105%;
  ascent-override: 90%;
}
```

---

## Resource Hints

```html
<!-- preload: recurso crítico para la página ACTUAL, alta prioridad -->
<!-- El navegador LO DESCARGA OBLIGATORIAMENTE -->
<link rel="preload" as="script" href="critical.js" />
<link rel="preload" as="style" href="critical.css" />
<link rel="preload" as="font" href="font.woff2" type="font/woff2" crossorigin />
<link rel="preload" as="image" href="hero.webp" fetchpriority="high" />
<link rel="preload" as="fetch" href="/api/data.json" crossorigin />

<!-- preconnect: establecer conexión anticipada con origen de terceros -->
<!-- DNS + TCP + TLS handshake -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://cdn.ejemplo.com" crossorigin />

<!-- dns-prefetch: solo resolver DNS (más ligero que preconnect) -->
<!-- Usar cuando no se está seguro de que el recurso será necesario -->
<link rel="dns-prefetch" href="https://analytics.ejemplo.com" />

<!-- prefetch: recurso para la SIGUIENTE navegación (baja prioridad) -->
<link rel="prefetch" href="/siguiente-pagina.js" />
<link rel="prefetch" as="document" href="/siguiente-pagina/" />
```

| Hint           | Cuándo usar                                                | Prioridad          |
| -------------- | ---------------------------------------------------------- | ------------------ |
| `preload`      | Recursos críticos para la página actual descubiertos tarde | Alta (obligatorio) |
| `preconnect`   | Dominios de terceros cuyo contenido se usará pronto        | Media              |
| `dns-prefetch` | Dominios de terceros probables (fallback de preconnect)    | Baja               |
| `prefetch`     | Recursos para la siguiente página probable                 | Muy baja           |

**Advertencia**: Usar `preload` con moderación. Los recursos precargados no usados generan un warning en consola tras 3 segundos y penalizan bandwidth.

---

## Critical CSS

El Critical CSS es el CSS mínimo necesario para renderizar el contenido above-the-fold sin bloqueo.

```html
<head>
  <!-- 1. Critical CSS inline (< 14KB idealmente) -->
  <style>
    /* Solo estilos necesarios para el primer viewport */
    body {
      margin: 0;
      font-family: system-ui;
    }
    header {
      background: #fff;
      padding: 1rem;
    }
    .hero {
      min-height: 60vh;
    }
    h1 {
      font-size: 2rem;
    }
  </style>

  <!-- 2. CSS completo cargado de forma no bloqueante -->
  <link
    rel="preload"
    href="styles.css"
    as="style"
    onload="this.onload=null;this.rel='stylesheet'"
  />
  <noscript><link rel="stylesheet" href="styles.css" /></noscript>
</head>
```

**Herramientas para generar Critical CSS**: Critical (npm), Penthouse, Critters (webpack/vite plugin).

---

## JavaScript: Optimización

```html
<!-- defer: para scripts de aplicación (mantiene orden de ejecución) -->
<script src="app.js" defer></script>

<!-- async: para scripts independientes sin dependencias -->
<script src="analytics.js" async></script>

<!-- type="module": implícitamente defer, soporta ESModules -->
<script type="module" src="app.mjs"></script>
```

### Code Splitting y Tree Shaking

- **Code Splitting**: dividir el bundle en chunks cargados bajo demanda
- **Tree Shaking**: eliminar código no usado durante el build
- **Dynamic import**: cargar módulos solo cuando se necesitan

```js
// Dynamic import para code splitting
const module = await import("./heavy-module.js");

// Con bundlers (Vite, Webpack): chunks automáticos por ruta
const LazyComponent = lazy(() => import("./LazyComponent"));
```

### Reglas JavaScript

- Eliminar polyfills innecesarios (usar `<script type="module">` vs legacy)
- Evitar librerías pesadas cuando hay alternativas nativas (ej: date-fns vs moment.js)
- Minificar en producción
- Objetivo: < 300KB de JS total en red (comprimido)

---

## Caching: Cache-Control Headers

```
# Recursos estáticos con hash en el nombre (inmutables)
Cache-Control: public, max-age=31536000, immutable

# HTML: revalidar siempre
Cache-Control: no-cache

# Recursos sin hash: revalidar con ETag
Cache-Control: public, max-age=86400, must-revalidate

# API responses: no cachear
Cache-Control: no-store
```

| Recurso         | Estrategia                | max-age           |
| --------------- | ------------------------- | ----------------- |
| HTML            | `no-cache` (revalidar)    | 0                 |
| CSS/JS con hash | `immutable`               | 1 año (31536000s) |
| Imágenes        | `public, must-revalidate` | 1 semana–1 mes    |
| Fuentes         | `public, immutable`       | 1 año             |
| API JSON        | `no-store` o corto        | 0–60s             |

**ETags**: Header de validación. El navegador envía `If-None-Match`, el servidor responde 304 si no cambió.

---

## Compresión: Gzip y Brotli

| Algoritmo  | Compresión          | Soporte          | Recomendación         |
| ---------- | ------------------- | ---------------- | --------------------- |
| **Brotli** | ~20% mejor que Gzip | >96% navegadores | Preferido para textos |
| **Gzip**   | Estándar            | 100%             | Fallback universal    |

```nginx
# Nginx: activar compresión Brotli y Gzip
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/json
             application/javascript text/xml application/xml
             image/svg+xml;

gzip on;
gzip_vary on;
gzip_types text/plain text/css application/json
           application/javascript text/xml application/xml;
```

- Comprimir siempre: HTML, CSS, JS, JSON, XML, SVG, fuentes (TTF/OTF)
- No comprimir: imágenes (ya comprimidas), vídeos, archivos binarios
- Objetivo: HTML comprimido < 14KB para primer roundtrip TCP
