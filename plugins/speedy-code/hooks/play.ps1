# Plays one saved narration, the MP3 at -Clip, to its end, for the speedy-code history menu.
# Exits 0 when it played to the end, 1 when the file would not open. Ending the process stops it.
param([Parameter(Mandatory = $true)][string]$Clip)
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName PresentationCore
$player = New-Object System.Windows.Media.MediaPlayer
$player.Open([Uri]$Clip)
$deadline = (Get-Date).AddSeconds(5)
while (-not $player.NaturalDuration.HasTimeSpan -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 20 }
if (-not $player.NaturalDuration.HasTimeSpan) { exit 1 }
$seconds = $player.NaturalDuration.TimeSpan.TotalSeconds
$player.Play()
Start-Sleep -Milliseconds ([int](($seconds + 0.5) * 1000))
$player.Close()
exit 0
