# Shows one file in a popup, for the speedy-code explorer: the file named by $env:SPEEDY_FILE.
# The popup stands in the middle of the screen the pointer is on, framed as view.ps1 frames a pasted image:
# a wide black contour, a blue line, the file's name in the middle of the top line and the close mark at
# its right, with "Copiar" beside it when there is something to copy. What it holds depends on the file:
#   an image (png, jpg, jpeg, gif, bmp, ico, tif, tiff): the picture, scaled down to fit, never deformed;
#   a PDF: its pages one under the other, drawn by Windows' own PDF reader, with a scroll bar and a bar
#   above them to go to a page (first, previous, its number, next, last) and to zoom (out, a list of sizes,
#   in, fit the width, the whole page);
#   Markdown, HTML and SVG: drawn as a page, the Preview, with a switch beside the title to their source;
#   a spreadsheet (xlsx, xlsm; xls through Excel) or a Word document (docx; doc through Word): drawn as a page;
#   a Word document, a Markdown or an HTML Preview also gets the bar's zoom;
#   audio and video: played by Windows' own media player, with a dark bar to pause, seek and set the volume,
#     and a switch for the speed, x0.5 x1 x1.25 x1.5 x2: after a sound's size, and in a video's bar;
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
# The bottom line repeats Copiar and the close mark, for a popup taller than the eye's reach. Beside each close
# mark, at its left, the move mark: held down with the mouse, it carries the popup where it is dropped, to read
# what is behind it; a popup opened again stands in the middle once more. Every scroll bar is dark. The close
# mark or Esc closes it. It says "shown" once it is up, then "." every tenth of a
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

# A sound's player: Windows' newer one (Windows.Media.Playback), which takes a new speed at once, from where
# it stands; the one a video has goes silent for a second or two, and then goes on behind. It is given the
# members of that one the popup uses, and says it opened, failed or ended by a look ten times a second: it has
# no event a script hears. Nothing when this Windows has no such player.
function New-SoundPlayer {
  try {
    $null = [Windows.Media.Playback.MediaPlayer, Windows.Media.Playback, ContentType = WindowsRuntime]
    $null = [Windows.Media.Core.MediaSource, Windows.Media.Core, ContentType = WindowsRuntime]
    $inner = New-Object Windows.Media.Playback.MediaPlayer
  } catch { return $null }
  $sound = [pscustomobject]@{ Inner = $inner; Opened = $null; Failed = $null; Ended = $null; IsOpen = $false; IsOver = $false; Since = [DateTime]::Now; Watch = $null }
  Add-Member -InputObject $sound -MemberType ScriptMethod -Name Add_MediaOpened -Value { param($do) $this.Opened = $do }
  Add-Member -InputObject $sound -MemberType ScriptMethod -Name Add_MediaFailed -Value { param($do) $this.Failed = $do }
  Add-Member -InputObject $sound -MemberType ScriptMethod -Name Add_MediaEnded -Value { param($do) $this.Ended = $do }
  Add-Member -InputObject $sound -MemberType ScriptMethod -Name Play -Value { $this.Inner.Play() }
  Add-Member -InputObject $sound -MemberType ScriptMethod -Name Pause -Value { $this.Inner.Pause() }
  Add-Member -InputObject $sound -MemberType ScriptMethod -Name Stop -Value { $this.Inner.Pause() }
  Add-Member -InputObject $sound -MemberType ScriptMethod -Name Close -Value { if ($this.Watch) { $this.Watch.Stop() }; $this.Inner.Dispose() }
  Add-Member -InputObject $sound -MemberType ScriptProperty -Name Source -Value { $null } -SecondValue { param($uri) $this.Since = [DateTime]::Now; $this.Inner.Source = [Windows.Media.Core.MediaSource]::CreateFromUri($uri) }
  Add-Member -InputObject $sound -MemberType ScriptProperty -Name Position -Value { $this.Inner.PlaybackSession.Position } -SecondValue { param($at) $this.Inner.PlaybackSession.Position = $at }
  Add-Member -InputObject $sound -MemberType ScriptProperty -Name Volume -Value { $this.Inner.Volume } -SecondValue { param($volume) $this.Inner.Volume = [double]$volume }
  Add-Member -InputObject $sound -MemberType ScriptProperty -Name SpeedRatio -Value { $this.Inner.PlaybackSession.PlaybackRate } -SecondValue { param($speed) $this.Inner.PlaybackSession.PlaybackRate = [double]$speed }
  Add-Member -InputObject $sound -MemberType ScriptProperty -Name NaturalDuration -Value {
    $whole = $this.Inner.PlaybackSession.NaturalDuration
    [pscustomobject]@{ HasTimeSpan = $whole.Ticks -gt 0; TimeSpan = $whole }
  }
  $watch = New-Object System.Windows.Forms.Timer
  $watch.Interval = 100
  $watch.Tag = $sound
  $watch.Add_Tick({
    $sound = $this.Tag
    $session = $sound.Inner.PlaybackSession
    if (-not $sound.IsOpen) {
      # Open once it knows how long the sound is; one it cannot read never does, and is given up after a while.
      if ($session.NaturalDuration.Ticks -gt 0) { $sound.IsOpen = $true; if ($sound.Opened) { & $sound.Opened } }
      elseif (-not $sound.IsOver -and ([DateTime]::Now - $sound.Since).TotalSeconds -gt 8) { $sound.IsOver = $true; if ($sound.Failed) { & $sound.Failed } }
      return
    }
    # Ended: it stands at its end, and plays no more.
    $isAtEnd = $session.Position.Ticks -ge $session.NaturalDuration.Ticks - 2000000
    if ($isAtEnd -and "$($session.PlaybackState)" -ne 'Playing') {
      if (-not $sound.IsOver) { $sound.IsOver = $true; if ($sound.Ended) { & $sound.Ended } }
    } else { $sound.IsOver = $false }
  })
  $sound.Watch = $watch
  $watch.Start()
  $sound
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
var a = WScript.Arguments, app = null, code = 0, keep = false;
try {
  if (a.Item(0) == "excel") {
    app = new ActiveXObject("Excel.Application"); app.DisplayAlerts = false;
    var book = app.Workbooks.Open(a.Item(1), 0, true, 5, "speedy-no-password");
    book.SaveAs(a.Item(2), 51); book.Close(false);
  } else if (a.Item(0) == "word-pdf") {
    app = new ActiveXObject("Word.Application"); app.DisplayAlerts = 0;
    var paged = app.Documents.Open(a.Item(1), false, true, false, "speedy-no-password");
    paged.SaveAs2(a.Item(2), 17); paged.Close(0);
  } else if (a.Item(0) == "slides-pdf") {
    // PowerPoint is one for everybody: one the person has open is used as it is, and left open.
    app = new ActiveXObject("PowerPoint.Application");
    keep = app.Presentations.Count > 0 || app.Visible != 0;
    var deck = app.Presentations.Open(a.Item(1), -1, 0, 0);
    deck.SaveAs(a.Item(2), 32); deck.Close();
  } else {
    app = new ActiveXObject("Word.Application"); app.DisplayAlerts = 0;
    var doc = app.Documents.Open(a.Item(1), false, true, false, "speedy-no-password");
    doc.SaveAs2(a.Item(2), 16); doc.Close(0);
  }
} catch (e) { WScript.StdErr.Write(e.message); code = 1; }
try { if (app && !keep) { if (a.Item(0) == "excel" || a.Item(0) == "slides-pdf") { app.Quit(); } else { app.Quit(0); } } } catch (e) { }
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

# Runs a program with no window and waits for it, 90 seconds at most; whether it ended well.
function Invoke-Hidden([string]$program, [string]$arguments) {
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = $program
  $info.Arguments = $arguments
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $info.EnvironmentVariables['PYTHONIOENCODING'] = 'utf-8'
  $process = [System.Diagnostics.Process]::Start($info)
  $out = $process.StandardOutput.ReadToEndAsync(); $problem = $process.StandardError.ReadToEndAsync()
  if (-not $process.WaitForExit(90000)) { try { $process.Kill() } catch { }; return $false }
  $process.ExitCode -eq 0
}

# Edge, or Chrome: the browser that prints a page to a PDF with no window.
function Find-Browser {
  $candidates = @()
  foreach ($name in @('msedge.exe', 'chrome.exe')) {
    foreach ($hive in @('HKLM:', 'HKCU:')) {
      try { $candidates += (Get-ItemProperty -LiteralPath "$hive\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$name" -ErrorAction Stop).'(default)' } catch { }
    }
  }
  $candidates += (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'), (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
  foreach ($one in $candidates) { if ($one -and (Test-Path -LiteralPath $one)) { return $one } }
  $null
}

# A Word document or a presentation as a PDF of its pages, in a folder of its own under %TEMP%, which the
# popup then draws as it draws a PDF. Word or PowerPoint writes it where it is installed, as it would print
# it; without them, office_pages.py lays a .docx or a .pptx out with the popup's own readers and Edge prints
# that. It gives the PDF's path, or nothing when neither could: the file is then shown as it was before.
function Get-OfficePages([string]$file, [string]$fileKind) {
  $isSlides = $fileKind -in @('pptx', 'ppt')
  # A popup ended from outside leaves its folder behind: those a day old go now.
  try {
    Get-ChildItem -LiteralPath ([IO.Path]::GetTempPath()) -Directory -Filter 'speedy-view-*' -ErrorAction SilentlyContinue |
      Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-1) } |
      ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
  } catch { }
  $folder = Join-Path ([IO.Path]::GetTempPath()) ('speedy-view-' + [guid]::NewGuid().ToString('N'))
  [void](New-Item -ItemType Directory -Path $folder)
  $state.Pages = $folder
  $target = Join-Path $folder 'pages.pdf'
  $written = { (Test-Path -LiteralPath $target) -and (Get-Item -LiteralPath $target).Length -gt 0 }
  if ([Type]::GetTypeFromProgID($(if ($isSlides) { 'PowerPoint.Application' } else { 'Word.Application' }))) {
    $script = Join-Path $folder 'copy.js'
    [IO.File]::WriteAllText($script, $officeScript, [System.Text.Encoding]::ASCII)
    $mode = if ($isSlides) { 'slides-pdf' } else { 'word-pdf' }
    $done = Invoke-Hidden (Join-Path $env:SystemRoot 'System32\cscript.exe') ('//nologo //E:jscript "' + $script + '" ' + $mode + ' "' + $file + '" "' + $target + '"')
    if ($done -and (& $written)) { return $target }
  }
  if ($fileKind -in @('docx', 'pptx')) {
    $python = Find-Python
    $browser = Find-Browser
    if ($python -and $browser) {
      $done = Invoke-Hidden $python ('"' + (Join-Path $PSScriptRoot 'office_pages.py') + '" "' + $file + '" "' + $target + '" "' + $browser + '"')
      if ($done -and (& $written)) { return $target }
    }
  }
  $null
}

