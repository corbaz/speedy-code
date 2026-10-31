# Speaks NARRATOR_TEXT with the Microsoft Edge neural voice NARRATOR_VOICE (edge-tts), for the speedy-code mod.
# Prints "voice <name>" once the audio plays, "." every tenth of a second while it plays, "error ..." on failure.
# Reads NARRATOR_CONTROL while it plays: "pause" pauses it, "play" goes on from where it stands.
#
# The text is cut in up to five parts at sentence ends, all synthesized at once: the first plays as soon
# as it is ready while the rest are still being made, and each plays after the one before.
$ErrorActionPreference = 'Stop'
$text = $env:NARRATOR_TEXT
$voice = $env:NARRATOR_VOICE
$control = $env:NARRATOR_CONTROL
if (-not $text -or -not $voice) { exit 0 }
function Say($line) { [Console]::Out.WriteLine($line); [Console]::Out.Flush() }

$maxParts = 5
$speed = 1.0
$null = [double]::TryParse("$env:NARRATOR_SPEED", [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$speed)
if ($speed -le 0) { $speed = 1.0 }
$percent = [int][Math]::Round(($speed - 1) * 100)
$rate = if ($percent -ge 0) { "+$percent%" } else { "$percent%" }

# A narration cut short never cleans up after itself: its files, and its pause file beside
# NARRATOR_CONTROL, go an hour later.
if ($control) {
  Get-ChildItem -LiteralPath (Split-Path -Parent $control) -Filter 'control-*.txt' -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddHours(-1) } |
    Remove-Item -Force -ErrorAction SilentlyContinue
}
$temp = [IO.Path]::GetTempPath()
Get-ChildItem -LiteralPath $temp -Filter 'speedy-code-*' -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddHours(-1) } |
  Remove-Item -Force -ErrorAction SilentlyContinue

# Up to five parts of about the same length, each ending where a sentence ends.
$sentences = @([regex]::Split($text.Trim(), '(?<=[.!?…:;])\s+') | Where-Object { $_.Trim() })
$size = [Math]::Max(1, [Math]::Ceiling($text.Length / $maxParts))
$parts = New-Object System.Collections.Generic.List[string]
$part = ''
foreach ($sentence in $sentences) {
  $part = if ($part) { "$part $sentence" } else { $sentence }
  if ($part.Length -ge $size -and $parts.Count -lt $maxParts - 1) { $parts.Add($part); $part = '' }
}
if ($part) { $parts.Add($part) }

# The audio is kept for an hour, named by its voice, rate and text: saying it again reuses it, and
# sessions narrating at once never share a file.
$sha = [Security.Cryptography.SHA256]::Create()
$key = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes("$voice|$rate|$text"))).Replace('-', '').Substring(0, 16)
$audios = @(0..($parts.Count - 1) | ForEach-Object { Join-Path $temp "speedy-code-$key-$_.mp3" })
$isKept = @($audios | Where-Object { -not (Test-Path -LiteralPath $_) }).Count -eq 0

$maker = $null
$textFiles = @()
try {
  if (-not $isKept) {
    for ($i = 0; $i -lt $parts.Count; $i++) {
      $textFile = Join-Path $temp "speedy-code-$PID-$i.txt"
      [IO.File]::WriteAllText($textFile, $parts[$i], (New-Object Text.UTF8Encoding $false))
      $textFiles += "`"$textFile`""
    }
    # One process makes them all: the first alone, then the rest at once while it plays.
    $arguments = @("`"$PSScriptRoot\tts.py`"", $voice, $rate, "`"$(Join-Path $temp "speedy-code-$key")`"") + $textFiles
    # The mod's own Python environment (NARRATOR_PYTHON), else whatever python the PATH finds.
    $python = if ($env:NARRATOR_PYTHON -and (Test-Path -LiteralPath $env:NARRATOR_PYTHON)) { $env:NARRATOR_PYTHON } else { (Get-Command python).Source }
    $maker = Start-Process -FilePath $python -ArgumentList $arguments -WindowStyle Hidden -PassThru
  }

  Add-Type -AssemblyName PresentationCore
  # Two players: the next part opens in one while the other plays, so parts follow with no gap.
  $players = @((New-Object System.Windows.Media.MediaPlayer), (New-Object System.Windows.Media.MediaPlayer))
  $opened = -1
  $isPaused = $false
  $isTold = $false
  for ($i = 0; $i -lt $parts.Count; $i++) {
    $audio = $audios[$i]
    $player = $players[$i % 2]
    # A part still being made: wait for it, as long as its maker runs.
    while (-not (Test-Path -LiteralPath $audio)) {
      if ($maker -and $maker.HasExited -and -not (Test-Path -LiteralPath $audio)) { Say "error edge-tts failed on part $($i + 1) ($($maker.ExitCode))"; exit 1 }
      Start-Sleep -Milliseconds 50
      if ($isTold) { Say '.' }
    }
    if ($opened -ne $i) { $player.Open([Uri]$audio); $opened = $i }
    $deadline = (Get-Date).AddSeconds(5)
    while (-not $player.NaturalDuration.HasTimeSpan -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 20 }
    if (-not $player.NaturalDuration.HasTimeSpan) { Say "error could not open part $($i + 1)"; exit 1 }
    $seconds = $player.NaturalDuration.TimeSpan.TotalSeconds
    if (-not $isPaused) { $player.Play() }
    if (-not $isTold) { Say "voice $voice"; $isTold = $true }
    $end = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $end) {
      Start-Sleep -Milliseconds 100
      Say '.'
      # The next part, once made, opens in the other player.
      $next = $i + 1
      if ($next -lt $parts.Count -and $opened -ne $next -and (Test-Path -LiteralPath $audios[$next])) {
        $players[$next % 2].Open([Uri]$audios[$next]); $opened = $next
      }
      # A read that meets the mod writing the file fails: it is read again on the next tick.
      $asked = ''
      if ($control) { try { $asked = ([IO.File]::ReadAllText($control)).Trim() } catch { $asked = '' } }
      if ($asked -eq 'pause' -and -not $isPaused) { $player.Pause(); $isPaused = $true }
      elseif ($asked -eq 'play' -and $isPaused) {
        $player.Play(); $isPaused = $false
        # What is left of this part, from where the audio stands.
        $end = (Get-Date).AddSeconds($seconds - $player.Position.TotalSeconds)
      }
      # Paused, nothing ends.
      if ($isPaused) { $end = (Get-Date).AddSeconds(1) }
    }
    $player.Stop()
  }
  foreach ($one in $players) { $one.Close() }
} catch {
  Say "error $($_.Exception.Message)"
  exit 1
} finally {
  # Ended early: the maker, if it still runs, stops with it.
  if ($maker -and -not $maker.HasExited) { Stop-Process -Id $maker.Id -Force -ErrorAction SilentlyContinue }
  foreach ($textFile in $textFiles) { Remove-Item -LiteralPath $textFile.Trim('"') -Force -ErrorAction SilentlyContinue }
  if ($control) { Remove-Item -LiteralPath $control -Force -ErrorAction SilentlyContinue }
}
