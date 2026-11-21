# Shows one file in a popup, for the speedy-code explorer: the file named by $env:SPEEDY_FILE.
# The popup stands in the middle of the screen the pointer is on, framed as view.ps1 frames a pasted image:
# a wide black contour, a blue line, the file's name in the middle of the top line and the close mark at
# its right. What it holds depends on the file:
#   an image (png, jpg, jpeg, gif, bmp, ico, tif, tiff): the picture, scaled down to fit, never deformed;
#   a PDF: its pages one under the other, drawn by Windows' own PDF reader, with a scroll bar;
#   anything else: its text, read-only, with scroll bars when it does not fit.
# The close mark or Esc closes it. It says "shown" once it is up, then "." every tenth of a second, so the
# mod wakes to end it; with no one reading, the write fails and it closes.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing

function Say($line) { [Console]::Out.WriteLine($line); [Console]::Out.Flush() }

$path = $env:SPEEDY_FILE
$extension = [IO.Path]::GetExtension($path).ToLowerInvariant()
$kind = if (@('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.tif', '.tiff') -contains $extension) { 'image' } elseif ($extension -eq '.pdf') { 'pdf' } else { 'text' }

# The frame's widths, in pixels, as view.ps1 has them.
$contour = 24
$line = 2
$margin = 12
$band = 16
$extraWidth = 2 * ($contour + $line + $margin)
$extraHeight = 2 * ($contour + $line) + $band + $margin

$black = [System.Drawing.Color]::Black
$blue = [System.Drawing.ColorTranslator]::FromHtml('#74c0fc')
$paper = [System.Drawing.ColorTranslator]::FromHtml('#16181d')
$ink = [System.Drawing.ColorTranslator]::FromHtml('#e9ecef')

$title = New-Object System.Windows.Forms.Label
$title.Text = " $([IO.Path]::GetFileName($path)) "
$title.AutoSize = $true
$title.Font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = $blue
$title.BackColor = $black

# [char] keeps the file ASCII: PowerShell 5.1 reads a script with no BOM in the system's code page.
$close = New-Object System.Windows.Forms.Label
$close.Text = " $([string][char]0x2715) "
$close.AutoSize = $true
$close.Font = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Bold)
$close.ForeColor = [System.Drawing.ColorTranslator]::FromHtml('#ff6b6b')
$close.BackColor = $black
$close.Cursor = [System.Windows.Forms.Cursors]::Hand

$area = [System.Windows.Forms.Screen]::FromPoint([System.Windows.Forms.Cursor]::Position).WorkingArea
$room = New-Object System.Drawing.Size(([int]($area.Width * 0.8 - $extraWidth)), ([int]($area.Height * 0.8 - $extraHeight)))

