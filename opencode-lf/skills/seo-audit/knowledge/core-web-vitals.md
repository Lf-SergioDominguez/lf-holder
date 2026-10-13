# Core Web Vitals

## Métricas principales (Core Web Vitals)

Las tres métricas Core Web Vitals son obligatorias para la evaluación de experiencia de usuario en Google Search. Se miden en el **percentil 75 de todas las cargas de página**, segmentadas por móvil y escritorio.

---

## LCP — Largest Contentful Paint (Rendimiento de carga)

Mide el tiempo hasta que el elemento de contenido más grande visible en el viewport termina de renderizarse.

| Umbral              | Valor          |
| ------------------- | -------------- |
| **Bueno**           | ≤ 2.5 segundos |
| **Necesita mejora** | 2.5s – 4.0s    |
| **Malo**            | > 4.0 segundos |

### Elementos candidatos a LCP

- `<img>` (incluyendo primer frame de GIFs animados)
- `<image>` dentro de `<svg>`
- `<video>` (imagen poster o primer frame, lo que sea anterior)
- Elementos con imagen de fondo vía `url()` en CSS
- Elementos de bloque con nodos de texto o texto inline

**No cuentan:** Elementos con `opacity: 0`, elementos que cubren todo el viewport (fondos), imágenes placeholder de baja entropía, `<svg>` completos.

### Subcomponentes del LCP (targets de optimización)

| Subcomponente                       | Target ideal |
| ----------------------------------- | ------------ |
| TTFB                                | ~40% del LCP |
| Retraso de carga del recurso        | < 10%        |
| Duración de carga del recurso       | ~40%         |
| Retraso de renderizado del elemento | < 10%        |

### Técnicas de optimización LCP

1. **Eliminar retraso de carga del recurso**
   - El recurso LCP debe estar en el HTML inicial (no en CSS/JS)
   - Usar `fetchpriority="high"` en la imagen LCP
   - **NUNCA usar lazy loading en la imagen LCP**
   - Hospedar recursos críticos en el mismo origen

2. **Eliminar retraso de renderizado del elemento**
   - Reducir o inline CSS render-blocking
   - Diferir JavaScript no crítico
   - Implementar Server-Side Rendering (SSR)
   - Romper tareas largas en el hilo principal

3. **Reducir duración de carga del recurso**
   - Usar formatos modernos: WebP, AVIF
   - Servir imágenes desde CDN
   - Implementar políticas de caché eficientes

4. **Reducir TTFB**
   - Minimizar redirecciones
   - Usar edge caching en CDN

```html
<!-- Preload imagen LCP con prioridad alta -->
<link
  rel="preload"
  fetchpriority="high"
  as="image"
  href="/hero.webp"
  type="image/webp"
/>

<!-- O directamente en el img -->
<img fetchpriority="high" src="/hero.webp" alt="Hero image" />

<!-- Carousel slides no visibles: baja prioridad -->
<img fetchpriority="low" src="/slide-3.webp" alt="Slide 3" />

<!-- NUNCA: lazy loading en imagen LCP -->
<!-- <img loading="lazy" src="/hero.webp"> ❌ -->
```

---

## INP — Interaction to Next Paint (Interactividad)

Mide la latencia de todas las interacciones del usuario con la página durante su ciclo de vida. Reemplazó a FID en marzo de 2024.

| Umbral              | Valor         |
| ------------------- | ------------- |
| **Bueno**           | ≤ 200 ms      |
| **Necesita mejora** | 201ms – 500ms |
| **Malo**            | > 500 ms      |

### Tipos de interacciones que mide INP

- Clics de ratón
- Taps en pantalla táctil
- Pulsaciones de teclado

### Tres componentes del INP

1. **Input Delay**: Tiempo antes de que los event handlers empiecen a ejecutarse
2. **Processing Duration**: Tiempo de ejecución de todos los event handlers
3. **Presentation Delay**: Tiempo hasta que se renderiza el siguiente frame

### Técnicas de optimización INP

- Evitar tareas largas (Long Tasks > 50ms) en el hilo principal
- Usar `scheduler.yield()` o `setTimeout` para ceder el hilo
- Mover trabajo pesado a Web Workers
- Reducir el JavaScript de terceros que bloquea el hilo
- Evitar forced reflows (leer layout props después de escribir DOM)
- Priorizar las interacciones críticas durante la carga de página

---

## CLS — Cumulative Layout Shift (Estabilidad visual)

