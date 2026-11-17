# WCAG — Accesibilidad Web

## Niveles de conformidad WCAG 2.1 / 2.2

| Nivel   | Descripción                                                                                                                        | Estándar mínimo       |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **A**   | Requisitos básicos. Sin esto, el sitio es inutilizable para algunos usuarios                                                       | Obligatorio           |
| **AA**  | Estándar recomendado. Eliminan barreras principales. **Requerido legalmente** en muchos países (EN 301 549 en Europa, ADA en EEUU) | **Nivel objetivo**    |
| **AAA** | Máximo nivel. No siempre posible para todo el contenido                                                                            | Opcional/aspiracional |

El **nivel AA es el estándar de facto** para cumplimiento legal y buenas prácticas.

### Framework POUR

Las 4 categorías principales de WCAG:

- **Perceptible**: La información debe ser presentable a los sentidos
- **Operable**: Los componentes deben ser operables (no solo con ratón)
- **Comprensible**: La información y la operación deben ser comprensibles
- **Robusto**: Compatible con tecnologías de asistencia actuales y futuras

---

## Imágenes y Texto Alternativo

### Nivel A — Criterio 1.1.1

```html
<!-- ✓ Imagen informativa: alt describe el contenido/función -->
<img
  src="grafico-ventas.png"
  alt="Gráfico de ventas: incremento del 25% en Q4 2024"
/>

<!-- ✓ Imagen funcional (botón/link): alt describe la acción -->
<a href="/buscar">
  <img src="lupa.svg" alt="Buscar" />
</a>

<!-- ✓ Imagen decorativa: alt vacío (no se vocaliza) -->
<img src="separador-decorativo.png" alt="" />
<!-- O usar CSS background-image para decorativas -->

<!-- ❌ Malo: sin alt -->
<img src="producto.jpg" />

<!-- ❌ Malo: alt con nombre de archivo -->
<img src="IMG_1234.jpg" alt="IMG_1234.jpg" />

<!-- ❌ Malo: alt redundante con el texto adyacente -->
<p>Nuestro equipo <img src="foto-equipo.jpg" alt="Foto del equipo" /></p>
<!-- Si la foto añade información, el alt debe aportar esa info adicional -->
```

### Reglas para alt text

- Máximo ~100-150 caracteres (ser conciso)
- Imágenes decorativas (solo estética): `alt=""`
- Imágenes de texto: el alt debe contener el texto de la imagen
- Imágenes complejas (gráficos): alt corto + descripción larga en `aria-describedby` o `<figcaption>`

---

## Contraste de Color

### Nivel AA — Criterio 1.4.3

| Tipo de texto                                  | Ratio mínimo AA | Ratio mínimo AAA |
| ---------------------------------------------- | --------------- | ---------------- |
| Texto normal (< 18pt regular / < 14pt negrita) | **4.5:1**       | 7:1              |
| Texto grande (≥ 18pt regular / ≥ 14pt negrita) | **3:1**         | 4.5:1            |
| Elementos gráficos / iconos de UI              | **3:1**         | -                |
| Texto decorativo / logo                        | Sin requisito   | -                |

**18pt = 24px, 14pt negrita = ~18.67px negrita**

```
Herramientas de verificación de contraste:
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Chrome DevTools: Inspector > Accesibilidad
- Colour Contrast Analyser (desktop app)
- axe DevTools (extensión Chrome)
```

```css
/* ❌ Malo: texto gris claro sobre blanco, ratio ~2.3:1 */
color: #aaaaaa;
background: #ffffff;

/* ✓ Bueno: texto oscuro sobre blanco, ratio 12.6:1 */
color: #212121;
background: #ffffff;

/* ✓ Texto blanco sobre azul corporativo (verificar ratio) */
color: #ffffff;
background: #0057b7; /* ratio ~4.6:1 ✓ */
```

---

## Accesibilidad de Teclado

### Nivel A — Criterio 2.1.1 / 2.1.2

Toda funcionalidad debe ser operable solo con teclado:

```html
<!-- ✓ Links y botones son natively focusable y activables -->
<a href="/pagina">Ir a página</a>
<button type="button">Enviar</button>

<!-- ❌ Malo: div/span con onClick no es accesible por teclado -->
<div onclick="enviar()">Enviar</div>

<!-- ✓ Si necesitas div interactivo: añadir role y tabindex -->
<div
  role="button"
  tabindex="0"
  onclick="enviar()"
  onkeypress="if(event.key==='Enter'){enviar()}"
>
  Enviar
</div>
```

### Focus visible — Nivel AA — Criterio 2.4.7 / 2.4.11

```css
/* ❌ Nunca eliminar el outline sin reemplazarlo */
* {
  outline: none;
} /* ❌ Muy malo */
a:focus {
  outline: 0;
} /* ❌ Malo */

/* ✓ Personalizar el focus de forma visible */
:focus-visible {
  outline: 3px solid #0057b7;
  outline-offset: 2px;
  border-radius: 2px;
}

/* ✓ Focus más vistoso para elementos interactivos */
button:focus-visible,
a:focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 3px;
  box-shadow: 0 0 0 4px rgba(0, 95, 204, 0.25);
}
```

### Skip Links

```html
<!-- PRIMER elemento en el <body>: permite saltar navegación -->
<body>
  <a href="#main-content" class="skip-link">Saltar al contenido principal</a>
  <nav><!-- navegación --></nav>
  <main id="main-content"><!-- contenido --></main>
</body>

<style>
  .skip-link {
    position: absolute;
    top: -40px;
    left: 6px;
    background: #000;
    color: #fff;
    padding: 8px;
    z-index: 100;
    text-decoration: none;
  }
  .skip-link:focus {
    top: 6px; /* Visible al recibir focus */
  }
</style>
```

### Orden del Tab

- El orden de tabulación debe ser lógico (izquierda-derecha, arriba-abajo)
- No usar `tabindex` con valores positivos (rompe el flujo natural)
- `tabindex="0"`: añade elemento al flujo natural
- `tabindex="-1"`: focusable por JS pero no por Tab

---

## ARIA (Accessible Rich Internet Applications)

### Reglas fundamentales de ARIA

1. **No usar ARIA cuando hay HTML nativo equivalente**
2. No cambiar semántica nativa con ARIA innecesariamente
3. Todos los controles interactivos ARIA deben ser accesibles por teclado
4. No ocultar elementos focusables con `aria-hidden="true"`
5. Los elementos interactivos deben tener un nombre accesible

### Landmark Regions

```html
<header role="banner">
  <!-- Implícito en <header> hijo de body -->
  <nav role="navigation">
    <!-- Implícito en <nav> -->
    <main role="main">
      <!-- Implícito en <main> -->
      <aside role="complementary">
        <!-- Implícito en <aside> -->
        <footer role="contentinfo">
          <!-- Implícito en <footer> hijo de body -->
          <section aria-label="Noticias">
            <!-- <section> necesita label para ser landmark -->
          </section>
        </footer>
      </aside>
    </main>
  </nav>
</header>
```

### aria-label y aria-labelledby

```html
<!-- aria-label: nombre descriptivo cuando no hay texto visible -->
<button aria-label="Cerrar diálogo">
  <svg>...</svg>
  <!-- icono X sin texto -->
</button>

<nav aria-label="Navegación principal">
  <nav aria-label="Navegación de pie de página">
    <!-- aria-labelledby: referencia a elemento existente -->
    <h2 id="products-heading">Nuestros Productos</h2>
    <section aria-labelledby="products-heading">
      <!-- aria-describedby: descripción adicional -->
      <input type="password" aria-describedby="pwd-requirements" />
      <p id="pwd-requirements">
        Mínimo 8 caracteres, una mayúscula y un número.
      </p>
    </section>
  </nav>
</nav>
```

### aria-hidden

```html
<!-- Ocultar a screen readers elementos puramente decorativos -->
<span aria-hidden="true">→</span>

<!-- ❌ NUNCA ocultar elementos focusables -->
<a href="/link" aria-hidden="true">Link</a>
<!-- ❌ El link sigue recibiendo focus -->
```

---

## Formularios Accesibles

### Criterio 1.3.1, 3.3.1, 3.3.2 — Nivel A