# What the frame holds, and the size it asks for inside the margin.
$disposables = @()
$pdfPages = $null
if ($kind -eq 'image') {
  # Read into memory, not with FromFile, which holds the file till the popup closes.
  $image = [System.Drawing.Image]::FromStream((New-Object System.IO.MemoryStream(, [System.IO.File]::ReadAllBytes($path))))
  $disposables += $image
  $scale = [Math]::Min(1.0, [Math]::Min($room.Width / $image.Width, $room.Height / $image.Height))
  $content = New-Object System.Windows.Forms.PictureBox
  $content.SizeMode = 'Zoom'
  $content.BackColor = $black
  $content.Image = $image
  $inner = New-Object System.Drawing.Size(([int][Math]::Round($image.Width * $scale)), ([int][Math]::Round($image.Height * $scale)))
} elseif ($kind -eq 'pdf') {
  # Windows' own PDF reader, through WinRT, which Windows PowerShell 5.1 can call.
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
  $null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 }
  $asOperation = $asTask | Where-Object { $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
  $asAction = $asTask | Where-Object { $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' } | Select-Object -First 1
  function Wait-Operation($operation, [Type]$type) { $task = $asOperation.MakeGenericMethod($type).Invoke($null, @($operation)); $task.Wait(); $task.Result }
  function Wait-Action($action) { $asAction.Invoke($null, @($action)).Wait() }
  $file = Wait-Operation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($path)) ([Windows.Storage.StorageFile])
  $document = Wait-Operation ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
  $pageWidth = [int][Math]::Min($room.Width - [System.Windows.Forms.SystemInformation]::VerticalScrollBarWidth - 8, 1100)
  $content = New-Object System.Windows.Forms.FlowLayoutPanel
  $content.FlowDirection = 'TopDown'
  $content.WrapContents = $false
  $content.AutoScroll = $true
  $content.BackColor = $paper
  $inner = New-Object System.Drawing.Size(($pageWidth + [System.Windows.Forms.SystemInformation]::VerticalScrollBarWidth + 8), $room.Height)
  # One page drawn now; the rest as the popup stands, a page a tick, so it comes up at once.
  $pdfPages = [pscustomobject]@{ Next = 0; Count = [int]$document.PageCount }
  function Add-Page([int]$index) {
    $page = $document.GetPage([uint32]$index)
    $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
    $options = New-Object Windows.Data.Pdf.PdfPageRenderOptions
    $options.DestinationWidth = [uint32]$pageWidth
    Wait-Action ($page.RenderToStreamAsync($stream, $options))
    $bitmap = [System.Drawing.Image]::FromStream([System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream.GetInputStreamAt(0)))
    $page.Dispose()
    $box = New-Object System.Windows.Forms.PictureBox
    $box.SizeMode = 'AutoSize'
    $box.Image = $bitmap
    $box.Margin = New-Object System.Windows.Forms.Padding(0, 0, 0, 8)
    $content.Controls.Add($box)
    $script:disposables += $bitmap
  }
  if ($pdfPages.Count -gt 0) { Add-Page 0; $pdfPages.Next = 1 }
} else {
  # Text as UTF-8 unless a mark says otherwise; a long file shows its first 2 MB.
  $bytes = [System.IO.File]::ReadAllBytes($path)
  $cut = $bytes.Length -gt 2MB
  $text = [System.Text.Encoding]::UTF8.GetString($bytes, 0, [Math]::Min($bytes.Length, 2MB))
  if ($text.Length -gt 0 -and $text[0] -eq [char]0xFEFF) { $text = $text.Substring(1) }
  if ($cut) { $text += "`r`n`r`n[...] (the file goes on past 2 MB)" }
  $content = New-Object System.Windows.Forms.RichTextBox
  $content.ReadOnly = $true
  $content.BorderStyle = 'None'
  $content.BackColor = $paper
  $content.ForeColor = $ink
  $content.Font = New-Object System.Drawing.Font('Consolas', 11)
  $content.DetectUrls = $false
  # Prose wraps; code and lists keep their lines and scroll sideways.
  $content.WordWrap = @('.md', '.markdown', '.txt') -contains $extension
  $content.ScrollBars = if ($content.WordWrap) { 'Vertical' } else { 'Both' }
  $content.Text = $text -replace "`r?`n", "`r`n"
  $inner = $room
}
$content.Dock = 'Fill'

# A small picture still leaves the top line room for its title and close mark.
$popupWidth = [Math]::Max($inner.Width + $extraWidth, 2 * $contour + $title.PreferredWidth + 2 * $close.PreferredWidth + 48)
$popupHeight = $inner.Height + $extraHeight
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

$frame = New-Object System.Windows.Forms.Panel
$frame.Dock = 'Fill'
$frame.BackColor = $blue
$frame.Padding = New-Object System.Windows.Forms.Padding($line)

$inside = New-Object System.Windows.Forms.Panel
$inside.Dock = 'Fill'
$inside.BackColor = $black
$inside.Padding = New-Object System.Windows.Forms.Padding($margin, $band, $margin, $margin)

$inside.Controls.Add($content)
$frame.Controls.Add($inside)
$form.Controls.Add($frame)

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
$timer.Add_Tick({
  try { Say '.' } catch { $form.Close(); return }
  if ($pdfPages -and $pdfPages.Next -lt $pdfPages.Count) {
    try { Add-Page $pdfPages.Next } catch { }
    $pdfPages.Next++
  }
})
$form.Add_Shown({
  $form.Activate()
  # The text starts at its top, with the caret out of sight and the wheel on it.
  if ($kind -eq 'text') { $content.SelectionStart = 0; $content.ScrollToCaret() }
  $content.Focus()
  Say 'shown'
  $timer.Start()
})

try {
  [System.Windows.Forms.Application]::Run($form)
} finally {
  $timer.Stop()
  foreach ($one in $disposables) { $one.Dispose() }
}
exit 0
