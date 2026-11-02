# speedy-code's status line: folder, branch, version, model, effort, time, tokens, context used, cost
# and the 5-hour and weekly limits, in color. In a narrow terminal it keeps what matters most. Claude Code runs it with the session's JSON on stdin; the setup copies
# it to ~/.claude/speedy-code and ⚙️ → Instalación turns it on (the previous status line is kept).
#
# Every part has a color of its own, and its label is gray, so the eye finds each part by color.
# Levels carry a meaning on top: context left is green above 40%, yellow down to 20%, red at 20% or
# less, where Claude Code compacts; a limit used is green below 75%, yellow to 90%, red from 90%, where
# the warning comes; their bars fill in that color.
# Times are the machine's own time zone. This file keeps its UTF-8 BOM: PowerShell 5.1 reads it
# as ANSI without one, and the accents and glyphs break.
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$raw = [Console]::In.ReadToEnd()
if (-not $raw.Trim()) { exit 0 }
$data = $raw | ConvertFrom-Json

# A dot for decimals, whatever the region.
[System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::InvariantCulture

$e = [char]27
function Paint($text, $color) { "$e[$($color)m$text$e[0m" }

# One color per part (256-color codes). C_ keeps them apart from the values: PowerShell's names
# ignore case, so a color named $MODEL would be the same variable as the model's name, $model.
$C_FOLDER = '1;38;5;81'; $C_BRANCH = '38;5;177'; $C_MODEL = '1;38;5;215'; $C_TIME = '38;5;117'
$C_IN = '38;5;79'; $C_OUT = '38;5;211'; $C_CACHE = '38;5;147'; $C_COST = '1;38;5;220'
$C_FIVE = '38;5;111'; $C_WEEK = '38;5;183'; $C_LABEL = '38;5;245'; $C_DIM = '38;5;240'
# Levels.
$C_GREEN = '38;5;114'; $C_YELLOW = '38;5;221'; $C_RED = '1;38;5;203'
# Each effort level in a traffic-light color, from the cheapest (green) to the dearest (red).
$EFFORT_COLORS = @{ low = '38;5;114'; medium = '38;5;149'; high = '38;5;221'; xhigh = '38;5;215'; max = '1;38;5;203' }
# The levels set in ⚙️ → Barra de estado (written by the mod to this file); the defaults without it.
$levels = @{ contextYellow = 60; contextRed = 80; limitYellow = 75; limitRed = 90 }
# The parts by priority, also set there: where the width is short, the first ones go in, each in its place.
$priority = @('core', 'five_hour', 'seven_day', 'context', 'time', 'cost', 'tokens', 'folder')
$levelsFile = Join-Path $HOME '.claude\speedy-code\levels.json'
if (Test-Path -LiteralPath $levelsFile) {
  try {
    $saved = Get-Content -Raw -LiteralPath $levelsFile | ConvertFrom-Json
    foreach ($key in @($levels.Keys)) { if ($null -ne $saved.$key) { $levels[$key] = [int]$saved.$key } }
    if ($saved.priority) {
      # The parts it knows in its order, once each; any it lacks after them, in the default order.
      $known = @(@($saved.priority) | Where-Object { $priority -contains $_ } | Select-Object -Unique)
      $priority = @($known) + @($priority | Where-Object { $known -notcontains $_ })
    }
  } catch { }
}
function Rank-Of($key) { [array]::IndexOf($priority, $key) + 1 }
$bar = Paint ' │ ' $C_DIM

$days = @('Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb')

function Format-Reset($epoch) {
  if (-not $epoch) { return '' }
  $at = [DateTimeOffset]::FromUnixTimeSeconds([int64]$epoch).LocalDateTime
  $today = (Get-Date).Date
  $time = $at.ToString('HH:mm')
  if ($at.Date -eq $today) { return "hoy $time" }
  if ($at.Date -eq $today.AddDays(1)) { return "mañana $time" }
  return "$($days[[int]$at.DayOfWeek]) $time"
}

function Format-Tokens($n) {
  if (-not $n) { return '0' }
  $invariant = [Globalization.CultureInfo]::InvariantCulture
  # Past 999.95k the k rounds to 1000.0: that is already a million.
  if ($n -ge 999950) { return [string]::Format($invariant, '{0:0.#}M', $n / 1000000) }
  if ($n -ge 1000) { return [string]::Format($invariant, '{0:0.#}k', $n / 1000) }
  return "$n"
}

function Format-Duration($ms) {
  if (-not $ms) { return '0m' }
  $minutes = [int]($ms / 60000)
  $days = [int][math]::Floor($minutes / 1440)
  $hours = [int][math]::Floor(($minutes % 1440) / 60)
  $mins = $minutes % 60
  if ($days -ge 1) { return "${days}d ${hours}h ${mins}m" }
  if ($hours -ge 1) { return "${hours}h ${mins}m" }
  return "${mins}m"
}

# Green while there is room, yellow as it runs low, red when it is nearly gone.
function Context-Color($used) { if ($used -ge $levels.contextRed) { $C_RED } elseif ($used -ge $levels.contextYellow) { $C_YELLOW } else { $C_GREEN } }
function Limit-Color($used) { if ($used -ge $levels.limitRed) { $C_RED } elseif ($used -ge $levels.limitYellow) { $C_YELLOW } else { $C_GREEN } }

# A bar of four cells, as full as the percentage: the full ones in its color, the rest dim.
function Meter($percent, $color) {
  $full = [int][math]::Round([math]::Min(100, [math]::Max(0, $percent)) / 100 * 4)
  (Paint ('▰' * $full) $color) + (Paint ('▱' * (4 - $full)) $C_DIM)
}

# `label value`: the label gray, the value in its color.
# Its parameters are not $label or $color: PowerShell's names ignore case, and $label is $C_LABEL.
function Part($name, $value, $tone) { (Paint $name $C_LABEL) + ' ' + (Paint $value $tone) }

$cwd = $data.cwd
if (-not $cwd) { $cwd = $data.workspace.current_dir }
$cwd = $cwd -replace [regex]::Escape($HOME), '~'
$model = $data.model.display_name
if (-not $model) { $model = $data.model }
# The effort in force for this turn, as Claude Code reports it after any downgrade for the model.
$effort = $data.effort.level
# The Claude Code running this session: the version installed, as it reports itself.
$version = $data.version

$left = Paint $cwd $C_FOLDER
if ($data.git.branch) { $left = "$left $(Paint "⎇ $($data.git.branch)" $C_BRANCH)" }

$usage = $data.context_window.current_usage
$tokens = (Part 'in' (Format-Tokens $usage.input_tokens) $C_IN) + ' ' + (Part 'out' (Format-Tokens $usage.output_tokens) $C_OUT) + ' ' + (Part 'caché' (Format-Tokens $usage.cache_read_input_tokens) $C_CACHE)

# The tokens the context holds now: what the last request sent, cached or not; and the window's size.
$size = [double]$data.context_window.context_window_size
$held = [double]$usage.input_tokens + [double]$usage.cache_creation_input_tokens + [double]$usage.cache_read_input_tokens
# The share used: as Claude Code says it, else from what is left, else from the tokens and the size.
$contextUsed = $data.context_window.used_percentage
if ($null -eq $contextUsed) {
  $remaining = $data.context_window.remaining_percentage
  $contextUsed = if ($null -ne $remaining) { 100 - [double]$remaining } elseif ($size) { $held / $size * 100 } else { 0 }
}
$contextUsed = [math]::Round([double]$contextUsed)
$ctxColor = Context-Color $contextUsed
# The amount needs the size; with no request yet it is 0 of it. Without the size, the percentage goes alone.
$amount = if ($size) { ' ' + (Paint "$(Format-Tokens $held)/$(Format-Tokens $size)" $ctxColor) } else { '' }
$context = (Paint 'ctx:' $C_LABEL) + ' ' + (Meter $contextUsed $ctxColor) + ' ' + (Paint "$contextUsed%" $ctxColor) + $amount + $(if ($contextUsed -ge $levels.contextRed) { ' ' + (Paint '⚠  compactar' $C_RED) } else { '' })

$cost = Part 'sesión' ('$' + ([double]$data.cost.total_cost_usd).ToString('N2')) $C_COST

$core = $(if ($version) { (Paint "v$version" $C_TIME) + ' ' } else { '' }) + (Paint "◆ $model" $C_MODEL) + $(if ($effort) { ' ' + (Paint '·' $C_LABEL) + ' ' + (Paint $effort $(if ($EFFORT_COLORS[$effort]) { $EFFORT_COLORS[$effort] } else { $C_LABEL })) } else { '' })
$time = Paint "⏱  $(Format-Duration $data.cost.total_duration_ms)" $C_TIME

# Each part in the order it is drawn, with its rank when the width is short (1 goes first) and,
# for the limits, a short form without the reset time.
$parts = [System.Collections.ArrayList]::new()
[void]$parts.Add(@{ Rank = (Rank-Of 'folder'); Full = $left })
[void]$parts.Add(@{ Rank = (Rank-Of 'core'); Full = $core })
[void]$parts.Add(@{ Rank = (Rank-Of 'time'); Full = $time })
[void]$parts.Add(@{ Rank = (Rank-Of 'tokens'); Full = $tokens })
[void]$parts.Add(@{ Rank = (Rank-Of 'context'); Full = $context })
[void]$parts.Add(@{ Rank = (Rank-Of 'cost'); Full = $cost })
foreach ($window in @(@('five_hour', '5hs', $C_FIVE), @('seven_day', 'semana', $C_WEEK))) {
  $limit = $data.rate_limits.($window[0])
  # 0% is a limit too: PowerShell reads 0 as false, so test for the value's presence.
  if ($limit -and $null -ne $limit.used_percentage) {
    $used = [math]::Round($limit.used_percentage)
    $usedColor = Limit-Color $used
    $short = (Paint $window[1] $window[2]) + ' ' + (Meter $used $usedColor) + ' ' + (Paint "$used%" $usedColor) + $(if ($used -ge $levels.limitRed) { ' ' + (Paint '⚠' $C_RED) + ' ' } else { '' })
    [void]$parts.Add(@{ Rank = (Rank-Of $window[0]); Full = $short + ' ' + (Paint "↻ $(Format-Reset $limit.resets_at)" $C_LABEL); Short = $short })
  }
}

# The width Claude Code gives the line: COLUMNS, less a margin. Without it, everything goes.
# First the parts in rank order, each in its short form, until one does not fit: a lower rank never
# takes the place of a higher one. The model always goes. Then, with the room left, the limits get
# their reset time back in rank order. Nothing is cut in the middle with "…". The first by priority
# always goes, whatever it is.
function Visible($text) { ($text -replace "$e\[[0-9;]*m", '').Length }
$room = if ([int]$env:COLUMNS -gt 0) { [int]$env:COLUMNS - 4 } else { [int]::MaxValue }
$ranked = @($parts | Sort-Object { $_.Rank })
$taken = 0
foreach ($part in $ranked) {
  $form = if ($part.Short) { $part.Short } else { $part.Full }
  $gap = if ($taken) { 3 } else { 0 }
  if ($taken -gt 0 -and $taken + $gap + (Visible $form) -gt $room) { break }
  $part.Shown = $form
  $taken += $gap + (Visible $form)
}
foreach ($part in $ranked) {
  if (-not $part.Shown -or -not $part.Short) { continue }
  $more = (Visible $part.Full) - (Visible $part.Short)
  if ($taken + $more -le $room) { $part.Shown = $part.Full; $taken += $more }
}
$shown = @($parts | Where-Object { $_.Shown } | ForEach-Object { $_.Shown })
# The folder is set off by », the rest by │.
$line = if ($parts[0].Shown) { $parts[0].Shown + ' ' + (Paint '»' $C_DIM) + ' ' + (($shown | Select-Object -Skip 1) -join $bar) } else { $shown -join $bar }
Write-Output $line
