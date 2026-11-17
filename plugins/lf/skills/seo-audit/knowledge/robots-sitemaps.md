# Robots.txt y Sitemaps XML

## robots.txt

### Ubicación y requisitos

- Debe estar en la **raíz del dominio**: `https://www.ejemplo.com/robots.txt`
- No puede estar en subdirectorios
- Tamaño máximo: **500 KiB**
- Codificación: UTF-8
- Las rutas son **case-sensitive**: `/Fotos` ≠ `/fotos`

### Sintaxis

```
# Comentario (línea que empieza con #)
field: value
```

### Directivas soportadas por Google

| Directiva     | Descripción                                        |
| ------------- | -------------------------------------------------- |
| `User-agent`  | Crawler al que aplican las reglas. `*` = todos     |
| `Disallow`    | Ruta que no debe ser crawleada                     |
| `Allow`       | Permite acceso a ruta dentro de una regla Disallow |
| `Sitemap`     | URL completa del sitemap XML                       |
| `Crawl-delay` | **NO soportado por Google** (sí por Bing, otros)   |

### Ejemplos de sintaxis

```robots
# Bloquear todo el sitio a todos los crawlers
User-agent: *
Disallow: /

# Permitir todo (equivalente a no tener robots.txt)
User-agent: *
Disallow:

# Bloquear directorio específico
User-agent: *
Disallow: /admin/
Disallow: /privado/
Disallow: /tmp/

# Reglas específicas para Googlebot
User-agent: Googlebot
Disallow: /staging/

# Bloquear un crawler específico completamente
User-agent: Bingbot
Disallow: /

# Permitir excepción dentro de una regla Disallow
User-agent: *
Disallow: /includes/
Allow: /includes/css/

# Declarar sitemap
Sitemap: https://www.ejemplo.com/sitemap.xml
Sitemap: https://www.ejemplo.com/sitemap-noticias.xml
```

### Wildcards

```robots
# * = cero o más caracteres
Disallow: /temp*        # Bloquea /temp, /temporal, /temp-files

# $ = fin de URL
Disallow: /*.php$       # Bloquea solo archivos .php (no /php-tutorial/)
Disallow: /$            # Bloquea solo la raíz exacta

# Combinación
Disallow: /buscar*      # Bloquea resultados de búsqueda interna
Disallow: /*?*          # Bloquea URLs con parámetros (cuidado: muy agresivo)
```

### Errores comunes en robots.txt

| Error                              | Descripción                                          | Solución                                             |
| ---------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| **Bloquear CSS/JS**                | Google no puede analizar el renderizado de la página | Permitir acceso a `/assets/`, `/static/`             |
| **Confundir con seguridad**        | robots.txt es público y bots maliciosos lo ignoran   | Usar contraseñas o `noindex` para contenido sensible |
| **Bloquear y pedir indexación**    | Página en robots.txt Disallow pero en sitemap        | Ser consistente entre ambos                          |
| **URLs canónicas bloqueadas**      | La URL canonical está bloqueada en robots.txt        | Google no puede confirmar el canonical               |
| **Archivos en subdirectorios**     | `ejemplo.com/blog/robots.txt` no tiene efecto        | Solo funciona en la raíz                             |
| **Usar `crawl-delay` para Google** | Google lo ignora                                     | Usar Search Console para ajustar crawl rate          |

### Robots.txt robusto para sitio típico

```robots
# Bloquear herramientas de scraping agresivas
User-agent: AhrefsBot
Disallow: /

User-agent: SemrushBot
Disallow: /

# Reglas generales
User-agent: *
Disallow: /admin/
Disallow: /wp-admin/
Disallow: /wp-login.php
Disallow: /checkout/
Disallow: /cart/
Disallow: /mi-cuenta/
Disallow: /buscar?
Allow: /wp-admin/admin-ajax.php

# Sitemaps
Sitemap: https://www.ejemplo.com/sitemap_index.xml
```

---

## Sitemaps XML

### Cuándo necesitas un sitemap

- Sitio grande (> 500 páginas)
- Sitio nuevo con pocos enlaces externos
- Contenido rico en multimedia (imágenes, vídeo)
- Contenido que se actualiza frecuentemente (noticias)