# A small notice in the middle of the screen while the pages are got ready: the popup comes up after them.
function Show-Wait([string]$text) {
  $wait = New-Object System.Windows.Forms.Form
  $wait.FormBorderStyle = 'None'
  $wait.StartPosition = 'Manual'
  $wait.TopMost = $true
  $wait.ShowInTaskbar = $false
  $wait.BackColor = $blue
  $wait.Padding = New-Object System.Windows.Forms.Padding(2)
  $wait.Size = New-Object System.Drawing.Size(360, 84)
  $wait.Location = New-Object System.Drawing.Point(($area.Left + [int](($area.Width - 360) / 2)), ($area.Top + [int](($area.Height - 84) / 2)))
  $label = New-Object System.Windows.Forms.Label
  $label.Dock = 'Fill'
  $label.BackColor = $black
  $label.ForeColor = $ink
  $label.Font = New-Object System.Drawing.Font('Segoe UI', 11)
  $label.TextAlign = 'MiddleCenter'
  $label.Text = $text
  $wait.Controls.Add($label)
  $wait.Show()
  $wait.Refresh()
  $wait
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

# A docx's text as Copiar takes it: a line to a paragraph, a tab between a table's cells and a line to its
# row, a line break where the document breaks a line. The page the browser draws loses them in its own text.
function Get-WordText($parent) {
  $out = New-Object System.Text.StringBuilder
  foreach ($node in $parent.ChildNodes) {
    if ($node.LocalName -eq 'p') {
      foreach ($piece in $node.SelectNodes('.//w:t|.//w:tab|.//w:br|.//w:cr', $wordNsm)) {
        switch ($piece.LocalName) {
          't' { [void]$out.Append($piece.InnerText) }
          'tab' { [void]$out.Append("`t") }
          default { [void]$out.Append("`n") }
        }
      }
      [void]$out.Append("`n")
    } elseif ($node.LocalName -eq 'tbl') {
      foreach ($row in $node.SelectNodes('w:tr', $wordNsm)) {
        $cells = foreach ($cell in $row.SelectNodes('w:tc', $wordNsm)) { (Get-WordText $cell).Trim() -replace "`n", ' ' }
        [void]$out.Append((@($cells) -join "`t") + "`n")
      }
    } elseif ($node.LocalName -in @('sdt', 'sdtContent', 'customXml', 'smartTag')) {
      [void]$out.Append((Get-WordText $node))
    }
  }
  $out.ToString()
}

function Get-DocxText([string]$file) {
  Use-Zip
  $zip = [System.IO.Compression.ZipFile]::OpenRead($file)
  try {
    $document = Read-ZipXml $zip 'word/document.xml'
    if ($null -eq $document) { return $null }
    $script:wordNsm = New-Object System.Xml.XmlNamespaceManager($document.NameTable)
    $script:wordNsm.AddNamespace('w', $wordNs)
    $body = $document.SelectSingleNode('/w:document/w:body', $script:wordNsm)
    if ($null -eq $body) { return $null }
    (Get-WordText $body).TrimEnd()
  } finally { $zip.Dispose() }
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
  '.pptx' = 'pptx'; '.pptm' = 'pptx'; '.ppsx' = 'pptx'; '.potx' = 'pptx'; '.ppt' = 'ppt'; '.pps' = 'ppt'; '.pot' = 'ppt'
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
$pagesFile = $null        # the PDF a Word document or a presentation was turned into, when it was
$isDeck = $false          # whether those pages are a presentation's slides: its bar has Run
$slideShow = $null        # the presentation being played, while it is
$player = $null
$svgExport = $null      # an SVG's markup and size for Copiar's PNG
$state = [pscustomobject]@{ View = $null; CopyFlash = 0; Office = $null; Pages = $null; Picked = $false; Drawing = $false; Ticks = 0; Drag = $null; Moved = $false }
$disposables = @()
$inner = $room
$toolbars = [ordered]@{}  # a view's bar above it, by the view's name
$webZooms = @{}           # a page view's zoom, by the view's name
$pdf = $null              # the PDF's pages, as New-PdfView lays them out

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
  # Docked last, as the views are, below any bar.
  $box.BringToFront()
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

# ---- The bar above a view --------------------------------------------------------------------------------
# A slim dark bar of flat buttons, centered: a PDF's pages and zoom, a page view's zoom. Shown with its view.
$toolbarHeight = 34
$barColor = [System.Drawing.ColorTranslator]::FromHtml('#0f1115')
$boxColor = [System.Drawing.ColorTranslator]::FromHtml('#25282e')
$edgeColor = [System.Drawing.ColorTranslator]::FromHtml('#343a40')
$thumbColor = [System.Drawing.ColorTranslator]::FromHtml('#495057')
$fitWidthText = T 'Ajustar al ancho'
$fitPageText = T 'P\u00e1gina completa'
$zoomPercents = @(50, 75, 100, 125, 150, 200, 300, 400)
# The steps - and + go through.
$zoomSteps = @(10, 25, 33, 50, 67, 75, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400)
$toolTips = $null
$zoomMenu = $null
$zoomMenuPick = $null

# Windows' symbol font when it has it; a font it lacks comes back as another, and the buttons fall back to ASCII.
$symbolFont = $null
try { $probe = New-Object System.Drawing.Font('Segoe MDL2 Assets', 10); if ($probe.Name -eq 'Segoe MDL2 Assets') { $symbolFont = 'Segoe MDL2 Assets' }; $probe.Dispose() } catch { }

function Set-DoubleBuffered($control) {
  [System.Windows.Forms.Control].GetProperty('DoubleBuffered', [System.Reflection.BindingFlags]'NonPublic, Instance').SetValue($control, $true, $null)
}

function New-Toolbar {
  $bar = New-Object System.Windows.Forms.Panel
  $bar.Dock = 'Top'
  $bar.Height = $toolbarHeight
  $bar.BackColor = $barColor
  $bar.Visible = $false
  $bar.Tag = New-Object System.Collections.Generic.List[object]
  $bar.Add_Paint({
    $pen = New-Object System.Drawing.Pen($edgeColor)
    $_.Graphics.DrawLine($pen, 0, $this.Height - 1, $this.Width, $this.Height - 1)
    $pen.Dispose()
  })
  $bar.Add_Resize({ Set-ToolbarLayout $this })
  $bar
}

function Add-ToolItem($bar, $control, [int]$gap = 2) {
  $bar.Controls.Add($control)
  $bar.Tag.Add([pscustomobject]@{ Control = $control; Gap = $gap })
}

function Set-ToolbarLayout($bar) {
  $total = 0
  foreach ($item in $bar.Tag) { $total += $item.Gap + $item.Control.Width }
  $x = [Math]::Max(6, [int](($bar.ClientSize.Width - $total) / 2))
  foreach ($item in $bar.Tag) {
    $x += $item.Gap
    $item.Control.Location = New-Object System.Drawing.Point($x, ([int](($bar.ClientSize.Height - 1 - $item.Control.Height) / 2)))
    $x += $item.Control.Width
  }
}

function Set-ToolTip($control, [string]$tip) {
  if (-not $tip) { return }
  if (-not $script:toolTips) { $script:toolTips = New-Object System.Windows.Forms.ToolTip }
  $script:toolTips.SetToolTip($control, $tip)
}

# A flat button: a glyph of the symbol font (or its ASCII stand-in), or a word. A click runs $action with $arg.
function New-ToolButton([int]$glyph, [string]$text, [string]$tip, [scriptblock]$action, $arg = $null) {
  $label = New-Object System.Windows.Forms.Label
  $label.AutoSize = $false
  $label.ForeColor = $blue
  $label.BackColor = $barColor
  $label.TextAlign = 'MiddleCenter'
  $label.Cursor = [System.Windows.Forms.Cursors]::Hand
  if ($glyph -and $symbolFont) {
    $label.Font = New-Object System.Drawing.Font($symbolFont, 10)
    $label.Text = [string][char]$glyph
    $label.Size = New-Object System.Drawing.Size(30, 26)
  } else {
    $label.Font = New-Object System.Drawing.Font('Segoe UI', 9.75, $(if ($glyph) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }))
    $label.Text = $text
    $label.Size = New-Object System.Drawing.Size(([Math]::Max(30, $label.PreferredWidth + 14)), 26)
  }
  $label.Tag = [pscustomobject]@{ Action = $action; Arg = $arg; Active = $false }
  $label.Add_Click({ & $this.Tag.Action $this.Tag.Arg })
  $label.Add_MouseEnter({ if (-not $this.Tag.Active) { $this.BackColor = $boxColor } })
  $label.Add_MouseLeave({ if (-not $this.Tag.Active) { $this.BackColor = $barColor } })
  Set-ToolTip $label $tip
  $label
}

# A button that stays lit while what it chose holds: fit the width, the whole page.
function Set-ToolActive($label, [bool]$active) {
  if ($null -eq $label -or $label.Tag.Active -eq $active) { return }
  $label.Tag.Active = $active
  $label.BackColor = if ($active) { $blue } else { $barColor }
  $label.ForeColor = if ($active) { $black } else { $blue }
}

# A small dark box to type in: the page's number, the zoom. Enter runs $onEnter with the text.
function New-ToolBox([int]$width, [string]$tip, [scriptblock]$onEnter, [int]$extra = 0) {
  $holder = New-Object System.Windows.Forms.Panel
  $holder.BackColor = $boxColor
  $holder.Size = New-Object System.Drawing.Size(($width + 8 + $extra), 24)
  $box = New-Object System.Windows.Forms.TextBox
  $box.BorderStyle = 'None'
  $box.BackColor = $boxColor
  $box.ForeColor = $ink
  $box.Font = New-Object System.Drawing.Font('Segoe UI', 10)
  $box.TextAlign = 'Center'
  $box.Width = $width
  $box.Location = New-Object System.Drawing.Point(4, ([int]((24 - $box.PreferredHeight) / 2) + 1))
  $box.Tag = $onEnter
  $box.Add_KeyDown({
    if ($_.KeyCode -eq 'Enter') { $_.SuppressKeyPress = $true; $_.Handled = $true; & $this.Tag $this.Text }
  })
  $box.Add_Enter({ $this.SelectAll() })
  $box.Add_MouseUp({ if ($this.SelectionLength -eq 0) { $this.SelectAll() } })
  $holder.Controls.Add($box)
  Set-ToolTip $box $tip
  [pscustomobject]@{ Holder = $holder; Box = $box }
}

# The zoom's list, a dark menu under its box: a click on an item runs $pick with it.
function Show-ZoomMenu($anchor, [string[]]$items, [scriptblock]$pick) {
  if ($zoomMenu -and $zoomMenu.Visible) { Hide-ZoomMenu; return }
  if (-not $zoomMenu) {
    $script:zoomMenu = New-Object System.Windows.Forms.Panel
    $zoomMenu.BackColor = $edgeColor
    $zoomMenu.Visible = $false
    $form.Controls.Add($zoomMenu)
  }
  foreach ($old in @($zoomMenu.Controls)) { $old.Dispose() }
  $zoomMenu.Controls.Clear()
  $y = 1
  foreach ($item in $items) {
    $label = New-Object System.Windows.Forms.Label
    $label.AutoSize = $false
    $label.Text = "   $item"
    $label.Font = New-Object System.Drawing.Font('Segoe UI', 10)
    $label.ForeColor = $ink
    $label.BackColor = $boxColor
    $label.TextAlign = 'MiddleLeft'
    $label.Cursor = [System.Windows.Forms.Cursors]::Hand
    $label.SetBounds(1, $y, 160, 24)
    $label.Tag = $item
    $label.Add_MouseEnter({ $this.BackColor = $blue; $this.ForeColor = $black })
    $label.Add_MouseLeave({ $this.BackColor = $boxColor; $this.ForeColor = $ink })
    $label.Add_Click({ $item = $this.Tag; Hide-ZoomMenu; & $zoomMenuPick $item })
    $zoomMenu.Controls.Add($label)
    $y += 24
  }
  $script:zoomMenuPick = $pick
  $zoomMenu.Size = New-Object System.Drawing.Size(162, ($y + 1))
  $zoomMenu.Location = $form.PointToClient($anchor.PointToScreen((New-Object System.Drawing.Point(0, ($anchor.Height + 2)))))
  $zoomMenu.Visible = $true
  $zoomMenu.BringToFront()
}

function Hide-ZoomMenu { if ($zoomMenu) { $zoomMenu.Visible = $false } }

# The zoom's controls, in the bar: -, the box with its list, +. $calls holds Step (by -1 or 1), Value (a
# percentage typed), Pick (an item of the list) and Items.
function Add-ZoomControls($bar, $calls) {
  Add-ToolItem $bar (New-ToolButton 0xE738 '-' (T 'Alejar (Ctrl -)') $calls.Step -1) 0
  $zoom = New-ToolBox 46 'Zoom' { param($text) & $zoomCalls[$state.View].Value $text } 24
  $open = New-Object System.Windows.Forms.Label
  $open.AutoSize = $false
  $open.ForeColor = $blue
  $open.BackColor = $boxColor
  $open.TextAlign = 'MiddleCenter'
  $open.Cursor = [System.Windows.Forms.Cursors]::Hand
  if ($symbolFont) { $open.Font = New-Object System.Drawing.Font($symbolFont, 8); $open.Text = [string][char]0xE70D }
  else { $open.Font = New-Object System.Drawing.Font('Segoe UI', 8); $open.Text = 'v' }
  $open.SetBounds(($zoom.Holder.Width - 24), 0, 24, 24)
  $open.Tag = $zoom.Holder
  $open.Add_Click({ $calls = $zoomCalls[$state.View]; Show-ZoomMenu $this.Tag $calls.Items $calls.Pick })
  $zoom.Holder.Controls.Add($open)
  Add-ToolItem $bar $zoom.Holder 2
  Add-ToolItem $bar (New-ToolButton 0xE710 '+' (T 'Acercar (Ctrl +)') $calls.Step 1) 2
  $zoom.Box
}
$zoomCalls = @{}          # each view's zoom calls, by the view's name

# The step after $percent toward $direction, or $null past the last.
function Get-NextZoom([double]$percent, [int]$direction) {
  if ($direction -gt 0) { foreach ($step in $zoomSteps) { if ($step -gt $percent + 0.5) { return $step } } }
  else { for ($k = $zoomSteps.Count - 1; $k -ge 0; $k--) { if ($zoomSteps[$k] -lt $percent - 0.5) { return $zoomSteps[$k] } } }
  $null
}

function Read-Percent([string]$text) {
  if ($text -match '^\s*(\d+([.,]\d+)?)\s*%?\s*$') { return [double]($Matches[1].Replace(',', '.')) }
  $null
}

# ---- A thin dark scroll bar --------------------------------------------------------------------------------
# Drawn, as Windows' own scroll bar control keeps its light theme. Its Tag holds Value (the first pixel
# shown), Content (all the pixels) and Page (the pixels shown); a drag or a click on it runs Change with the
# new value.
function New-DarkScrollBar([bool]$vertical) {
  $bar = New-Object System.Windows.Forms.Panel
  Set-DoubleBuffered $bar
  $bar.BackColor = $paper
  if ($vertical) { $bar.Width = 12 } else { $bar.Height = 12 }
  $bar.Tag = [pscustomobject]@{ Vertical = $vertical; Value = 0.0; Content = 0.0; Page = 0.0; Grab = -1.0; Hover = $false; Change = $null }
  $bar.Add_Paint({
    $span = Get-ThumbSpan $this
    if (-not $span) { return }
    $s = $this.Tag
    $g = $_.Graphics
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $pen = New-Object System.Drawing.Pen($(if ($s.Hover -or $s.Grab -ge 0) { $dim } else { $thumbColor }), 6)
    $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
    $from = [single]($span[0] + 4); $to = [single]($span[0] + $span[1] - 4)
    if ($s.Vertical) { $g.DrawLine($pen, [single]6, $from, [single]6, $to) } else { $g.DrawLine($pen, $from, [single]6, $to, [single]6) }
    $pen.Dispose()
  })
  $bar.Add_MouseDown({
    $span = Get-ThumbSpan $this
    if (-not $span) { return }
    $s = $this.Tag
    $at = if ($s.Vertical) { $_.Y } else { $_.X }
    if ($at -ge $span[0] -and $at -le $span[0] + $span[1]) { $s.Grab = $at - $span[0]; $this.Invalidate() }
    elseif ($s.Change) { & $s.Change ($s.Value + $(if ($at -lt $span[0]) { -$s.Page } else { $s.Page })) }
  })
  $bar.Add_MouseMove({
    $s = $this.Tag
    if ($s.Grab -lt 0) { return }
    $span = Get-ThumbSpan $this
    if (-not $span) { return }
    $at = if ($s.Vertical) { $_.Y } else { $_.X }
    $room = [Math]::Max(1.0, $span[2] - $span[1])
    if ($s.Change) { & $s.Change ((($at - $s.Grab) / $room) * ($s.Content - $s.Page)) }
  })
  $bar.Add_MouseUp({ $this.Tag.Grab = -1.0; $this.Invalidate() })
  $bar.Add_MouseEnter({ $this.Tag.Hover = $true; $this.Invalidate() })
  $bar.Add_MouseLeave({ $this.Tag.Hover = $false; $this.Invalidate() })
  $bar
}

# The thumb's start and length along the bar, and the bar's length; $null when everything is in view.
function Get-ThumbSpan($bar) {
  $s = $bar.Tag
  $length = [double]$(if ($s.Vertical) { $bar.ClientSize.Height } else { $bar.ClientSize.Width })
  if ($s.Content -le $s.Page -or $length -le 0) { return $null }
  $size = [Math]::Min($length, [Math]::Max(28.0, $length * $s.Page / $s.Content))
  $at = ($length - $size) * $s.Value / ($s.Content - $s.Page)
  , @($at, $size, $length)
}

function Set-DarkScrollBar($bar, [double]$value, [double]$content, [double]$page) {
  $s = $bar.Tag
  $s.Value = $value; $s.Content = $content; $s.Page = $page
  $bar.Invalidate()
}

# ---- The PDF's pages ---------------------------------------------------------------------------------------
# The pages are painted on one canvas, never a control a page: Windows places a child window no further down
# than 32767 pixels, so pages past that would pile up there and the rest of a long PDF would show black. Each
# page has its place from its own size and the zoom; only the pages in view, and two either side, are drawn
# by Windows' PDF reader into bitmaps, the farther ones are let go, and a page not drawn yet shows as a dark
# sheet saying it is coming. Drawing waits for the scrolling to stop for a moment, a few pages a tick.
$pdfGap = 10
$pdfPixelCap = 12000000   # a page's bitmap past this many pixels is drawn smaller and stretched

function New-PdfView($document) {
  $count = [int]$document.PageCount
  $widths = New-Object double[] $count
  $heights = New-Object double[] $count
  for ($i = 0; $i -lt $count; $i++) {
    $page = $document.GetPage([uint32]$i)
    $widths[$i] = [double]$page.Size.Width; $heights[$i] = [double]$page.Size.Height
    $page.Dispose()
  }
  $canvas = New-Object System.Windows.Forms.Panel
  Set-DoubleBuffered $canvas
  # Focusable, for the wheel and the keys.
  [void][System.Windows.Forms.Control].GetMethod('SetStyle', [System.Reflection.BindingFlags]'NonPublic, Instance').Invoke($canvas, @([System.Windows.Forms.ControlStyles]::Selectable, $true))
  $canvas.TabStop = $true
  $canvas.BackColor = $paper
  $canvas.Dock = 'Fill'
  $vertical = New-DarkScrollBar $true
  $vertical.Dock = 'Right'
  $vertical.Tag.Change = { param($value) Set-PdfScroll $value $null }
  $horizontal = New-DarkScrollBar $false
  $horizontal.Dock = 'Bottom'
  $horizontal.Visible = $false
  $horizontal.Tag.Change = { param($value) Set-PdfScroll $pdf.Y $value }
  $panel = New-Object System.Windows.Forms.Panel
  $panel.BackColor = $paper
  $panel.Dock = 'Fill'
  $panel.Controls.Add($canvas)
  $panel.Controls.Add($horizontal)
  $panel.Controls.Add($vertical)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = 'Center'
  $format.LineAlignment = 'Center'
  $script:pdf = [pscustomobject]@{
    Document = $document; Count = $count; PageW = $widths; PageH = $heights
    MaxW = [Math]::Max(1.0, ($widths | Measure-Object -Maximum).Maximum); MaxH = [Math]::Max(1.0, ($heights | Measure-Object -Maximum).Maximum)
    Tops = (New-Object double[] $count); Widths = (New-Object double[] $count); Heights = (New-Object double[] $count)
    Total = 0.0; Wide = 0.0; Zoom = 1.0; Mode = 'width'; Y = 0.0; X = 0.0
    Bitmaps = @{}; Failed = @{}; LastMove = [DateTime]::MinValue; Pinned = 0; Jumping = $false; Busy = $false; Drag = $null
    Canvas = $canvas; VBar = $vertical; HBar = $horizontal; PageBox = $null; ZoomBox = $null; FitWidth = $null; FitPage = $null
    Sheet = (New-Object System.Drawing.SolidBrush($boxColor)); Note = (New-Object System.Drawing.SolidBrush($dim))
    Font = (New-Object System.Drawing.Font('Segoe UI', 11)); Format = $format
    Loading = (T 'Cargando p\u00e1gina '); Broken = (T 'No se pudo dibujar la p\u00e1gina ')
  }
  # Each page's place, before any event asks where a page is.
  Update-PdfLayout
  $canvas.Add_Paint({ Show-PdfPages $_.Graphics })
  $canvas.Add_Resize({
    if ($pdf.Busy) { return }
    $pdf.Busy = $true
    try {
      if ($pdf.Mode -ne 'fixed') { Set-PdfZoom (Get-PdfFit $pdf.Mode) $pdf.Mode 0 }
      else { Update-PdfLayout; Set-PdfScroll $pdf.Y $pdf.X }
    } finally { $pdf.Busy = $false }
  })
  $canvas.Add_MouseWheel({
    if (([System.Windows.Forms.Control]::ModifierKeys -band [System.Windows.Forms.Keys]::Control) -ne 0) {
      Step-PdfZoom $(if ($_.Delta -gt 0) { 1 } else { -1 }) $_.Y
    } elseif (([System.Windows.Forms.Control]::ModifierKeys -band [System.Windows.Forms.Keys]::Shift) -ne 0) {
      Set-PdfScroll $pdf.Y ($pdf.X - $_.Delta)
    } else {
      Set-PdfScroll ($pdf.Y - $_.Delta * 100 / 120) $null
    }
  })
  # A drag moves the pages, as a hand would.
  $canvas.Add_MouseDown({
    [void]$this.Focus()
    Hide-ZoomMenu
    if ($_.Button -eq 'Left') { $pdf.Drag = @($_.X, $_.Y, $pdf.X, $pdf.Y); $this.Cursor = [System.Windows.Forms.Cursors]::SizeAll }
  })
  $canvas.Add_MouseMove({ if ($pdf.Drag) { Set-PdfScroll ($pdf.Drag[3] - ($_.Y - $pdf.Drag[1])) ($pdf.Drag[2] - ($_.X - $pdf.Drag[0])) } })
  $canvas.Add_MouseUp({ $pdf.Drag = $null; $this.Cursor = [System.Windows.Forms.Cursors]::Default })
  $canvas.Add_PreviewKeyDown({ if ($_.KeyCode -in @('Up', 'Down', 'Left', 'Right')) { $_.IsInputKey = $true } })

  # The bar: |< < [page] / total > >|, then - [zoom] +, then fit the width and the whole page.
  $bar = New-Toolbar
  Add-ToolItem $bar (New-ToolButton 0xE892 '|<' (T 'Primera p\u00e1gina (Inicio)') { Go-PdfPage 1 }) 0
  Add-ToolItem $bar (New-ToolButton 0xE76B '<' (T 'P\u00e1gina anterior (RePag)') { Go-PdfPage ((Get-PdfCurrent) - 1) })
  $pageBox = New-ToolBox 40 (T 'P\u00e1gina: escrib\u00ed un n\u00famero y Enter') {
    param($text)
    $n = 0
    if ([int]::TryParse($text.Trim(), [ref]$n)) { Go-PdfPage $n }
    [void]$pdf.Canvas.Focus()
    Update-PdfPageBox
  }
  $pageBox.Box.Add_Leave({ Update-PdfPageBox })
  Add-ToolItem $bar $pageBox.Holder 6
  $total = New-Object System.Windows.Forms.Label
  $total.AutoSize = $false
  $total.Font = New-Object System.Drawing.Font('Segoe UI', 10)
  $total.ForeColor = $dim
  $total.BackColor = $barColor
  $total.TextAlign = 'MiddleLeft'
  $total.Text = "/ $count"
  $total.Size = New-Object System.Drawing.Size(($total.PreferredWidth + 4), 24)
  Add-ToolItem $bar $total 4
  Add-ToolItem $bar (New-ToolButton 0xE76C '>' (T 'P\u00e1gina siguiente (AvPag)') { Go-PdfPage ((Get-PdfCurrent) + 1) }) 2
  Add-ToolItem $bar (New-ToolButton 0xE893 '>|' (T '\u00daltima p\u00e1gina (Fin)') { Go-PdfPage $pdf.Count })
  $script:zoomCalls['PDF'] = [pscustomobject]@{
    Step = { param($direction) Step-PdfZoom $direction 0 }
    Value = { param($text) $percent = Read-Percent $text; if ($null -ne $percent) { Set-PdfZoom ($percent / 100) 'fixed' 0 }; [void]$pdf.Canvas.Focus(); Update-PdfZoomBox }
    Pick = { param($item) if ($item -eq $fitWidthText) { Set-PdfFit 'width' } elseif ($item -eq $fitPageText) { Set-PdfFit 'page' } else { Set-PdfZoom ((Read-Percent $item) / 100) 'fixed' 0 }; [void]$pdf.Canvas.Focus() }
    Items = [string[]](@($fitWidthText, $fitPageText) + @($zoomPercents | ForEach-Object { "$_%" }))
  }
  $spacer = New-Object System.Windows.Forms.Label
  $spacer.Size = New-Object System.Drawing.Size(1, 18)
  $spacer.BackColor = $edgeColor
  Add-ToolItem $bar $spacer 14
  $zoomBox = Add-ZoomControls $bar $zoomCalls['PDF']
  $fitWidth = New-ToolButton 0 $fitWidthText (T 'Las p\u00e1ginas a lo ancho de la vista (Ctrl 0)') { Set-PdfFit 'width' }
  $fitPage = New-ToolButton 0 $fitPageText (T 'Una p\u00e1gina entera a la vista') { Set-PdfFit 'page' }
  Add-ToolItem $bar $fitWidth 12
  Add-ToolItem $bar $fitPage 4
  if ($isDeck) {
    $run = New-ToolButton 0 'Run' (T 'Reproducir la presentaci\u00f3n a pantalla completa (F5)') { Start-SlideShow }
    $run.Font = New-Object System.Drawing.Font('Segoe UI', 9.75, [System.Drawing.FontStyle]::Bold)
    $run.Size = New-Object System.Drawing.Size(([Math]::Max(30, $run.PreferredWidth + 14)), 26)
    Add-ToolItem $bar $run 12
  }
  $pdf.PageBox = $pageBox.Box; $pdf.ZoomBox = $zoomBox; $pdf.FitWidth = $fitWidth; $pdf.FitPage = $fitPage
  $script:toolbars['PDF'] = $bar
  $panel
}

# Each page's place at the zoom, one under the other, and the scroll bars' extents.
function Update-PdfLayout {
  $z = $pdf.Zoom
  $y = [double]$pdfGap
  $wide = 0.0
  for ($i = 0; $i -lt $pdf.Count; $i++) {
    $w = $pdf.PageW[$i] * $z; $h = $pdf.PageH[$i] * $z
    $pdf.Tops[$i] = $y; $pdf.Widths[$i] = $w; $pdf.Heights[$i] = $h
    $y += $h + $pdfGap
    if ($w -gt $wide) { $wide = $w }
  }
  $pdf.Total = $y
  $pdf.Wide = $wide + 2 * $pdfGap
  $pdf.HBar.Visible = $pdf.Wide -gt $pdf.Canvas.ClientSize.Width + 0.5
}

# The page at a height of the pages: the last one starting at or above it.
function Find-PdfPage([double]$y) {
  $lo = 0; $hi = $pdf.Count - 1
  if ($hi -lt 0) { return 0 }
  while ($lo -lt $hi) {
    $mid = [int][Math]::Floor(($lo + $hi + 1) / 2)
    if ($pdf.Tops[$mid] -le $y) { $lo = $mid } else { $hi = $mid - 1 }
  }
  $lo
}

function Set-PdfScroll([double]$y, $x) {
  $w = $pdf.Canvas.ClientSize.Width; $h = $pdf.Canvas.ClientSize.Height
  $pdf.Y = [Math]::Max(0.0, [Math]::Min($y, $pdf.Total - $h))
  if ($null -ne $x) { $pdf.X = [Math]::Max(0.0, [Math]::Min([double]$x, $pdf.Wide - $w)) }
  else { $pdf.X = [Math]::Max(0.0, [Math]::Min($pdf.X, $pdf.Wide - $w)) }
  Set-DarkScrollBar $pdf.VBar $pdf.Y $pdf.Total $h
  Set-DarkScrollBar $pdf.HBar $pdf.X $pdf.Wide $w
  $pdf.LastMove = [DateTime]::Now
  if (-not $pdf.Jumping) { $pdf.Pinned = 0 }
  Update-PdfPageBox
  $pdf.Canvas.Invalidate()
}

# The page the box shows: the one a third of the way down the view, the last at the end, or the one just
# gone to.
function Get-PdfCurrent {
  if ($pdf.Count -eq 0) { return 0 }
  if ($pdf.Pinned -gt 0) { return $pdf.Pinned }
  $h = $pdf.Canvas.ClientSize.Height
  if ($pdf.Total - $h -gt 0 -and $pdf.Y -ge $pdf.Total - $h - 1) { return $pdf.Count }
  (Find-PdfPage ($pdf.Y + $h / 3)) + 1
}

function Update-PdfPageBox {
  if ($pdf.PageBox -and -not $pdf.PageBox.Focused) { $pdf.PageBox.Text = [string](Get-PdfCurrent) }
}

function Go-PdfPage([int]$number) {
  if ($pdf.Count -eq 0) { return }
  $number = [Math]::Max(1, [Math]::Min($pdf.Count, $number))
  $pdf.Jumping = $true
  try { Set-PdfScroll ($pdf.Tops[$number - 1] - $pdfGap) $null } finally { $pdf.Jumping = $false }
  $pdf.Pinned = $number
  Update-PdfPageBox
}

# The zoom that fits the widest page to the view's width, or the tallest page whole in the view.
function Get-PdfFit([string]$mode) {
  $w = $pdf.Canvas.ClientSize.Width - 2 * $pdfGap - 1
  $h = $pdf.Canvas.ClientSize.Height - 2 * $pdfGap
  if ($w -le 0 -or $h -le 0) { return $pdf.Zoom }
  $z = $w / $pdf.MaxW
  if ($mode -eq 'page') { $z = [Math]::Min($z, $h / $pdf.MaxH) }
  $z
}

# A zoom, the point $anchor pixels down the view kept where it is.
function Set-PdfZoom([double]$zoom, [string]$mode, [double]$anchor) {
  if ($pdf.Count -eq 0) { return }
  $zoom = [Math]::Max(0.05, [Math]::Min(4.0, $zoom))
  $w = $pdf.Canvas.ClientSize.Width
  $at = $pdf.Y + $anchor
  $p = Find-PdfPage $at
  $within = ($at - $pdf.Tops[$p]) / ($pdf.Heights[$p] + $pdfGap)
  $across = if ($pdf.Wide -gt 0) { ($pdf.X + $w / 2) / $pdf.Wide } else { 0.5 }
  $pdf.Zoom = $zoom
  $pdf.Mode = $mode
  $wasBusy = $pdf.Busy
  $pdf.Busy = $true
  try { Update-PdfLayout } finally { $pdf.Busy = $wasBusy }
  $w = $pdf.Canvas.ClientSize.Width
  $pdf.Jumping = $true
  try { Set-PdfScroll ($pdf.Tops[$p] + $within * ($pdf.Heights[$p] + $pdfGap) - $anchor) ($across * $pdf.Wide - $w / 2) } finally { $pdf.Jumping = $false }
  Update-PdfZoomBox
}

function Set-PdfFit([string]$mode) {
  $current = Get-PdfCurrent
  Set-PdfZoom (Get-PdfFit $mode) $mode 0
  if ($mode -eq 'page') { Go-PdfPage $current }
}

function Step-PdfZoom([int]$direction, [double]$anchor) {
  $next = Get-NextZoom ($pdf.Zoom * 100) $direction
  if ($null -ne $next) { Set-PdfZoom ($next / 100) 'fixed' $anchor }
}

function Update-PdfZoomBox {
  if ($pdf.ZoomBox -and -not $pdf.ZoomBox.Focused) { $pdf.ZoomBox.Text = ('{0}%' -f [int][Math]::Round($pdf.Zoom * 100)) }
  Set-ToolActive $pdf.FitWidth ($pdf.Mode -eq 'width')
  Set-ToolActive $pdf.FitPage ($pdf.Mode -eq 'page')
}

# The pages in view: each drawn, stretched while a sharper one is coming, or a dark sheet saying it is coming.
function Show-PdfPages($g) {
  $g.Clear($paper)
  if ($pdf.Count -eq 0) { return }
  $w = $pdf.Canvas.ClientSize.Width; $h = $pdf.Canvas.ClientSize.Height
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::Bilinear
  $i = Find-PdfPage $pdf.Y
  while ($i -lt $pdf.Count -and $pdf.Tops[$i] -lt $pdf.Y + $h) {
    $pw = $pdf.Widths[$i]
    $x = if ($pdf.Wide -le $w) { ($w - $pw) / 2 } else { $pdfGap + ($pdf.Wide - 2 * $pdfGap - $pw) / 2 - $pdf.X }
    $rect = New-Object System.Drawing.Rectangle(([int][Math]::Round($x)), ([int][Math]::Round($pdf.Tops[$i] - $pdf.Y)), ([int][Math]::Round($pw)), ([int][Math]::Round($pdf.Heights[$i])))
    $bitmap = $pdf.Bitmaps[$i]
    if ($bitmap) {
      if ($bitmap.Width -eq $rect.Width -and $bitmap.Height -eq $rect.Height) { $g.DrawImageUnscaled($bitmap, $rect.X, $rect.Y) }
      else { $g.DrawImage($bitmap, $rect) }
    } else {
      $g.FillRectangle($pdf.Sheet, $rect)
      $words = if ($pdf.Failed.ContainsKey($i)) { $pdf.Broken + ($i + 1) } else { $pdf.Loading + ($i + 1) + '...' }
      # The words where the eye is: the middle of the part of the sheet in view.
      $seen = [System.Drawing.Rectangle]::Intersect($rect, (New-Object System.Drawing.Rectangle(0, 0, $w, $h)))
      $g.DrawString($words, $pdf.Font, $pdf.Note, [System.Drawing.RectangleF]$seen, $pdf.Format)
    }
    $i++
  }
}

# A page drawn by Windows' PDF reader, as a BMP (quicker than its PNG), copied into a bitmap of its own.
function Get-PdfBitmap([int]$index, [int]$width) {
  $page = $pdf.Document.GetPage([uint32]$index)
  $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
  try {
    $options = New-Object Windows.Data.Pdf.PdfPageRenderOptions
    $options.DestinationWidth = [uint32]$width
    $options.BitmapEncoderId = [guid]'69be8bb4-d66d-47c8-865a-ed1589433782'
    Wait-Action ($page.RenderToStreamAsync($stream, $options))
    $read = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream.GetInputStreamAt(0))
    $decoded = [System.Drawing.Image]::FromStream($read)
    try {
      $bitmap = New-Object System.Drawing.Bitmap($decoded.Width, $decoded.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
      $g = [System.Drawing.Graphics]::FromImage($bitmap)
      $g.DrawImageUnscaled($decoded, 0, 0)
      $g.Dispose()
      $bitmap
    } finally { $decoded.Dispose(); $read.Dispose() }
  } finally { $stream.Dispose(); $page.Dispose() }
}

# Once the scrolling has stopped for a moment: the pages in view drawn at the zoom, then two either side;
# the rest let go (one either side for big pages). A tick draws for up to about a tenth of a second; -All draws every page in view at once.
function Update-PdfPages([switch]$All) {
  if (-not $pdf -or $pdf.Count -eq 0 -or -not $pdf.Canvas.Visible) { return }
  if (-not $All -and ([DateTime]::Now - $pdf.LastMove).TotalMilliseconds -lt 150) { return }
  $h = $pdf.Canvas.ClientSize.Height
  $first = Find-PdfPage $pdf.Y
  $last = Find-PdfPage ($pdf.Y + $h)
  # Big pages (a high zoom) keep one either side, not two.
  $reach = if ($pdf.Widths[$first] * $pdf.Heights[$first] -gt 4000000) { 1 } else { 2 }
  $low = [Math]::Max(0, $first - $reach); $high = [Math]::Min($pdf.Count - 1, $last + $reach)
  foreach ($key in @($pdf.Bitmaps.Keys)) {
    if ($key -lt $low -or $key -gt $high) { $pdf.Bitmaps[$key].Dispose(); $pdf.Bitmaps.Remove($key) }
  }
  $order = New-Object System.Collections.Generic.List[int]
  for ($i = $first; $i -le $last; $i++) { $order.Add($i) }
  for ($step = 1; $step -le $reach; $step++) { if ($last + $step -le $high) { $order.Add($last + $step) }; if ($first - $step -ge $low) { $order.Add($first - $step) } }
  $clock = [System.Diagnostics.Stopwatch]::StartNew()
  foreach ($i in $order) {
    if ($pdf.Failed.ContainsKey($i)) { continue }
    $width = [Math]::Max(1.0, [Math]::Round($pdf.Widths[$i]))
    $pixels = $width * $pdf.Heights[$i]
    if ($pixels -gt $pdfPixelCap) { $width = [Math]::Floor($width * [Math]::Sqrt($pdfPixelCap / $pixels)) }
    $width = [int]$width
    $have = $pdf.Bitmaps[$i]
    if ($have -and $have.Width -eq $width) { continue }
    if (-not ($All -and $i -le $last) -and $clock.ElapsedMilliseconds -gt 90) { break }
    try {
      $bitmap = Get-PdfBitmap $i $width
      if ($have) { $have.Dispose() }
      $pdf.Bitmaps[$i] = $bitmap
    } catch { $pdf.Failed[$i] = $true }
    $pdf.Canvas.Invalidate()
  }
}

# ---- A presentation, played --------------------------------------------------------------------------------
# Run: a slide at a time, whole and as large as the screen the popup is on takes it, over black. Right, Down,
# Space, Enter, AvPag, the wheel or a click go on; Left, Up, Backspace, RePag or the right button go back;
# Inicio and Fin are the first and the last. Esc ends it, and so does going on past the last slide: the popup
# is then at the slide it ended on.
function Set-SlideShow([int]$index) {
  $one = $script:slideShow
  if (-not $one) { return }
  if ($index -ge $pdf.Count) { $one.Form.Close(); return }
  $index = [Math]::Max(0, $index)
  $size = $one.Form.ClientSize
  $scale = [Math]::Min($size.Width / $pdf.PageW[$index], $size.Height / $pdf.PageH[$index])
  $bitmap = $null
  try { $bitmap = Get-PdfBitmap $index ([int][Math]::Max(1, [Math]::Floor($pdf.PageW[$index] * $scale))) } catch { }
  if ($one.Bitmap) { $one.Bitmap.Dispose() }
  $one.Bitmap = $bitmap
  $one.Index = $index
  $one.Form.Invalidate()
}

function Start-SlideShow {
  if (-not $pdf -or $pdf.Count -eq 0 -or $script:slideShow) { return }
  $show = New-Object System.Windows.Forms.Form
  $show.FormBorderStyle = 'None'
  $show.StartPosition = 'Manual'
  $show.Bounds = [System.Windows.Forms.Screen]::FromControl($form).Bounds
  $show.BackColor = [System.Drawing.Color]::Black
  $show.TopMost = $true
  $show.ShowInTaskbar = $false
  $show.KeyPreview = $true
  Set-DoubleBuffered $show
  $script:slideShow = [pscustomobject]@{ Form = $show; Index = [Math]::Max(0, (Get-PdfCurrent) - 1); Bitmap = $null }
  $show.Add_Paint({
    $one = $script:slideShow
    if (-not $one -or -not $one.Bitmap) { return }
    $size = $this.ClientSize
    $_.Graphics.DrawImageUnscaled($one.Bitmap, [int](($size.Width - $one.Bitmap.Width) / 2), [int](($size.Height - $one.Bitmap.Height) / 2))
  })
  $show.Add_KeyDown({
    $at = $script:slideShow.Index
    $key = [string]$_.KeyCode
    if ($key -eq 'Escape') { $this.Close() }
    elseif ($key -in @('Right', 'Down', 'Space', 'Return', 'Enter', 'Next', 'PageDown')) { Set-SlideShow ($at + 1) }
    elseif ($key -in @('Left', 'Up', 'Back', 'Prior', 'PageUp')) { Set-SlideShow ($at - 1) }
    elseif ($key -eq 'Home') { Set-SlideShow 0 }
    elseif ($key -eq 'End') { Set-SlideShow ($pdf.Count - 1) }
    $_.Handled = $true
    $_.SuppressKeyPress = $true
  })
  $show.Add_MouseDown({
    $at = $script:slideShow.Index
    if ($_.Button -eq 'Right') { Set-SlideShow ($at - 1) } elseif ($_.Button -eq 'Left') { Set-SlideShow ($at + 1) }
  })
  $show.Add_MouseWheel({ Set-SlideShow ($script:slideShow.Index + $(if ($_.Delta -lt 0) { 1 } else { -1 })) })
  $show.Add_Shown({ $this.Activate(); Set-SlideShow $script:slideShow.Index })
  try { [void]$show.ShowDialog($form) } finally {
    $at = $script:slideShow.Index
    if ($script:slideShow.Bitmap) { $script:slideShow.Bitmap.Dispose() }
    $script:slideShow = $null
    $show.Dispose()
    Go-PdfPage ($at + 1)
    [void]$pdf.Canvas.Focus()
  }
}

function Invoke-PdfKey($e) {
  if ($isDeck -and $e.KeyCode -eq 'F5') { Start-SlideShow; return $true }
  if ($e.Control) {
    switch ($e.KeyCode) {
      { $_ -in @('Add', 'Oemplus') } { Step-PdfZoom 1 0; return $true }
      { $_ -in @('Subtract', 'OemMinus') } { Step-PdfZoom -1 0; return $true }
      { $_ -in @('D0', 'NumPad0') } { Set-PdfFit 'width'; return $true }
    }
    return $false
  }
  if ($form.ActiveControl -is [System.Windows.Forms.TextBox]) { return $false }
  $h = $pdf.Canvas.ClientSize.Height
  switch ($e.KeyCode) {
    'PageDown' { Go-PdfPage ((Get-PdfCurrent) + 1); return $true }
    'PageUp' { Go-PdfPage ((Get-PdfCurrent) - 1); return $true }
    'Home' { Go-PdfPage 1; return $true }
    'End' { Go-PdfPage $pdf.Count; return $true }
    'Down' { Set-PdfScroll ($pdf.Y + 60) $null; return $true }
    'Up' { Set-PdfScroll ($pdf.Y - 60) $null; return $true }
    'Right' { Set-PdfScroll $pdf.Y ($pdf.X + 60); return $true }
    'Left' { Set-PdfScroll $pdf.Y ($pdf.X - 60); return $true }
    'Space' { Set-PdfScroll ($pdf.Y + $(if ($e.Shift) { -1 } else { 1 }) * ($h - 40)) $null; return $true }
  }
  $false
}

# ---- A page view's zoom ------------------------------------------------------------------------------------
# Internet Explorer's own zoom (OLECMDID_OPTICAL_ZOOM), which lays the page out again at the size, as its
# Ctrl+wheel and Ctrl +/- do; the box follows those too, by the screen's DPI the page reports.
function Add-WebZoom([string]$view) {
  $browser = $views[$view]
  $browser.Tag = $view
  $zoom = [pscustomobject]@{ Browser = $browser; Zoom = 100; Ratio = 0.0; Mode = 'fixed'; Box = $null; FitWidth = $null }
  $script:webZooms[$view] = $zoom
  $script:zoomCalls[$view] = [pscustomobject]@{
    Step = { param($direction) $one = $webZooms[$state.View]; $next = Get-NextZoom $one.Zoom $direction; if ($null -ne $next) { Set-WebZoom $one $next 'fixed' } }
    Value = { param($text) $one = $webZooms[$state.View]; $percent = Read-Percent $text; if ($null -ne $percent) { Set-WebZoom $one $percent 'fixed' }; [void]$one.Browser.Focus(); Update-WebZoomBox $one }
    Pick = { param($item) $one = $webZooms[$state.View]; if ($item -eq $fitWidthText) { Set-WebFit $one } else { Set-WebZoom $one (Read-Percent $item) 'fixed' }; [void]$one.Browser.Focus() }
    Items = [string[]](@($fitWidthText) + @($zoomPercents | ForEach-Object { "$_%" }))
  }
  $bar = New-Toolbar
  $zoom.Box = Add-ZoomControls $bar $zoomCalls[$view]
  $zoom.FitWidth = New-ToolButton 0 $fitWidthText (T 'El texto a lo ancho de la vista') { Set-WebFit $webZooms[$state.View] }
  Add-ToolItem $bar $zoom.FitWidth 12
  $script:toolbars[$view] = $bar
  # A page put in again (Office's copy, read later) keeps the zoom.
  $browser.Add_DocumentCompleted({
    $one = $webZooms[$this.Tag]
    if ($one.Mode -eq 'width') { Set-WebFit $one } elseif ($one.Zoom -ne 100) { Set-WebZoom $one $one.Zoom $one.Mode } else { $one.Ratio = Get-WebRatio $one }
  })
  $browser.Add_Resize({ $one = $webZooms[$this.Tag]; if ($one.Mode -eq 'width') { Set-WebFit $one } })
  Update-WebZoomBox $zoom
}

function Get-WebRatio($zoom) {
  try { [double][string]$zoom.Browser.Document.InvokeScript('eval', [object[]]@('String(screen.deviceXDPI / screen.logicalXDPI)')) } catch { 0.0 }
}

function Set-WebZoom($zoom, [double]$percent, [string]$mode) {
  # A whole number: the zoom takes a VT_I4 and refuses a double.
  $whole = [int][Math]::Round([Math]::Max(25, [Math]::Min(400, $percent)))
  try { [void]$zoom.Browser.ActiveXInstance.ExecWB(63, 2, $whole, $null) } catch { }
  $zoom.Zoom = $whole
  $zoom.Mode = $mode
  $zoom.Ratio = Get-WebRatio $zoom
  Update-WebZoomBox $zoom
}

# The width the page asks for (a Word document's body is 900 pixels at most) over the view's width; a page
# with no limit fills any width at 100%.
function Set-WebFit($zoom) {
  $natural = 0.0
  try { $natural = [double][string]$zoom.Browser.Document.InvokeScript('eval', [object[]]@('(function(){var s=window.getComputedStyle(document.body);var m=parseFloat(s.maxWidth);return String(m>0?m+parseFloat(s.marginLeft)+parseFloat(s.marginRight):0);})()')) } catch { }
  $room = $zoom.Browser.ClientSize.Width - [System.Windows.Forms.SystemInformation]::VerticalScrollBarWidth - 4
  $percent = if ($natural -gt 0 -and $room -gt 0) { [Math]::Floor($room * 100 / $natural) } else { 100 }
  Set-WebZoom $zoom $percent 'width'
}

function Update-WebZoomBox($zoom) {
  if ($zoom.Box -and -not $zoom.Box.Focused) { $zoom.Box.Text = "$($zoom.Zoom)%" }
  Set-ToolActive $zoom.FitWidth ($zoom.Mode -eq 'width')
}

# Ctrl+wheel and Ctrl +/- zoom the page on their own: the box follows them.
function Sync-WebZoom {
  if (-not $webZooms.ContainsKey([string]$state.View)) { return }
  $zoom = $webZooms[$state.View]
  $ratio = Get-WebRatio $zoom
  if ($ratio -le 0) { return }
  if ($zoom.Ratio -le 0) { $zoom.Ratio = $ratio; return }
  if ([Math]::Abs($ratio - $zoom.Ratio) -gt 0.004) {
    $zoom.Zoom = [int][Math]::Round($zoom.Zoom * $ratio / $zoom.Ratio)
    $zoom.Ratio = $ratio
    $zoom.Mode = 'fixed'
    Update-WebZoomBox $zoom
  }
}

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
  # A Word document and a presentation are drawn as their pages, as a PDF is and under its bar. When the pages
  # cannot be got, a document is drawn as one page and a presentation is described, as before.
  if ($kind -in @('docx', 'doc', 'pptx', 'ppt')) {
    $wait = Show-Wait (T 'Preparando las p\u00e1ginas...')
    try { $pagesFile = Get-OfficePages $path $kind } catch { $pagesFile = $null }
    try { $wait.Close(); $wait.Dispose() } catch { }
    if ($pagesFile) {
      $labelNames['PDF'] = if ($kind -in @('pptx', 'ppt')) { 'Diapositivas' } else { 'Documento' }
      $isDeck = $kind -in @('pptx', 'ppt')
      $kind = 'pdf'
    } elseif ($kind -in @('pptx', 'ppt')) {
      $kind = if (Test-ZipHead (Read-Bytes $path 16)) { 'zip' } else { 'text' }
    }
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
    # The file itself, or the pages a document or a presentation was turned into.
    $pdfFile = if ($pagesFile) { $pagesFile } else { $path }
    $file = Wait-Operation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($pdfFile)) ([Windows.Storage.StorageFile])
    $document = Wait-Operation ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
    # The pages fit the view's width at first, up to 1100 pixels wide.
    $pageWidth = [int][Math]::Min($room.Width - 12 - 2 * $pdfGap, 1100)
    $views['PDF'] = New-PdfView $document
    $pdf.Zoom = $pageWidth / $pdf.MaxW
    Update-PdfLayout
    # Texto: the PDF's text, selectable and copied by Copiar, read by pdf_text.py (pdfminer.six) while the
    # pages are drawn; the timer puts it in place when it is read.
    $views['Texto'] = New-SourceBox (T 'Leyendo el texto del PDF...') $true
    $pdfText = Start-PdfText $pdfFile
    $inner = New-Object System.Drawing.Size(($pageWidth + 12 + 2 * $pdfGap), $room.Height)
  } elseif ($kind -in @('audio', 'video')) {
    Add-Type -AssemblyName PresentationCore, PresentationFramework, WindowsBase, WindowsFormsIntegration
    # WPF drawn by the processor: with the graphics card, a WPF area inside a Windows Forms window can stay
    # unpainted, showing what was behind it.
    [System.Windows.Media.RenderOptions]::ProcessRenderMode = [System.Windows.Interop.RenderMode]::SoftwareOnly
    . {
      $uri = New-Object System.Uri($path)
      $barHeight = 40
      $media = [pscustomobject]@{ Ready = $false; Playing = $true; Seconds = 0.0; Asked = 'play'; Speed = 1.0 }
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
        # A sound is played by Windows' newer player, which takes a new speed at once. Where there is none,
        # by the player a video has, on a cell of its own that shows nothing.
        $stage = New-Object System.Windows.Forms.Panel
        $player = New-SoundPlayer
        if (-not $player) {
          $player = New-Object System.Windows.Controls.MediaElement
          $player.LoadedBehavior = [System.Windows.Controls.MediaState]::Manual
          $player.UnloadedBehavior = [System.Windows.Controls.MediaState]::Manual
          $grid = New-Object System.Windows.Controls.Grid
          $grid.Background = [System.Windows.Media.Brushes]::Black
          [void]$grid.Children.Add($player)
          $sound = New-Object System.Windows.Forms.Integration.ElementHost
          $sound.BackColor = $black
          $sound.SetBounds(0, 0, 1, 1)
          $sound.Child = $grid
          $stage.Controls.Add($sound)
        }
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
        $about.SetBounds(54, 2, 330, 46)
        $stage.Controls.Add($note)
        $stage.Controls.Add($about)
        $inner = New-Object System.Drawing.Size(620, 90)
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
      # The speed's switch: x0.5 x1 x1.25 x1.5 x2, the one in force filled, x1 as it opens. A sound has it
      # after its size; a video, which fills its stage, in the bar before the time.
      $speedButtons = New-Object System.Collections.ArrayList
      $speedWidth = 38
      $speedGap = 2
      $speedsWidth = 5 * $speedWidth + 4 * $speedGap
      $speedOff = [System.Drawing.ColorTranslator]::FromHtml('#25282e')
      foreach ($speed in @(0.5, 1.0, 1.25, 1.5, 2.0)) {
        $one = New-Object System.Windows.Forms.Label
        $one.Text = 'x' + ([double]$speed).ToString('0.##', [Globalization.CultureInfo]::InvariantCulture)
        $one.Font = New-Object System.Drawing.Font('Segoe UI', 9)
        $one.TextAlign = 'MiddleCenter'
        $one.Cursor = [System.Windows.Forms.Cursors]::Hand
        $one.Tag = [double]$speed
        $one.Add_Click({ Set-Speed $this.Tag })
        [void]$speedButtons.Add($one)
        if ($kind -eq 'video') { $bar.Controls.Add($one) } else {
          $one.SetBounds(392 + ($speedButtons.Count - 1) * ($speedWidth + $speedGap), 13, $speedWidth, 24)
          $stage.Controls.Add($one)
        }
      }
      $bar.Add_Resize({
        $w = $bar.ClientSize.Width
        $speeds = if ($kind -eq 'video') { $speedsWidth + 6 } else { 0 }
        $playButton.SetBounds(0, 4, 34, 32)
        $volumeBar.SetBounds($w - 84, 12, 82, 16)
        $volumeIcon.SetBounds($w - 112, 4, 28, 32)
        $timeLabel.SetBounds($w - 112 - 136, 4, 132, 32)
        $seekBar.SetBounds(40, 12, [Math]::Max(40, $w - 40 - 112 - 136 - 8 - $speeds), 16)
        if ($kind -eq 'video') {
          for ($i = 0; $i -lt $speedButtons.Count; $i++) { $speedButtons[$i].SetBounds($w - 112 - 136 - $speedsWidth + $i * ($speedWidth + $speedGap), 8, $speedWidth, 24) }
        }
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
    # The speed it plays at, and its switch drawn to match.
    function Set-Speed([double]$speed) {
      $mediaParts.Media.Speed = $speed
      $player.SpeedRatio = $speed
      foreach ($one in $speedButtons) {
        $isOn = [Math]::Abs([double]$one.Tag - $speed) -lt 0.001
        $one.BackColor = $(if ($isOn) { $blue } else { $speedOff })
        $one.ForeColor = $(if ($isOn) { $black } else { $ink })
      }
    }
    Set-Speed 1.0
    # Plays or pauses, and says which, so the mod's own play marks follow the popup's.
    function Set-Playing([bool]$on) {
      $media = $mediaParts.Media
      if ($media.Playing -eq $on) { return }
      # Windows' player goes back to its own speed when it starts again: the one chosen is set anew.
      if ($on) { $player.Play(); $player.SpeedRatio = $media.Speed } else { $player.Pause() }
      $media.Playing = $on
      $mediaParts.Play.Text = [string][char]$(if ($on) { 0xE769 } else { 0xE768 })
      try { Say $(if ($on) { 'media playing' } else { 'media paused' }) } catch { }
    }
    function Switch-Playing { Set-Playing (-not $mediaParts.Media.Playing) }
    $player.Add_MediaOpened({
      $media = $mediaParts.Media
      $media.Ready = $true
      if ($player.NaturalDuration.HasTimeSpan) { $media.Seconds = $player.NaturalDuration.TimeSpan.TotalSeconds }
      # A video takes its own size, within the room the screen gives.
      if ($kind -eq 'video' -and $player.NaturalVideoWidth -gt 0 -and $player.NaturalVideoHeight -gt 0) {
        $width = [double]$player.NaturalVideoWidth; $height = [double]$player.NaturalVideoHeight
        $scale = [Math]::Min(1.0, [Math]::Min($room.Width / $width, ($room.Height - $mediaParts.Bar) / $height))
        Set-PopupSize (([int][Math]::Max(640, $width * $scale)) + $extraWidth) (([int]($height * $scale)) + $mediaParts.Bar + $extraHeight)
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
      try { Say 'media ended' } catch { }
    })
    if ($kind -eq 'audio') { $player.Source = New-Object System.Uri($path) }
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
      'docx' {
        $views['Page'] = New-PageView (New-Page (ConvertFrom-Docx $path) $documentCss)
        $rawText = try { Get-DocxText $path } catch { $null }
      }
      'doc' {
        if ([Type]::GetTypeFromProgID('Word.Application')) {
          $views['Page'] = New-PageView (New-MessagePage 'Abriendo con Word...')
          $state.Office = Start-OfficeCopy 'word' '.docx' {
            param($copyPath, $problem)
            $views['Page'].DocumentText = if ($problem) {
              New-Page ('<p class="note">Word no pudo abrir este .doc: ' + $problem + '<br>Texto aproximado: los textos legibles del archivo.</p><pre>' + (Html (Get-LooseText $bytes)) + '</pre>') $documentCss
            } else { $script:rawText = try { Get-DocxText $copyPath } catch { $null }; New-Page (ConvertFrom-Docx $copyPath) $documentCss }
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
  $toolbars.Clear()
  $pdf = $null
  $kind = 'binary'
  $bytes = New-Object byte[] 0
  try { $bytes = Read-Bytes $path } catch { }
  $info = try { Get-BinaryInfo $bytes $problem } catch { (T 'No se pudo mostrar este archivo: ') + $problem }
  $views['Text'] = New-SourceBox $info $false
  $inner = $room
}
# A Word document's page and a Markdown or HTML Preview get the zoom's bar.
foreach ($name in @($views.Keys)) {
  $wantsZoom = ($name -eq 'Preview' -and $kind -in @('markdown', 'html')) -or ($name -eq 'Page' -and $kind -in @('docx', 'doc'))
  if ($wantsZoom -and $views[$name] -is [System.Windows.Forms.WebBrowser]) { try { Add-WebZoom $name } catch { } }
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
# A bar above a view takes its height inside the frame, within the room.
if ($toolbars.Count -gt 0) { $inner = New-Object System.Drawing.Size($inner.Width, ([Math]::Min($inner.Height + $toolbarHeight, [Math]::Max($inner.Height, $room.Height)))) }

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

# The move mark, at the close mark's left: held down, the popup follows the pointer, and stays where it is let go.
function New-MoveLabel {
  $label = New-Object System.Windows.Forms.Label
  $label.Text = " $([string][char]0x2725) "
  $label.AutoSize = $true
  $label.Font = New-Object System.Drawing.Font('Segoe UI Symbol', 12, [System.Drawing.FontStyle]::Bold)
  $label.ForeColor = $blue
  $label.BackColor = $black
  $label.Cursor = [System.Windows.Forms.Cursors]::SizeAll
  # A label pressed keeps the mouse until it is let go, so the moves reach it even off the mark.
  $label.Add_MouseDown({
    if ($_.Button -ne 'Left') { return }
    $at = [System.Windows.Forms.Cursor]::Position
    $state.Drag = @(($at.X - $form.Left), ($at.Y - $form.Top))
  })
  $label.Add_MouseMove({
    if (-not $state.Drag) { return }
    $at = [System.Windows.Forms.Cursor]::Position
    $form.Location = New-Object System.Drawing.Point(($at.X - $state.Drag[0]), ($at.Y - $state.Drag[1]))
    $state.Moved = $true
  })
  $label.Add_MouseUp({ $state.Drag = $null })
  $label
}
$move = New-MoveLabel
$moveBelow = New-MoveLabel

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
# Added after the views, the bars are docked first: on top, the view below them.
foreach ($bar in $toolbars.Values) { $inside.Controls.Add($bar) }
$frame.Controls.Add($inside)
$form.Controls.Add($frame)

$lineMiddle = $contour + [int]($line / 2)
$topLabels = @($title, $close, $closeBelow, $move, $moveBelow) + @($switch.Values) + $copyLabels
foreach ($label in $topLabels) { $form.Controls.Add($label); $label.BringToFront() }

# The top line: the title in the middle, the switch after it, Copiar, the move mark and the close mark at the right.
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
  $move.Location = New-Object System.Drawing.Point(($close.Location.X - $move.PreferredWidth - 2), ($lineMiddle - [int]($move.PreferredHeight / 2)))
  if ($copy) { $copy.Location = New-Object System.Drawing.Point(($move.Location.X - $copy.PreferredWidth - 6), ($lineMiddle - [int]($copy.PreferredHeight / 2))) }
  # The bottom line: the same Copiar and close mark, at the same places on it, only on a large popup
  # (two thirds of the screen's height or more); a small or middling one keeps them on top alone.
  $isLarge = $form.ClientSize.Height -ge ($area.Height * 0.65)
  $closeBelow.Visible = $isLarge
  $moveBelow.Visible = $isLarge
  if ($copyBelow) { $copyBelow.Visible = $isLarge }
  $bottomMiddle = $form.ClientSize.Height - $lineMiddle
  $closeBelow.Location = New-Object System.Drawing.Point($close.Location.X, ($bottomMiddle - [int]($closeBelow.PreferredHeight / 2)))
  $moveBelow.Location = New-Object System.Drawing.Point($move.Location.X, ($bottomMiddle - [int]($moveBelow.PreferredHeight / 2)))
  if ($copyBelow) { $copyBelow.Location = New-Object System.Drawing.Point(($moveBelow.Location.X - $copyBelow.PreferredWidth - 6), ($bottomMiddle - [int]($copyBelow.PreferredHeight / 2))) }
}

# The popup at a size, in the middle of the screen, or where it was moved to; a small one still leaves the top
# line room.
function Set-PopupSize([int]$width, [int]$height) {
  $sides = $close.PreferredWidth + $move.PreferredWidth + 2 + 24 + 40
  if ($copy) { $sides += $copy.PreferredWidth + 6 }
  foreach ($label in $switch.Values) { $sides += $label.PreferredWidth + 4 }
  $width = [Math]::Max($width, 2 * $contour + $title.PreferredWidth + 2 * $sides)
  $form.ClientSize = New-Object System.Drawing.Size($width, $height)
  if (-not $state.Moved) { $form.Location = New-Object System.Drawing.Point(([int]($area.X + ($area.Width - $width) / 2)), ([int]($area.Y + ($area.Height - $height) / 2))) }
  Set-TopLine
}

function Show-View([string]$view) {
  $state.View = $view
  Hide-ZoomMenu
  foreach ($name in $viewNames) { $views[$name].Visible = $name -eq $view }
  foreach ($name in @($toolbars.Keys)) { $toolbars[$name].Visible = $name -eq $view }
  foreach ($one in $switch.Values) {
    $isShown = $one.Tag -eq $view
    $one.BackColor = if ($isShown) { $blue } else { $black }
    $one.ForeColor = if ($isShown) { $black } else { $blue }
  }
  if ($form.Visible) { [void](Get-FocusTarget $view).Focus() }
}

# What takes the keys and the wheel in a view: the PDF's canvas, else the view itself.
function Get-FocusTarget([string]$view) { if ($view -eq 'PDF' -and $pdf) { $pdf.Canvas } else { $views[$view] } }

$selectionScript = @'
(function () {
  var s = window.getSelection ? window.getSelection() : null;
  if (!s || s.rangeCount === 0 || s.isCollapsed) return '';
  var d = document.createElement('div');
  for (var i = 0; i < s.rangeCount; i++) d.appendChild(s.getRangeAt(i).cloneContents());
  var h = d.innerHTML;
  h = h.replace(/<br[^>]*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|pre|blockquote|table|ul|ol|dt|dd|section|article)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<[^>]+>/g, '');
  var t = document.createElement('textarea');
  t.innerHTML = h;
  return t.value.replace(/\t\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
})()
'@

function Copy-View {
  $view = $views[$state.View]
  $text = $null
  try {
    if ($view -is [System.Windows.Forms.WebBrowser] -and $svgExport -and $state.View -eq 'Preview') {
      Copy-SvgPicture; return
    }
    if ($view -is [System.Windows.Forms.WebBrowser]) {
      $selected = $null
      # The selection as text with its line breaks: IE's own text of a selection runs paragraphs and list
      # items together, so its HTML is read instead, a line after each block, a tab after each cell.
      try { $selected = [string]$view.Document.InvokeScript('eval', [object[]]@($selectionScript)) } catch { }
      if (-not $selected) { try { $selected = [string]$view.Document.InvokeScript('eval', [object[]]@('window.getSelection ? String(window.getSelection()) : ""')) } catch { } }
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
  if ($_.KeyCode -eq 'Escape') {
    if ($zoomMenu -and $zoomMenu.Visible) { Hide-ZoomMenu; $_.Handled = $true; return }
    $form.Close(); return
  }
  if ($state.View -eq 'PDF' -and $pdf -and (Invoke-PdfKey $_)) { $_.Handled = $true; $_.SuppressKeyPress = $true; return }
  $view = $views[$state.View]
  if ($player -and $_.KeyCode -eq 'Space') { Switch-Playing; $_.Handled = $true; $_.SuppressKeyPress = $true; return }
  if ($_.Control -and $_.KeyCode -eq 'A' -and $view -is [System.Windows.Forms.RichTextBox]) { $view.SelectAll(); $_.Handled = $true; $_.SuppressKeyPress = $true; return }
  if ($_.Control -and $_.KeyCode -eq 'C' -and $image) { Copy-View; $_.Handled = $true }
})

$form.Add_FormClosing({
  if ($player) { try { $player.Stop(); $player.Close() } catch { } }
  # Office left at work finishes on its own and quits; its folder goes if it can.
  if ($state.Office) { try { Remove-Item -LiteralPath $state.Office.Folder -Recurse -Force } catch { } }
  if ($state.Pages) { try { Remove-Item -LiteralPath $state.Pages -Recurse -Force } catch { } }
  # A database still being read is not waited for.
  if ($dbJob -and -not $dbJob.Done) { try { $dbJob.Process.Kill() } catch { } }
  if ($prettyJob -and -not $prettyJob.Done) { try { $prettyJob.Process.Kill() } catch { } }
})

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 100
$timer.Add_Tick({
  try { Say '.' } catch { $form.Close(); return }
  # The mod's own pause and play (SPEEDY_CONTROL, a file saying `pause` or `play`) drive the sound too: what it
  # asks is done once, when it changes, so a pause pressed in the popup stands.
  if ($player -and $env:SPEEDY_CONTROL) {
    $asked = ''
    try { $asked = ([IO.File]::ReadAllText($env:SPEEDY_CONTROL)).Trim() } catch { $asked = '' }
    if ($asked -in @('pause', 'play') -and $asked -ne $mediaParts.Media.Asked) {
      $mediaParts.Media.Asked = $asked
      Set-Playing ($asked -eq 'play')
    }
  }
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
  if ($pdf) { try { Update-PdfPages } catch { } }
  $state.Ticks++
  if ($webZooms.Count -gt 0 -and $state.Ticks % 3 -eq 0) { try { Sync-WebZoom } catch { } }
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
  if ($player) { [void]$form.Focus() } else { [void](Get-FocusTarget $state.View).Focus() }
  Say 'shown'
  # The PDF's pages in view, drawn at once.
  if ($pdf) { try { Update-PdfPages -All } catch { } }
  $timer.Start()
})

try {
  [System.Windows.Forms.Application]::Run($form)
} finally {
  $timer.Stop()
  foreach ($one in $disposables) { $one.Dispose() }
  if ($pdf) { foreach ($one in @($pdf.Bitmaps.Values)) { $one.Dispose() } }
}
exit 0
