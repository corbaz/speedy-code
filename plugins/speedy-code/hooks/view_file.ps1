# Shows one file in a popup, for the speedy-code explorer: the file named by $env:SPEEDY_FILE.
# The popup stands in the middle of the screen the pointer is on, framed as view.ps1 frames a pasted image:
# a wide black contour, a blue line, the file's name in the middle of the top line and the close mark at
# its right, with "Copiar" beside it when there is something to copy. What it holds depends on the file:
#   an image (png, jpg, jpeg, gif, bmp, ico, tif, tiff): the picture, scaled down to fit, never deformed;
#   a PDF: its pages one under the other, drawn by Windows' own PDF reader, with a scroll bar;
#   Markdown, HTML and SVG: drawn as a page, the Preview, with a switch beside the title to their source;
#   a spreadsheet (xlsx, xlsm; xls through Excel) or a Word document (docx; doc through Word): drawn as a page;
#   audio and video: played by Windows' own media player, with a dark bar to pause, seek and set the volume;
#   a SQLite database (sqlite, sqlite3, db, db3, or any file that starts as one): its tables and views, a tab
#   each, with their columns and first rows, read by db_view.py;
#   a Windows shortcut (.lnk) or an Internet shortcut (.url): where it leads, as selectable text;
#   a zip archive (zip, jar, apk, nupkg, vsix, whl, epub, or any file that starts as one): what it holds, as
#   a table of names, sizes and dates, read only, nothing extracted;
#   any other file that reads as text (yaml, toml, xml, csv, logs, dotfiles, LICENSE and other files with no
#   extension, .bak and .tmp that hold text): its text, read-only but selectable;
#   anything else (crx, .DS_Store, .sys, other binaries): what can be told about it, as selectable text.
# A minified file (one-line JSON, even with no extension; JSON Lines; minified JavaScript, CSS, HTML, XML,
# SVG) also gets its text laid out by pretty.py while the popup stands, the file itself untouched: once it
# comes, a switch beside the title shows it, Formateado, or the text as it is, Original.
# The bottom line repeats Copiar and the close mark, for a popup taller than the eye's reach. Every scroll
# bar is dark. The close mark or Esc closes it. It says "shown" once it is up, then "." every tenth of a
# second, so the mod wakes to end it; with no one reading, the write fails and it closes. When Copiar takes
# text, it also says "copied " and that text in Base64 (UTF-8, LF line ends), for the mod to put it in the
# prompt. When Copiar takes a picture (an image file, or an SVG's Preview drawn as a PNG), it says
# "attach " and the picture file's absolute path in Base64 (UTF-8), for the mod to attach it to the prompt.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing

function Say($line) { [Console]::Out.WriteLine($line); [Console]::Out.Flush() }

# Spanish words with \uXXXX escapes: PowerShell 5.1 reads a script with no BOM in the system's code page,
# so this file stays ASCII.
function T([string]$text) { [regex]::Unescape($text) }
function Html([string]$text) { [System.Net.WebUtility]::HtmlEncode($text) }

# Windows' dark scroll bars for a native control, through uxtheme's SetWindowTheme. The P/Invoke is emitted
# at run time, which costs nothing, where Add-Type would start the C# compiler on every popup.
$uxTheme = $null
try {
  $nativeAssembly = [AppDomain]::CurrentDomain.DefineDynamicAssembly((New-Object System.Reflection.AssemblyName('SpeedyViewNative')), [System.Reflection.Emit.AssemblyBuilderAccess]::Run)
  $nativeType = $nativeAssembly.DefineDynamicModule('SpeedyViewNative').DefineType('SpeedyViewNative.UxTheme', [System.Reflection.TypeAttributes]'Public, Class')
  $nativeMethod = $nativeType.DefinePInvokeMethod('SetWindowTheme', 'uxtheme.dll', [System.Reflection.MethodAttributes]'Public, Static, PinvokeImpl', [System.Reflection.CallingConventions]::Standard, [int], [Type[]]@([IntPtr], [string], [string]), [System.Runtime.InteropServices.CallingConvention]::Winapi, [System.Runtime.InteropServices.CharSet]::Unicode)
  $nativeMethod.SetImplementationFlags([System.Reflection.MethodImplAttributes]::PreserveSig)
  $uxTheme = $nativeType.CreateType()
} catch { }

function Set-DarkScrollBars($control) {
  if (-not $uxTheme) { return }
  if ($control.IsHandleCreated) {
    try { [void]$uxTheme::SetWindowTheme($control.Handle, 'DarkMode_Explorer', [NullString]::Value) } catch { }
  } else {
    $control.Add_HandleCreated({ Set-DarkScrollBars $this })
  }
}

