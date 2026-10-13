# SEO — Meta Standards y Estándares HTML

## Title Tags (`<title>`)

### Reglas

- **Longitud recomendada**: 50–60 caracteres (Google trunca ~60 caracteres en desktop, ~78px de ancho)
- Debe ser **único** por página
- Debe describir con precisión el contenido de la página
- Incluir palabra clave principal, preferiblemente al inicio
- Puede incluir nombre del sitio al final separado por `|` o `-`

```html
<!-- ✓ Bueno: descriptivo, único, longitud correcta -->
<title>Zapatillas Running Nike Air Max - Tienda Oficial | MiTienda</title>

<!-- ✓ Bueno: página de inicio -->
<title>MiTienda.es - Zapatillas y Ropa Deportiva</title>

<!-- ❌ Malo: demasiado genérico -->
<title>Inicio</title>

<!-- ❌ Malo: keyword stuffing -->
<title>Zapatillas zapatillas running zapatillas nike zapatillas baratas</title>

<!-- ❌ Malo: demasiado largo (>60 chars) -->
<title>
  Comprar Zapatillas Running Nike Air Max 2024 Online en España con Envío Gratis
</title>
```

---

## Meta Description

### Reglas

- **Longitud recomendada**: 120–160 caracteres (Google trunca ~160 chars en desktop)
- Único por página (duplicadas no penalizan pero son una oportunidad perdida)
- Debe resumir el contenido en 1-2 frases
- Incluir llamada a la acción cuando sea apropiado
- Google puede reescribir el snippet si el suyo es mejor

```html
<!-- ✓ Bueno: descriptivo, CTA, longitud correcta -->
<meta
  name="description"
  content="Descubre las mejores zapatillas running Nike Air Max. Envío gratis en 24h, devolución gratuita 30 días. ¡Compra ahora con -20% de descuento!"
/>

<!-- ❌ Malo: demasiado corto, sin información útil -->
<meta name="description" content="Zapatillas Nike baratas." />
```

---

## Jerarquía de Headings (H1–H6)

### Reglas

- **Un solo `<h1>` por página**: debe describir el tema principal de la página
- Los headings deben seguir orden jerárquico lógico (no saltar de H2 a H4)
- Los headings ayudan a la accesibilidad (screen readers) y estructura de contenido
- Google puede interpretar headings fuera de orden pero es mala práctica

```html
<!-- ✓ Estructura correcta -->
<h1>Guía de Zapatillas Running 2024</h1>
<h2>Zapatillas para Asfalto</h2>
<h3>Nike Air Max</h3>
<h3>Adidas Ultraboost</h3>
<h2>Zapatillas para Trail</h2>
<h3>Salomon Speedcross</h3>

<!-- ❌ Incorrecto: saltar niveles -->
<h1>Guía Running</h1>
<h4>Nike Air Max</h4>
<!-- ❌ salta H2 y H3 -->
```

---

## Estructura de URLs

### Reglas

- **Usar palabras descriptivas**: `/categoria/subcategoria/nombre-producto`
- **Separadores**: usar guiones `-` entre palabras, nunca `_` ni espacios
- **Minúsculas**: siempre en minúsculas (evitar duplicados `/Producto` vs `/producto`)
- **Trailing slash**: ser consistente (siempre con `/` o siempre sin)
- **Sin parámetros innecesarios**: limpiar UTMs de URLs canónicas
- **Profundidad**: máximo 3-4 niveles cuando sea posible
- **Sin caracteres especiales**: acentos, `ñ`, `?`, `#` en slugs

```
✓ Bueno:
https://www.ejemplo.com/zapatillas/running/nike-air-max-2024

❌ Malo:
https://www.ejemplo.com/product.php?id=12345&cat=3
https://www.ejemplo.com/Zapatillas_Running_Nike
https://www.ejemplo.com/p/z/r/n/a/m/zapatillas-running
```

---

## HTML lang Attribute

```html
<!-- OBLIGATORIO: declarar idioma en <html> -->
<html lang="es">
  <html lang="es-ES">
    <!-- Variante regional -->
    <html lang="en-US">
      <!-- Para contenido multilingüe en la misma página -->
      <p lang="en">This is in English.</p>
      <p lang="es">Esto está en español.</p>
    </html>
  </html>
</html>
```

El atributo `lang` es crítico para:

- Screen readers (pronunciación correcta)
- Motores de búsqueda (segmentación por idioma)
- Navegadores (sugerencias de traducción)

---

## Viewport Meta Tag

```html
<!-- OBLIGATORIO para mobile-first: siempre incluir -->
<meta name="viewport" content="width=device-width, initial-scale=1" />

<!-- ❌ NUNCA usar: impide zoom en accesibilidad -->
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
/>
```

---

## Canonical Tags

### Cuándo usar

- Contenido duplicado (misma página accesible por múltiples URLs)
- Versiones HTTP vs HTTPS
- Versiones www vs no-www
- URLs con/sin trailing slash
- Páginas con parámetros de filtro/ordenación
- Contenido sindicado en otro dominio

```html
<!-- Self-referencing canonical (SIEMPRE recomendado en todas las páginas) -->
<link rel="canonical" href="https://www.ejemplo.com/zapatillas/nike-air-max/" />

<!-- Cross-domain canonical (para contenido sindicado) -->
<!-- En la copia sindicada, apuntar al original -->
<link rel="canonical" href="https://original.com/articulo-original/" />

<!-- Paginación: cada página se canonicaliza a sí misma -->
<!-- Página 1 -->
<link rel="canonical" href="https://ejemplo.com/blog/page/1/" />
<!-- Página 2 -->
<link rel="canonical" href="https://ejemplo.com/blog/page/2/" />
```