Mide la suma total de todos los desplazamientos de layout inesperados durante la vida de la página.

| Umbral              | Valor      |
| ------------------- | ---------- |
| **Bueno**           | ≤ 0.1      |
| **Necesita mejora** | 0.1 – 0.25 |
| **Malo**            | > 0.25     |

### Causas comunes de CLS

- Imágenes o vídeos sin dimensiones definidas (`width`/`height`)
- Fuentes que renderizan más grandes/pequeñas que el fallback
- Anuncios o widgets de terceros que cambian de tamaño
- Contenido cargado asincrónamente insertado antes del contenido existente
- Animaciones que modifican propiedades de layout

### Técnicas de optimización CLS

```css
/* Usar transform en lugar de propiedades de layout */
/* ❌ Malo: modifica layout */
.element {
  top: 10px;
  height: 200px;
}

/* ✓ Bueno: usa transform */
.element {
  transform: translateY(10px) scaleY(1.1);
}
```

```html
<!-- Reservar espacio para imágenes: SIEMPRE definir width y height -->
<img src="hero.jpg" width="1200" height="630" alt="Hero" />

<!-- CSS para imágenes responsive manteniendo aspect-ratio -->
<style>
  img {
    max-width: 100%;
    height: auto;
  }
</style>

<!-- Reservar espacio para anuncios con min-height -->
<div style="min-height: 250px;">
  <!-- Ad slot -->
</div>
```

- Los layout shifts causados por interacciones del usuario dentro de **500ms** son aceptables
- Usar `aspect-ratio` CSS para reservar espacio antes de que cargue el contenido

---

## FCP — First Contentful Paint (Métrica de diagnóstico)

Mide cuando cualquier parte del contenido de la página (texto, imagen, SVG, canvas no blanco) se renderiza por primera vez.

| Umbral              | Valor          |
| ------------------- | -------------- |
| **Bueno**           | ≤ 1.8 segundos |
| **Necesita mejora** | 1.8s – 3.0s    |
| **Malo**            | > 3.0 segundos |

### Factores que afectan al FCP

- TTFB alto
- CSS render-blocking
- Redirecciones múltiples
- Fuentes web bloqueantes

### Optimizaciones clave

- Eliminar recursos render-blocking
- Minificar y eliminar CSS/JS no usado
- Hacer `preconnect` a orígenes requeridos
- Evitar cadenas largas de peticiones críticas

---

## TTFB — Time to First Byte (Métrica de diagnóstico)

Mide el tiempo desde que el navegador solicita una página hasta que recibe el primer byte de la respuesta del servidor.

| Umbral              | Valor          |
| ------------------- | -------------- |
| **Bueno**           | ≤ 0.8 segundos |
| **Necesita mejora** | 0.8s – 1.8s    |
| **Malo**            | > 1.8 segundos |

### Componentes del TTFB

1. Tiempo de redirección
2. Arranque del Service Worker (si aplica)
3. Lookup DNS
4. Negociación de conexión y TLS
5. Transmisión de petición hasta recibir primer byte

### Optimizaciones

- Edge caching en CDN para HTML
- Reducir tiempo de procesamiento del servidor
- Minimizar cadenas de redirección
- Usar HTTP/2 o HTTP/3

---

## Herramientas de medición

| Herramienta                          | Tipo        | LCP | INP   | CLS | FCP | TTFB |
| ------------------------------------ | ----------- | --- | ----- | --- | --- | ---- |
| PageSpeed Insights                   | Campo + Lab | ✓   | ✓     | ✓   | ✓   | ✓    |
| Chrome User Experience Report (CrUX) | Campo       | ✓   | ✓     | ✓   | ✓   | ✓    |
| Google Search Console                | Campo       | ✓   | ✓     | ✓   | -   | -    |
| Chrome DevTools (Performance)        | Lab         | ✓   | -     | ✓   | ✓   | ✓    |
| Lighthouse                           | Lab         | ✓   | TBT\* | ✓   | ✓   | ✓    |
| web-vitals JS library                | Campo       | ✓   | ✓     | ✓   | ✓   | ✓    |

\*TBT (Total Blocking Time) es el proxy de lab para INP.

```js
// Medir Core Web Vitals con la librería web-vitals
import { getLCP, getINP, getCLS, getFCP, getTTFB } from "web-vitals";

getLCP(console.log);
getINP(console.log);
getCLS(console.log);
getFCP(console.log);
getTTFB(console.log);
```
