# speedy-code setup: installs everything the mod needs beside its own code, on Windows.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 [-GroqKey <key>]
#
# What it installs, all under the user's own folders (no administrator rights):
#   - uv, the Python manager, if missing (from astral.sh, its official installer)
#   - a Python 3.12 environment at ~/.claude/speedy-code/venv (uv fetches Python 3.12 if missing)
#   - edge-tts (the voices), transcribe-cpp, sounddevice and numpy (the dictation)
#   - the dictation model, NVIDIA's Nemotron 3.5 ASR Streaming (about 750 MB, from Hugging Face),
#     at ~/.claude/speedy-code/models: dictation runs on this machine with it
# It then checks the microphones, the Edge voices and the GROQ_API_KEY the pen uses; -GroqKey
# saves that key as a user environment variable. The key's value is never printed.
#
# Every line it prints starts with a word the mod reads: "step <name> <text>" as a step starts,
# "ok <name> <text>" or "fail <name> <text>" as it ends, "info <text>" along the way, and "done"
# at the end. Run again at any time: each step skips what is already in place.
param(
  [string]$GroqKey
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# The mod reads these lines as UTF-8, accents included.
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
function Say($line) { [Console]::Out.WriteLine($line); [Console]::Out.Flush() }

# A program's notes on stderr (uv writes them there) are not failures: its exit code says.
function Run([scriptblock]$command) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $command 2>&1 | ForEach-Object { Say "info $_" } } finally { $ErrorActionPreference = $previous }
}

$data = Join-Path $HOME '.claude\speedy-code'
$venv = Join-Path $data 'venv'
$python = Join-Path $venv 'Scripts\python.exe'
$listen = Join-Path $PSScriptRoot '..\hooks\listen.py'
$failed = $false

function Step($name, $text, [scriptblock]$work) {
  Say "step $name $text"
  try {
    $result = & $work
    Say "ok $name $result"
  } catch {
    Say "fail $name $($_.Exception.Message -replace '\s+', ' ')"
    $script:failed = $true
  }
}

Step 'uv' 'Buscando uv, el administrador de Python' {
  if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Say 'info Instalando uv desde astral.sh'
    Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression | Out-Null
    $env:Path = "$HOME\.local\bin;$env:Path"
    if (-not (Get-Command uv -ErrorAction SilentlyContinue)) { throw 'uv no quedó instalado' }
  }
  (& uv --version) -join ' '
}

Step 'python' 'Creando el entorno con Python 3.12' {
  New-Item -ItemType Directory -Force -Path $data | Out-Null
  if (-not (Test-Path -LiteralPath $python)) {
    Run { uv venv --python 3.12 $venv }
    if ($LASTEXITCODE -ne 0) { throw "uv venv salió con $LASTEXITCODE" }
  }
  (& $python --version) -join ' '
}

Step 'packages' 'Instalando las voces y el dictado' {
  Run { uv pip install --python $python edge-tts transcribe-cpp sounddevice numpy }
  if ($LASTEXITCODE -ne 0) { throw "uv pip install salió con $LASTEXITCODE" }
  # transcribe-cpp notes on stderr as it loads: Run keeps them from counting as a failure.
  Run { & $python -c "import edge_tts, transcribe_cpp, sounddevice, numpy" }
  if ($LASTEXITCODE -ne 0) { throw 'los paquetes no se pueden importar' }
  'edge-tts, transcribe-cpp, sounddevice y numpy listos'
}

Step 'model' 'Descargando el modelo de dictado (unos 750 MB, puede tardar)' {
  $models = Join-Path $data 'models'
  $model = Join-Path $models 'nemotron-3.5-asr-streaming-0.6b-Q8_0.gguf'
  if (-not (Test-Path -LiteralPath $model)) {
    New-Item -ItemType Directory -Force -Path $models | Out-Null
    # To a .part first: a download cut halfway never passes for the model.
    $part = "$model.part"
    Run { curl.exe -L --fail --silent --show-error -o $part 'https://huggingface.co/handy-computer/nemotron-3.5-asr-streaming-0.6b-gguf/resolve/main/nemotron-3.5-asr-streaming-0.6b-Q8_0.gguf' }
    if ($LASTEXITCODE -ne 0) { Remove-Item -LiteralPath $part -ErrorAction SilentlyContinue; throw "la descarga salió con $LASTEXITCODE" }
    Move-Item -LiteralPath $part -Destination $model -Force
  }
  # Loaded as a dictation loads it: "ok es-US", or "fail" and why.
  $answer = (& $python $listen --check es) -join ' '
  if ($answer -notlike 'ok *') { throw ($answer -replace '^fail ', '') }
  "Nemotron listo ($($answer.Substring(3)))"
}

Step 'mics' 'Buscando micrófonos' {
  $found = @(& $python $listen --list | Where-Object { $_ -like 'mic *' })
  if ($found.Count -eq 0) { throw 'no hay micrófonos conectados' }
  "$($found.Count) micrófono(s)"
}

Step 'voices' 'Consultando las voces de Edge' {
  $count = @(& $python -m edge_tts --list-voices 2>$null | Where-Object { $_ -match 'Neural' }).Count
  if ($count -eq 0) { throw 'no responden: ¿hay conexión a internet?' }
  "$count voces"
}

Step 'groq' 'Buscando la clave de Groq de la pluma' {
  if ($GroqKey) {
    [Environment]::SetEnvironmentVariable('GROQ_API_KEY', $GroqKey, 'User')
    $env:GROQ_API_KEY = $GroqKey
  }
  $key = if ($env:GROQ_API_KEY) { $env:GROQ_API_KEY } else { [Environment]::GetEnvironmentVariable('GROQ_API_KEY', 'User') }
  if (-not $key) { throw 'falta GROQ_API_KEY (opcional: solo la usa la pluma)' }
  'GROQ_API_KEY presente'
}

Step 'prefs' 'Ajustando las preferencias de Claude Code' {
  $said = (& $python (Join-Path $PSScriptRoot 'claude_prefs.py')) -join ' '
  if ($LASTEXITCODE -ne 0) { throw $said }
  $said
}

Say $(if ($failed) { 'done con avisos' } else { 'done' })
