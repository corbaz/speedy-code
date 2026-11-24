# A small dialog for the speedy-code explorer, in the middle of the screen the pointer is on, framed as
# the viewer's popups are: a wide black contour, a blue line, a black band inside it, the title on the top
# line, the move mark and the close mark. Both kinds have one size and the same two buttons, at the same place.
#   SPEEDY_MODE=rename: two fields, the name and the extension of $env:SPEEDY_FILE, and Aceptar / Cancelar.
#     The new name is checked here (not empty, none of \ / : * ? " < > |, not another file of the folder)
#     and the dialog stays open, saying why, until it is right or cancelled.
#     Prints `rename <base64 of the UTF-8 new name>`, or `cancel`.
#   SPEEDY_KIND=dir: a folder; one field for its name, and Borrar says it goes with what it holds.
#   SPEEDY_MODE=delete: asks whether $env:SPEEDY_FILE goes to the Recycle Bin, Si, borrar / Cancelar. Prints `delete` or `cancel`.
#   SPEEDY_MODE=paste: asks whether $env:SPEEDY_FILE is copied or moved into the folder $env:SPEEDY_TARGET,
#     Copiar / Mover / Cancelar, and then whether for sure, Si, copiar / Cancelar. Prints `copy`, `move` or `cancel`.
#     With SPEEDY_ONLY=copy (a file of another machine, which stays there) it only asks whether for sure.
# Enter accepts a rename (a delete only by its button), and Esc or the close mark cancels. The file stays ASCII: PowerShell 5.1 reads a script
# with no BOM in the system's code page, so its Spanish goes through T, as \u escapes.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

function T([string]$text) { [regex]::Unescape($text) }
function Say($line) { [Console]::Out.WriteLine($line); [Console]::Out.Flush() }

$path = $env:SPEEDY_FILE
$mode = if ($env:SPEEDY_MODE -eq 'delete') { 'delete' } elseif ($env:SPEEDY_MODE -eq 'paste') { 'paste' } else { 'rename' }
$fileName = [IO.Path]::GetFileName($path)
# A folder (SPEEDY_KIND=dir) is renamed whole, with no extension, and goes to the trash with what it holds.
$isFolder = $env:SPEEDY_KIND -eq 'dir'
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
# Renombrar and Borrar are one dialog: the same size, the text from the same top, the same two buttons at
# the same place, the one that does it first and Cancelar after it.
$height = 250 + 2 * $band
$buttonWidth = 130
$buttonHeight = 38
$gap = 24

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

# The title, the move mark and the close mark ride the top line, on black, as the viewer's do.
$title = New-Object System.Windows.Forms.Label
$title.Text = ' ' + $(if ($mode -eq 'delete') { 'Borrar' } elseif ($mode -eq 'paste') { 'Pegar' } else { 'Renombrar' }) + ' '
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
# The move mark, at the close mark's left, as the viewer has it: held down, the popup follows the
# pointer and stays where it is let go. A label pressed keeps the mouse until it is let go, so the
# moves reach it even off the mark.
$drag = @{ At = $null }
$move = New-Object System.Windows.Forms.Label
$move.Text = " $([string][char]0x2725) "
$move.AutoSize = $true
$move.Font = New-Object System.Drawing.Font('Segoe UI Symbol', 12, [System.Drawing.FontStyle]::Bold)
$move.ForeColor = $frame.BackColor
$move.BackColor = $black
$move.Cursor = [System.Windows.Forms.Cursors]::SizeAll
$move.Add_MouseDown({
  if ($_.Button -ne 'Left') { return }
  $at = [System.Windows.Forms.Cursor]::Position
  $drag.At = @(($at.X - $form.Left), ($at.Y - $form.Top))
})
$move.Add_MouseMove({
  if (-not $drag.At) { return }
  $at = [System.Windows.Forms.Cursor]::Position
  $form.Location = New-Object System.Drawing.Point(($at.X - $drag.At[0]), ($at.Y - $drag.At[1]))
})
$move.Add_MouseUp({ $drag.At = $null })
$form.Controls.Add($title)
$form.Controls.Add($close)
$form.Controls.Add($move)
$title.BringToFront()
$close.BringToFront()
$move.BringToFront()
$lineMiddle = $contour + [int]($line / 2)
$title.Location = New-Object System.Drawing.Point(([int](($width - $title.PreferredWidth) / 2)), ($lineMiddle - [int]($title.PreferredHeight / 2)))
$close.Location = New-Object System.Drawing.Point(($width - $contour - $close.PreferredWidth - 10), ($lineMiddle - [int]($close.PreferredHeight / 2)))
$move.Location = New-Object System.Drawing.Point(($close.Location.X - $move.PreferredWidth - 2), ($lineMiddle - [int]($move.PreferredHeight / 2)))

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

