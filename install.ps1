# speedy-code: installs the plugin into Claude Code and everything it needs, from a clone of this
# repository, in one go.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 [-SkipModels] [-GroqKey <key>]
#
# 1. Adds this folder to Claude Code as the `speedy-code` marketplace, and installs the plugin.
# 2. Runs plugins/speedy-code/setup/install.ps1: uv, Python 3.12, the voices, the dictation and
#    the Whisper models (see that script). The same runs from Claude Code: ⚙️ → Instalación.
# Then restart Claude Code.
param(
  [switch]$SkipModels,
  [string]$GroqKey
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Write-Host 'Falta Claude Code: instalalo primero (https://claude.com/claude-code).' -ForegroundColor Red
  exit 1
}

Write-Host '1/2  Instalando el plugin speedy-code en Claude Code' -ForegroundColor Cyan
$previous = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& claude plugin marketplace add $PSScriptRoot 2>&1 | Out-Host
& claude plugin install speedy-code@speedy-code 2>&1 | Out-Host
$ErrorActionPreference = $previous

Write-Host '2/2  Instalando las voces, el dictado y los modelos' -ForegroundColor Cyan
$setup = Join-Path $PSScriptRoot 'plugins\speedy-code\setup\install.ps1'
$arguments = @{}
if ($SkipModels) { $arguments.SkipModels = $true }
if ($GroqKey) { $arguments.GroqKey = $GroqKey }
& $setup @arguments | ForEach-Object {
  $word, $rest = $_ -split ' ', 2
  switch ($word) {
    'step' { Write-Host "  … $(($rest -split ' ', 2)[1])" -ForegroundColor DarkGray }
    'ok' { Write-Host "  ✔ $(($rest -split ' ', 2)[1])" -ForegroundColor Green }
    'fail' { Write-Host "  ✘ $(($rest -split ' ', 2)[1])" -ForegroundColor Yellow }
    'done' { Write-Host '' }
  }
}

Write-Host 'Listo. Reiniciá Claude Code: el pie de speedy-code aparece abajo a la derecha.' -ForegroundColor Green
