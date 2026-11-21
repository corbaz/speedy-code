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

# Markdown's inline marks as HTML: code spans first, kept apart from the rest, then images and links,
# bold, italic and struck text. The text is escaped before any tag goes in.
function ConvertFrom-MarkdownInline([string]$text) {
  $parts = [regex]::Split($text, '(`+[^`]*?`+)')
  $out = New-Object System.Text.StringBuilder
  foreach ($part in $parts) {
    if ($part -match '^(`+)(.*?)\1$') { [void]$out.Append('<code>' + [System.Net.WebUtility]::HtmlEncode($Matches[2].Trim()) + '</code>'); continue }
    $html = [System.Net.WebUtility]::HtmlEncode($part)
    $html = [regex]::Replace($html, '!\[([^\]]*)\]\(([^)\s]+)[^)]*\)', '<span class="alt">[$1]</span>')
    $html = [regex]::Replace($html, '\[([^\]]+)\]\(([^)\s]+)[^)]*\)', '<a href="$2">$1</a>')
    $html = [regex]::Replace($html, '(?<![\w"=/])(https?://[^\s<]+)', '<a href="$1">$1</a>')
    $html = [regex]::Replace($html, '\*\*(.+?)\*\*|__(.+?)__', '<strong>$1$2</strong>')
    $html = [regex]::Replace($html, '(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\w)|(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)', '<em>$1$2</em>')
    $html = [regex]::Replace($html, '~~(.+?)~~', '<del>$1</del>')
    [void]$out.Append($html)
  }
  $out.ToString()
}

# A Markdown document as a page: headings, paragraphs, lists (nested by indent), quotes, fenced code,
# tables and rules, in the popup's dark colors. Enough to read a README, not every corner of CommonMark.
function ConvertFrom-Markdown([string]$markdown) {
  $lines = $markdown -split "`r?`n"
  $html = New-Object System.Text.StringBuilder
  $paragraph = New-Object System.Collections.Generic.List[string]
  $lists = New-Object System.Collections.Generic.List[object]
  $flush = {
    if ($paragraph.Count -gt 0) { [void]$html.Append('<p>' + (ConvertFrom-MarkdownInline ($paragraph -join ' ')) + "</p>`n"); $paragraph.Clear() }
  }
  $closeLists = {
    param([int]$above)
    while ($lists.Count -gt 0 -and $lists[$lists.Count - 1].Indent -ge $above) {
      [void]$html.Append('</li></' + $lists[$lists.Count - 1].Tag + ">`n"); $lists.RemoveAt($lists.Count - 1)
    }
  }
  $i = 0
  while ($i -lt $lines.Count) {
    $line = $lines[$i]
    if ($line -match '^\s*(```|~~~)\s*([\w+-]*)') {
      & $flush; & $closeLists 0
      $fence = $Matches[1]; $code = New-Object System.Collections.Generic.List[string]; $i++
      while ($i -lt $lines.Count -and $lines[$i] -notmatch ('^\s*' + [regex]::Escape($fence))) { $code.Add($lines[$i]); $i++ }
      [void]$html.Append('<pre><code>' + [System.Net.WebUtility]::HtmlEncode(($code -join "`n")) + "</code></pre>`n"); $i++; continue
    }
    if ($line -match '^\s*$') { & $flush; $i++; continue }
    if ($line -match '^(#{1,6})\s+(.*?)\s*#*\s*$') {
      & $flush; & $closeLists 0
      $level = $Matches[1].Length
      [void]$html.Append("<h$level>" + (ConvertFrom-MarkdownInline $Matches[2]) + "</h$level>`n"); $i++; continue
    }
    if ($line -match '^\s{0,3}([-*_])(\s*\1){2,}\s*$') { & $flush; & $closeLists 0; [void]$html.Append("<hr>`n"); $i++; continue }
    if ($line -match '^\s*\|.*\|\s*$' -and $i + 1 -lt $lines.Count -and $lines[$i + 1] -match '^\s*\|?\s*:?-{2,}') {
      & $flush; & $closeLists 0
      $cells = { param($row) ($row.Trim() -replace '^\||\|$', '') -split '\|' | ForEach-Object { ConvertFrom-MarkdownInline $_.Trim() } }
      [void]$html.Append('<table><tr>' + ((& $cells $line | ForEach-Object { "<th>$_</th>" }) -join '') + "</tr>`n"); $i += 2
      while ($i -lt $lines.Count -and $lines[$i] -match '^\s*\|') {
        [void]$html.Append('<tr>' + ((& $cells $lines[$i] | ForEach-Object { "<td>$_</td>" }) -join '') + "</tr>`n"); $i++
      }
      [void]$html.Append("</table>`n"); continue
    }
    if ($line -match '^\s*>\s?(.*)$') {
      & $flush; & $closeLists 0
      $quote = New-Object System.Collections.Generic.List[string]
      while ($i -lt $lines.Count -and $lines[$i] -match '^\s*>\s?(.*)$') { $quote.Add($Matches[1]); $i++ }
      [void]$html.Append('<blockquote>' + (ConvertFrom-Markdown ($quote -join "`n")) + "</blockquote>`n"); continue
    }
    if ($line -match '^(\s*)([-*+]|\d+[.)])\s+(.*)$') {
      & $flush
      $indent = $Matches[1].Replace("`t", '    ').Length; $tag = if ($Matches[2] -match '\d') { 'ol' } else { 'ul' }; $item = $Matches[3]
      # A task list's box, drawn as one.
      $box = ''
      if ($item -match '^\[([ xX])\]\s*(.*)$') { $box = if ($Matches[1] -eq ' ') { '&#9744; ' } else { '&#9745; ' }; $item = $Matches[2] }
      & $closeLists ($indent + 1)
      if ($lists.Count -gt 0 -and $lists[$lists.Count - 1].Indent -eq $indent -and $lists[$lists.Count - 1].Tag -eq $tag) {
        [void]$html.Append("</li>`n<li>")
      } else {
        if ($lists.Count -gt 0 -and $lists[$lists.Count - 1].Indent -eq $indent) { & $closeLists $indent }
        [void]$html.Append("<$tag><li>"); $lists.Add([pscustomobject]@{ Indent = $indent; Tag = $tag })
      }
      [void]$html.Append($box + (ConvertFrom-MarkdownInline $item))
      $i++; continue
    }
    if ($lists.Count -gt 0 -and $line -match '^\s+\S') { [void]$html.Append(' ' + (ConvertFrom-MarkdownInline $line.Trim())); $i++; continue }
    & $closeLists 0
    $paragraph.Add($line.Trim()); $i++
  }
  & $flush; & $closeLists 0
  $html.ToString()
}

