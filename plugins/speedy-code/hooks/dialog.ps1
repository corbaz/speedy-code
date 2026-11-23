# A small dialog for the speedy-code explorer, in the middle of the screen the pointer is on, framed as
# the viewer's popups are: a wide black contour, a blue line, the title on the top line and the close mark.
#   SPEEDY_MODE=rename: two fields, the name and the extension of $env:SPEEDY_FILE, and Aceptar / Cancelar.
#     The new name is checked here (not empty, none of \ / : * ? " < > |, not another file of the folder)
#     and the dialog stays open, saying why, until it is right or cancelled.
#     Prints `rename <base64 of the UTF-8 new name>`, or `cancel`.
#   SPEEDY_MODE=delete: asks whether $env:SPEEDY_FILE goes to the Recycle Bin, Si / No. Prints `delete` or `cancel`.
# Enter accepts a rename (a delete only by its button), and Esc or the close mark cancels. The file stays ASCII: PowerShell 5.1 reads a script
# with no BOM in the system's code page, so its Spanish goes through T, as \u escapes.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

function T([string]$text) { [regex]::Unescape($text) }
function Say($line) { [Console]::Out.WriteLine($line); [Console]::Out.Flush() }

$path = $env:SPEEDY_FILE
$mode = if ($env:SPEEDY_MODE -eq 'delete') { 'delete' } else { 'rename' }
$fileName = [IO.Path]::GetFileName($path)
$folder = [IO.Path]::GetDirectoryName($path)

$black = [System.Drawing.Color]::Black
$blue = [System.Drawing.ColorTranslator]::FromHtml('#74c0fc')
$red = [System.Drawing.ColorTranslator]::FromHtml('#ff6b6b')
$paper = [System.Drawing.ColorTranslator]::FromHtml('#16181d')
$field = [System.Drawing.ColorTranslator]::FromHtml('#25282e')
$ink = [System.Drawing.ColorTranslator]::FromHtml('#e9ecef')
$dim = [System.Drawing.ColorTranslator]::FromHtml('#adb5bd')
$font = New-Object System.Drawing.Font('Segoe UI', 11)
$bold = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)

$contour = 20
$line = 2
# Inside the line, a black band all round, as the viewer has: the title rides black on both sides of the line.
$margin = 12
$band = 16
$width = 520 + 2 * $margin
$height = $(if ($mode -eq 'rename') { 250 } else { 200 }) + 2 * $band

$form = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = 'None'
$form.StartPosition = 'Manual'
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.KeyPreview = $true
$form.BackColor = $black
$form.Padding = New-Object System.Windows.Forms.Padding($contour)
$form.ClientSize = New-Object System.Drawing.Size($width, $height)
$area = [System.Windows.Forms.Screen]::FromPoint([System.Windows.Forms.Cursor]::Position).WorkingArea
$form.Location = New-Object System.Drawing.Point(([int]($area.X + ($area.Width - $width) / 2)), ([int]($area.Y + ($area.Height - $height) / 2)))

$frame = New-Object System.Windows.Forms.Panel
$frame.Dock = 'Fill'
$frame.BackColor = $(if ($mode -eq 'delete') { $red } else { $blue })
$frame.Padding = New-Object System.Windows.Forms.Padding($line)
$inside = New-Object System.Windows.Forms.Panel
$inside.Dock = 'Fill'
$inside.BackColor = $black
$inside.Padding = New-Object System.Windows.Forms.Padding($margin, $band, $margin, $band)
$frame.Controls.Add($inside)
# What the dialog says and asks, on the paper inside the black band.
$body = New-Object System.Windows.Forms.Panel
$body.Dock = 'Fill'
$body.BackColor = $paper
$inside.Controls.Add($body)
$form.Controls.Add($frame)

# The title and the close mark ride the top line, on black, as the viewer's do.
$title = New-Object System.Windows.Forms.Label
$title.Text = ' ' + $(if ($mode -eq 'delete') { 'Borrar' } else { 'Renombrar' }) + ' '
$title.AutoSize = $true
$title.Font = $bold
$title.ForeColor = $frame.BackColor
$title.BackColor = $black
$close = New-Object System.Windows.Forms.Label
$close.Text = " $([string][char]0x2715) "
$close.AutoSize = $true
$close.Font = $bold
$close.ForeColor = $red
$close.BackColor = $black
$close.Cursor = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($title)
$form.Controls.Add($close)
$title.BringToFront()
$close.BringToFront()
$lineMiddle = $contour + [int]($line / 2)
$title.Location = New-Object System.Drawing.Point(([int](($width - $title.PreferredWidth) / 2)), ($lineMiddle - [int]($title.PreferredHeight / 2)))
$close.Location = New-Object System.Drawing.Point(($width - $contour - $close.PreferredWidth - 10), ($lineMiddle - [int]($close.PreferredHeight / 2)))

function New-Text([string]$text, [int]$x, [int]$y, $color, $face) {
  $label = New-Object System.Windows.Forms.Label
  $label.Text = $text
  $label.AutoSize = $true
  $label.Font = $face
  $label.ForeColor = $color
  $label.BackColor = $paper
  $label.Location = New-Object System.Drawing.Point($x, $y)
  $body.Controls.Add($label)
  $label
}