```html
<!-- ✓ Label explícito (for + id) -->
<label for="nombre">Nombre completo *</label>
<input
  type="text"
  id="nombre"
  name="nombre"
  required
  aria-required="true"
  autocomplete="name"
/>

<!-- ✓ Label implícito (label envuelve input) -->
<label>
  Email
  <input type="email" name="email" autocomplete="email" />
</label>

<!-- ✓ Mensaje de error accesible -->
<label for="email">Email *</label>
<input
  type="email"
  id="email"
  aria-describedby="email-error"
  aria-invalid="true"
/>
<p id="email-error" role="alert">Por favor, introduce un email válido.</p>

<!-- ❌ Malo: placeholder como único label -->
<input type="text" placeholder="Tu nombre" />
<!-- Desaparece al escribir -->

<!-- ❌ Malo: input sin label -->
<input type="text" name="buscar" />
```

### Agrupación de campos

```html
<fieldset>
  <legend>Tipo de envío</legend>
  <input type="radio" id="envio-normal" name="envio" value="normal" />
  <label for="envio-normal">Envío estándar (3-5 días)</label>
  <input type="radio" id="envio-express" name="envio" value="express" />
  <label for="envio-express">Envío express (24h)</label>
</fieldset>
```

---

## Multimedia Accesible

### Criterios 1.2.x — Nivel A y AA

```html
<!-- Vídeo: subtítulos sincronizados (Level A para grabaciones, AA para live) -->
<video controls>
  <source src="video.mp4" type="video/mp4" />
  <track
    kind="captions"
    src="subtitulos-es.vtt"
    srclang="es"
    label="Español"
    default
  />
  <track
    kind="subtitles"
    src="subtitulos-en.vtt"
    srclang="en"
    label="English"
  />
</video>

<!-- Audio: transcripción en texto (Level A) -->
<audio controls src="podcast.mp3"></audio>
<details>
  <summary>Transcripción del podcast</summary>
  <p>Texto completo del audio...</p>
</details>

<!-- Vídeo decorativo: sin controles, silenciado, aria-hidden -->
<video autoplay muted loop aria-hidden="true">
  <source src="background.mp4" type="video/mp4" />
</video>
```

---

## Errores WCAG más comunes

| Error                         | Criterio | Nivel | Código correcto                         |
| ----------------------------- | -------- | ----- | --------------------------------------- |
| Imágenes sin alt              | 1.1.1    | A     | `alt="descripción"` o `alt=""`          |
| Contraste insuficiente        | 1.4.3    | AA    | Ratio ≥ 4.5:1 texto normal              |
| Click handlers en divs/spans  | 2.1.1    | A     | Usar `<button>` o `<a>`                 |
| outline: none sin reemplazo   | 2.4.7    | AA    | Focus visible siempre                   |
| Inputs sin label              | 1.3.1    | A     | `<label for>` o `aria-label`            |
| Lang no declarado en `<html>` | 3.1.1    | A     | `<html lang="es">`                      |
| Trampas de teclado            | 2.1.2    | A     | Permitir salir con Escape/Tab           |
| Vídeos sin subtítulos         | 1.2.2    | A     | `<track kind="captions">`               |
| Texto de link genérico        | 2.4.6    | AA    | Links descriptivos, no "haz click aquí" |
| Zoom desactivado              | 1.4.4    | AA    | No usar `maximum-scale=1`               |

---

## Herramientas de auditoría de accesibilidad

| Herramienta              | Tipo                         | URL                      |
| ------------------------ | ---------------------------- | ------------------------ |
| axe DevTools             | Extensión Chrome/Firefox     | chrome extension         |
| Lighthouse               | Integrado en Chrome DevTools | DevTools > Lighthouse    |
| WAVE                     | Extensión + web              | https://wave.webaim.org/ |
| Colour Contrast Analyser | App desktop                  | TPGi                     |
| Screen Reader NVDA       | Screen reader Windows        | nvaccess.org             |
| VoiceOver                | Screen reader Mac/iOS        | Integrado en macOS       |
| TalkBack                 | Screen reader Android        | Integrado en Android     |