function New-MarkdownPage([string]$markdown) {
  @"
<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><style>
body { background: #16181d; color: #e9ecef; font: 15px/1.55 'Segoe UI', sans-serif; margin: 18px 26px; }
h1, h2 { border-bottom: 1px solid #343a40; padding-bottom: 4px; } h1, h2, h3, h4, h5, h6 { color: #74c0fc; margin: 1.1em 0 .5em; }
a { color: #4dabf7; } code { font-family: Consolas, monospace; background: #25282e; padding: 1px 5px; border-radius: 4px; color: #ffd43b; }
pre { background: #0f1115; border: 1px solid #343a40; padding: 10px 12px; overflow: auto; border-radius: 6px; }
pre code { background: none; padding: 0; color: #e9ecef; } blockquote { border-left: 4px solid #4dabf7; margin: 0; padding: 2px 14px; color: #adb5bd; }
table { border-collapse: collapse; margin: 8px 0; } th, td { border: 1px solid #343a40; padding: 5px 10px; text-align: left; vertical-align: top; } th { background: #25282e; }
hr { border: 0; border-top: 1px solid #343a40; } .alt { color: #868e96; } del { color: #868e96; } li { margin: 2px 0; }
</style></head><body>
$(ConvertFrom-Markdown $markdown)
</body></html>
"@
}

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

# Markdown opens drawn as a page, the Preview; a switch beside the title shows its text, MD, and back.
$preview = $null
if (@('.md', '.markdown') -contains $extension) {
  $preview = New-Object System.Windows.Forms.WebBrowser
  $preview.Dock = 'Fill'
  $preview.ScriptErrorsSuppressed = $true
  $preview.IsWebBrowserContextMenuEnabled = $false
  $preview.AllowWebBrowserDrop = $false
  $preview.DocumentText = New-MarkdownPage $text
  # A link opens in the browser, not in the popup.
  $preview.Add_Navigating({
    if ($_.Url.Scheme -in @('http', 'https', 'mailto')) { $_.Cancel = $true; Start-Process $_.Url.AbsoluteUri }
  })
  $preview.Add_PreviewKeyDown({ if ($_.KeyCode -eq 'Escape') { $form.Close() } })
  $content.Visible = $false
}

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
if ($preview) { $inside.Controls.Add($preview) }
$frame.Controls.Add($inside)
$form.Controls.Add($frame)

$lineMiddle = $contour + [int]($line / 2)
$form.Controls.Add($title)
$form.Controls.Add($close)
$title.BringToFront()
$close.BringToFront()
$title.Location = New-Object System.Drawing.Point(([int](($popupWidth - $title.PreferredWidth) / 2)), ($lineMiddle - [int]($title.PreferredHeight / 2)))

# The switch beside the title: the view shown filled in blue, the other in blue on black.
if ($preview) {
  $switch = @{}
  foreach ($view in @('Preview', 'MD')) {
    $label = New-Object System.Windows.Forms.Label
    $label.Text = " $view "
    $label.AutoSize = $true
    $label.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
    $label.Cursor = [System.Windows.Forms.Cursors]::Hand
    $label.Tag = $view
    $switch[$view] = $label
    $form.Controls.Add($label)
    $label.BringToFront()
  }
  $left = $title.Location.X + $title.PreferredWidth + 10
  foreach ($view in @('Preview', 'MD')) {
    $label = $switch[$view]
    $label.Location = New-Object System.Drawing.Point($left, ($lineMiddle - [int]($label.PreferredHeight / 2)))
    $left += $label.PreferredWidth + 4
  }
  function Show-View([string]$view) {
    $preview.Visible = $view -eq 'Preview'
    $content.Visible = $view -eq 'MD'
    foreach ($one in $switch.Values) {
      $isShown = $one.Tag -eq $view
      $one.BackColor = if ($isShown) { $blue } else { $black }
      $one.ForeColor = if ($isShown) { $black } else { $blue }
    }
    if ($view -eq 'MD') { [void]$content.Focus() } else { [void]$preview.Focus() }
  }
  foreach ($one in $switch.Values) { $one.Add_Click({ Show-View $this.Tag }) }
  Show-View 'Preview'
}
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
  if ($preview -and $preview.Visible) { [void]$preview.Focus() } else { [void]$content.Focus() }
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
