# Schema.org — Datos Estructurados

## Por qué JSON-LD (vs Microdata y RDFa)

| Formato                   | Pros                                                             | Contras                                       |
| ------------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| **JSON-LD** (recomendado) | Separado del HTML, fácil de mantener, inyectable con JS, legible | Requiere sincronización con contenido visible |
| Microdata                 | Integrado en HTML, sin duplicación                               | Difícil de mantener, contamina el markup      |
| RDFa                      | Estándar web semántico                                           | Verboso, complejo                             |

**Google recomienda JSON-LD** en un `<script type="application/ld+json">` en `<head>` o `<body>`.

### Regla fundamental

**Solo marcar información visible para el usuario**. No incluir datos ocultos o diferentes a lo que se muestra en la página.

### Validación

- **Rich Results Test**: https://search.google.com/test/rich-results
- **Schema Markup Validator**: https://validator.schema.org/
- **URL Inspection Tool** en Google Search Console

---

## Organization y WebSite

```json
<!-- En todas las páginas del sitio, idealmente en el <head> -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.ejemplo.com/#organization",
      "name": "Ejemplo S.L.",
      "url": "https://www.ejemplo.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.ejemplo.com/logo.png",
        "width": 600,
        "height": 60
      },
      "sameAs": [
        "https://www.facebook.com/ejemplo",
        "https://twitter.com/ejemplo",
        "https://www.linkedin.com/company/ejemplo"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+34-900-123-456",
        "contactType": "customer service",
        "availableLanguage": "Spanish"
      }
    },
    {
      "@type": "WebSite",
      "@id": "https://www.ejemplo.com/#website",
      "url": "https://www.ejemplo.com",
      "name": "Ejemplo",
      "publisher": {"@id": "https://www.ejemplo.com/#organization"},
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://www.ejemplo.com/buscar?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    }
  ]
}
</script>
```

---

## Article / NewsArticle / BlogPosting

| Propiedad       | Obligatorio | Tipo                                        |
| --------------- | ----------- | ------------------------------------------- |
| `headline`      | Recomendado | Text (max ~110 chars)                       |
| `image`         | Recomendado | ImageObject o URL (múltiples aspect ratios) |
| `datePublished` | Recomendado | DateTime ISO 8601                           |
| `dateModified`  | Recomendado | DateTime ISO 8601                           |
| `author`        | Recomendado | Person o Organization                       |

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Guía completa de zapatillas running 2024",
  "image": [
    "https://ejemplo.com/img/articulo-1x1.jpg",
    "https://ejemplo.com/img/articulo-4x3.jpg",
    "https://ejemplo.com/img/articulo-16x9.jpg"
  ],
  "datePublished": "2024-01-15T08:00:00+01:00",
  "dateModified": "2024-02-01T10:00:00+01:00",
  "author": [{
    "@type": "Person",
    "name": "Ana García",
    "url": "https://ejemplo.com/autor/ana-garcia/"
  }],
  "publisher": {
    "@type": "Organization",
    "name": "Ejemplo",
    "logo": {
      "@type": "ImageObject",
      "url": "https://ejemplo.com/logo.png"
    }
  },
  "description": "Análisis completo de las mejores zapatillas running del mercado.",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://ejemplo.com/guia-zapatillas-running/"
  }
}
</script>
```

**Usar**: `Article` (genérico), `NewsArticle` (noticias), `BlogPosting` (blog).
**Imágenes recomendadas**: 3 versiones con aspect ratios 1:1, 4:3, 16:9.

---

## Product

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Nike Air Max 2024",
  "image": [
    "https://ejemplo.com/img/nike-air-max-1.jpg",
    "https://ejemplo.com/img/nike-air-max-2.jpg"
  ],
  "description": "Zapatilla running con tecnología Air Max para máxima amortiguación.",
  "sku": "NAM2024-BL-42",
  "brand": {
    "@type": "Brand",
    "name": "Nike"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://ejemplo.com/zapatillas/nike-air-max-2024/",
    "priceCurrency": "EUR",
    "price": "149.99",
    "priceValidUntil": "2024-12-31",
    "itemCondition": "https://schema.org/NewCondition",
    "availability": "https://schema.org/InStock",
    "seller": {
      "@type": "Organization",
      "name": "Ejemplo Tienda"
    }
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.5",
    "reviewCount": "89",
    "bestRating": "5",
    "worstRating": "1"
  },
  "review": [{
    "@type": "Review",
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": "5",
      "bestRating": "5"
    },
    "author": {
      "@type": "Person",
      "name": "Juan López"
    },
    "reviewBody": "Excelentes zapatillas, muy cómodas para running."
  }]
}
</script>
```

**Valores de `availability`**: `InStock`, `OutOfStock`, `PreOrder`, `BackOrder`, `Discontinued`
**Valores de `itemCondition`**: `NewCondition`, `UsedCondition`, `RefurbishedCondition`