### Límites del sitemap

| Parámetro          | Límite                    |
| ------------------ | ------------------------- |
| URLs por sitemap   | **50.000 URLs**           |
| Tamaño máximo      | **50 MB** (sin comprimir) |
| Sitemap comprimido | Gzip recomendado          |

### Formato XML básico

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.ejemplo.com/</loc>
    <lastmod>2024-01-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.ejemplo.com/categoria/zapatillas/</loc>
    <lastmod>2024-01-10</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.ejemplo.com/zapatillas/nike-air-max/</loc>
    <lastmod>2024-01-08</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>
```

### Atributos del sitemap

| Atributo       | Obligatorio | Descripción                                                                                |
| -------------- | ----------- | ------------------------------------------------------------------------------------------ |
| `<loc>`        | **Sí**      | URL completa (con protocolo). Máx 2048 chars                                               |
| `<lastmod>`    | No          | Fecha de última modificación: `YYYY-MM-DD` o `YYYY-MM-DDThh:mmTZD`                         |
| `<changefreq>` | No          | Frecuencia indicativa: `always`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`, `never` |
| `<priority>`   | No          | Importancia relativa entre 0.0 y 1.0 (defecto: 0.5). **Google lo ignora mayormente**       |

**Nota**: `changefreq` y `priority` son **hints** ignorados frecuentemente por Google. `lastmod` sí se usa si es preciso.

### Sitemap Index (para sitios grandes)

Cuando el sitio tiene > 50.000 URLs o múltiples tipos de contenido:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.ejemplo.com/sitemap-paginas.xml</loc>
    <lastmod>2024-01-15</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://www.ejemplo.com/sitemap-productos.xml</loc>
    <lastmod>2024-01-15</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://www.ejemplo.com/sitemap-blog.xml</loc>
    <lastmod>2024-01-14</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://www.ejemplo.com/sitemap-imagenes.xml</loc>
    <lastmod>2024-01-15</lastmod>
  </sitemap>
</sitemapindex>
```

### Sitemap de Imágenes

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://www.ejemplo.com/zapatillas/nike-air-max/</loc>
    <image:image>
      <image:loc>https://www.ejemplo.com/img/nike-air-max-principal.jpg</image:loc>
      <image:title>Nike Air Max 2024 - Vista frontal</image:title>
      <image:caption>Zapatilla Nike Air Max en color blanco y azul</image:caption>
    </image:image>
    <image:image>
      <image:loc>https://www.ejemplo.com/img/nike-air-max-lateral.jpg</image:loc>
      <image:title>Nike Air Max 2024 - Vista lateral</image:title>
    </image:image>
  </url>
</urlset>
```

### Sitemap de Vídeo

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <url>
    <loc>https://www.ejemplo.com/videos/como-elegir-zapatillas/</loc>
    <video:video>
      <video:thumbnail_loc>https://www.ejemplo.com/img/thumbnail-video.jpg</video:thumbnail_loc>
      <video:title>Cómo elegir tus zapatillas de running</video:title>
      <video:description>Guía completa para elegir el calzado de running ideal</video:description>
      <video:content_loc>https://www.ejemplo.com/videos/zapatillas.mp4</video:content_loc>
      <video:duration>600</video:duration>
      <video:publication_date>2024-01-10T08:00:00+01:00</video:publication_date>
    </video:video>
  </url>
</urlset>
```

### Envío del sitemap

1. **robots.txt**: `Sitemap: https://www.ejemplo.com/sitemap_index.xml`
2. **Google Search Console**: Sitemaps > Añadir nuevo sitemap
3. **Bing Webmaster Tools**: Configuración > Sitemaps
4. **URL directa**: `https://www.google.com/ping?sitemap=URL_DEL_SITEMAP`

### Buenas prácticas

- Solo incluir URLs **canónicas** e indexables (sin noindex)
- No incluir URLs bloqueadas en robots.txt
- Mantener `lastmod` actualizado y preciso (fechas incorrectas perjudican)
- Comprimir con Gzip: `sitemap.xml.gz`
- Para noticias: usar Google News Sitemap con `<news:news>` namespace
- Separar sitemaps por tipo de contenido para mejor diagnóstico en Search Console
