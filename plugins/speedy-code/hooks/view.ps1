# Shows one pasted image in a popup, for the speedy-code images menu: the file named by $env:SPEEDY_IMAGE.
# The popup stands in the middle of the screen the pointer is on, in the picture's own proportions, up to
# 80% of that screen's working area and never larger than the picture: the picture fills its place, never
# deformed. Its frame, from outside in: a wide black contour that hides what is behind, a blue line, and a
# black margin. On the top line, as the terminal panel has them: the file's name in the middle and the
# close mark at the right.
# The close mark or Esc closes it. It says "shown" once it is up, then "." every tenth of a second, so the
# mod wakes to end it; with no one reading, the write fails and it closes.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing

function Say($line) { [Console]::Out.WriteLine($line); [Console]::Out.Flush() }

# The frame's widths, in pixels. The band under the top line leaves room for the half of the title and
# the close mark that hangs below it.
$contour = 24
$line = 2
$margin = 12
$band = 16
$extraWidth = 2 * ($contour + $line + $margin)
$extraHeight = 2 * ($contour + $line) + $band + $margin

$black = [System.Drawing.Color]::Black
$blue = [System.Drawing.ColorTranslator]::FromHtml('#74c0fc')

# On the top line, as the terminal panel has them: the file's name in the middle, the close mark at the
# right. Each on black, so it cuts the line. [char] keeps the file ASCII: PowerShell 5.1 reads a script
# with no BOM in the system's code page, which would garble the glyph.
$title = New-Object System.Windows.Forms.Label
$title.Text = " $([IO.Path]::GetFileName($env:SPEEDY_IMAGE)) "
$title.AutoSize = $true
$title.Font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = $blue
$title.BackColor = $black

$close = New-Object System.Windows.Forms.Label
$close.Text = " $([string][char]0x2715) "
$close.AutoSize = $true
$close.Font = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Bold)
$close.ForeColor = [System.Drawing.ColorTranslator]::FromHtml('#ff6b6b')
$close.BackColor = $black
$close.Cursor = [System.Windows.Forms.Cursors]::Hand

# Read into memory, not with FromFile, which holds the file till the popup closes: clearing the history
# could not delete the image shown.
$image = [System.Drawing.Image]::FromStream((New-Object System.IO.MemoryStream(, [System.IO.File]::ReadAllBytes($env:SPEEDY_IMAGE))))
$area = [System.Windows.Forms.Screen]::FromPoint([System.Windows.Forms.Cursor]::Position).WorkingArea
# The picture's scale: what leaves the whole popup within 80% of the screen, never above its own size.
$scale = [Math]::Min(1.0, [Math]::Min(($area.Width * 0.8 - $extraWidth) / $image.Width, ($area.Height * 0.8 - $extraHeight) / $image.Height))
$width = [int][Math]::Round($image.Width * $scale)
$height = [int][Math]::Round($image.Height * $scale)
# A small picture still leaves the top line room for its title and close mark: the picture stays its
# size, centered, with black beside it.
$popupWidth = [Math]::Max($width + $extraWidth, 2 * $contour + $title.PreferredWidth + 2 * $close.PreferredWidth + 48)
$popupHeight = $height + $extraHeight
$form = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = 'None'
$form.StartPosition = 'Manual'
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.KeyPreview = $true
$form.BackColor = $black
$form.Padding = New-Object System.Windows.Forms.Padding($contour)
$form.ClientSize = New-Object System.Drawing.Size($popupWidth, $popupHeight)
$form.Location = New-Object System.Drawing.Point(([int]($area.X + ($area.Width - $popupWidth) / 2)), ([int]($area.Y + ($area.Height - $popupHeight) / 2)))

# The blue line: a panel of that color, as wide as the line around what it holds.
$frame = New-Object System.Windows.Forms.Panel
$frame.Dock = 'Fill'
$frame.BackColor = $blue
$frame.Padding = New-Object System.Windows.Forms.Padding($line)

# Inside the line: black, the band on top under the title, the margin around the picture.
$inside = New-Object System.Windows.Forms.Panel
$inside.Dock = 'Fill'
$inside.BackColor = $black
$inside.Padding = New-Object System.Windows.Forms.Padding($margin, $band, $margin, $margin)

$box = New-Object System.Windows.Forms.PictureBox
$box.Dock = 'Fill'
$box.SizeMode = 'Zoom'
$box.BackColor = $black
$box.Image = $image

$inside.Controls.Add($box)
$frame.Controls.Add($inside)
$form.Controls.Add($frame)

# The title and the close mark ride the top line, their middle on it, drawn over the frame.
$lineMiddle = $contour + [int]($line / 2)
$form.Controls.Add($title)
$form.Controls.Add($close)
$title.BringToFront()
$close.BringToFront()
$title.Location = New-Object System.Drawing.Point(([int](($popupWidth - $title.PreferredWidth) / 2)), ($lineMiddle - [int]($title.PreferredHeight / 2)))
$close.Location = New-Object System.Drawing.Point(($popupWidth - $contour - $close.PreferredWidth - 12), ($lineMiddle - [int]($close.PreferredHeight / 2)))
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
