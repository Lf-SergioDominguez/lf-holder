# Open Graph, Twitter Cards y Social Meta Tags

## Open Graph Protocol

Open Graph permite controlar cómo se presenta el contenido cuando se comparte en redes sociales (Facebook, LinkedIn, WhatsApp, Telegram, etc.).

### Tags OG obligatorios

Toda página que quiera tener un preview enriquecido DEBE tener estos 4:

```html
<meta
  property="og:title"
  content="Guía de Zapatillas Running 2024 | MiTienda"
/>
<meta property="og:type" content="article" />
<meta property="og:image" content="https://ejemplo.com/img/og-zapatillas.jpg" />
<meta
  property="og:url"
  content="https://ejemplo.com/guia-zapatillas-running/"
/>
```

### Tags OG recomendados

```html
<meta
  property="og:description"
  content="Análisis completo de las mejores zapatillas running del mercado. Comparativa, precios y recomendaciones por tipo de pisada."
/>
<meta property="og:site_name" content="MiTienda" />
<meta property="og:locale" content="es_ES" />
<meta property="og:locale:alternate" content="en_GB" />
```

### Tags OG para imágenes (propiedades estructuradas)

```html
<meta property="og:image" content="https://ejemplo.com/img/og-image.jpg" />
<meta
  property="og:image:secure_url"
  content="https://ejemplo.com/img/og-image.jpg"
/>
<meta property="og:image:type" content="image/jpeg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta
  property="og:image:alt"
  content="Zapatillas running sobre fondo blanco con logo de la tienda"
/>
```

### Especificaciones de imagen OG

| Parámetro              | Valor recomendado              |
| ---------------------- | ------------------------------ |
| **Tamaño óptimo**      | 1200 × 630 px                  |
| **Tamaño mínimo**      | 600 × 315 px                   |
| **Ratio**              | 1.91:1                         |
| **Formato**            | JPG o PNG (sin GIF)            |
| **Tamaño de archivo**  | < 8 MB                         |
| **Texto sobre imagen** | Máximo 20% del área (Facebook) |

### Tipos de objetos OG (`og:type`)

| Tipo            | Uso                                               |
| --------------- | ------------------------------------------------- |
| `website`       | Página de inicio, páginas genéricas (por defecto) |
| `article`       | Posts de blog, noticias, artículos                |
| `product`       | Fichas de producto                                |
| `video.movie`   | Páginas de películas                              |
| `video.episode` | Episodios de serie                                |
| `music.song`    | Canciones                                         |
| `music.album`   | Álbumes                                           |
| `profile`       | Perfiles de persona                               |
| `book`          | Libros                                            |

### Tags adicionales para artículos (`og:type = article`)

```html
<meta property="article:published_time" content="2024-01-15T08:00:00+01:00" />
<meta property="article:modified_time" content="2024-02-01T10:00:00+01:00" />
<meta
  property="article:author"
  content="https://ejemplo.com/autor/ana-garcia/"
/>
<meta property="article:section" content="Running" />
<meta property="article:tag" content="zapatillas" />
<meta property="article:tag" content="running" />
```

---

## Twitter / X Cards

Twitter Cards controlan la apariencia de los links cuando se comparten en Twitter/X.

### Tipos de Twitter Cards

| Tipo                  | Descripción                            | Cuándo usar                    |
| --------------------- | -------------------------------------- | ------------------------------ |
| `summary`             | Preview pequeño con imagen cuadrada    | Artículos, páginas genéricas   |
| `summary_large_image` | Preview con imagen grande horizontal   | Artículos con imagen destacada |
| `app`                 | Preview con botón de descarga de app   | Apps móviles                   |
| `player`              | Preview con reproductor de vídeo/audio | Contenido multimedia           |

### Tags Twitter obligatorios

```html
<!-- Obligatorio en todos los tipos -->
<meta name="twitter:card" content="summary_large_image" />
```

### Tags Twitter recomendados

