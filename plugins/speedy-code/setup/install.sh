#!/bin/bash
# speedy-code setup: installs everything the mod needs beside its own code, on macOS.
#
#   bash install.sh
#
# What it installs, all under the user's own folders (no administrator rights), as install.ps1 does on Windows:
#   - uv, the Python manager, if missing (from astral.sh, its official installer)
#   - a Python 3.12 environment at ~/.claude/speedy-code/venv (uv fetches Python 3.12 if missing)
#   - edge-tts (the voices), transcribe-cpp, sounddevice and numpy (the dictation)
#   - the dictation model, NVIDIA's Nemotron 3.5 ASR Streaming (about 750 MB, from Hugging Face),
#     at ~/.claude/speedy-code/models: dictation runs on this machine with it
# It then checks the microphones, the Edge voices and the GROQ_API_KEY the pen uses. The key is read
# from the environment: export it in ~/.zshrc. Its value is never printed.
#
# Every line it prints starts with a word the mod reads: "step <name> <text>" as a step starts,
# "ok <name> <text>" or "fail <name> <text>" as it ends, "info <text>" along the way, and "done"
# at the end. Run again at any time: each step skips what is already in place.

here="$(cd "$(dirname "$0")" && pwd)"
data="$HOME/.claude/speedy-code"
venv="$data/venv"
python="$venv/bin/python"
listen="$here/../hooks/listen.py"
model_url='https://huggingface.co/handy-computer/nemotron-3.5-asr-streaming-0.6b-gguf/resolve/main/nemotron-3.5-asr-streaming-0.6b-Q8_0.gguf'
failed=0
export PATH="$HOME/.local/bin:$PATH"

# step <name> <text> <function>: the function prints its result on success, or its reason on failure.
step() {
  local name="$1" text="$2" work="$3" result
  echo "step $name $text"
  if result="$($work)"; then
    echo "ok $name $(echo "$result" | tail -n 1)"
  else
    echo "fail $name $(echo "$result" | tail -n 1 | tr -s '[:space:]' ' ')"
    failed=1
  fi
}

uv_step() {
  if ! command -v uv >/dev/null 2>&1; then
    curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null 2>&1
    command -v uv >/dev/null 2>&1 || { echo 'uv no quedó instalado'; return 1; }
  fi
  uv --version
}

python_step() {
  mkdir -p "$data"
  if [ ! -x "$python" ]; then
    uv venv --python 3.12 "$venv" >/dev/null 2>&1 || { echo 'uv venv falló'; return 1; }
  fi
  "$python" --version
}

packages_step() {
  uv pip install --python "$python" edge-tts transcribe-cpp sounddevice numpy certifi truststore >/dev/null 2>&1 || { echo 'uv pip install falló'; return 1; }
  "$python" -c "import edge_tts, transcribe_cpp, sounddevice, numpy" >/dev/null 2>&1 || { echo 'los paquetes no se pueden importar'; return 1; }
  # uv's Python on macOS does not read the macOS keychain, and edge-tts trusts certifi's list alone: a
  # network that inspects HTTPS (a company proxy, an antivirus) signs with a root only the keychain has,
  # and every connection fails (ClientConnectorCertificateError). truststore makes Python verify with the
  # system's own trust, keychain included, in every script the environment runs; certifi if it is missing.
  # Loaded by a .pth file, not sitecustomize.py: Homebrew's Python ships its own sitecustomize, which
  # comes first on the path and hides one in the environment.
  local site
  site="$("$python" -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')" || { echo 'no encontré site-packages'; return 1; }
  rm -f "$site/sitecustomize.py"
  echo 'import speedy_trust' > "$site/speedy_trust.pth"
  printf '%s\n' \
    '# speedy-code: HTTPS verified by the system'"'"'s trust (the macOS keychain), as the browser does.' \
    'import os' \
    'try:' \
    '    import truststore' \
    '    truststore.inject_into_ssl()' \
    'except Exception:' \
    '    try:' \
    '        import certifi' \
    '        os.environ.setdefault("SSL_CERT_FILE", certifi.where())' \
    '    except ImportError:' \
    '        pass' > "$site/speedy_trust.py"
  "$python" -c 'import ssl; assert "truststore" in ssl.SSLContext.__module__' >/dev/null 2>&1 || { echo 'HTTPS sin el llavero de macOS (truststore no se cargó)'; return 1; }
  echo 'edge-tts, transcribe-cpp, sounddevice y numpy listos'
}

model_step() {
  local models="$data/models" model="$data/models/nemotron-3.5-asr-streaming-0.6b-Q8_0.gguf" answer
  if [ ! -f "$model" ]; then
    mkdir -p "$models"
    # To a .part first: a download cut halfway never passes for the model.
    if ! curl -L --fail --silent --show-error -o "$model.part" "$model_url"; then
      rm -f "$model.part"
      echo 'la descarga falló'
      return 1
    fi
    mv -f "$model.part" "$model"
  fi
  # Loaded as a dictation loads it: "ok es-US", or "fail" and why.
  answer="$("$python" "$listen" --check es 2>/dev/null | tr '\n' ' ' | sed 's/ *$//')"
  case "$answer" in
    'ok '*) echo "Nemotron listo (${answer#ok })" ;;
    *) echo "${answer#fail }"; return 1 ;;
  esac
}

mics_step() {
  local count
  count="$("$python" "$listen" --list 2>/dev/null | grep -c '^mic ')"
  [ "$count" -gt 0 ] || { echo 'no hay micrófonos conectados'; return 1; }
  echo "$count micrófono(s)"
}

voices_step() {
  local listed count why
  listed="$("$python" -m edge_tts --list-voices 2>&1)"
  count="$(printf '%s\n' "$listed" | grep -c 'Neural')"
  if [ "$count" -eq 0 ]; then
    # The error's last line says why (a certificate, no network): the step shows it.
    why="$(printf '%s\n' "$listed" | grep -v '^[[:space:]]*$' | tail -n 1 | cut -c1-120)"
    echo "no responden: ${why:-¿hay conexión a internet?}"
    return 1
  fi
  echo "$count voces"
}

groq_step() {
  [ -n "$GROQ_API_KEY" ] || { echo 'falta GROQ_API_KEY (opcional: solo la usa la pluma; exportala en ~/.zshrc)'; return 1; }
  echo 'GROQ_API_KEY presente'
}

# Claude Code's own preferences, the same on every machine: see claude_prefs.py.
prefs_step() {
  "$python" "$here/claude_prefs.py"
}

step uv 'Buscando uv, el administrador de Python' uv_step
step python 'Creando el entorno con Python 3.12' python_step
step packages 'Instalando las voces y el dictado' packages_step
step model 'Descargando el modelo de dictado (unos 750 MB, puede tardar)' model_step
step mics 'Buscando micrófonos' mics_step
step voices 'Consultando las voces de Edge' voices_step
step groq 'Buscando la clave de Groq de la pluma' groq_step
step prefs 'Ajustando las preferencias de Claude Code' prefs_step

if [ "$failed" -ne 0 ]; then echo 'done con avisos'; else echo 'done'; fi
