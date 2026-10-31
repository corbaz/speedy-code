# speedy-code setup: installs everything the mod needs beside its own code, on Windows.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 [-GroqKey <key>]
#
# What it installs, all under the user's own folders (no administrator rights):
#   - uv, the Python manager, if missing (from astral.sh, its official installer)
#   - a Python 3.12 environment at ~/.claude/speedy-code/venv (uv fetches Python 3.12 if missing)
#   - edge-tts (the voices), and winrt and pycaw (the dictation, by Windows' own speech recognizer)
# It then checks that Windows can dictate, the microphones, the Edge voices and the GROQ_API_KEY
# the pen uses; -GroqKey
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
  Run { uv pip install --python $python edge-tts pycaw winrt-runtime winrt-Windows.Foundation winrt-Windows.Foundation.Collections winrt-Windows.Globalization winrt-Windows.Media.SpeechRecognition }
  if ($LASTEXITCODE -ne 0) { throw "uv pip install salió con $LASTEXITCODE" }
  & $python -c "import edge_tts, winrt.windows.media.speechrecognition, pycaw; print('edge-tts, winrt y pycaw listos')"
  if ($LASTEXITCODE -ne 0) { throw 'los paquetes no se pueden importar' }
}

Step 'speech' 'Probando el dictado de Windows' {
  $answer = (& $python $listen --check es) -join ' '
  if ($answer -notlike 'ok *') { throw ($answer -replace '^fail ', '') }
  "reconocedor $($answer.Substring(3))"
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

Say $(if ($failed) { 'done con avisos' } else { 'done' })
