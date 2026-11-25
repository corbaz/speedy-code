#!/bin/bash
# speedy-code: takes away what its setup installed under the mod's own folder, on macOS.
#
#   bash uninstall.sh [folder]
#
# It removes the Python environment (venv), the dictation model (models) and the mod's own ffmpeg (bin):
# what the setup brings again with "Instalar / reparar todo". It keeps what is the person's: the audios
# and images kept, the history and the settings. The fonts, uv and a ffmpeg of the system's stay too:
# other programs may use them.
#
# It prints "info <text>" for each folder, and "done" at the end, as install.sh does.

data="${1:-$HOME/.claude/speedy-code}"
failed=0

# Only the mod's own folder is ever touched, whatever it is given.
if [ "$(basename "$data")" != 'speedy-code' ] || [ ! -d "$data" ]; then
  echo "info No es la carpeta de speedy-code: $data"
  echo 'done con avisos'
  exit 1
fi
for name in venv models bin; do
  folder="$data/$name"
  if [ ! -e "$folder" ]; then echo "info $name: no estaba"; continue; fi
  rm -rf -- "$folder" 2>/dev/null
  if [ -e "$folder" ]; then
    echo "info $name: no se pudo borrar del todo"
    failed=1
  else
    echo "info $name: borrado"
  fi
done
if [ "$failed" -ne 0 ]; then echo 'done con avisos'; else echo 'done'; fi