---

## BreadcrumbList

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Inicio",
      "item": "https://ejemplo.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Zapatillas",
      "item": "https://ejemplo.com/zapatillas/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Running",
      "item": "https://ejemplo.com/zapatillas/running/"
    },
    {
      "@type": "ListItem",
      "position": 4,
      "name": "Nike Air Max 2024"
      /* No se incluye "item" en el último elemento */
    }
  ]
}
</script>
```

**Reglas**: mínimo 2 elementos, `position` empieza en 1, último elemento sin `item` es opcional.

---

## FAQPage

**Elegibilidad**: Solo para sitios de gobierno o salud reconocidos (restricción de Google desde 2023).

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "¿Cuánto tarda el envío?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "<p>El envío estándar tarda <strong>24-48 horas</strong>. Para pedidos antes de las 14h, enviamos el mismo día.</p>"
      }
    },
    {
      "@type": "Question",
      "name": "¿Puedo devolver el producto?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Sí, aceptamos devoluciones durante 30 días desde la recepción del pedido, sin coste adicional."
      }
    }
  ]
}
</script>
```

**Tags HTML permitidos en `text`**: `<h1-h6>`, `<br>`, `<ol>`, `<ul>`, `<li>`, `<a>`, `<p>`, `<div>`, `<b>`, `<strong>`, `<i>`, `<em>`.

---

## LocalBusiness

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Tienda Running Madrid",
  "image": "https://ejemplo.com/img/tienda.jpg",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Calle Gran Vía 28",
    "addressLocality": "Madrid",
    "addressRegion": "Madrid",
    "postalCode": "28013",
    "addressCountry": "ES"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 40.41956,
    "longitude": -3.69196
  },
  "url": "https://ejemplo.com/tienda-madrid/",
  "telephone": "+34-91-123-4567",
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
      "opens": "10:00",
      "closes": "20:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Saturday",
      "opens": "10:00",
      "closes": "14:00"
    }
  ],
  "priceRange": "€€"
}
</script>
```

**Subtipos útiles**: `Restaurant`, `Store`, `MedicalBusiness`, `Hotel`, `AutoDealer`

---

## Event

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Maratón de Madrid 2024",
  "startDate": "2024-04-28T09:00:00+02:00",
  "endDate": "2024-04-28T18:00:00+02:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": {
    "@type": "Place",
    "name": "Paseo de la Castellana",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Paseo de la Castellana s/n",
      "addressLocality": "Madrid",
      "addressCountry": "ES"
    }
  },
  "image": "https://ejemplo.com/img/maraton-madrid.jpg",
  "description": "La carrera más importante de la capital.",
  "organizer": {
    "@type": "Organization",
    "name": "Ayuntamiento de Madrid",
    "url": "https://www.madrid.es"
  },
  "offers": {
    "@type": "Offer",
    "price": "45.00",
    "priceCurrency": "EUR",
    "availability": "https://schema.org/InStock",
    "url": "https://ejemplo.com/inscripcion-maraton/"
  }
}
</script>
```

**`eventStatus`**: `EventScheduled`, `EventCancelled`, `EventPostponed`, `EventRescheduled`
**`eventAttendanceMode`**: `OfflineEventAttendanceMode`, `OnlineEventAttendanceMode`, `MixedEventAttendanceMode`

---

## Recipe (Extra)

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Tortilla española",
  "image": "https://ejemplo.com/img/tortilla.jpg",
  "author": {"@type": "Person", "name": "María Pérez"},
  "datePublished": "2024-01-10",
  "description": "La auténtica receta de tortilla española.",
  "prepTime": "PT15M",
  "cookTime": "PT20M",
  "totalTime": "PT35M",
  "recipeYield": "4 personas",
  "recipeCategory": "Plato principal",
  "recipeCuisine": "Española",
  "recipeIngredient": [
    "4 huevos",
    "500g de patatas",
    "1 cebolla",
    "Aceite de oliva",
    "Sal"
  ],
  "recipeInstructions": [
    {
      "@type": "HowToStep",
      "text": "Pelar y cortar las patatas en rodajas finas."
    },
    {
      "@type": "HowToStep",
      "text": "Freír las patatas en aceite de oliva a fuego medio."
    }
  ],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "245"
  },
  "nutrition": {
    "@type": "NutritionInformation",
    "calories": "320 calorías"
  }
}
</script>
```

---

## Buenas prácticas generales

1. Usar `@graph` para múltiples tipos en la misma página y referenciar con `@id`
2. Los datos marcados deben ser **visibles en la página**
3. No marcar contenido irrelevante o engañoso (penalización manual)
4. Una sola instancia del mismo tipo por página (excepto productos, artículos de lista)
5. Validar siempre antes de publicar con Rich Results Test
6. Monitorizar errores en Search Console > Mejoras
