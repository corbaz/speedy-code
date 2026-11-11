#!/bin/bash
# speedy-code: installs the plugin into Claude Code and everything it needs, from a clone of this
# repository, in one go. macOS; on Windows, install.ps1.
#
#   bash install.sh
#
# 1. Adds this folder to Claude Code as the `speedy-code` marketplace, and installs the plugin.
# 2. Runs plugins/speedy-code/setup/install.sh: uv, Python 3.12, the voices and the dictation
#    (see that script). The same runs from Claude Code: ⚙️ → Instalación.
# Then restart Claude Code. Running it again updates: it skips what is already in place.

here="$(cd "$(dirname "$0")" && pwd)"

if ! command -v claude >/dev/null 2>&1; then
  echo 'Falta Claude Code: instalalo primero (https://claude.com/claude-code).'
  exit 1
fi

echo '1/2  Instalando el plugin speedy-code en Claude Code'
# Already added: the marketplace is read again instead.
claude plugin marketplace add "$here" 2>&1 || claude plugin marketplace update speedy-code 2>&1
claude plugin install speedy-code@speedy-code 2>&1

echo '2/2  Instalando las voces y el dictado'
bash "$here/plugins/speedy-code/setup/install.sh" | while read -r word name rest; do
  case "$word" in
    step) echo "  … $rest" ;;
    ok) echo "  ✔ $rest" ;;
    fail) echo "  ✘ $rest" ;;
  esac
done

echo 'Listo. Reiniciá Claude Code: el pie de speedy-code aparece abajo a la derecha.'
echo 'Para pegar imágenes y enviar con ⏎: Ajustes del Sistema → Privacidad y seguridad → Accesibilidad → tu terminal.'
