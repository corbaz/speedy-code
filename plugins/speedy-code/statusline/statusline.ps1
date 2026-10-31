# speedy-code's status line: folder, branch, model, time, tokens, context left, cost and the 5-hour
# and weekly limits, in color. Claude Code runs it with the session's JSON on stdin; the setup copies
# it to ~/.claude/speedy-code and ⚙️ → Instalación turns it on (the previous status line is kept).
#
# Every part has a color of its own, and its label is gray, so the eye finds each part by color.
# Levels carry a meaning on top: context left is green above 50%, yellow down to 20%, red below; a
# limit used is green below 50%, yellow to 80%, red past it; their bars fill in that color.
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
  if ($n -ge 1000000) { return '{0:N1}M' -f ($n / 1000000) }
  if ($n -ge 1000) { return '{0:N1}k' -f ($n / 1000) }
  return "$n"
}

function Format-Duration($ms) {
  if (-not $ms) { return '0m' }
  $minutes = [int]($ms / 60000)
  $hours = [int][math]::Floor($minutes / 60)
  if ($hours -ge 1) { return "${hours}h$($minutes % 60)m" }
  return "${minutes}m"
}

# Green while there is room, yellow as it runs low, red when it is nearly gone.
function Left-Color($percent) { if ($percent -gt 50) { $C_GREEN } elseif ($percent -ge 20) { $C_YELLOW } else { $C_RED } }
function Used-Color($percent) { if ($percent -lt 50) { $C_GREEN } elseif ($percent -lt 80) { $C_YELLOW } else { $C_RED } }

# A bar of eight cells, as full as the percentage: the full ones in its color, the rest dim.
function Meter($percent, $color) {
  $full = [int][math]::Round([math]::Min(100, [math]::Max(0, $percent)) / 100 * 8)
  (Paint ('▰' * $full) $color) + (Paint ('▱' * (8 - $full)) $C_DIM)
}

# `label value`: the label gray, the value in its color.
# Its parameters are not $label or $color: PowerShell's names ignore case, and $label is $C_LABEL.
function Part($name, $value, $tone) { (Paint $name $C_LABEL) + ' ' + (Paint $value $tone) }

$cwd = $data.cwd
if (-not $cwd) { $cwd = $data.workspace.current_dir }
$cwd = $cwd -replace [regex]::Escape($HOME), '~'
$model = $data.model.display_name
if (-not $model) { $model = $data.model }

$left = Paint $cwd $C_FOLDER
if ($data.git.branch) { $left = "$left $(Paint "⎇ $($data.git.branch)" $C_BRANCH)" }

$usage = $data.context_window.current_usage
$tokens = (Part 'in' (Format-Tokens $usage.input_tokens) $C_IN) + ' ' + (Part 'out' (Format-Tokens $usage.output_tokens) $C_OUT) + ' ' + (Part 'cache' (Format-Tokens $usage.cache_read_input_tokens) $C_CACHE)

$contextLeft = $data.context_window.remaining_percentage
if (-not $contextLeft) { $contextLeft = 100 }
$leftColor = Left-Color $contextLeft
$context = (Paint 'contexto' $C_LABEL) + ' ' + (Meter $contextLeft $leftColor) + ' ' + (Paint "$([math]::Round($contextLeft))% libre" $leftColor)

$cost = Part 'sesión' ('$' + ([double]$data.cost.total_cost_usd).ToString('N2')) $C_COST

$right = (Paint "◆ $model" $C_MODEL) + $bar + (Paint "⏱ $(Format-Duration $data.cost.total_duration_ms)" $C_TIME) + $bar + $tokens + $bar + $context + $bar + $cost

foreach ($window in @(@('five_hour', '5hs', $C_FIVE), @('seven_day', 'semana', $C_WEEK))) {
  $limit = $data.rate_limits.($window[0])
  if ($limit -and $limit.used_percentage) {
    $used = [math]::Round($limit.used_percentage)
    $usedColor = Used-Color $used
    $right += $bar + (Paint $window[1] $window[2]) + ' ' + (Meter $used $usedColor) + ' ' + (Paint "$used%" $usedColor) + ' ' + (Paint "↻ $(Format-Reset $limit.resets_at)" $C_LABEL)
  }
}

Write-Output "$left $(Paint '»' $C_DIM) $right"