# The same scroll bars in a page, for Internet Explorer's engine, and no 3D edge around it.
$scrollCss = @'
html, body { scrollbar-face-color: #495057; scrollbar-track-color: #16181d; scrollbar-arrow-color: #74c0fc; scrollbar-shadow-color: #495057; scrollbar-highlight-color: #495057; scrollbar-3dlight-color: #16181d; scrollbar-darkshadow-color: #16181d; }
html, body { border: 0; }
'@

$darkCss = @'
body { background: #16181d; color: #e9ecef; font: 15px/1.55 'Segoe UI', sans-serif; margin: 18px 26px; }
h1, h2 { border-bottom: 1px solid #343a40; padding-bottom: 4px; } h1, h2, h3, h4, h5, h6 { color: #74c0fc; margin: 1.1em 0 .5em; }
a { color: #4dabf7; } code { font-family: Consolas, monospace; background: #25282e; padding: 1px 5px; border-radius: 4px; color: #ffd43b; }
pre { background: #0f1115; border: 1px solid #343a40; padding: 10px 12px; overflow: auto; border-radius: 6px; }
pre code { background: none; padding: 0; color: #e9ecef; } blockquote { border-left: 4px solid #4dabf7; margin: 0; padding: 2px 14px; color: #adb5bd; }
table { border-collapse: collapse; margin: 8px 0; } th, td { border: 1px solid #343a40; padding: 5px 10px; text-align: left; vertical-align: top; } th { background: #25282e; }
hr { border: 0; border-top: 1px solid #343a40; } .alt { color: #868e96; } del { color: #868e96; } li { margin: 2px 0; }
.note { color: #868e96; font: 13px 'Segoe UI', sans-serif; margin: 10px 0; }
'@

function New-Page([string]$body, [string]$css = $darkCss) {
  @"
<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><style>
$scrollCss
$css
</style></head><body>
$body
</body></html>
"@
}

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

function New-MarkdownPage([string]$markdown) { New-Page (ConvertFrom-Markdown $markdown) }

# A file's text, or $null when it is not text: a NUL near the start, or too many control bytes. A byte
# order mark says the encoding; otherwise UTF-8 when it decodes as such, else the system's code page.
# A long file gives its first 2 MB.
function Read-Text([byte[]]$bytes) {
  $count = [Math]::Min($bytes.Length, 2MB)
  if ($count -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) { return [System.Text.Encoding]::Unicode.GetString($bytes, 2, ($count - 2) - (($count - 2) % 2)) }
  if ($count -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) { return [System.Text.Encoding]::BigEndianUnicode.GetString($bytes, 2, ($count - 2) - (($count - 2) % 2)) }
  $start = if ($count -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) { 3 } else { 0 }
  $probe = [Math]::Min($count, 8000)
  if ($probe -gt 0 -and [Array]::IndexOf($bytes, [byte]0, 0, $probe) -ge 0) { return $null }
  # The cut never splits a UTF-8 character.
  while ($count -lt $bytes.Length -and $count -gt $start -and ($bytes[$count] -band 0xC0) -eq 0x80) { $count-- }
  try { return (New-Object System.Text.UTF8Encoding($false, $true)).GetString($bytes, $start, $count - $start) } catch { }
  $controls = 0
  for ($i = 0; $i -lt $probe; $i++) { $b = $bytes[$i]; if ($b -lt 9 -or ($b -gt 13 -and $b -lt 32 -and $b -ne 27)) { $controls++ } }
  if ($controls * 100 -gt $probe) { return $null }
  [System.Text.Encoding]::Default.GetString($bytes, $start, $count - $start)
}

# A file's bytes, shared with a program still writing it (a log, a database), which ReadAllBytes refuses.
function Read-Bytes([string]$file, [int]$limit = 0) {
  $stream = New-Object System.IO.FileStream($file, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, ([System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete))
  try {
    $length = if ($limit -gt 0) { [int][Math]::Min($limit, $stream.Length) } else { [int]$stream.Length }
    $buffer = New-Object byte[] $length
    $read = 0
    while ($read -lt $length) { $n = $stream.Read($buffer, $read, $length - $read); if ($n -le 0) { break }; $read += $n }
    if ($read -lt $length) { [Array]::Resize([ref]$buffer, $read) }
    ,$buffer
  } finally { $stream.Dispose() }
}

function Format-Size([long]$size) {
  if ($size -lt 1KB) { return "$size bytes" }
  if ($size -lt 1MB) { return ('{0:N1} KB ({1:N0} bytes)' -f ($size / 1KB), $size) }
  '{0:N1} MB ({1:N0} bytes)' -f ($size / 1MB), $size
}

function Find-Bytes([byte[]]$bytes, [byte[]]$pattern) {
  $i = [Array]::IndexOf($bytes, $pattern[0])
  while ($i -ge 0 -and $i -le $bytes.Length - $pattern.Length) {
    $found = $true
    for ($k = 1; $k -lt $pattern.Length; $k++) { if ($bytes[$i + $k] -ne $pattern[$k]) { $found = $false; break } }
    if ($found) { return $i }
    $i = [Array]::IndexOf($bytes, $pattern[0], $i + 1)
  }
  -1
}

function Use-Zip { Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem }

# A zip's entries with their sizes; the zip may start past a header, as a Chrome extension's does.
function Get-ZipListing([byte[]]$bytes, [int]$offset) {
  Use-Zip
  $lines = New-Object System.Collections.Generic.List[string]
  $stream = [System.IO.MemoryStream]::new($bytes, $offset, $bytes.Length - $offset)
  $zip = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Read)
  try {
    $entries = $zip.Entries
    $lines.Add((T 'Contenido: ') + "$($entries.Count) " + (T 'entradas') + "`r`n")
    $shown = 0
    foreach ($entry in $entries) {
      if ($shown -ge 1000) { $lines.Add('[...]'); break }
      $lines.Add(('{0,14:N0}  {1}' -f $entry.Length, $entry.FullName)); $shown++
    }
  } finally { $zip.Dispose() }
  ,$lines
}

# The names a Finder .DS_Store keeps records for: each record starts with the name's length and the name
# in UTF-16BE, then a four-character code.
function Get-DsStoreNames([byte[]]$bytes) {
  $names = New-Object System.Collections.Generic.List[string]
  $seen = @{}
  $i = 0
  while ($i -lt $bytes.Length - 12) {
    if ($bytes[$i] -eq 0 -and $bytes[$i + 1] -eq 0 -and $bytes[$i + 2] -eq 0 -and $bytes[$i + 3] -gt 0) {
      $after = $i + 4 + 2 * $bytes[$i + 3]
      if ($after + 4 -le $bytes.Length) {
        $isCode = $true
        for ($k = 0; $k -lt 4; $k++) { $c = $bytes[$after + $k]; if (-not (($c -ge 0x61 -and $c -le 0x7A) -or ($c -ge 0x41 -and $c -le 0x5A) -or ($c -ge 0x30 -and $c -le 0x39))) { $isCode = $false; break } }
        if ($isCode) {
          $name = [System.Text.Encoding]::BigEndianUnicode.GetString($bytes, $i + 4, $after - $i - 4)
          if ($name -notmatch '[\x00-\x1F\uFFFD]') {
            if (-not $seen.ContainsKey($name)) { $seen[$name] = $true; $names.Add($name) }
            $i = $after + 4; continue
          }
        }
      }
    }
    $i++
  }
  ,$names
}

function Get-HexDump([byte[]]$bytes, [int]$length) {
  $lines = New-Object System.Collections.Generic.List[string]
  $end = [Math]::Min($length, $bytes.Length)
  for ($o = 0; $o -lt $end; $o += 16) {
    $n = [Math]::Min(16, $end - $o)
    $hex = New-Object System.Text.StringBuilder; $ascii = New-Object System.Text.StringBuilder
    for ($k = 0; $k -lt $n; $k++) {
      $b = $bytes[$o + $k]
      [void]$hex.Append($b.ToString('X2')).Append(' ')
      [void]$ascii.Append($(if ($b -ge 32 -and $b -lt 127) { [char]$b } else { '.' }))
    }
    $lines.Add(('{0:X8}  {1,-48} {2}' -f $o, $hex.ToString(), $ascii.ToString()))
  }
  $lines -join "`r`n"
}

# What can be told about a file that is not text.
function Get-BinaryInfo([byte[]]$bytes, [string]$problem) {
  $out = New-Object System.Collections.Generic.List[string]
  if ($problem) { $out.Add((T 'No se pudo mostrar este archivo: ') + $problem); $out.Add('') }
  $out.Add((T 'Archivo:  ') + $fileName)
  $out.Add((T 'Tama\u00F1o:   ') + (Format-Size $bytes.Length))
  $zipAt = Find-Bytes $bytes ([byte[]](0x50, 0x4B, 0x03, 0x04))
  if ($extension -eq '.ds_store') {
    $out.Add((T 'Tipo:     metadatos de carpeta del Finder de macOS (.DS_Store)'))
    $names = Get-DsStoreNames $bytes
    $out.Add('')
    $out.Add((T 'Archivos y carpetas con datos guardados: ') + $names.Count)
    foreach ($name in $names) { $out.Add('  ' + $name) }
  } elseif ($zipAt -ge 0 -and ($zipAt -eq 0 -or $extension -eq '.crx')) {
    if ($extension -eq '.crx') {
      $version = if ($bytes.Length -ge 8 -and $bytes[0] -eq 0x43 -and $bytes[1] -eq 0x72 -and $bytes[2] -eq 0x32 -and $bytes[3] -eq 0x34) { ' CRX' + $bytes[4] } else { '' }
      $out.Add((T 'Tipo:     extensi\u00F3n de Chrome') + "$version, " + (T 'un ZIP desde el byte ') + $zipAt)
    } else {
      $out.Add((T 'Tipo:     archivo ZIP'))
    }
    $out.Add('')
    try { foreach ($line in (Get-ZipListing $bytes $zipAt)) { $out.Add($line) } } catch { $out.Add((T 'No se pudo leer el ZIP: ') + $_.Exception.Message) }
  } else {
    $out.Add((T 'Tipo:     binario'))
    $out.Add('')
    $out.Add((T 'Primeros 512 bytes:'))
    $out.Add((Get-HexDump $bytes 512))
  }
  $out -join "`r`n"
}

# ---- Spreadsheets ----------------------------------------------------------------------------------------
$rowCap = 2000
$colCap = 100

function Get-ColumnIndex([string]$letters) { $n = 0; foreach ($ch in $letters.ToUpperInvariant().ToCharArray()) { $n = $n * 26 + ([int]$ch - 64) }; $n }
function Get-ColumnName([int]$n) { $s = ''; while ($n -gt 0) { $m = ($n - 1) % 26; $s = [string][char](65 + $m) + $s; $n = [int][Math]::Floor(($n - 1) / 26) }; $s }

function Read-ZipXml($zip, [string]$name) {
  $entry = $zip.GetEntry($name)
  if ($null -eq $entry) { $entry = $zip.Entries | Where-Object { $_.FullName -eq $name -or $_.FullName.Replace('\', '/') -ieq $name } | Select-Object -First 1 }
  if ($null -eq $entry) { return $null }
  $stream = $entry.Open()
  try {
    $document = New-Object System.Xml.XmlDocument
    $document.XmlResolver = $null
    $document.Load($stream)
    ,$document
  } finally { $stream.Dispose() }
}

# The text of a shared or inline string: its t elements, without the phonetic runs.
function Get-CellText($node) {
  $parts = foreach ($t in $node.SelectNodes(".//*[local-name()='t' and not(ancestor::*[local-name()='rPh'])]")) { $t.InnerText }
  -join $parts
}

function Add-Cell($sheet, [int]$row, [int]$column, $value) {
  if ($null -eq $value) { return }
  $value = [string]$value
  if ($value -eq '') { return }
  if (-not $sheet.Cells.ContainsKey($row)) { $sheet.Cells[$row] = @{} }
  $sheet.Cells[$row][$column] = $value
  if ($row -gt $sheet.MaxRow) { $sheet.MaxRow = $row }
  if ($column -gt $sheet.MaxCol) { $sheet.MaxCol = $column }
}

function New-Sheet([string]$name) { [pscustomobject]@{ Name = $name; Cells = @{}; MaxRow = 0; MaxCol = 0; Rows = 0 } }

function Read-Xlsx([string]$file) {
  Use-Zip
  $sheetNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  $relNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  $sheets = New-Object System.Collections.Generic.List[object]
  $zip = [System.IO.Compression.ZipFile]::OpenRead($file)
  try {
    $strings = New-Object System.Collections.Generic.List[string]
    $shared = Read-ZipXml $zip 'xl/sharedStrings.xml'
    if ($null -ne $shared) { foreach ($si in $shared.DocumentElement.ChildNodes) { if ($si.LocalName -eq 'si') { $strings.Add((Get-CellText $si)) } } }
    $targets = @{}
    $rels = Read-ZipXml $zip 'xl/_rels/workbook.xml.rels'
    if ($null -ne $rels) { foreach ($rel in $rels.DocumentElement.ChildNodes) { if ($rel.LocalName -eq 'Relationship') { $targets[$rel.GetAttribute('Id')] = $rel.GetAttribute('Target') } } }
    $parts = New-Object System.Collections.Generic.List[object]
    $workbook = Read-ZipXml $zip 'xl/workbook.xml'
    if ($null -ne $workbook) {
      $index = 0
      foreach ($node in $workbook.SelectNodes("//*[local-name()='sheet']")) {
        $index++
        $target = $targets[$node.GetAttribute('id', $relNs)]
        $entry = if (-not $target) { "xl/worksheets/sheet$index.xml" } elseif ($target.StartsWith('/')) { $target.Substring(1) } else { 'xl/' + $target }
        $parts.Add([pscustomobject]@{ Name = $node.GetAttribute('name'); Entry = $entry })
      }
    }
    if ($parts.Count -eq 0) {
      foreach ($entry in $zip.Entries) { if ($entry.FullName -match '^xl/worksheets/(sheet\d+)\.xml$') { $parts.Add([pscustomobject]@{ Name = $Matches[1]; Entry = $entry.FullName }) } }
    }
    foreach ($part in $parts) {
      $sheet = New-Sheet $part.Name
      $sheets.Add($sheet)
      $document = Read-ZipXml $zip $part.Entry
      if ($null -eq $document) { continue }
      $ns = New-Object System.Xml.XmlNamespaceManager($document.NameTable)
      $ns.AddNamespace('m', $sheetNs)
      $rowIndex = 0
      foreach ($row in $document.SelectNodes('/m:worksheet/m:sheetData/m:row', $ns)) {
        $r = $row.GetAttribute('r')
        $rowIndex = if ($r) { [int]$r } else { $rowIndex + 1 }
        $sheet.Rows = $rowIndex
        if ($rowIndex -gt $rowCap) { continue }
        $columnIndex = 0
        foreach ($cell in $row.ChildNodes) {
          if ($cell.LocalName -ne 'c') { continue }
          $ref = $cell.GetAttribute('r')
          $columnIndex = if ($ref -match '^([A-Za-z]+)\d+$') { Get-ColumnIndex $Matches[1] } else { $columnIndex + 1 }
          $v = $cell.SelectSingleNode('m:v', $ns)
          $value = $null
          switch ($cell.GetAttribute('t')) {
            's' { if ($null -ne $v) { $k = [int]$v.InnerText; if ($k -lt $strings.Count) { $value = $strings[$k] } } }
            'inlineStr' { $is = $cell.SelectSingleNode('m:is', $ns); if ($null -ne $is) { $value = Get-CellText $is } }
            'b' { if ($null -ne $v) { $value = if ($v.InnerText -eq '1') { 'TRUE' } else { 'FALSE' } } }
            default { if ($null -ne $v) { $value = $v.InnerText } }
          }
          Add-Cell $sheet $rowIndex $columnIndex $value
        }
      }
    }
  } finally { $zip.Dispose() }
  ,$sheets
}

# An .xls or a .doc through Office itself: Excel or Word, unseen, opens it read-only and saves a copy as
# .xlsx or .docx in a folder of its own under %TEMP%, which the popup then draws as it draws those. A JScript
# under cscript drives Office: Windows PowerShell's COM binder garbles Word's answers on some installs. It
# runs on its own while the popup stands; the timer looks for its end. The password keeps a protected file
# from waiting on a prompt nobody sees: Office fails at once instead.
$officeScript = @'
var a = WScript.Arguments, app = null, code = 0;
try {
  if (a.Item(0) == "excel") {
    app = new ActiveXObject("Excel.Application"); app.DisplayAlerts = false;
    var book = app.Workbooks.Open(a.Item(1), 0, true, 5, "speedy-no-password");
    book.SaveAs(a.Item(2), 51); book.Close(false);
  } else {
    app = new ActiveXObject("Word.Application"); app.DisplayAlerts = 0;
    var doc = app.Documents.Open(a.Item(1), false, true, false, "speedy-no-password");
    doc.SaveAs2(a.Item(2), 16); doc.Close(0);
  }
} catch (e) { WScript.StdErr.Write(e.message); code = 1; }
try { if (app) { if (a.Item(0) == "excel") { app.Quit(); } else { app.Quit(0); } } } catch (e) { }
WScript.Quit(code);
'@

function Start-OfficeCopy([string]$application, [string]$copyExtension, [scriptblock]$done) {
  $folder = Join-Path ([IO.Path]::GetTempPath()) ('speedy-view-' + [guid]::NewGuid().ToString('N'))
  [void](New-Item -ItemType Directory -Path $folder)
  $script = Join-Path $folder 'copy.js'
  [IO.File]::WriteAllText($script, $officeScript, [System.Text.Encoding]::ASCII)
  $copyPath = Join-Path $folder ('copy' + $copyExtension)
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = Join-Path $env:SystemRoot 'System32\cscript.exe'
  $info.Arguments = '//nologo //E:jscript "' + $script + '" ' + $application + ' "' + $path + '" "' + $copyPath + '"'
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  # Its output never reaches the popup's own: the mod reads that.
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $process = [System.Diagnostics.Process]::Start($info)
  [pscustomobject]@{
    Process = $process; Folder = $folder; Copy = $copyPath; Done = $done
    Output = $process.StandardOutput.ReadToEndAsync(); Problem = $process.StandardError.ReadToEndAsync()
    Started = [DateTime]::Now
  }
}

# Once Office is through: the copy drawn, or why not; then its folder goes.
function Complete-OfficeCopy($copy, [bool]$timedOut) {
  $problem = if ($timedOut) { 'Office no respondi&oacute; en 90 segundos.' }
             elseif ($copy.Process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $copy.Copy)) { Html ($copy.Problem.Result.Trim()) }
             else { $null }
  try { & $copy.Done $copy.Copy $problem } catch { & $copy.Done $null (Html $_.Exception.Message) }
  try { Remove-Item -LiteralPath $copy.Folder -Recurse -Force } catch { }
}

$sheetCss = $darkCss + @'
body { margin: 0; }
.tabs { position: fixed; top: 0; left: 0; right: 0; height: 34px; background: #0f1115; border-bottom: 1px solid #343a40; padding: 6px 8px 0; white-space: nowrap; overflow: hidden; z-index: 2; }
.tab { display: inline-block; padding: 4px 14px; margin-right: 4px; color: #74c0fc; cursor: pointer; border: 1px solid #343a40; border-bottom: 0; border-radius: 6px 6px 0 0; font: bold 13px 'Segoe UI', sans-serif; }
.tab.on { background: #74c0fc; color: #000; border-color: #74c0fc; }
.sheets { padding: 10px 12px; } .tabbed { padding-top: 50px; }
table.grid { border-collapse: collapse; margin: 0; font: 13px Consolas, monospace; }
.grid th { background: #25282e; color: #868e96; font-weight: normal; padding: 2px 8px; border: 1px solid #343a40; text-align: center; }
.grid td { border: 1px solid #2b2f36; padding: 2px 8px; white-space: nowrap; max-width: 480px; overflow: hidden; text-overflow: ellipsis; color: #e9ecef; }
.grid td.n { text-align: right; color: #a5d8ff; }
.grid td.alt { color: #868e96; font-style: italic; }
'@

# The sheets as text for Copiar: each sheet's name, then its rows with the cells apart by tabs, as Excel
# pastes them.
function Get-SheetsText($sheets) {
  $text = New-Object System.Text.StringBuilder
  foreach ($sheet in $sheets) {
    if ($sheets.Count -gt 1) { [void]$text.Append($sheet.Name).Append("`r`n") }
    for ($r = 1; $r -le $sheet.MaxRow; $r++) {
      $row = $sheet.Cells[$r]
      $values = for ($c = 1; $c -le $sheet.MaxCol; $c++) { if ($row -and $null -ne $row[$c]) { $row[$c] } else { '' } }
      [void]$text.Append(($values -join "`t")).Append("`r`n")
    }
    if ($sheets.Count -gt 1) { [void]$text.Append("`r`n") }
  }
  $text.ToString()
}

function New-SheetsPage($sheets, [string]$note) {
  $html = New-Object System.Text.StringBuilder
  $tabbed = $sheets.Count -gt 1
  if ($tabbed) {
    [void]$html.Append('<div class="tabs">')
    for ($s = 0; $s -lt $sheets.Count; $s++) {
      [void]$html.Append("<span class=""tab$(if ($s -eq 0) { ' on' })"" id=""t$s"" onclick=""show($s)"">" + (Html $sheets[$s].Name) + '</span>')
    }
    [void]$html.Append('</div>')
  }
  [void]$html.Append("<div class=""sheets$(if ($tabbed) { ' tabbed' })"">")
  if ($note) { [void]$html.Append('<p class="note">' + $note + '</p>') }
  for ($s = 0; $s -lt $sheets.Count; $s++) {
    $sheet = $sheets[$s]
    [void]$html.Append("<div class=""sheet"" id=""s$s""$(if ($s -gt 0) { ' style=""display:none""' })>")
    if (-not $tabbed) { [void]$html.Append('<p class="note">' + (Html $sheet.Name) + '</p>') }
    if ($sheet.MaxRow -eq 0) {
      [void]$html.Append('<p class="note">(hoja vac&iacute;a)</p></div>'); continue
    }
    $columns = [Math]::Min($sheet.MaxCol, $colCap)
    [void]$html.Append('<table class="grid"><tr><th></th>')
    for ($c = 1; $c -le $columns; $c++) { [void]$html.Append('<th>' + (Get-ColumnName $c) + '</th>') }
    [void]$html.Append('</tr>')
    for ($r = 1; $r -le $sheet.MaxRow; $r++) {
      [void]$html.Append("<tr><th>$r</th>")
      $row = $sheet.Cells[$r]
      for ($c = 1; $c -le $columns; $c++) {
        $value = if ($row) { $row[$c] } else { $null }
        if ($null -eq $value) { [void]$html.Append('<td></td>') }
        elseif ($value -match '^-?\d+(\.\d+)?([eE][-+]?\d+)?$') { [void]$html.Append('<td class="n">' + $value + '</td>') }
        else { [void]$html.Append('<td title="' + (Html $value) + '">' + (Html $value) + '</td>') }
      }
      [void]$html.Append('</tr>')
    }
    [void]$html.Append('</table>')
    if ($sheet.Rows -gt $rowCap) { [void]$html.Append("<p class=""note"">Se muestran las primeras $rowCap filas de $($sheet.Rows).</p>") }
    if ($sheet.MaxCol -gt $colCap) { [void]$html.Append("<p class=""note"">Se muestran las primeras $colCap columnas de $($sheet.MaxCol).</p>") }
    [void]$html.Append('</div>')
  }
  [void]$html.Append('</div>')
  if ($tabbed) {
    [void]$html.Append('<script>function show(n){var i=0,d;while(d=document.getElementById("s"+i)){d.style.display=(i==n)?"":"none";document.getElementById("t"+i).className=(i==n)?"tab on":"tab";i++;}window.scrollTo(0,0);}</script>')
  }
  New-Page $html.ToString() $sheetCss
}

# ---- Word documents --------------------------------------------------------------------------------------
$wordNs = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
$wordNsm = $null
$wordStyles = @{}

function Test-WordToggle($properties, [string]$name) {
  if ($null -eq $properties) { return $false }
  $node = $properties.SelectSingleNode("w:$name", $wordNsm)
  if ($null -eq $node) { return $false }
  $value = $node.GetAttribute('val', $wordNs)
  -not ($value -in @('0', 'false', 'none'))
}

function ConvertFrom-WordParagraph($paragraph) {
  $styleNode = $paragraph.SelectSingleNode('w:pPr/w:pStyle', $wordNsm)
  $styleId = if ($null -ne $styleNode) { $styleNode.GetAttribute('val', $wordNs) } else { '' }
  $style = if ($wordStyles.ContainsKey($styleId)) { $wordStyles[$styleId] } else { $styleId.ToLowerInvariant() }
  $tag = 'p'
  if ($style -match '^heading\s*([1-6])$') { $tag = 'h' + $Matches[1] }
  elseif ($style -eq 'title') { $tag = 'h1' }
  elseif ($style -eq 'subtitle') { $tag = 'h3' }
  elseif ($null -ne $paragraph.SelectSingleNode('w:pPr/w:numPr', $wordNsm) -or $style -match '^list') { $tag = 'li' }
  $html = New-Object System.Text.StringBuilder
  foreach ($run in $paragraph.SelectNodes('.//w:r[not(ancestor::w:del)]', $wordNsm)) {
    $text = New-Object System.Text.StringBuilder
    foreach ($child in $run.ChildNodes) {
      switch ($child.LocalName) {
        't' { [void]$text.Append((Html $child.InnerText)) }
        'tab' { [void]$text.Append('&emsp;') }
        'br' { [void]$text.Append('<br>') }
        'cr' { [void]$text.Append('<br>') }
        'noBreakHyphen' { [void]$text.Append('-') }
        'drawing' { [void]$text.Append('<span class="alt">[imagen]</span>') }
        'pict' { [void]$text.Append('<span class="alt">[imagen]</span>') }
      }
    }
    if ($text.Length -eq 0) { continue }
    $piece = $text.ToString()
    $properties = $run.SelectSingleNode('w:rPr', $wordNsm)
    if (Test-WordToggle $properties 'b') { $piece = "<b>$piece</b>" }
    if (Test-WordToggle $properties 'i') { $piece = "<i>$piece</i>" }
    if (Test-WordToggle $properties 'u') { $piece = "<u>$piece</u>" }
    if (Test-WordToggle $properties 'strike') { $piece = "<s>$piece</s>" }
    [void]$html.Append($piece)
  }
  $body = if ($html.Length -gt 0) { $html.ToString() } else { '&nbsp;' }
  [pscustomobject]@{ Tag = $tag; Html = $body }
}

function ConvertFrom-WordTable($table) {
  $html = New-Object System.Text.StringBuilder
  [void]$html.Append('<table>')
  foreach ($row in $table.SelectNodes('w:tr', $wordNsm)) {
    [void]$html.Append('<tr>')
    foreach ($cell in $row.SelectNodes('w:tc', $wordNsm)) {
      $span = $cell.SelectSingleNode('w:tcPr/w:gridSpan', $wordNsm)
      $colspan = if ($null -ne $span) { ' colspan="' + $span.GetAttribute('val', $wordNs) + '"' } else { '' }
      [void]$html.Append("<td$colspan>" + (ConvertFrom-WordBlocks $cell) + '</td>')
    }
    [void]$html.Append('</tr>')
  }
  [void]$html.Append('</table>')
  $html.ToString()
}

function ConvertFrom-WordBlocks($parent) {
  $html = New-Object System.Text.StringBuilder
  $inList = $false
  foreach ($node in $parent.ChildNodes) {
    $name = $node.LocalName
    if ($inList -and $name -ne 'p') { [void]$html.Append('</ul>'); $inList = $false }
    if ($name -eq 'sdt') {
      $inner = $node.SelectSingleNode('w:sdtContent', $wordNsm)
      if ($null -ne $inner) { [void]$html.Append((ConvertFrom-WordBlocks $inner)) }
      continue
    }
    if ($name -eq 'tbl') { [void]$html.Append((ConvertFrom-WordTable $node)); continue }
    if ($name -ne 'p') { continue }
    $paragraph = ConvertFrom-WordParagraph $node
    if ($paragraph.Tag -eq 'li') {
      if (-not $inList) { [void]$html.Append('<ul>'); $inList = $true }
      [void]$html.Append('<li>' + $paragraph.Html + '</li>')
    } else {
      if ($inList) { [void]$html.Append('</ul>'); $inList = $false }
      [void]$html.Append('<' + $paragraph.Tag + '>' + $paragraph.Html + '</' + $paragraph.Tag + ">`n")
    }
  }
  if ($inList) { [void]$html.Append('</ul>') }
  $html.ToString()
}

function ConvertFrom-Docx([string]$file) {
  Use-Zip
  $zip = [System.IO.Compression.ZipFile]::OpenRead($file)
  try {
    $document = Read-ZipXml $zip 'word/document.xml'
    if ($null -eq $document) { throw 'word/document.xml no existe' }
    $script:wordNsm = New-Object System.Xml.XmlNamespaceManager($document.NameTable)
    $script:wordNsm.AddNamespace('w', $wordNs)
    $styles = Read-ZipXml $zip 'word/styles.xml'
    if ($null -ne $styles) {
      foreach ($style in $styles.DocumentElement.ChildNodes) {
        if ($style.LocalName -ne 'style') { continue }
        $nameNode = $style.ChildNodes | Where-Object { $_.LocalName -eq 'name' } | Select-Object -First 1
        if ($null -ne $nameNode) { $script:wordStyles[$style.GetAttribute('styleId', $wordNs)] = $nameNode.GetAttribute('val', $wordNs).ToLowerInvariant() }
      }
    }
    $body = $document.SelectSingleNode('/w:document/w:body', $script:wordNsm)
    if ($null -eq $body) { return '' }
    ConvertFrom-WordBlocks $body
  } finally { $zip.Dispose() }
}

$documentCss = $darkCss + @'
body { max-width: 900px; } p { margin: 0 0 .6em; white-space: pre-wrap; } td p { margin: 0; } li { white-space: pre-wrap; }
'@

# A .doc without Word: the runs of readable text in it, UTF-16 or 8-bit, whichever gives more.
function Get-LooseText([byte[]]$bytes) {
  $pattern = '[\t\r\n\x20-\x7E\u00A1\u00BF\u00C0-\u00FF\u2018-\u201D\u2026]{4,}'
  $pick = {
    param([string]$decoded)
    $runs = foreach ($m in [regex]::Matches($decoded, $pattern)) {
      $value = $m.Value.Trim()
      # Mostly plain letters, digits and spaces: binary noise decodes to accented letters and symbols.
      $plain = ([regex]::Matches($value, '[A-Za-z0-9 ]')).Count
      $ascii = ([regex]::Matches($value, '[A-Za-z]')).Count
      if ($ascii -ge 3 -and $plain * 10 -ge $value.Length * 7 -and ($value.ToCharArray() | Select-Object -Unique).Count -ge 3) { $value }
    }
    ,@($runs)
  }
  $wide = & $pick ([System.Text.Encoding]::Unicode.GetString($bytes))
  $narrow = & $pick ([System.Text.Encoding]::GetEncoding(1252).GetString($bytes))
  $wideLength = ($wide | Measure-Object -Property Length -Sum).Sum
  $narrowLength = ($narrow | Measure-Object -Property Length -Sum).Sum
  $runs = if ($wideLength -ge $narrowLength) { $wide } else { $narrow }
  ($runs -join "`n") -replace "`r", "`n"
}

# ---- What the file is ------------------------------------------------------------------------------------
# A full path with backslashes: Windows' PDF reader refuses forward slashes.
$path = $env:SPEEDY_FILE
try { $path = [IO.Path]::GetFullPath($path) } catch { }
$fileName = [IO.Path]::GetFileName($path)
$extension = [IO.Path]::GetExtension($path).ToLowerInvariant()
$imageTypes = @('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.tif', '.tiff')
$audioTypes = @('.mp3', '.mpa', '.mp2', '.wav', '.m4a', '.aac', '.wma', '.ogg', '.oga', '.opus', '.flac', '.aif', '.aiff', '.mid', '.midi')
$videoTypes = @('.mp4', '.m4v', '.mov', '.avi', '.wmv', '.mkv', '.webm', '.mpg', '.mpeg', '.3gp')
$kinds = @{
  '.pdf' = 'pdf'; '.md' = 'markdown'; '.markdown' = 'markdown'; '.html' = 'html'; '.htm' = 'html'; '.xhtml' = 'html'; '.svg' = 'svg'
  '.xlsx' = 'xlsx'; '.xlsm' = 'xlsx'; '.xls' = 'xls'; '.docx' = 'docx'; '.docm' = 'docx'; '.doc' = 'doc'; '.crx' = 'binary'; '.ds_store' = 'binary'
  '.sqlite' = 'sqlite'; '.sqlite3' = 'sqlite'; '.db' = 'sqlite'; '.db3' = 'sqlite'; '.lnk' = 'shortcut'; '.url' = 'url'
  '.sys' = 'binary'; '.dll' = 'binary'; '.exe' = 'binary'
  '.zip' = 'zip'; '.jar' = 'zip'; '.apk' = 'zip'; '.nupkg' = 'zip'; '.vsix' = 'zip'; '.whl' = 'zip'; '.epub' = 'zip'
}
foreach ($type in $imageTypes) { $kinds[$type] = 'image' }
foreach ($type in $audioTypes) { $kinds[$type] = 'audio' }
foreach ($type in $videoTypes) { $kinds[$type] = 'video' }
$kind = if ($kinds.ContainsKey($extension)) { $kinds[$extension] } else { 'text' }

# The frame's widths, in pixels, as view.ps1 has them.
$contour = 24
$line = 2
$margin = 12
$band = 16
$extraWidth = 2 * ($contour + $line + $margin)
# The bottom line carries Copiar and the close mark as the top one does, so it gets the same band.
$extraHeight = 2 * ($contour + $line) + 2 * $band

$black = [System.Drawing.Color]::Black
$blue = [System.Drawing.ColorTranslator]::FromHtml('#74c0fc')
$paper = [System.Drawing.ColorTranslator]::FromHtml('#16181d')
$ink = [System.Drawing.ColorTranslator]::FromHtml('#e9ecef')
$dim = [System.Drawing.ColorTranslator]::FromHtml('#868e96')
$red = [System.Drawing.ColorTranslator]::FromHtml('#ff6b6b')

$area = [System.Windows.Forms.Screen]::FromPoint([System.Windows.Forms.Cursor]::Position).WorkingArea
$room = New-Object System.Drawing.Size(([int]($area.Width * 0.8 - $extraWidth)), ([int]($area.Height * 0.8 - $extraHeight)))

# ---- The views -------------------------------------------------------------------------------------------
# Each view fills the frame; with two, a switch beside the title shows one at a time.
$views = [ordered]@{}
$rawText = $null        # what Copiar takes from a Preview with nothing selected
$image = $null
$pdfPages = $null
$pdfText = $null
$player = $null
$svgExport = $null      # an SVG's markup and size for Copiar's PNG
$state = [pscustomobject]@{ View = $null; CopyFlash = 0; Office = $null; Picked = $false; Drawing = $false }
$disposables = @()
$inner = $room

# The Python that reads a PDF's text: the host's, by SPEEDY_PYTHON, else the one the setup made for
# Claude Code or for OpenCode.
function Find-Python {
  $candidates = @($env:SPEEDY_PYTHON, (Join-Path $env:USERPROFILE '.claude\speedy-code\venv\Scripts\python.exe'), (Join-Path $env:USERPROFILE '.config\opencode\speedy-code\venv\Scripts\python.exe'))
  foreach ($one in $candidates) { if ($one -and (Test-Path -LiteralPath $one)) { return $one } }
  $null
}

# Starts one of the hook's Python scripts on the file; its output is read as it runs and looked at by the
# timer. With no Python, or when it cannot start, the job is done at once with $failure and the reason.
function Start-PythonScript([string]$script, [string]$file, [string]$failure) {
  $python = Find-Python
  if (-not $python) { return [pscustomobject]@{ Done = $true; Failed = $true; Text = (T 'No encontr\u00e9 el Python de speedy-code: instalalo desde \u2699 \u2192 Instalaci\u00f3n.') } }
  $start = New-Object System.Diagnostics.ProcessStartInfo
  $start.FileName = $python
  $start.Arguments = '"' + (Join-Path $PSScriptRoot $script) + '" "' + $file + '"'
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $start.StandardOutputEncoding = [System.Text.Encoding]::UTF8
  $start.StandardErrorEncoding = [System.Text.Encoding]::UTF8
  $start.EnvironmentVariables['PYTHONIOENCODING'] = 'utf-8'
  try {
    $process = [System.Diagnostics.Process]::Start($start)
    [pscustomobject]@{ Done = $false; Failed = $false; Process = $process; Out = $process.StandardOutput.ReadToEndAsync(); Err = $process.StandardError.ReadToEndAsync(); Text = $null }
  } catch {
    [pscustomobject]@{ Done = $true; Failed = $true; Text = $failure + $_.Exception.Message }
  }
}

# Starts pdf_text.py on the file.
function Start-PdfText([string]$file) { Start-PythonScript 'pdf_text.py' $file (T 'No se pudo leer el texto del PDF: ') }

# The text read, or why there is none, once pdf_text.py has ended.
function Complete-PdfText($job) {
  $job.Done = $true
  $out = $job.Out.Result
  if ($job.Process.ExitCode -eq 2) { $job.Text = T 'Falta pdfminer.six para leer el texto: \u2699 \u2192 Instalaci\u00f3n \u2192 Instalar / reparar todo.' }
  elseif ($job.Process.ExitCode -ne 0) { $job.Text = (T 'No se pudo leer el texto del PDF: ') + $job.Err.Result.Trim() }
  elseif (-not $out.Trim()) { $job.Text = T 'Este PDF no tiene texto: sus p\u00e1ginas son im\u00e1genes.' }
  else { $job.Text = $out }
  $views['Texto'].Text = $job.Text -replace "(?<!`r)`n", "`r`n"
  $views['Texto'].SelectionStart = 0
  $views['Texto'].ScrollToCaret()
}

# ---- Minified files laid out ----------------------------------------------------------------------------
# pretty.py lays out a minified file while the popup stands; the file on disk is never touched. Once it
# answers with a layout that differs from the text, the source view gets a sibling before it, Formateado,
# shown unless the viewer already chose a view, and the source view's label becomes Original. A file past
# 5 MB keeps its text as it is.
$prettyJob = $null
$prettySource = $null     # the view holding the text as it is
$prettyOriginal = $null
$labelNames = @{}         # a view's label when it is not its name

function Start-Pretty([string]$sourceView, [string]$original, [long]$size) {
  if ($size -gt 5MB) { return }
  $job = Start-PythonScript 'pretty.py' $path ''
  if ($job.Done) { return }
  $script:prettySource = $sourceView
  $script:prettyOriginal = $original
  $script:prettyJob = $job
}

# Once pretty.py has ended: exit 0 with a different text adds Formateado; 3 (nothing to lay out), 2 (a
# package missing) or 1 (it failed) leave the popup as it is.
function Complete-Pretty($job) {
  $job.Done = $true
  if ($job.Process.ExitCode -ne 0) { return }
  $laid = $job.Out.Result
  $plain = { param([string]$s) ($s -replace "`r`n", "`n").TrimEnd() }
  if (-not $laid.Trim() -or (& $plain $laid) -eq (& $plain $prettyOriginal)) { return }
  $box = New-SourceBox $laid $false
  $box.Visible = $false
  $inside.Controls.Add($box)
  $views.Insert([Array]::IndexOf($viewNames, $prettySource), 'Formateado', $box)
  $labelNames[$prettySource] = 'Original'
  $script:viewNames = @($views.Keys)
  foreach ($view in $viewNames) { Add-SwitchLabel $view }
  # A Preview's Copiar, with nothing selected, takes the laid-out text too.
  if ($null -ne $rawText) { $script:rawText = $laid }
  $box.SelectionStart = 0
  $box.ScrollToCaret()
  # The layout is longer than the text it came from: a text popup grows to it, up to the room.
  $grown = Get-TextFit
  if ($grown) { Set-PopupSize ([Math]::Max($form.ClientSize.Width, $grown.Width + $extraWidth)) ([Math]::Max($form.ClientSize.Height, $grown.Height + $extraHeight)) }
  else { Set-PopupSize $form.ClientSize.Width $form.ClientSize.Height }
  $shown = $state.View
  if (-not $state.Picked -and $shown -eq $prettySource -and $env:SPEEDY_VIEW -ne 'Original') { $shown = 'Formateado' }
  Show-View $shown
}

# ---- Databases -------------------------------------------------------------------------------------------
$sqliteMagic = [System.Text.Encoding]::ASCII.GetBytes("SQLite format 3`0")
$dbTables = $null      # each table's text for Copiar, by the tab shown
$dbJob = $null

function Test-SqliteHead([byte[]]$head) {
  if ($null -eq $head -or $head.Length -lt 16) { return $false }
  for ($k = 0; $k -lt 16; $k++) { if ($head[$k] -ne $sqliteMagic[$k]) { return $false } }
  $true
}

# A table's text for Copiar: the column names, then the rows, the cells apart by tabs.
function Get-TableText($table) {
  $text = New-Object System.Text.StringBuilder
  [void]$text.Append((@($table.columns) -join "`t")).Append("`r`n")
  foreach ($row in @($table.rows)) { [void]$text.Append((@($row) -join "`t")).Append("`r`n") }
  $text.ToString()
}

# The tables as a page, as the spreadsheets are drawn: a tab each, the column names over the columns and
# the rows numbered. The page keeps the tab shown in `cur`, for Copiar.
function New-TablesPage($tables) {
  $html = New-Object System.Text.StringBuilder
  $tabbed = $tables.Count -gt 1
  if ($tabbed) {
    [void]$html.Append('<div class="tabs">')
    for ($s = 0; $s -lt $tables.Count; $s++) {
      [void]$html.Append("<span class=""tab$(if ($s -eq 0) { ' on' })"" id=""t$s"" onclick=""show($s)"">" + (Html $tables[$s].name) + '</span>')
    }
    [void]$html.Append('</div>')
  }
  [void]$html.Append("<div class=""sheets$(if ($tabbed) { ' tabbed' })"">")
  for ($s = 0; $s -lt $tables.Count; $s++) {
    $table = $tables[$s]
    $rows = @($table.rows)
    [void]$html.Append("<div class=""sheet"" id=""s$s""$(if ($s -gt 0) { ' style=""display:none""' })>")
    $what = if ($table.type -eq 'view') { 'vista' } else { 'tabla' }
    $count = [long]$table.count
    $about = (Html $table.name) + " &middot; $what &middot; " + ('{0:N0}' -f $count) + $(if ($count -eq 1) { ' fila' } else { ' filas' })
    if ($count -gt $rows.Count) { $about += ' &middot; se muestran las primeras ' + $rows.Count }
    [void]$html.Append('<p class="note">' + $about + '</p>')
    if ($table.error) { [void]$html.Append('<p class="note">No se pudo leer: ' + (Html $table.error) + '</p></div>'); continue }
    [void]$html.Append('<table class="grid"><tr><th></th>')
    foreach ($column in @($table.columns)) { [void]$html.Append('<th>' + (Html $column) + '</th>') }
    [void]$html.Append('</tr>')
    $r = 0
    foreach ($row in $rows) {
      $r++
      [void]$html.Append("<tr><th>$r</th>")
      foreach ($value in @($row)) {
        $value = [string]$value
        if ($value -eq '') { [void]$html.Append('<td></td>') }
        elseif ($value -match '^-?\d+(\.\d+)?([eE][-+]?\d+)?$') { [void]$html.Append('<td class="n">' + $value + '</td>') }
        elseif ($value -match '^<blob \d+ bytes>$') { [void]$html.Append('<td class="alt">' + (Html $value) + '</td>') }
        else { [void]$html.Append('<td title="' + (Html $value) + '">' + (Html $value) + '</td>') }
      }
      [void]$html.Append('</tr>')
    }
    [void]$html.Append('</table>')
    if ($rows.Count -eq 0) { [void]$html.Append('<p class="note">(sin filas)</p>') }
    [void]$html.Append('</div>')
  }
  [void]$html.Append('</div>')
  [void]$html.Append('<script>var cur=0;function show(n){var i=0,d;while(d=document.getElementById("s"+i)){d.style.display=(i==n)?"":"none";document.getElementById("t"+i).className=(i==n)?"tab on":"tab";i++;}cur=n;window.scrollTo(0,0);}</script>')
  New-Page $html.ToString() $sheetCss
}

# Once db_view.py has ended: its tables drawn, or why not.
function Complete-DbView($job) {
  $job.Done = $true
  $page = $views['Page']
  if ($job.Process.ExitCode -ne 0) {
    $page.DocumentText = New-MessagePage ('No se pudo abrir la base de datos: ' + (Html $job.Err.Result.Trim()))
    return
  }
  Add-Type -AssemblyName System.Web.Extensions
  $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
  $serializer.MaxJsonLength = [int]::MaxValue
  $data = $serializer.DeserializeObject($job.Out.Result)
  $tables = @(foreach ($one in $data['tables']) { [pscustomobject]@{ name = $one['name']; type = $one['type']; columns = @($one['columns']); count = $one['count']; rows = @($one['rows']); error = $one['error'] } })
  if ($tables.Count -eq 0) { $page.DocumentText = New-MessagePage 'La base de datos no tiene tablas.'; return }
  $script:dbTables = @(foreach ($table in $tables) { Get-TableText $table })
  $page.DocumentText = New-TablesPage $tables
}

# ---- Zip archives ----------------------------------------------------------------------------------------
# A zip's entries as a table, read through ZipFile.OpenRead: names, sizes and dates only, nothing extracted.
# Folders a path implies but the zip does not list get a row too, so the table reads as a tree.
$zipRowCap = 5000

function Test-ZipHead([byte[]]$head) {
  if ($null -eq $head -or $head.Length -lt 4 -or $head[0] -ne 0x50 -or $head[1] -ne 0x4B) { return $false }
  ($head[2] -eq 3 -and $head[3] -eq 4) -or ($head[2] -eq 5 -and $head[3] -eq 6)
}

function Format-ShortSize([long]$size) {
  if ($size -lt 1KB) { return "$size B" }
  if ($size -lt 1MB) { return ('{0:N1} KB' -f ($size / 1KB)) }
  if ($size -lt 1GB) { return ('{0:N1} MB' -f ($size / 1MB)) }
  '{0:N2} GB' -f ($size / 1GB)
}

# How many entries the central directory marks encrypted (bit 0 of their flags): their names read, their
# bytes do not. Found from the end of the file, so a zip past a header works too; -1 when it cannot be told
# (a ZIP64 directory, a damaged end record).
function Get-ZipEncryptedCount([string]$file) {
  $stream = New-Object System.IO.FileStream($file, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, ([System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete))
  try {
    $read = {
      param([long]$from, [int]$count)
      $buffer = New-Object byte[] $count
      $stream.Position = $from
      $done = 0
      while ($done -lt $count) { $n = $stream.Read($buffer, $done, $count - $done); if ($n -le 0) { break }; $done += $n }
      ,$buffer
    }
    $tail = [int][Math]::Min($stream.Length, 65557)
    $end = & $read ($stream.Length - $tail) $tail
    $at = -1
    for ($i = $tail - 22; $i -ge 0; $i--) { if ($end[$i] -eq 0x50 -and $end[$i + 1] -eq 0x4B -and $end[$i + 2] -eq 5 -and $end[$i + 3] -eq 6) { $at = $i; break } }
    if ($at -lt 0) { return -1 }
    $size = [BitConverter]::ToUInt32($end, $at + 12)
    if ([BitConverter]::ToUInt32($end, $at + 16) -eq [uint32]::MaxValue -or $size -gt 64MB) { return -1 }
    $start = $stream.Length - $tail + $at - $size
    if ($start -lt 0) { return -1 }
    $directory = & $read $start ([int]$size)
    $count = 0
    $i = 0
    while ($i + 46 -le $directory.Length -and $directory[$i] -eq 0x50 -and $directory[$i + 1] -eq 0x4B -and $directory[$i + 2] -eq 1 -and $directory[$i + 3] -eq 2) {
      $nameLength = [BitConverter]::ToUInt16($directory, $i + 28)
      # A folder's entry holds no bytes to lock, whatever its flag says.
      $isFolder = $nameLength -gt 0 -and $i + 46 + $nameLength -le $directory.Length -and $directory[$i + 45 + $nameLength] -eq 0x2F
      if (($directory[$i + 8] -band 1) -ne 0 -and -not $isFolder) { $count++ }
      $i += 46 + $nameLength +[BitConverter]::ToUInt16($directory, $i + 30) + [BitConverter]::ToUInt16($directory, $i + 32)
    }
    $count
  } catch { -1 } finally { $stream.Dispose() }
}

function Read-ZipListing([string]$file) {
  Use-Zip
  $byPath = New-Object 'System.Collections.Generic.Dictionary[string,object]' ([StringComparer]::Ordinal)
  $files = 0; $total = [long]0; $packed = [long]0; $entries = 0
  $zip = [System.IO.Compression.ZipFile]::OpenRead($file)
  try {
    foreach ($entry in $zip.Entries) {
      $entries++
      $name = $entry.FullName.Replace('\', '/')
      $isFolder = $name.EndsWith('/')
      if (-not $isFolder) { $files++; $total += $entry.Length; $packed += $entry.CompressedLength }
      $byPath[$name] = [pscustomobject]@{ Path = $name; Folder = $isFolder; Size = $entry.Length; Packed = $entry.CompressedLength; Date = $entry.LastWriteTime }
      $cut = $name.TrimEnd('/').LastIndexOf('/')
      while ($cut -gt 0) {
        $parent = $name.Substring(0, $cut + 1)
        if ($byPath.ContainsKey($parent)) { break }
        $byPath[$parent] = [pscustomobject]@{ Path = $parent; Folder = $true; Size = 0; Packed = 0; Date = $null }
        $cut = $parent.TrimEnd('/').LastIndexOf('/')
      }
    }
  } finally { $zip.Dispose() }
  # Tree order: a folder's rows right after it, as '/' sorts before any other character.
  # Each key carries its row's place after a NUL, as Windows PowerShell hands Array.Sort a copy of a second
  # array and leaves the rows unsorted.
  $unsorted = @($byPath.Values)
  $keys = [string[]]@(for ($i = 0; $i -lt $unsorted.Count; $i++) { $unsorted[$i].Path.ToLowerInvariant().Replace('/', [string][char]1) + [char]0 + $i })
  [Array]::Sort($keys, [StringComparer]::Ordinal)
  $rows = @(foreach ($key in $keys) { $unsorted[[int]$key.Substring($key.LastIndexOf([char]0) + 1)] })
  $folders = @($rows | Where-Object { $_.Folder }).Count
  [pscustomobject]@{ Rows = $rows; Files = $files; Folders = $folders; Total = $total; Packed = $packed; Entries = $entries; Encrypted = (Get-ZipEncryptedCount $file) }
}

function Format-ZipDate($date) { if ($null -eq $date) { '' } else { $date.ToString('yyyy-MM-dd HH:mm') } }

function Get-ZipShownRows($listing) { if ($listing.Rows.Count -gt $zipRowCap) { $listing.Rows[0..($zipRowCap - 1)] } else { $listing.Rows } }

function New-ZipPage($listing) {
  $html = New-Object System.Text.StringBuilder
  $about = ('{0:N0}' -f $listing.Files) + $(if ($listing.Files -eq 1) { ' archivo' } else { ' archivos' }) + ', ' + ('{0:N0}' -f $listing.Folders) + $(if ($listing.Folders -eq 1) { ' carpeta' } else { ' carpetas' })
  $about += ' &middot; ' + (Format-ShortSize $listing.Total) + ' en total &middot; ' + (Format-ShortSize $listing.Packed) + ' comprimido'
  [void]$html.Append('<div class="sheets"><p class="note">' + $about + '</p>')
  if ($listing.Encrypted -gt 0) { [void]$html.Append('<p class="note" style="color:#ffd43b">Cifrado con contrase&ntilde;a: ' + $listing.Encrypted + ' de ' + $listing.Files + ' archivos. Se ve la lista, no su contenido.</p>') }
  if ($listing.Rows.Count -eq 0) { [void]$html.Append('<p class="note">(ZIP vac&iacute;o)</p></div>'); return New-Page $html.ToString() $sheetCss }
  [void]$html.Append('<table class="grid"><tr><th style="text-align:left">Nombre</th><th>Tama&ntilde;o</th><th>Comprimido</th><th>Fecha</th></tr>')
  foreach ($row in (Get-ZipShownRows $listing)) {
    $depth = ($row.Path.TrimEnd('/').Split('/')).Count - 1
    $leaf = $row.Path.TrimEnd('/').Substring($row.Path.TrimEnd('/').LastIndexOf('/') + 1)
    $style = 'padding-left:' + (8 + 18 * $depth) + 'px' + $(if ($row.Folder) { ';color:#74c0fc' } else { '' })
    [void]$html.Append('<tr><td style="' + $style + '" title="' + (Html $row.Path) + '">' + (Html $leaf) + $(if ($row.Folder) { '/' } else { '' }) + '</td>')
    if ($row.Folder) { [void]$html.Append('<td></td><td></td>') }
    else { [void]$html.Append('<td class="n">' + (Format-ShortSize $row.Size) + '</td><td class="n">' + (Format-ShortSize $row.Packed) + '</td>') }
    [void]$html.Append('<td>' + (Format-ZipDate $row.Date) + '</td></tr>')
  }
  [void]$html.Append('</table>')
  if ($listing.Rows.Count -gt $zipRowCap) { [void]$html.Append('<p class="note">Se muestran las primeras ' + ('{0:N0}' -f $zipRowCap) + ' entradas de ' + ('{0:N0}' -f $listing.Rows.Count) + '.</p>') }
  [void]$html.Append('</div>')
  New-Page $html.ToString() $sheetCss
}

# The rows shown, for Copiar: the full path, the sizes in bytes and the date, apart by tabs.
function Get-ZipText($listing) {
  $text = New-Object System.Text.StringBuilder
  [void]$text.Append((T 'Nombre\tTama\u00f1o\tComprimido\tFecha')).Append("`r`n")
  foreach ($row in (Get-ZipShownRows $listing)) {
    $sizes = if ($row.Folder) { "`t" } else { "$($row.Size)`t$($row.Packed)" }
    [void]$text.Append($row.Path + "`t" + $sizes + "`t" + (Format-ZipDate $row.Date)).Append("`r`n")
  }
  $text.ToString()
}

# A short zip gets a popup sized to its rows.
function Get-ZipFitSize($listing) {
  $shown = [Math]::Min($listing.Rows.Count, $zipRowCap)
  $longest = 0
  foreach ($row in (Get-ZipShownRows $listing)) { $width = $row.Path.Length - $row.Path.TrimEnd('/').LastIndexOf('/') + 2 * ($row.Path.TrimEnd('/').Split('/').Count - 1); if ($width -gt $longest) { $longest = $width } }
  New-Object System.Drawing.Size(([int][Math]::Min($room.Width, [Math]::Max(640, 8 * $longest + 420))), ([int][Math]::Min($room.Height, [Math]::Max(220, 23 * $shown + 120))))
}

# A Windows shortcut's own fields, read through WScript.Shell, which only reads it here: nothing is saved.
function Get-ShortcutInfo([string]$file) {
  $shell = New-Object -ComObject WScript.Shell
  try {
    $link = $shell.CreateShortcut($file)
    try {
      $style = switch ([int]$link.WindowStyle) { 3 { 'maximizada' } 7 { 'minimizada' } default { 'normal' } }
      $target = [string]$link.TargetPath
      $exists = if ($target -and -not (Test-Path -LiteralPath $target)) { T '   (no existe)' } else { '' }
      $out = New-Object System.Collections.Generic.List[string]
      $out.Add((T 'Archivo:            ') + $fileName)
      $out.Add((T 'Tipo:               acceso directo de Windows (.lnk)'))
      $out.Add('')
      $out.Add((T 'Destino:            ') + $target + $exists)
      $out.Add((T 'Argumentos:         ') + $link.Arguments)
      $out.Add((T 'Carpeta de inicio:  ') + $link.WorkingDirectory)
      $out.Add((T 'Descripci\u00f3n:        ') + $link.Description)
      $out.Add((T 'Icono:              ') + $link.IconLocation)
      $out.Add((T 'Tecla:              ') + $link.Hotkey)
      $out.Add((T 'Ventana:            ') + $style)
      $out -join "`r`n"
    } finally { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($link) }
  } finally { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($shell) }
}

# An Internet shortcut: its URL from the INI text, then the text itself.
function Get-UrlInfo([string]$text) {
  $url = ''
  $icon = ''
  foreach ($one in ($text -split "`r?`n")) {
    if (-not $url -and $one -match '^\s*URL\s*=\s*(.*)$') { $url = $Matches[1].Trim() }
    if (-not $icon -and $one -match '^\s*IconFile\s*=\s*(.*)$') { $icon = $Matches[1].Trim() }
  }
  $out = New-Object System.Collections.Generic.List[string]
  $out.Add((T 'Archivo:  ') + $fileName)
  $out.Add((T 'Tipo:     acceso directo de Internet (.url)'))
  $out.Add('')
  $out.Add((T 'URL:      ') + $(if ($url) { $url } else { T '(no tiene)' }))
  if ($icon) { $out.Add((T 'Icono:    ') + $icon) }
  $out.Add('')
  $out.Add((T 'Contenido:'))
  $out.Add($text.TrimEnd())
  $out -join "`r`n"
}

# A view holding a few lines of text gets a popup sized to them, not the whole room.
function Get-FitSize([string]$text) {
  $lines = @($text -split "`r?`n")
  $longest = ($lines | Measure-Object -Property Length -Maximum).Maximum
  New-Object System.Drawing.Size(([int][Math]::Min($room.Width, [Math]::Max(520, 9 * $longest + 60))), ([int][Math]::Min($room.Height, [Math]::Max(160, 19 * $lines.Count + 40))))
}

function New-SourceBox([string]$text, [bool]$wrap) {
  $box = New-Object System.Windows.Forms.RichTextBox
  $box.ReadOnly = $true
  $box.HideSelection = $false
  $box.BorderStyle = 'None'
  $box.BackColor = $paper
  $box.ForeColor = $ink
  $box.Font = New-Object System.Drawing.Font('Consolas', 11)
  $box.DetectUrls = $false
  # Prose wraps; code and lists keep their lines and scroll sideways.
  $box.WordWrap = $wrap
  $box.ScrollBars = if ($wrap) { 'Vertical' } else { 'Both' }
  $box.Text = $text -replace "`r?`n", "`r`n"
  $box.Dock = 'Fill'
  Set-DarkScrollBars $box
  $box
}

function New-PageView([string]$html) {
  $browser = New-Object System.Windows.Forms.WebBrowser
  $browser.Dock = 'Fill'
  $browser.ScriptErrorsSuppressed = $true
  $browser.IsWebBrowserContextMenuEnabled = $false
  $browser.AllowWebBrowserDrop = $false
  # The page stays put: a web link opens in the browser, anything else goes nowhere.
  $browser.Add_Navigating({
    $scheme = $_.Url.Scheme
    if ($scheme -eq 'about' -or $scheme -eq 'javascript') { return }
    $_.Cancel = $true
    if ($scheme -in @('http', 'https', 'mailto')) { Start-Process $_.Url.AbsoluteUri }
  })
  $browser.Add_NewWindow({
    $_.Cancel = $true
    if ($this.StatusText -match '^(https?|mailto):') { Start-Process $this.StatusText }
  })
  $browser.Add_PreviewKeyDown({ if ($_.KeyCode -eq 'Escape') { $form.Close() } })
  $browser.DocumentText = $html
  $browser
}

# An HTML file as itself, in the newest mode Internet Explorer's engine has, its relative links read from
# its folder, with the dark scroll bars unless it sets its own.
function Add-HtmlHead([string]$html, [string]$folder) {
  $base = (New-Object System.Uri(($folder.TrimEnd('\') + '\'))).AbsoluteUri
  $head = '<meta http-equiv="X-UA-Compatible" content="IE=edge"><base href="' + $base + '"><style>' + $scrollCss + '</style>'
  $at = [regex]::Match($html, '(?i)<head(\s[^>]*)?>')
  if (-not $at.Success) { $at = [regex]::Match($html, '(?i)<html(\s[^>]*)?>') }
  if ($at.Success) { return $html.Insert($at.Index + $at.Length, $head) }
  $doctype = [regex]::Match($html, '(?i)^\s*<!DOCTYPE[^>]*>')
  if ($doctype.Success) { return $html.Insert($doctype.Length, $head) }
  '<!DOCTYPE html>' + $head + $html
}

# An SVG drawn inline, scaled to fit the popup (a small icon grows to be seen), on a checkerboard.
function New-SvgView([string]$text) {
  $settings = New-Object System.Xml.XmlReaderSettings
  $settings.DtdProcessing = [System.Xml.DtdProcessing]::Ignore
  $settings.XmlResolver = $null
  $document = New-Object System.Xml.XmlDocument
  $document.Load([System.Xml.XmlReader]::Create((New-Object System.IO.StringReader($text)), $settings))
  $svg = $document.DocumentElement
  if ($svg.LocalName -ne 'svg') { throw 'no es un SVG' }
  $number = { param($value) if ($value -match '^\s*([\d.]+)\s*(px)?\s*$') { [double]$Matches[1] } else { 0.0 } }
  $width = & $number $svg.GetAttribute('width')
  $height = & $number $svg.GetAttribute('height')
  $sized = $width -gt 0 -and $height -gt 0
  $viewBox = $svg.GetAttribute('viewBox') -split '[\s,]+' | Where-Object { $_ -ne '' }
  if (($width -le 0 -or $height -le 0) -and $viewBox.Count -eq 4) { $width = [double]$viewBox[2]; $height = [double]$viewBox[3] }
  if ($width -le 0 -or $height -le 0) { $width = 300.0; $height = 150.0 }
  if ($viewBox.Count -ne 4) { $svg.SetAttribute('viewBox', "0 0 $width $height") }
  # Copiar on the Preview draws it as a PNG at its own size; with only a viewBox, a small one grows to 512
  # on its longer side. Never past 4096.
  $exportScale = if ($sized) { 1.0 } else { [Math]::Max(1.0, 512 / [Math]::Max($width, $height)) }
  $exportScale = [Math]::Min($exportScale, 4096 / [Math]::Max($width, $height))
  $export = $svg.CloneNode($true)
  $exportWidth = [int][Math]::Max(1, [Math]::Round($width * $exportScale))
  $exportHeight = [int][Math]::Max(1, [Math]::Round($height * $exportScale))
  $export.SetAttribute('width', "$exportWidth")
  $export.SetAttribute('height', "$exportHeight")
  $script:svgExport = [pscustomobject]@{ Markup = $export.OuterXml; Width = $exportWidth; Height = $exportHeight }
  $fit = [Math]::Min(($room.Width - 48) / $width, ($room.Height - 48) / $height)
  $scale = [Math]::Min($fit, [Math]::Max(1.0, 256 / [Math]::Max($width, $height)))
  $shownWidth = [int][Math]::Max(1, [Math]::Round($width * $scale))
  $shownHeight = [int][Math]::Max(1, [Math]::Round($height * $scale))
  $svg.SetAttribute('width', "$shownWidth")
  $svg.SetAttribute('height', "$shownHeight")
  $css = @"
html, body { height: 100%; margin: 0; background: #16181d; overflow: hidden; }
body { display: flex; align-items: center; justify-content: center; }
.board { width: ${shownWidth}px; height: ${shownHeight}px; background-color: #2b2f36; background-image: linear-gradient(45deg, #3a3f47 25%, transparent 25%, transparent 75%, #3a3f47 75%), linear-gradient(45deg, #3a3f47 25%, transparent 25%, transparent 75%, #3a3f47 75%); background-size: 16px 16px; background-position: 0 0, 8px 8px; }
svg { display: block; }
"@
  $script:inner = New-Object System.Drawing.Size(([Math]::Max(360, $shownWidth + 40)), ([Math]::Max(220, $shownHeight + 40)))
  New-PageView (New-Page ('<div class="board">' + $svg.OuterXml + '</div>') $css)
}

function New-MessagePage([string]$html) { New-Page ('<p class="note" style="font-size:15px">' + $html + '</p>') }

try {
  # A SQLite database is told by its first 16 bytes, whatever its name; a .db that is not one (a Thumbs.db)
  # is read as any other file.
  # A zip is told by its first four bytes too (an .odt, a .pptx, a zip with no extension); a Chrome
  # extension keeps its own page, as its zip starts past a header.
  if ($kind -in @('text', 'binary', 'sqlite')) {
    $head = Read-Bytes $path 16
    $isSqlite = Test-SqliteHead $head
    if ($isSqlite) { $kind = 'sqlite' } elseif ($kind -eq 'sqlite') { $kind = 'text' }
    if ($kind -in @('text', 'binary') -and $extension -ne '.crx' -and (Test-ZipHead $head)) { $kind = 'zip' }
  }
  if ($kind -eq 'sqlite') {
    # db_view.py reads it while the popup stands; the timer draws its tables when it is through.
    $views['Page'] = New-PageView (New-MessagePage 'Leyendo la base de datos...')
    $dbJob = Start-PythonScript 'db_view.py' $path 'No se pudo abrir la base de datos: '
    if ($dbJob.Done) { $views['Page'].DocumentText = New-MessagePage (Html $dbJob.Text) }
  } elseif ($kind -eq 'zip') {
    try {
      $listing = Read-ZipListing $path
      $views['Page'] = New-PageView (New-ZipPage $listing)
      $rawText = Get-ZipText $listing
      $inner = Get-ZipFitSize $listing
    } catch {
      $why = $_.Exception
      while ($why.InnerException) { $why = $why.InnerException }
      $size = try { Format-Size (Get-Item -LiteralPath $path).Length } catch { '' }
      $views['Page'] = New-PageView (New-MessagePage ('No se pudo leer este ZIP: est&aacute; da&ntilde;ado, incompleto o no es un ZIP.<br><br>' + (Html $why.Message) + '<br><br>' + (Html $fileName) + ' &middot; ' + (Html $size)))
      $inner = New-Object System.Drawing.Size(([int][Math]::Min($room.Width, 640)), 220)
    }
  } elseif ($kind -eq 'shortcut') {
    $info = Get-ShortcutInfo $path
    $views['Text'] = New-SourceBox $info $false
    $inner = Get-FitSize $info
  } elseif ($kind -eq 'image') {
    # Read into memory, not with FromFile, which holds the file till the popup closes.
    $image = [System.Drawing.Image]::FromStream((New-Object System.IO.MemoryStream(, [System.IO.File]::ReadAllBytes($path))))
    $disposables += $image
    $scale = [Math]::Min(1.0, [Math]::Min($room.Width / $image.Width, $room.Height / $image.Height))
    $picture = New-Object System.Windows.Forms.PictureBox
    $picture.SizeMode = 'Zoom'
    $picture.BackColor = $black
    $picture.Image = $image
    $picture.Dock = 'Fill'
    $views['Image'] = $picture
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
    $pages = New-Object System.Windows.Forms.FlowLayoutPanel
    $pages.FlowDirection = 'TopDown'
    $pages.WrapContents = $false
    $pages.AutoScroll = $true
    $pages.BackColor = $paper
    $pages.Dock = 'Fill'
    Set-DarkScrollBars $pages
    $views['PDF'] = $pages
    # Texto: the PDF's text, selectable and copied by Copiar, read by pdf_text.py (pdfminer.six) while the
    # pages are drawn; the timer puts it in place when it is read.
    $views['Texto'] = New-SourceBox (T 'Leyendo el texto del PDF...') $true
    $pdfText = Start-PdfText $path
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
      $pages.Controls.Add($box)
      $script:disposables += $bitmap
    }
    if ($pdfPages.Count -gt 0) { Add-Page 0; $pdfPages.Next = 1 }
  } elseif ($kind -in @('audio', 'video')) {
    Add-Type -AssemblyName PresentationCore, PresentationFramework, WindowsBase, WindowsFormsIntegration
    # WPF drawn by the processor: with the graphics card, a WPF area inside a Windows Forms window can stay
    # unpainted, showing what was behind it.
    [System.Windows.Media.RenderOptions]::ProcessRenderMode = [System.Windows.Interop.RenderMode]::SoftwareOnly
    . {
      $uri = New-Object System.Uri($path)
      $barHeight = 40
      $media = [pscustomobject]@{ Ready = $false; Playing = $true; Seconds = 0.0 }
      $panel = New-Object System.Windows.Forms.Panel
      $panel.BackColor = $black
      $panel.Dock = 'Fill'
      $symbols = 'Segoe MDL2 Assets'
      $message = New-Object System.Windows.Forms.Label
      $message.Dock = 'Fill'
      $message.ForeColor = $red
      $message.Font = New-Object System.Drawing.Font('Segoe UI', 11)
      $message.TextAlign = 'MiddleCenter'
      $message.Visible = $false
      if ($kind -eq 'video') {
        $player = New-Object System.Windows.Controls.MediaElement
        $player.LoadedBehavior = [System.Windows.Controls.MediaState]::Manual
        $player.UnloadedBehavior = [System.Windows.Controls.MediaState]::Manual
        $player.Stretch = [System.Windows.Media.Stretch]::Uniform
        $grid = New-Object System.Windows.Controls.Grid
        $grid.Background = [System.Windows.Media.Brushes]::Black
        [void]$grid.Children.Add($player)
        $stage = New-Object System.Windows.Forms.Integration.ElementHost
        $stage.BackColor = $black
        $stage.Child = $grid
        $player.Source = $uri
        $inner = New-Object System.Drawing.Size(([int][Math]::Min(640, $room.Width)), ([int][Math]::Min(360 + $barHeight, $room.Height)))
      } else {
        $player = New-Object System.Windows.Media.MediaPlayer
        $stage = New-Object System.Windows.Forms.Panel
        $stage.BackColor = $black
        $note = New-Object System.Windows.Forms.Label
        $note.Text = [string][char]0xE8D6
        $note.Font = New-Object System.Drawing.Font($symbols, 24)
        $note.ForeColor = $blue
        $note.TextAlign = 'MiddleCenter'
        $note.SetBounds(0, 2, 48, 46)
        $about = New-Object System.Windows.Forms.Label
        $about.Text = (T 'Audio ') + $extension.TrimStart('.').ToUpperInvariant() + '  -  ' + (Format-Size (Get-Item -LiteralPath $path).Length)
        $about.Font = New-Object System.Drawing.Font('Segoe UI', 10)
        $about.ForeColor = $dim
        $about.TextAlign = 'MiddleLeft'
        $about.SetBounds(54, 2, 420, 46)
        $stage.Controls.Add($note)
        $stage.Controls.Add($about)
        $inner = New-Object System.Drawing.Size(484, 90)
      }
      $stage.Dock = 'Fill'
      $player.Volume = 0.8

      # A thin dark slider: the track, the part played in blue, and a round knob; pressed or dragged, it
      # tells $Tag.Change where, from 0 to 1.
      $makeSlider = {
        param([double]$value)
        $slider = New-Object System.Windows.Forms.Panel
        [System.Windows.Forms.Control].GetProperty('DoubleBuffered', [System.Reflection.BindingFlags]'NonPublic, Instance').SetValue($slider, $true, $null)
        $slider.BackColor = $black
        $slider.Cursor = [System.Windows.Forms.Cursors]::Hand
        $slider.Tag = @{ Value = $value; Drag = $false; Hover = $false; Change = $null }
        $slider.Add_Paint({
          $g = $_.Graphics
          $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
          $s = $this.Tag
          $radius = 6
          $y = $this.ClientSize.Height / 2
          $x0 = $radius; $x1 = $this.ClientSize.Width - $radius
          $x = $x0 + ($x1 - $x0) * [Math]::Max(0.0, [Math]::Min(1.0, $s.Value))
          $track = New-Object System.Drawing.Pen(([System.Drawing.ColorTranslator]::FromHtml('#343a40')), 4)
          $track.StartCap = 'Round'; $track.EndCap = 'Round'
          $done = New-Object System.Drawing.Pen($blue, 4)
          $done.StartCap = 'Round'; $done.EndCap = 'Round'
          $g.DrawLine($track, [single]$x0, [single]$y, [single]$x1, [single]$y)
          if ($x -gt $x0) { $g.DrawLine($done, [single]$x0, [single]$y, [single]$x, [single]$y) }
          $knob = New-Object System.Drawing.SolidBrush($(if ($s.Hover -or $s.Drag) { $blue } else { $ink }))
          $g.FillEllipse($knob, [single]($x - $radius), [single]($y - $radius), [single](2 * $radius), [single](2 * $radius))
          $track.Dispose(); $done.Dispose(); $knob.Dispose()
        })
        $move = {
          param($control, [int]$at)
          $radius = 6
          $span = [Math]::Max(1, $control.ClientSize.Width - 2 * $radius)
          $control.Tag.Value = [Math]::Max(0.0, [Math]::Min(1.0, ($at - $radius) / $span))
          $control.Invalidate()
          if ($control.Tag.Change) { & $control.Tag.Change $control.Tag.Value }
        }.GetNewClosure()
        $slider.Add_MouseDown({ $this.Tag.Drag = $true; & $move $this $_.X }.GetNewClosure())
        $slider.Add_MouseMove({ if ($this.Tag.Drag) { & $move $this $_.X } }.GetNewClosure())
        $slider.Add_MouseUp({ $this.Tag.Drag = $false; $this.Invalidate() })
        $slider.Add_MouseEnter({ $this.Tag.Hover = $true; $this.Invalidate() })
        $slider.Add_MouseLeave({ $this.Tag.Hover = $false; $this.Invalidate() })
        $slider
      }

      $bar = New-Object System.Windows.Forms.Panel
      $bar.Dock = 'Bottom'
      $bar.Height = $barHeight
      $bar.BackColor = $black
      $playButton = New-Object System.Windows.Forms.Label
      $playButton.Font = New-Object System.Drawing.Font($symbols, 14)
      $playButton.ForeColor = $blue
      $playButton.TextAlign = 'MiddleCenter'
      $playButton.Cursor = [System.Windows.Forms.Cursors]::Hand
      $playButton.Text = [string][char]0xE769
      $seekBar = & $makeSlider 0.0
      $timeLabel = New-Object System.Windows.Forms.Label
      $timeLabel.Font = New-Object System.Drawing.Font('Consolas', 10)
      $timeLabel.ForeColor = $ink
      $timeLabel.TextAlign = 'MiddleRight'
      $timeLabel.Text = '0:00 / 0:00'
      $volumeIcon = New-Object System.Windows.Forms.Label
      $volumeIcon.Font = New-Object System.Drawing.Font($symbols, 12)
      $volumeIcon.ForeColor = $blue
      $volumeIcon.TextAlign = 'MiddleCenter'
      $volumeIcon.Text = [string][char]0xE767
      $volumeBar = & $makeSlider 0.8
      foreach ($one in @($playButton, $seekBar, $timeLabel, $volumeIcon, $volumeBar)) { $bar.Controls.Add($one) }
      $bar.Add_Resize({
        $w = $bar.ClientSize.Width
        $playButton.SetBounds(0, 4, 34, 32)
        $volumeBar.SetBounds($w - 84, 12, 82, 16)
        $volumeIcon.SetBounds($w - 112, 4, 28, 32)
        $timeLabel.SetBounds($w - 112 - 136, 4, 132, 32)
        $seekBar.SetBounds(40, 12, [Math]::Max(40, $w - 40 - 112 - 136 - 8), 16)
      })

      $panel.Controls.Add($stage)
      $panel.Controls.Add($message)
      $panel.Controls.Add($bar)
      $views['Media'] = $panel
      $mediaParts = [pscustomobject]@{ Media = $media; Message = $message; Stage = $stage; Play = $playButton; Seek = $seekBar; Time = $timeLabel; Bar = $barHeight }
      $seekBar.Tag.Change = { param($value) if ($mediaParts.Media.Seconds -gt 0) { $player.Position = [TimeSpan]::FromSeconds($value * $mediaParts.Media.Seconds) } }
      $volumeBar.Tag.Change = { param($value) $player.Volume = $value }
      $playButton.Add_Click({ Switch-Playing })
    }
    function Format-Time([double]$seconds) {
      $t = [TimeSpan]::FromSeconds([Math]::Floor([Math]::Max(0, $seconds)))
      if ($t.TotalHours -ge 1) { '{0}:{1:00}:{2:00}' -f [int][Math]::Floor($t.TotalHours), $t.Minutes, $t.Seconds } else { '{0}:{1:00}' -f $t.Minutes, $t.Seconds }
    }
    function Switch-Playing {
      $media = $mediaParts.Media
      if ($media.Playing) { $player.Pause() } else { $player.Play() }
      $media.Playing = -not $media.Playing
      $mediaParts.Play.Text = [string][char]$(if ($media.Playing) { 0xE769 } else { 0xE768 })
    }
    $player.Add_MediaOpened({
      $media = $mediaParts.Media
      $media.Ready = $true
      if ($player.NaturalDuration.HasTimeSpan) { $media.Seconds = $player.NaturalDuration.TimeSpan.TotalSeconds }
      # A video takes its own size, within the room the screen gives.
      if ($kind -eq 'video' -and $player.NaturalVideoWidth -gt 0 -and $player.NaturalVideoHeight -gt 0) {
        $width = [double]$player.NaturalVideoWidth; $height = [double]$player.NaturalVideoHeight
        $scale = [Math]::Min(1.0, [Math]::Min($room.Width / $width, ($room.Height - $mediaParts.Bar) / $height))
        Set-PopupSize (([int][Math]::Max(480, $width * $scale)) + $extraWidth) (([int]($height * $scale)) + $mediaParts.Bar + $extraHeight)
      }
    })
    $player.Add_MediaFailed({
      $why = if ($_.ErrorException) { $_.ErrorException.Message } else { '' }
      $gap = if ($kind -eq 'audio') { "`r`n" } else { "`r`n`r`n" }
      $mediaParts.Message.Text = (T 'No se puede reproducir este formato en Windows') + $gap + $why
      $mediaParts.Message.Visible = $true
      $mediaParts.Stage.Visible = $false
      $mediaParts.Media.Playing = $false
      $mediaParts.Play.Text = [string][char]0xE768
    })
    $player.Add_MediaEnded({
      $player.Pause()
      $player.Position = [TimeSpan]::Zero
      $mediaParts.Media.Playing = $false
      $mediaParts.Play.Text = [string][char]0xE768
    })
    if ($kind -eq 'audio') { $player.Open((New-Object System.Uri($path))) }
    $player.Play()
  } else {
    $bytes = Read-Bytes $path
    $text = $null
    if ($kind -in @('text', 'markdown', 'html', 'svg', 'url')) {
      $text = Read-Text $bytes
      if ($null -eq $text) { $kind = 'binary' }
      else {
        if ($text.Length -gt 0 -and $text[0] -eq [char]0xFEFF) { $text = $text.Substring(1) }
        if ($bytes.Length -gt 2MB) { $text += "`r`n`r`n[...] (the file goes on past 2 MB)" }
      }
    }
    switch ($kind) {
      'markdown' {
        # Markdown opens drawn as a page, the Preview; the switch shows its text, MD, and back.
        $views['Preview'] = New-PageView (New-MarkdownPage $text)
        $views['MD'] = New-SourceBox $text $true
        $rawText = $text
      }
      'html' {
        $views['Preview'] = New-PageView (Add-HtmlHead $text ([IO.Path]::GetDirectoryName($path)))
        $views['HTML'] = New-SourceBox $text $false
        $rawText = $text
        Start-Pretty 'HTML' $text $bytes.Length
      }
      'svg' {
        try { $views['Preview'] = New-SvgView $text }
        catch { $views['Preview'] = New-PageView (New-MessagePage ('No se pudo dibujar este SVG: ' + (Html $_.Exception.Message))) }
        $views['SVG'] = New-SourceBox $text $false
        $rawText = $text
        Start-Pretty 'SVG' $text $bytes.Length
      }
      'xlsx' {
        $sheets = Read-Xlsx $path
        $views['Page'] = New-PageView (New-SheetsPage $sheets '')
        $rawText = Get-SheetsText $sheets
      }
      'xls' {
        if ([Type]::GetTypeFromProgID('Excel.Application')) {
          $views['Page'] = New-PageView (New-MessagePage 'Abriendo con Excel...')
          $state.Office = Start-OfficeCopy 'excel' '.xlsx' {
            param($copyPath, $problem)
            if ($problem) { $views['Page'].DocumentText = New-MessagePage ('Excel no pudo abrir este .xls: ' + $problem); return }
            $sheets = Read-Xlsx $copyPath
            $views['Page'].DocumentText = New-SheetsPage $sheets ''
            $script:rawText = Get-SheetsText $sheets
          }
        } else {
          $views['Page'] = New-PageView (New-MessagePage ('No se puede previsualizar .xls sin Excel instalado.<br><br>' + (Html $fileName) + ' &middot; ' + (Html (Format-Size $bytes.Length))))
        }
      }
      'docx' { $views['Page'] = New-PageView (New-Page (ConvertFrom-Docx $path) $documentCss) }
      'doc' {
        if ([Type]::GetTypeFromProgID('Word.Application')) {
          $views['Page'] = New-PageView (New-MessagePage 'Abriendo con Word...')
          $state.Office = Start-OfficeCopy 'word' '.docx' {
            param($copyPath, $problem)
            $views['Page'].DocumentText = if ($problem) {
              New-Page ('<p class="note">Word no pudo abrir este .doc: ' + $problem + '<br>Texto aproximado: los textos legibles del archivo.</p><pre>' + (Html (Get-LooseText $bytes)) + '</pre>') $documentCss
            } else { New-Page (ConvertFrom-Docx $copyPath) $documentCss }
          }
        } else {
          $views['Text'] = New-SourceBox ((T 'Texto aproximado: sin Word instalado, se muestran los textos legibles del archivo.') + "`r`n`r`n" + (Get-LooseText $bytes)) $true
        }
      }
      'url' {
        $info = Get-UrlInfo $text
        $views['Text'] = New-SourceBox $info $false
        $inner = Get-FitSize $info
      }
      'text' {
        # Prose wraps: plain text, logs, and a LICENSE or README with no extension.
        $prose = (@('.txt', '.log') -contains $extension) -or ($extension -eq '' -and $fileName -match '^(LICENSE|LICENCE|COPYING|README|AUTHORS|NOTICE|CHANGELOG)$')
        $views['Text'] = New-SourceBox $text $prose
        Start-Pretty 'Text' $text $bytes.Length
      }
    }
    if ($kind -eq 'binary') { $views['Text'] = New-SourceBox (Get-BinaryInfo $bytes '') $false }
  }
} catch {
  # Whatever goes wrong, the popup still comes up and says so.
  $problem = $_.Exception.Message
  $views.Clear()
  $kind = 'binary'
  $bytes = New-Object byte[] 0
  try { $bytes = Read-Bytes $path } catch { }
  $info = try { Get-BinaryInfo $bytes $problem } catch { (T 'No se pudo mostrar este archivo: ') + $problem }
  $views['Text'] = New-SourceBox $info $false
  $inner = $room
}
$viewNames = @($views.Keys)

# A popup of text alone is as tall and as wide as its text asks, up to the room: a short file opens small.
function Get-TextFit {
  $boxes = @($views.Values | Where-Object { $_ -is [System.Windows.Forms.RichTextBox] })
  if ($boxes.Count -eq 0 -or $boxes.Count -ne $views.Count) { return $null }
  $lines = 1
  $longest = 1
  foreach ($box in $boxes) {
    $all = $box.Lines
    $lines = [Math]::Max($lines, $all.Count)
    foreach ($one in $all) { if ($one.Length -gt $longest) { $longest = $one.Length } }
  }
  $cell = [System.Windows.Forms.TextRenderer]::MeasureText('M', $boxes[0].Font)
  $bar = [System.Windows.Forms.SystemInformation]::HorizontalScrollBarHeight
  $width = [int][Math]::Min($room.Width, [Math]::Max(480, $longest * ($cell.Width - 4) + 48))
  $height = [int][Math]::Min($room.Height, [Math]::Max(140, $lines * ($boxes[0].Font.Height + 1) + $bar + 24))
  New-Object System.Drawing.Size($width, $height)
}
$fit = Get-TextFit
if ($fit) { $inner = $fit }

# ---- The frame -------------------------------------------------------------------------------------------
$title = New-Object System.Windows.Forms.Label
$title.Text = " $fileName "
$title.AutoSize = $true
$title.Font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = $blue
$title.BackColor = $black

# [char] keeps the file ASCII: PowerShell 5.1 reads a script with no BOM in the system's code page.
function New-CloseLabel {
  $label = New-Object System.Windows.Forms.Label
  $label.Text = " $([string][char]0x2715) "
  $label.AutoSize = $true
  $label.Font = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Bold)
  $label.ForeColor = $red
  $label.BackColor = $black
  $label.Cursor = [System.Windows.Forms.Cursors]::Hand
  $label
}
$close = New-CloseLabel
# The bottom line's close mark, the same as the top one's.
$closeBelow = New-CloseLabel

function New-TopLabel([string]$text) {
  $label = New-Object System.Windows.Forms.Label
  $label.Text = " $text "
  $label.AutoSize = $true
  $label.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
  $label.ForeColor = $blue
  $label.BackColor = $black
  $label.Cursor = [System.Windows.Forms.Cursors]::Hand
  $label
}

# Copiar: what is selected, else all the text (a Preview's source, a database's table shown); a picture as
# itself. Text copied is also said on stdout, for the mod to put in the prompt.
$copy = $null
$copyBelow = $null
if ($kind -notin @('audio', 'video')) { $copy = New-TopLabel 'Copiar'; $copyBelow = New-TopLabel 'Copiar' }
$copyLabels = @($copy, $copyBelow | Where-Object { $_ })

# The switch: a label a view, made the first time and renamed after (the source's, once laid out, as
# Original); one made while the popup stands goes on it at once. A click on one is the viewer's choice.
$switch = @{}
function Add-SwitchLabel([string]$view) {
  $text = if ($labelNames.ContainsKey($view)) { $labelNames[$view] } else { $view }
  if ($switch.ContainsKey($view)) { $switch[$view].Text = " $text "; return }
  $label = New-TopLabel $text
  $label.Tag = $view
  $label.Add_Click({ $state.Picked = $true; Show-View $this.Tag })
  $switch[$view] = $label
  if ($form) { $form.Controls.Add($label); $label.BringToFront() }
}
if ($viewNames.Count -gt 1) { foreach ($view in $viewNames) { Add-SwitchLabel $view } }

$form = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = 'None'
$form.StartPosition = 'Manual'
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.KeyPreview = $true
$form.BackColor = $black
$form.Padding = New-Object System.Windows.Forms.Padding($contour)

$frame = New-Object System.Windows.Forms.Panel
$frame.Dock = 'Fill'
$frame.BackColor = $blue
$frame.Padding = New-Object System.Windows.Forms.Padding($line)

$inside = New-Object System.Windows.Forms.Panel
$inside.Dock = 'Fill'
$inside.BackColor = $black
$inside.Padding = New-Object System.Windows.Forms.Padding($margin, $band, $margin, $band)

foreach ($view in $viewNames) { $inside.Controls.Add($views[$view]) }
$frame.Controls.Add($inside)
$form.Controls.Add($frame)

$lineMiddle = $contour + [int]($line / 2)
$topLabels = @($title, $close, $closeBelow) + @($switch.Values) + $copyLabels
foreach ($label in $topLabels) { $form.Controls.Add($label); $label.BringToFront() }

# The top line: the title in the middle, the switch after it, Copiar and the close mark at the right.
function Set-TopLine {
  $width = $form.ClientSize.Width
  $title.Location = New-Object System.Drawing.Point(([int](($width - $title.PreferredWidth) / 2)), ($lineMiddle - [int]($title.PreferredHeight / 2)))
  $left = $title.Location.X + $title.PreferredWidth + 10
  foreach ($view in $viewNames) {
    if (-not $switch.ContainsKey($view)) { continue }
    $label = $switch[$view]
    $label.Location = New-Object System.Drawing.Point($left, ($lineMiddle - [int]($label.PreferredHeight / 2)))
    $left += $label.PreferredWidth + 4
  }
  $close.Location = New-Object System.Drawing.Point(($width - $contour - $close.PreferredWidth - 12), ($lineMiddle - [int]($close.PreferredHeight / 2)))
  if ($copy) { $copy.Location = New-Object System.Drawing.Point(($close.Location.X - $copy.PreferredWidth - 6), ($lineMiddle - [int]($copy.PreferredHeight / 2))) }
  # The bottom line: the same Copiar and close mark, at the same places on it, only on a large popup
  # (two thirds of the screen's height or more); a small or middling one keeps them on top alone.
  $isLarge = $form.ClientSize.Height -ge ($area.Height * 0.65)
  $closeBelow.Visible = $isLarge
  if ($copyBelow) { $copyBelow.Visible = $isLarge }
  $bottomMiddle = $form.ClientSize.Height - $lineMiddle
  $closeBelow.Location = New-Object System.Drawing.Point($close.Location.X, ($bottomMiddle - [int]($closeBelow.PreferredHeight / 2)))
  if ($copyBelow) { $copyBelow.Location = New-Object System.Drawing.Point(($closeBelow.Location.X - $copyBelow.PreferredWidth - 6), ($bottomMiddle - [int]($copyBelow.PreferredHeight / 2))) }
}

# The popup at a size, in the middle of the screen; a small one still leaves the top line room.
function Set-PopupSize([int]$width, [int]$height) {
  $sides = $close.PreferredWidth + 24 + 40
  if ($copy) { $sides += $copy.PreferredWidth + 6 }
  foreach ($label in $switch.Values) { $sides += $label.PreferredWidth + 4 }
  $width = [Math]::Max($width, 2 * $contour + $title.PreferredWidth + 2 * $sides)
  $form.ClientSize = New-Object System.Drawing.Size($width, $height)
  $form.Location = New-Object System.Drawing.Point(([int]($area.X + ($area.Width - $width) / 2)), ([int]($area.Y + ($area.Height - $height) / 2)))
  Set-TopLine
}

function Show-View([string]$view) {
  $state.View = $view
  foreach ($name in $viewNames) { $views[$name].Visible = $name -eq $view }
  foreach ($one in $switch.Values) {
    $isShown = $one.Tag -eq $view
    $one.BackColor = if ($isShown) { $blue } else { $black }
    $one.ForeColor = if ($isShown) { $black } else { $blue }
  }
  if ($form.Visible) { [void]$views[$view].Focus() }
}

function Copy-View {
  $view = $views[$state.View]
  $text = $null
  try {
    if ($view -is [System.Windows.Forms.WebBrowser] -and $svgExport -and $state.View -eq 'Preview') {
      Copy-SvgPicture; return
    }
    if ($view -is [System.Windows.Forms.WebBrowser]) {
      $selected = $null
      try { $selected = [string]$view.Document.InvokeScript('eval', [object[]]@('window.getSelection ? String(window.getSelection()) : ""')) } catch { }
      $shownTable = $null
      if (-not $selected -and $dbTables) {
        $at = 0
        try { $at = [int][string]$view.Document.InvokeScript('eval', [object[]]@('String(window.cur || 0)')) } catch { }
        if ($at -ge 0 -and $at -lt $dbTables.Count) { $shownTable = $dbTables[$at] }
      }
      $text = if ($selected) { $selected } elseif ($shownTable) { $shownTable } elseif ($rawText) { $rawText } elseif ($view.Document -and $view.Document.Body) { $view.Document.Body.InnerText } else { $null }
    } elseif ($view -is [System.Windows.Forms.RichTextBox]) {
      $text = if ($view.SelectionLength -gt 0) { $view.SelectedText } else { $view.Text }
    } elseif ($image) {
      [System.Windows.Forms.Clipboard]::SetImage($image); Send-Attach $path; Show-Copied; return
    } elseif ($pdfText) {
      # On the pages, Copiar takes the whole text, once it is read.
      if ($pdfText.Done) { $text = $pdfText.Text }
    }
    if ($text) {
      [System.Windows.Forms.Clipboard]::SetText(($text -replace "(?<!`r)`n", "`r`n"))
      Send-Copied $text
      Show-Copied
    }
  } catch { }
}

# The text copied, for the mod: one line, `copied ` and the text's UTF-8 in Base64, with LF line ends.
function Send-Copied([string]$text) {
  $plain = $text -replace "`r`n", "`n"
  try { Say ('copied ' + [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($plain))) } catch { }
}

# A picture file for the mod to attach to the prompt: one line, `attach ` and its absolute path's UTF-8 in
# Base64.
function Send-Attach([string]$file) {
  try { Say ('attach ' + [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([IO.Path]::GetFullPath($file)))) } catch { }
}

# An SVG's Preview as a picture: drawn at its export size by a WebBrowser of its own that is never shown, on
# the Preview's dark paper, then put on the clipboard and saved as a PNG under %TEMP%\speedy-code\copies for
# the mod to attach.
function Copy-SvgPicture {
  if ($state.Drawing) { return }
  $state.Drawing = $true
  $browser = $null
  $bitmap = $null
  try {
    $width = $svgExport.Width; $height = $svgExport.Height
    $browser = New-Object System.Windows.Forms.WebBrowser
    $browser.ScrollBarsEnabled = $false
    $browser.ScriptErrorsSuppressed = $true
    $browser.Size = New-Object System.Drawing.Size($width, $height)
    $css = 'html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #16181d; overflow: hidden; } svg { display: block; }'
    $browser.DocumentText = New-Page $svgExport.Markup $css
    $until = [DateTime]::Now.AddSeconds(5)
    while ($browser.ReadyState -ne [System.Windows.Forms.WebBrowserReadyState]::Complete -and [DateTime]::Now -lt $until) {
      [System.Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 10
    }
    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $browser.DrawToBitmap($bitmap, (New-Object System.Drawing.Rectangle(0, 0, $width, $height)))
    $folder = Join-Path ([IO.Path]::GetTempPath()) 'speedy-code\copies'
    [void][IO.Directory]::CreateDirectory($folder)
    $file = Join-Path $folder ([IO.Path]::GetFileNameWithoutExtension($path) + '-' + [DateTime]::Now.ToString('yyMMdd-HHmmss') + '.png')
    $bitmap.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
    [System.Windows.Forms.Clipboard]::SetImage($bitmap)
    Send-Attach $file
    Show-Copied
  } finally {
    if ($bitmap) { $bitmap.Dispose() }
    if ($browser) { $browser.Dispose() }
    $state.Drawing = $false
  }
}

function Set-CopyLabels([string]$text, $back, $fore) {
  foreach ($one in $copyLabels) { $one.Text = $text; $one.BackColor = $back; $one.ForeColor = $fore }
  Set-TopLine
}

function Show-Copied {
  Set-CopyLabels ' Copiado ' $blue $black
  $state.CopyFlash = 10
}
foreach ($one in $copyLabels) { $one.Add_Click({ Copy-View }) }

Set-PopupSize ($inner.Width + $extraWidth) ($inner.Height + $extraHeight)
# The view it opens on: the first, or the one SPEEDY_VIEW names when it has it (`Texto` for a PDF's text).
Show-View $(if ($env:SPEEDY_VIEW -and $viewNames -contains $env:SPEEDY_VIEW) { $env:SPEEDY_VIEW } else { $viewNames[0] })
$close.Add_Click({ $form.Close() })
$closeBelow.Add_Click({ $form.Close() })

$form.Add_KeyDown({
  if ($_.KeyCode -eq 'Escape') { $form.Close(); return }
  $view = $views[$state.View]
  if ($player -and $_.KeyCode -eq 'Space') { Switch-Playing; $_.Handled = $true; $_.SuppressKeyPress = $true; return }
  if ($_.Control -and $_.KeyCode -eq 'A' -and $view -is [System.Windows.Forms.RichTextBox]) { $view.SelectAll(); $_.Handled = $true; $_.SuppressKeyPress = $true; return }
  if ($_.Control -and $_.KeyCode -eq 'C' -and $image) { Copy-View; $_.Handled = $true }
})

$form.Add_FormClosing({
  if ($player) { try { $player.Stop(); $player.Close() } catch { } }
  # Office left at work finishes on its own and quits; its folder goes if it can.
  if ($state.Office) { try { Remove-Item -LiteralPath $state.Office.Folder -Recurse -Force } catch { } }
  # A database still being read is not waited for.
  if ($dbJob -and -not $dbJob.Done) { try { $dbJob.Process.Kill() } catch { } }
  if ($prettyJob -and -not $prettyJob.Done) { try { $prettyJob.Process.Kill() } catch { } }
})

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 100
$timer.Add_Tick({
  try { Say '.' } catch { $form.Close(); return }
  # Office, at work on its own, is looked in on; past 90 seconds it is given up on.
  if ($state.Office) {
    $office = $state.Office
    $timedOut = ([DateTime]::Now - $office.Started).TotalSeconds -gt 90
    if ($office.Process.HasExited -or $timedOut) {
      $state.Office = $null
      if ($timedOut) { try { $office.Process.Kill() } catch { } }
      Complete-OfficeCopy $office $timedOut
    }
  }
  if ($pdfText -and -not $pdfText.Done -and $pdfText.Process.HasExited) { try { Complete-PdfText $pdfText } catch { $pdfText.Done = $true } }
  if ($prettyJob -and -not $prettyJob.Done -and $prettyJob.Process.HasExited) { try { Complete-Pretty $prettyJob } catch { $prettyJob.Done = $true } }
  if ($dbJob -and -not $dbJob.Done -and $dbJob.Process.HasExited) {
    try { Complete-DbView $dbJob } catch { $dbJob.Done = $true; $views['Page'].DocumentText = New-MessagePage ('No se pudo mostrar la base de datos: ' + (Html $_.Exception.Message)) }
  }
  if ($pdfPages -and $pdfPages.Next -lt $pdfPages.Count) {
    try { Add-Page $pdfPages.Next } catch { }
    $pdfPages.Next++
  }
  if ($player -and $mediaParts.Media.Ready -and -not $mediaParts.Seek.Tag.Drag) {
    $seconds = $player.Position.TotalSeconds
    $total = $mediaParts.Media.Seconds
    if ($total -gt 0) { $mediaParts.Seek.Tag.Value = $seconds / $total; $mediaParts.Seek.Invalidate() }
    $mediaParts.Time.Text = (Format-Time $seconds) + ' / ' + (Format-Time $total)
  }
  if ($state.CopyFlash -gt 0) {
    $state.CopyFlash--
    if ($state.CopyFlash -eq 0) { Set-CopyLabels ' Copiar ' $black $blue }
  }
})
$form.Add_Shown({
  $form.Activate()
  # Text starts at its top, with the caret out of sight and the wheel on it.
  foreach ($view in $views.Values) { if ($view -is [System.Windows.Forms.RichTextBox]) { $view.SelectionStart = 0; $view.ScrollToCaret() } }
  if ($player) { [void]$form.Focus() } else { [void]$views[$state.View].Focus() }
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
