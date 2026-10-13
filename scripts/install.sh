#!/usr/bin/env bash
# Envoltorio para clones del repo: el instalador vive en plugins/lf/scripts/install.sh
set -e
d="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
exec "$d/../plugins/lf/scripts/install.sh" "$@"