function New-Box([string]$text, [int]$x, [int]$y, [int]$boxWidth) {
  $box = New-Object System.Windows.Forms.TextBox
  $box.Text = $text
  $box.Font = $font
  $box.BorderStyle = 'FixedSingle'
  $box.BackColor = $field
  $box.ForeColor = $ink
  $box.Location = New-Object System.Drawing.Point($x, $y)
  $box.Width = $boxWidth
  $body.Controls.Add($box)
  $box
}

function New-Action([string]$text, $fill, $color, [int]$x, [int]$y) {
  $button = New-Object System.Windows.Forms.Label
  $button.Text = "  $text  "
  $button.AutoSize = $true
  $button.Font = $bold
  $button.BackColor = $fill
  $button.ForeColor = $color
  $button.Padding = New-Object System.Windows.Forms.Padding(4, 5, 4, 5)
  $button.Cursor = [System.Windows.Forms.Cursors]::Hand
  $button.Location = New-Object System.Drawing.Point($x, $y)
  $body.Controls.Add($button)
  $button
}

$state = [pscustomobject]@{ Said = $false }
function Finish([string]$answer) {
  if (-not $state.Said) { $state.Said = $true; Say $answer }
  $form.Close()
}

$inner = $width - 2 * ($contour + $line + $margin)
if ($mode -eq 'rename') {
  # A dotfile (.gitignore) or a name with no dot is all name; otherwise the last dot parts them.
  $dot = $fileName.LastIndexOf('.')
  $base = if ($dot -gt 0) { $fileName.Substring(0, $dot) } else { $fileName }
  $extension = if ($dot -gt 0) { $fileName.Substring($dot + 1) } else { '' }
  [void](New-Text 'Nombre' 24 30 $dim $font)
  [void](New-Text (T 'Extensi\u00f3n') 330 30 $dim $font)
  $nameBox = New-Box $base 24 56 290
  [void](New-Text '.' 318 58 $ink $bold)
  $extensionBox = New-Box $extension 330 56 ($inner - 330 - 24)
  $problem = New-Text '' 24 96 $red $font
  $accept = New-Action 'Aceptar' $blue $black ($inner - 24 - 220) 136
  $cancel = New-Action 'Cancelar' $field $ink ($inner - 24 - 100) 136

  function Try-Accept {
    $name = $nameBox.Text.Trim()
    $ext = $extensionBox.Text.Trim().TrimStart('.')
    $wanted = if ($ext) { "$name.$ext" } else { $name }
    $why = ''
    if (-not $name) { $why = T 'El nombre est\u00e1 vac\u00edo.' }
    elseif ($wanted -eq '.' -or $wanted -eq '..') { $why = T 'Ese nombre no es v\u00e1lido.' }
    elseif ($wanted.IndexOfAny([char[]]'\/:*?"<>|') -ge 0) { $why = T 'No puede tener \\ / : * ? " < > |' }
    elseif ($wanted -ne $fileName -and $wanted.ToLowerInvariant() -ne $fileName.ToLowerInvariant() -and (Test-Path -LiteralPath (Join-Path $folder $wanted))) { $why = "Ya hay un archivo $wanted en esa carpeta." }
    if ($why) { $problem.Text = $why; return }
    if ($wanted -eq $fileName) { Finish 'cancel'; return }
    Finish ('rename ' + [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($wanted)))
  }
  $accept.Add_Click({ Try-Accept })
  $cancel.Add_Click({ Finish 'cancel' })
  $form.Add_Shown({ $form.Activate(); [void]$nameBox.Focus(); $nameBox.SelectAll() })
  $form.Add_KeyDown({ if ($_.KeyCode -eq 'Enter') { Try-Accept; $_.Handled = $true; $_.SuppressKeyPress = $true } })
} else {
  [void](New-Text (T '\u00bfMandar a la papelera?') 24 26 $ink $bold)
  $shown = if ($fileName.Length -gt 46) { $fileName.Substring(0, 45) + [char]0x2026 } else { $fileName }
  [void](New-Text $shown 24 54 $blue $bold)
  [void](New-Text (T 'Se puede recuperar desde la Papelera de reciclaje.') 24 82 $dim $font)
  $accept = New-Action (T 'S\u00ed, borrar') $red $black ($inner - 24 - 200) 112
  $cancel = New-Action 'No' $field $ink ($inner - 24 - 60) 112
  $accept.Add_Click({ Finish 'delete' })
  $cancel.Add_Click({ Finish 'cancel' })
  $form.Add_Shown({ $form.Activate(); [void]$cancel.Focus() })
}

$close.Add_Click({ Finish 'cancel' })
$form.Add_KeyDown({ if ($_.KeyCode -eq 'Escape') { Finish 'cancel' } })
$form.Add_FormClosed({ if (-not $state.Said) { $state.Said = $true; Say 'cancel' } })

[System.Windows.Forms.Application]::Run($form)
exit 0
