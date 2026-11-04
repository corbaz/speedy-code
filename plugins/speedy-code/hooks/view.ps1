# Shows one pasted image in a popup, for the speedy-code 👁 menu: the file named by $env:SPEEDY_IMAGE.
# The popup stands in the middle of the screen the pointer is on, in the picture's own proportions, up to
# 80% of that screen's working area and never larger than the picture: the picture fills it, never deformed.
# A click on it or Esc closes it. It says "shown" once it is up, then "." every tenth of a second, so the
# mod wakes to end it; with no one reading, the write fails and it closes.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing

function Say($line) { [Console]::Out.WriteLine($line); [Console]::Out.Flush() }

$image = [System.Drawing.Image]::FromFile($env:SPEEDY_IMAGE)
$area = [System.Windows.Forms.Screen]::FromPoint([System.Windows.Forms.Cursor]::Position).WorkingArea
$scale = [Math]::Min(1.0, [Math]::Min($area.Width * 0.8 / $image.Width, $area.Height * 0.8 / $image.Height))
$width = [int][Math]::Round($image.Width * $scale)
$height = [int][Math]::Round($image.Height * $scale)

$form = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = 'None'
$form.StartPosition = 'Manual'
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.KeyPreview = $true
$form.BackColor = [System.Drawing.Color]::Black
$form.ClientSize = New-Object System.Drawing.Size($width, $height)
$form.Location = New-Object System.Drawing.Point(([int]($area.X + ($area.Width - $width) / 2)), ([int]($area.Y + ($area.Height - $height) / 2)))

$box = New-Object System.Windows.Forms.PictureBox
$box.Dock = 'Fill'
$box.SizeMode = 'Zoom'
$box.Image = $image
$form.Controls.Add($box)

$box.Add_Click({ $form.Close() })
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
