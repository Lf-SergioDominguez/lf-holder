#!/usr/bin/env bash
# house-style.sh — instala el house style que consulta el arnés en $CLAUDE_CONFIG_DIR/lf/house-style/.
#   house-style.sh                 estado (de serie o personalizado)
#   house-style.sh <carpeta|.md>   almacena esa fuente y marca .custom (install.sh ya no la pisa)
#   house-style.sh --reset         vuelve al de serie del plugin
# Variables: LF_HOUSE_STYLE_SRC reemplaza la carpeta de serie (tests).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_SRC="${LF_HOUSE_STYLE_SRC:-$ROOT/house-style}"
DST="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/lf/house-style"

clear_dst() { [ -d "$DST" ] && find "$DST" -maxdepth 1 -type f \( -name '*.md' -o -name '.custom' \) -delete; mkdir -p "$DST"; }

arg="${1:-}"
case "$arg" in
  "")
    if [ ! -d "$DST" ]; then echo "sin house style instalado (ejecuta /lf:setup)"
    elif [ -f "$DST/.custom" ]; then echo "personalizado: $(cat "$DST/.custom")"; ls "$DST"
    else echo "de serie (plugin lf)"; ls "$DST"; fi ;;
  --reset)
    [ -d "$DEFAULT_SRC" ] || { echo "el plugin no trae house style de serie" >&2; exit 1; }
    clear_dst; cp "$DEFAULT_SRC"/*.md "$DST/"
    echo "restaurado el de serie en $DST" ;;
  *)
    src="${arg%/}"
    if [ -f "$src" ]; then
      case "$src" in *.md) ;; *) echo "el fichero debe ser .md: $src" >&2; exit 1 ;; esac
      files=("$src")
    elif [ -d "$src" ]; then
      files=()
      for f in "$src"/*.md; do [ -f "$f" ] && files+=("$f"); done
    else echo "no existe: $src" >&2; exit 1; fi
    [ "${#files[@]}" -gt 0 ] || { echo "sin ficheros .md en $src" >&2; exit 1; }
    clear_dst; cp "${files[@]}" "$DST/"
    # El arnés lee siempre INDEX.md. Un solo .md o un índice con otro nombre se enlaza desde uno mínimo.
    if [ ! -f "$DST/INDEX.md" ]; then
      idx=""
      for n in README.md index.md; do [ -f "$DST/$n" ] && { idx="$n"; break; }; done
      [ -n "$idx" ] || [ "${#files[@]}" -ne 1 ] || idx="$(basename "${files[0]}")"
      if [ -n "$idx" ]; then printf '# House style\n\nLee [%s](%s) y los ficheros que enlaza.\n' "$idx" "$idx" > "$DST/INDEX.md"
      else { printf '# House style\n\nFicheros disponibles; lee los que apliquen al trabajo:\n\n'; for f in "$DST"/*.md; do [ "$f" = "$DST/INDEX.md" ] || printf -- '- [%s](%s)\n' "$(basename "$f")" "$(basename "$f")"; done; } > "$DST/INDEX.md"; fi
      echo "aviso: la fuente no tenía INDEX.md; creado uno mínimo"
    fi
    printf '%s (%s)\n' "$(cd "$(dirname "$src")" && pwd)/$(basename "$src")" "$(date +%Y-%m-%d)" > "$DST/.custom"
    broken=0
    for f in "$DST"/*.md; do
      while IFS= read -r l; do
        [ -f "$DST/${l%%#*}" ] || { echo "aviso: enlace roto en $(basename "$f"): $l"; broken=$((broken+1)); }
      done < <(grep -oE '\]\([^)#:]+(#[^)]*)?\)' "$f" | sed 's/^](//; s/)$//' | sort -u || true)
    done
    echo "instalados ${#files[@]} fichero(s) en $DST (${broken} enlaces rotos)" ;;
esac