# A button, all of one size, its text in the middle. `slot` 0 is the one that does it, 1 Cancelar after it:
# both on the bottom row, at the right, in every dialog. Pegar has one more at their left, slot -1.
function New-Action([string]$text, $fill, $color, [int]$slot) {
  $button = New-Object System.Windows.Forms.Label
  $button.Text = $text
  $button.AutoSize = $false
  $button.Size = New-Object System.Drawing.Size($buttonWidth, $buttonHeight)
  $button.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
  $button.Font = $bold
  $button.BackColor = $fill
  $button.ForeColor = $color
  $button.Cursor = [System.Windows.Forms.Cursors]::Hand
  $x = $inner - $gap - $buttonWidth - (1 - $slot) * ($buttonWidth + 12)
  $y = $innerHeight - $gap - $buttonHeight
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
$innerHeight = $height - 2 * ($contour + $line + $band)
if ($mode -eq 'rename') {
  # A dotfile (.gitignore) or a name with no dot is all name; otherwise the last dot parts them. A folder's
  # name is all name: one field, as wide as the two.
  $dot = if ($isFolder) { -1 } else { $fileName.LastIndexOf('.') }
  $base = if ($dot -gt 0) { $fileName.Substring(0, $dot) } else { $fileName }
  $extension = if ($dot -gt 0) { $fileName.Substring($dot + 1) } else { '' }
  [void](New-Text 'Nombre' $gap $gap $dim $font)
  if ($isFolder) {
    $nameBox = New-Box $base $gap 52 ($inner - 2 * $gap)
    $extensionBox = $null
  } else {
    [void](New-Text (T 'Extensi\u00f3n') 330 $gap $dim $font)
    $nameBox = New-Box $base $gap 52 290
    [void](New-Text '.' 318 54 $ink $bold)
    $extensionBox = New-Box $extension 330 52 ($inner - 330 - $gap)
  }
  $problem = New-Text '' $gap 92 $red $font
  $accept = New-Action 'Aceptar' $blue $black 0
  $cancel = New-Action 'Cancelar' $field $ink 1

  function Try-Accept {
    $name = $nameBox.Text.Trim()
    $ext = if ($extensionBox) { $extensionBox.Text.Trim().TrimStart('.') } else { '' }
    $wanted = if ($ext) { "$name.$ext" } else { $name }
    $why = ''
    if (-not $name) { $why = T 'El nombre est\u00e1 vac\u00edo.' }
    elseif ($wanted -eq '.' -or $wanted -eq '..') { $why = T 'Ese nombre no es v\u00e1lido.' }
    elseif ($wanted.IndexOfAny([char[]]'\/:*?"<>|') -ge 0) { $why = T 'No puede tener \\ / : * ? " < > |' }
    elseif ($wanted -ne $fileName -and $wanted.ToLowerInvariant() -ne $fileName.ToLowerInvariant() -and (Test-Path -LiteralPath (Join-Path $folder $wanted))) { $why = "Ya hay $(if ($isFolder) { 'una carpeta o un archivo' } else { 'un archivo' }) $wanted en esa carpeta." }
    if ($why) { $problem.Text = $why; return }
    if ($wanted -eq $fileName) { Finish 'cancel'; return }
    Finish ('rename ' + [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($wanted)))
  }
  $accept.Add_Click({ Try-Accept })
  $cancel.Add_Click({ Finish 'cancel' })
  $form.Add_Shown({ $form.Activate(); [void]$nameBox.Focus(); $nameBox.SelectAll() })
  $form.Add_KeyDown({ if ($_.KeyCode -eq 'Enter') { Try-Accept; $_.Handled = $true; $_.SuppressKeyPress = $true } })
} elseif ($mode -eq 'paste') {
  # Copiar or Mover first; the one chosen is then asked again, for sure, and only that answers. A press within
  # half a second of the choice is the same press twice, and is not an answer.
  $asking = New-Text (T '\u00bfCopiar o mover?') $gap $gap $ink $bold
  $shown = if ($fileName.Length -gt 46) { $fileName.Substring(0, 45) + [char]0x2026 } else { $fileName }
  [void](New-Text $shown $gap 52 $blue $bold)
  # The folder it goes into, its end kept when it is too long for the line.
  $where = [string]$env:SPEEDY_TARGET
  if ($where.Length -gt 50) { $where = [char]0x2026 + $where.Substring($where.Length - 49) }
  [void](New-Text "a $where" $gap 80 $dim $font)
  $copyIt = New-Action 'Copiar' $blue $black -1
  $accept = New-Action 'Mover' $blue $black 0
  $cancel = New-Action 'Cancelar' $field $ink 1
  $chosen = @{ Verb = ''; Since = [DateTime]::MinValue }
  function Choose([string]$verb) {
    $chosen.Verb = $verb
    $chosen.Since = [DateTime]::Now
    $copyIt.Visible = $false
    $asking.Text = if ($verb -eq 'move') { T '\u00bfSeguro que quer\u00e9s moverlo?' } else { T '\u00bfSeguro que quer\u00e9s copiarlo?' }
    $accept.Text = if ($verb -eq 'move') { T 'S\u00ed, mover' } else { T 'S\u00ed, copiar' }
  }
  $copyIt.Add_Click({ Choose 'copy' })
  $accept.Add_Click({
    if (-not $chosen.Verb) { Choose 'move' }
    elseif (([DateTime]::Now - $chosen.Since).TotalMilliseconds -gt 500) { Finish $chosen.Verb }
  })
  $cancel.Add_Click({ Finish 'cancel' })
  if ($env:SPEEDY_ONLY -eq 'copy') { Choose 'copy'; $chosen.Since = [DateTime]::MinValue }
  $form.Add_Shown({ $form.Activate(); [void]$cancel.Focus() })
} else {
  [void](New-Text (T '\u00bfMandar a la papelera?') $gap $gap $ink $bold)
  $shown = if ($fileName.Length -gt 46) { $fileName.Substring(0, 45) + [char]0x2026 } else { $fileName }
  [void](New-Text $shown $gap 52 $blue $bold)
  $note = if ($isFolder) { T 'Con todo lo que tiene. Se puede recuperar desde la Papelera.' } else { T 'Se puede recuperar desde la Papelera de reciclaje.' }
  [void](New-Text $note $gap 80 $dim $font)
  $accept = New-Action (T 'S\u00ed, borrar') $red $black 0
  $cancel = New-Action 'Cancelar' $field $ink 1
  $accept.Add_Click({ Finish 'delete' })
  $cancel.Add_Click({ Finish 'cancel' })
  $form.Add_Shown({ $form.Activate(); [void]$cancel.Focus() })
}

$close.Add_Click({ Finish 'cancel' })
$form.Add_KeyDown({ if ($_.KeyCode -eq 'Escape') { Finish 'cancel' } })
$form.Add_FormClosed({ if (-not $state.Said) { $state.Said = $true; Say 'cancel' } })

[System.Windows.Forms.Application]::Run($form)
exit 0
