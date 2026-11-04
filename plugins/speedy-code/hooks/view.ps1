# Shows one pasted image in a popup, for the speedy-code images menu: the file named by $env:SPEEDY_IMAGE.
# The popup stands in the middle of the screen the pointer is on, in the picture's own proportions, up to
# 80% of that screen's working area and never larger than the picture: the picture fills it, never deformed.
# A frame of two lines sets it apart from what is behind: a black one outside, a blue one inside.
# Its close mark (top right) or Esc closes it. It says "shown" once it is up, then "." every tenth of a
# second, so the mod wakes to end it; with no one reading, the write fails and it closes.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing

function Say($line) { [Console]::Out.WriteLine($line); [Console]::Out.Flush() }

$image = [System.Drawing.Image]::FromFile($env:SPEEDY_IMAGE)
$area = [System.Windows.Forms.Screen]::FromPoint([System.Windows.Forms.Cursor]::Position).WorkingArea
$scale = [Math]::Min(1.0, [Math]::Min($area.Width * 0.8 / $image.Width, $area.Height * 0.8 / $image.Height))
$width = [int][Math]::Round($image.Width * $scale)
$height = [int][Math]::Round($image.Height * $scale)

# The frame: the black line outside (the form's own padding) and the blue line inside (a panel's).
$outer = 1
$inner = 2
$frameWidth = $width + 2 * ($outer + $inner)
$frameHeight = $height + 2 * ($outer + $inner)

$form = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = 'None'
$form.StartPosition = 'Manual'
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.KeyPreview = $true
$form.BackColor = [System.Drawing.Color]::Black
$form.Padding = New-Object System.Windows.Forms.Padding($outer)
$form.ClientSize = New-Object System.Drawing.Size($frameWidth, $frameHeight)
$form.Location = New-Object System.Drawing.Point(([int]($area.X + ($area.Width - $frameWidth) / 2)), ([int]($area.Y + ($area.Height - $frameHeight) / 2)))

$frame = New-Object System.Windows.Forms.Panel
$frame.Dock = 'Fill'
$frame.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#74c0fc')
$frame.Padding = New-Object System.Windows.Forms.Padding($inner)

$box = New-Object System.Windows.Forms.PictureBox
$box.Dock = 'Fill'
$box.SizeMode = 'Zoom'
$box.BackColor = [System.Drawing.Color]::Black
$box.Image = $image
$frame.Controls.Add($box)
$form.Controls.Add($frame)

# The close mark, over the picture's top right corner. [char] keeps the file ASCII: PowerShell 5.1 reads
# a script with no BOM in the system's code page, which would garble the glyph.
$close = New-Object System.Windows.Forms.Label
$close.Text = [string][char]0x2715
$close.AutoSize = $true
$close.Font = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)
$close.ForeColor = [System.Drawing.ColorTranslator]::FromHtml('#ff6b6b')
$close.BackColor = [System.Drawing.Color]::Black
$close.Cursor = [System.Windows.Forms.Cursors]::Hand
$box.Controls.Add($close)
$close.Location = New-Object System.Drawing.Point(($width - $close.PreferredWidth - 6), 6)
$close.Add_Click({ $form.Close() })

$form.Add_KeyDown({ if ($_.KeyCode -eq 'Escape') { $form.Close() } })

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 100
$timer.Add_Tick({ try { Say '.' } catch { $form.Close() } })
$form.Add_Shown({ $form.Activate(); Say 'shown'; $timer.Start() })

try {
  [System.Windows.Forms.Application]::Run($form)
} finally {
  $timer.Stop()
  $image.Dispose()
}
exit 0
