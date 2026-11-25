# speedy-code: takes away what its setup installed under the mod's own folder, on Windows.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File uninstall.ps1 [-Data <folder>]
#
# It removes the Python environment (venv), the dictation model (models) and the mod's own ffmpeg (bin):
# what the setup brings again with "Instalar / reparar todo". It keeps what is the person's: the audios
# and images kept, the history and the settings. The fonts, uv and a ffmpeg of the system's stay too:
# other programs may use them.
#
# It prints "info <text>" for each folder, and "done" at the end, as install.ps1 does.
param(
  [string]$Data = (Join-Path $HOME '.claude\speedy-code')
)

$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
function Say($line) { [Console]::Out.WriteLine($line); [Console]::Out.Flush() }

# Only the mod's own folder is ever touched, whatever it is given.
if ((Split-Path -Leaf $Data) -ne 'speedy-code' -or -not (Test-Path -LiteralPath $Data -PathType Container)) {
  Say "info No es la carpeta de speedy-code: $Data"
  Say 'done con avisos'
  exit 1
}
$failed = $false
foreach ($name in @('venv', 'models', 'bin')) {
  $folder = Join-Path $Data $name
  if (-not (Test-Path -LiteralPath $folder)) { Say "info $name`: no estaba"; continue }
  Remove-Item -LiteralPath $folder -Recurse -Force -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $folder) {
    # A file in use stays: the dictation or a narration of this session holds the environment's Python.
    Say "info $name`: no se pudo borrar del todo (algo lo usa: cerrá el programa y probá otra vez)"
    $failed = $true
  } else { Say "info $name`: borrado" }
}
Say $(if ($failed) { 'done con avisos' } else { 'done' })
