# speedy-code's status line: folder, branch, model, time, tokens, context left, cost and the 5-hour
# and weekly limits, in color. Claude Code runs it with the session's JSON on stdin; the setup copies
# it to ~/.claude/speedy-code and ⚙️ → Instalación turns it on (the previous status line is kept).
#
# Colors carry the meaning: context left is green above 50%, yellow down to 20%, red below; a limit
# used is green below 50%, yellow to 80%, red past it. Times are the machine's own time zone.
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$raw = [Console]::In.ReadToEnd()
if (-not $raw.Trim()) { exit 0 }
$data = $raw | ConvertFrom-Json

# A dot for decimals, whatever the region.
[System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::InvariantCulture

$e = [char]27
function Paint($text, $color) { "$e[$($color)m$text$e[0m" }
$CYAN = '38;5;81'; $VIOLET = '38;5;177'; $ORANGE = '1;38;5;215'; $GRAY = '38;5;245'
$YELLOW = '38;5;221'; $GREEN = '38;5;114'; $RED = '1;38;5;203'
$bar = Paint ' | ' $GRAY

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
function Left-Color($percent) { if ($percent -gt 50) { $GREEN } elseif ($percent -ge 20) { $YELLOW } else { $RED } }
function Used-Color($percent) { if ($percent -lt 50) { $GREEN } elseif ($percent -lt 80) { $YELLOW } else { $RED } }

$cwd = $data.cwd
if (-not $cwd) { $cwd = $data.workspace.current_dir }
$cwd = $cwd -replace [regex]::Escape($HOME), '~'
$model = $data.model.display_name
if (-not $model) { $model = $data.model }

$left = Paint $cwd $CYAN
if ($data.git.branch) { $left = "$left $(Paint "($($data.git.branch))" $VIOLET)" }
$left = "$left $(Paint '»' $GRAY)"

$usage = $data.context_window.current_usage
$tokens = Paint "in:$(Format-Tokens $usage.input_tokens) out:$(Format-Tokens $usage.output_tokens) cache:$(Format-Tokens $usage.cache_read_input_tokens)" $GRAY
$contextLeft = $data.context_window.remaining_percentage
if (-not $contextLeft) { $contextLeft = 100 }
$context = Paint "contexto:$([math]::Round($contextLeft))% libre" (Left-Color $contextLeft)
$cost = Paint ('sesión:$' + ([double]$data.cost.total_cost_usd).ToString('N2')) $YELLOW

$right = (Paint $model $ORANGE) + $bar + (Paint (Format-Duration $data.cost.total_duration_ms) $GRAY) + $bar + $tokens + $bar + $context + $bar + $cost

foreach ($window in @(@('five_hour', '5hs'), @('seven_day', 'semana'))) {
  $limit = $data.rate_limits.($window[0])
  if ($limit -and $limit.used_percentage) {
    $used = [math]::Round($limit.used_percentage)
    $right += $bar + (Paint "$($window[1]):$used% usado (reset $(Format-Reset $limit.resets_at))" (Used-Color $used))
  }
}

Write-Output "$left    $right"
