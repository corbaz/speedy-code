# Plays one saved narration for the speedy-code 📎 menu: the MP3 named by $env:SPEEDY_CLIP.
# $env:SPEEDY_CONTROL names a file that says "pause" or "play" while it plays, as speak.ps1's does, so the
# footer's play button pauses and goes on. Exits 0 when it played to the end, 1 when the file would not open.
# Ending the process stops it; the control file is removed as it ends.
$ErrorActionPreference = 'Stop'
$clip = $env:SPEEDY_CLIP
$control = $env:SPEEDY_CONTROL

Add-Type -AssemblyName PresentationCore
$player = New-Object System.Windows.Media.MediaPlayer
$player.Open([Uri]$clip)
$deadline = (Get-Date).AddSeconds(5)
while (-not $player.NaturalDuration.HasTimeSpan -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 20 }
if (-not $player.NaturalDuration.HasTimeSpan) { exit 1 }
$seconds = $player.NaturalDuration.TimeSpan.TotalSeconds

try {
  $player.Play()
  $isPaused = $false
  while ($true) {
    Start-Sleep -Milliseconds 100
    # A read that meets the writer is read again on the next tick.
    $asked = ''
    if ($control) { try { $asked = ([IO.File]::ReadAllText($control)).Trim() } catch { $asked = '' } }
    if ($asked -eq 'pause' -and -not $isPaused) { $player.Pause(); $isPaused = $true }
    elseif ($asked -eq 'play' -and $isPaused) { $player.Play(); $isPaused = $false }
    if (-not $isPaused -and $player.Position.TotalSeconds -ge ($seconds - 0.15)) { break }
  }
} finally {
  $player.Close()
  if ($control) { Remove-Item -LiteralPath $control -Force -ErrorAction SilentlyContinue }
}
exit 0
