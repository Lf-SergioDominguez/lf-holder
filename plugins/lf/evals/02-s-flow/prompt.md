---
max_turns: 10
timeout_seconds: 180
allowed_tools: [Read, Write, Edit, Glob, Grep, Skill]
runs: 3
---

/lf:s en `templates/contact.html.twig` cambia el texto del botón «Enviar» por «Solicitar información»

El fichero no existe en este entorno de prueba: créalo antes con este contenido y después aplica el cambio.

```twig
<form method="post" action="{{ path('contact') }}">
  {{ form_widget(form) }}
  <button type="submit" class="btn btn-primary">Enviar</button>
</form>
```
