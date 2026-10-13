---
name: wordpress
description: Buenas prácticas para plugins y temas de WordPress — hooks, seguridad (escapado, nonces, capabilities), WP-CLI y WP_Query.
paths: "wp-content/**/*.php, wp-config.php, **/wp-content/**/*.php"
---

# WordPress — guía operativa

## Reglas de oro

- **Nunca** edites el core (`wp-admin/`, `wp-includes/`) ni plugins/temas de terceros; extiende con hooks o un plugin propio en `wp-content/plugins/<lf-*>` / child theme.
- Prefijo único en funciones, clases, opciones y hooks propios (p. ej. `lf_`), o namespaces PHP + autoload de Composer.
- Todo lo que llega del usuario se **sanea al entrar** (`sanitize_text_field`, `absint`, `wp_kses_post`) y se **escapa al salir** (`esc_html`, `esc_attr`, `esc_url`, `wp_kses`).
- Formularios y acciones: `wp_nonce_field` / `check_admin_referer` o `check_ajax_referer`, y `current_user_can(<capability>)`. AJAX/REST: `permission_callback` obligatorio.
- SQL: `$wpdb->prepare()` siempre; preferir `WP_Query`, `get_posts`, `get_option` a SQL directo.

## Inspección barata

- `wp plugin list --status=active`, `wp theme list`, `wp option get <clave>`, `wp cron event list`, `wp post list --post_type=<cpt> --format=count`.
- `wp eval 'var_export(has_action("init"));'` para ver callbacks registrados.
- Logs: `WP_DEBUG_LOG` → `wp-content/debug.log` (léelo con `tail -n 50`, nunca entero).

## Estructura de un plugin propio

```
lf-<nombre>/
├── lf-<nombre>.php        # cabecera del plugin, constantes, bootstrap
├── includes/              # clases (Loader, Admin, Public, CPT, REST)
├── assets/{css,js}/       # enqueue con wp_enqueue_* y versiones por filemtime
└── languages/             # load_plugin_textdomain
```

- Registro de CPT/taxonomías en `init`; `register_activation_hook` para `flush_rewrite_rules`.
- Scripts y estilos solo con `wp_enqueue_script/style` en `wp_enqueue_scripts` o `admin_enqueue_scripts`; nunca `<script>` inline sin `wp_add_inline_script`.
- Opciones: `register_setting` + Settings API; datos de usuario en `user_meta`; datos transitorios en `set_transient`.

## Rendimiento

- `WP_Query` con `no_found_rows => true` si no hay paginación, `fields => 'ids'` cuando basta, `update_post_meta_cache => false` si no se usan metas.
- Object cache (`wp_cache_get/set`) para consultas caras; transients con expiración.
- Evitar `query_posts`; usar `pre_get_posts` para modificar la consulta principal.

## Tests y verificación

- `wp plugin activate <slug>` y `wp eval-file` para smoke tests; PHPUnit con `wp-phpunit` si el proyecto lo tiene (`vendor/bin/phpunit --filter …`).
- `php -l <fichero>` como verificación mínima de sintaxis tras cada edición.
- Nunca `wp db reset|drop|import`, ni `wp search-replace` sin `--dry-run` primero y sin que el usuario lo pida.