### Errores comunes con canonicals

- Canonical apuntando a página diferente al contenido real
- Canonical a página noindex
- Canonical a URL con redirección
- Canonical en paginación todos apuntando a página 1 (incorrecto)
- Múltiples tags canonical en la misma página

---

## Directivas noindex / nofollow

### Meta robots tag

```html
<!-- No indexar esta página -->
<meta name="robots" content="noindex" />

<!-- No seguir los links de esta página -->
<meta name="robots" content="nofollow" />

<!-- Combinaciones -->
<meta name="robots" content="noindex, nofollow" />
<meta name="robots" content="noindex, follow" />
<meta name="robots" content="index, nofollow" />

<!-- Valores adicionales útiles -->
<meta name="robots" content="noarchive" />
<!-- No guardar caché -->
<meta name="robots" content="nosnippet" />
<!-- No mostrar descripción -->
<meta name="robots" content="max-snippet:150" />
<!-- Limitar snippet -->
<meta name="robots" content="max-image-preview:large" />
<!-- Tamaño preview imagen -->
```

### Cuándo usar cada directiva

| Directiva           | Cuándo usar                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `noindex`           | Páginas de resultados de búsqueda interna, páginas de paginación, páginas de agradecimiento, staging, duplicados |
| `nofollow`          | Links de pago/publicidad, comentarios de usuarios no moderados, UGC                                              |
| `noindex, nofollow` | Páginas de administración, confirmaciones de formularios                                                         |

### nofollow en links individuales

```html
<!-- Marcar link individual como nofollow -->
<a href="https://externo.com" rel="nofollow">Enlace externo</a>

<!-- UGC (User Generated Content) -->
<a href="https://spam.com" rel="ugc">Link en comentario</a>

<!-- Patrocinado/pagado -->
<a href="https://anunciante.com" rel="sponsored">Nuestro patrocinador</a>

<!-- Combinaciones -->
<a href="https://externo.com" rel="nofollow sponsored">Enlace patrocinado</a>
```

---

## Mobile-First Considerations

- Google usa **mobile-first indexing**: indexa y rankea basándose en la versión móvil
- El contenido en móvil debe ser **igual** al de escritorio
- Evitar contenido oculto en móvil que esté visible en escritorio (penaliza)
- Imágenes deben ser responsive y legibles en móvil
- Botones y elementos táctiles: mínimo 44x44px de área de toque
- Texto base mínimo 16px en móvil
- Evitar Flash, pop-ups intrusivos al cargar (penalización de Google)

---

## HTML Semántico

El HTML semántico mejora accesibilidad, SEO y mantenibilidad.

```html
<body>
  <header>
    <!-- Cabecera del sitio o sección -->
    <nav>
      <!-- Navegación principal -->
      <ul>
        <li><a href="/">Inicio</a></li>
      </ul>
    </nav>
  </header>

  <main>
    <!-- Contenido principal (solo uno por página) -->
    <article>
      <!-- Contenido independiente y reutilizable -->
      <header>
        <!-- Cabecera del artículo -->
        <h1>Título del artículo</h1>
        <time datetime="2024-01-15">15 enero 2024</time>
      </header>

      <section>
        <!-- Sección temática del artículo -->
        <h2>Sección 1</h2>
        <p>Contenido...</p>
      </section>

      <aside>
        <!-- Contenido relacionado/complementario -->
        <h2>Artículos relacionados</h2>
      </aside>
    </article>
  </main>

  <footer>
    <!-- Pie de página -->
    <address>
      <!-- Información de contacto -->
      <a href="mailto:info@ejemplo.com">info@ejemplo.com</a>
    </address>
  </footer>
</body>
```

### Reglas de uso semántico

| Elemento                    | Usar cuando                                                         |
| --------------------------- | ------------------------------------------------------------------- |
| `<article>`                 | Contenido autocontenido: post de blog, noticia, comentario, widget  |
| `<section>`                 | Agrupación temática de contenido dentro de un documento             |
| `<nav>`                     | Conjunto de links de navegación (principal, breadcrumb, paginación) |
| `<main>`                    | Contenido principal único de la página (solo uno por página)        |
| `<header>`                  | Cabecera de página o sección (puede haber varios)                   |
| `<footer>`                  | Pie de página o sección (puede haber varios)                        |
| `<aside>`                   | Contenido tangencialmente relacionado (sidebar, notas)              |
| `<figure>` + `<figcaption>` | Imágenes, diagramas, código con su descripción                      |
| `<time>`                    | Fechas y horas (con atributo `datetime`)                            |
| `<address>`                 | Información de contacto del autor/propietario                       |

---

## Checklist SEO Técnico Esencial

- [ ] `<title>` único, 50-60 chars, con keyword principal
- [ ] `<meta name="description">` único, 120-160 chars
- [ ] Un solo `<h1>` por página
- [ ] `<html lang="XX">` declarado
- [ ] `<meta name="viewport">` presente
- [ ] Canonical self-referencing en todas las páginas
- [ ] URLs en minúsculas, con guiones, sin caracteres especiales
- [ ] Imágenes con atributo `alt` descriptivo
- [ ] Estructura HTML semántica (`main`, `nav`, `header`, `footer`)
- [ ] Versión HTTPS configurada y redirigiendo desde HTTP
- [ ] No hay contenido oculto en móvil vs escritorio