```html
<meta name="twitter:site" content="@MiTiendaES" />
<!-- Cuenta del sitio -->
<meta name="twitter:creator" content="@AutorArticulo" />
<!-- Cuenta del autor -->
<meta name="twitter:title" content="Guía de Zapatillas Running 2024" />
<meta
  name="twitter:description"
  content="Análisis completo de las mejores zapatillas running del mercado."
/>
<meta name="twitter:image" content="https://ejemplo.com/img/twitter-card.jpg" />
<meta
  name="twitter:image:alt"
  content="Zapatillas running sobre fondo blanco"
/>
```

### Especificaciones de imagen para Twitter

| Tipo de card          | Tamaño recomendado | Ratio | Tamaño máx |
| --------------------- | ------------------ | ----- | ---------- |
| `summary`             | 144 × 144 px (mín) | 1:1   | 5 MB       |
| `summary_large_image` | 1200 × 628 px      | 2:1   | 5 MB       |

---

## Ejemplo completo HTML (página de artículo)

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Guía de Zapatillas Running 2024 | MiTienda</title>
    <meta
      name="description"
      content="Análisis completo de las mejores zapatillas running del mercado. Comparativa, precios y recomendaciones por tipo de pisada."
    />
    <link rel="canonical" href="https://ejemplo.com/guia-zapatillas-running/" />

    <!-- Open Graph / Facebook / LinkedIn / WhatsApp -->
    <meta property="og:type" content="article" />
    <meta
      property="og:url"
      content="https://ejemplo.com/guia-zapatillas-running/"
    />
    <meta
      property="og:title"
      content="Guía de Zapatillas Running 2024 | MiTienda"
    />
    <meta
      property="og:description"
      content="Análisis completo de las mejores zapatillas running del mercado. Comparativa, precios y recomendaciones por tipo de pisada."
    />
    <meta
      property="og:image"
      content="https://ejemplo.com/img/og-zapatillas-running.jpg"
    />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta
      property="og:image:alt"
      content="Varias zapatillas de running sobre una pista de atletismo"
    />
    <meta property="og:site_name" content="MiTienda" />
    <meta property="og:locale" content="es_ES" />
    <meta
      property="article:published_time"
      content="2024-01-15T08:00:00+01:00"
    />
    <meta
      property="article:modified_time"
      content="2024-02-01T10:00:00+01:00"
    />
    <meta
      property="article:author"
      content="https://ejemplo.com/autor/ana-garcia/"
    />
    <meta property="article:section" content="Running" />

    <!-- Twitter / X Cards -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@MiTiendaES" />
    <meta name="twitter:creator" content="@AnaGarciaRun" />
    <meta name="twitter:title" content="Guía de Zapatillas Running 2024" />
    <meta
      name="twitter:description"
      content="Análisis completo de las mejores zapatillas running del mercado."
    />
    <meta
      name="twitter:image"
      content="https://ejemplo.com/img/twitter-zapatillas-running.jpg"
    />
    <meta
      name="twitter:image:alt"
      content="Varias zapatillas de running sobre una pista de atletismo"
    />
  </head>
</html>
```

---

## Ejemplo para página de inicio (website)

```html
<head>
  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://ejemplo.com/" />
  <meta property="og:title" content="MiTienda - Zapatillas y Ropa Deportiva" />
  <meta
    property="og:description"
    content="Tu tienda online de deporte. Las mejores marcas con envío gratis en 24h."
  />
  <meta property="og:image" content="https://ejemplo.com/img/og-home.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="MiTienda" />
  <meta property="og:locale" content="es_ES" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@MiTiendaES" />
  <meta name="twitter:image" content="https://ejemplo.com/img/og-home.jpg" />
</head>
```

---

## Checklist Social Meta Tags

- [ ] `og:title` presente y único (diferente al `<title>` si mejora en social)
- [ ] `og:type` correcto según tipo de contenido
- [ ] `og:image` con URL absoluta HTTPS
- [ ] `og:image` de al menos 1200x630px
- [ ] `og:url` con URL canónica completa
- [ ] `og:description` único y descriptivo
- [ ] `og:site_name` consistente en todas las páginas
- [ ] `og:locale` declarado
- [ ] `twitter:card` declarado
- [ ] `twitter:image` (puede reutilizar la de OG)
- [ ] Todas las URLs de imágenes son absolutas (no relativas)
- [ ] Validar con Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
- [ ] Validar con Twitter Card Validator: https://cards-dev.twitter.com/validator
- [ ] Validar con LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/
