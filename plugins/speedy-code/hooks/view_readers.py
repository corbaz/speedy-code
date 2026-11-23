"""What view_file.py's popup shows of a file, read here: what kind it is, its text, and the pages drawn of it.

The same readings view_file.ps1 does on Windows, with the same words and the same pages: a Markdown file as
a page, a spreadsheet's sheets, a Word document, a zip's listing, a database's tables, and what can be told
of a file that is not text. Nothing here opens a window: view_file.py does, with what these give it.
"""
import base64
import datetime
import html
import os
import re
import struct
import zipfile
from xml.etree import ElementTree

IMAGE_TYPES = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.tif', '.tiff', '.webp'}
AUDIO_TYPES = {'.mp3', '.mpa', '.mp2', '.wav', '.m4a', '.aac', '.wma', '.ogg', '.oga', '.opus', '.flac', '.aif', '.aiff', '.mid', '.midi'}
VIDEO_TYPES = {'.mp4', '.m4v', '.mov', '.avi', '.wmv', '.mkv', '.webm', '.mpg', '.mpeg', '.3gp'}
KINDS = {
    '.pdf': 'pdf', '.md': 'markdown', '.markdown': 'markdown', '.html': 'html', '.htm': 'html', '.xhtml': 'html', '.svg': 'svg',
    '.xlsx': 'xlsx', '.xlsm': 'xlsx', '.xls': 'xls', '.docx': 'docx', '.docm': 'docx', '.doc': 'doc', '.crx': 'binary', '.ds_store': 'binary',
    '.sqlite': 'sqlite', '.sqlite3': 'sqlite', '.db': 'sqlite', '.db3': 'sqlite', '.lnk': 'binary', '.url': 'url',
    '.sys': 'binary', '.dll': 'binary', '.exe': 'binary',
    '.zip': 'zip', '.jar': 'zip', '.apk': 'zip', '.nupkg': 'zip', '.vsix': 'zip', '.whl': 'zip', '.epub': 'zip',
    '.pptx': 'pptx', '.pptm': 'pptx', '.ppsx': 'pptx', '.potx': 'pptx', '.ppt': 'ppt', '.pps': 'ppt', '.pot': 'ppt',
}
KINDS.update({one: 'image' for one in IMAGE_TYPES})
KINDS.update({one: 'audio' for one in AUDIO_TYPES})
KINDS.update({one: 'video' for one in VIDEO_TYPES})

TEXT_LIMIT = 2 * 1024 * 1024
ROW_CAP = 2000
COLUMN_CAP = 100
ZIP_ROW_CAP = 5000
SQLITE_MAGIC = b'SQLite format 3\x00'
PROSE_NAMES = re.compile(r'^(LICENSE|LICENCE|COPYING|README|AUTHORS|NOTICE|CHANGELOG)$')

# The pages' styles, as view_file.ps1 has them; the scroll bars dark, as its are.
SCROLL_CSS = """
::-webkit-scrollbar { width: 12px; height: 12px; } ::-webkit-scrollbar-track, ::-webkit-scrollbar-corner { background: #16181d; }
::-webkit-scrollbar-thumb { background: #495057; border: 2px solid #16181d; border-radius: 6px; }
html, body { border: 0; }
"""
DARK_CSS = """
body { background: #16181d; color: #e9ecef; font: 15px/1.55 'Segoe UI', -apple-system, 'Helvetica Neue', sans-serif; margin: 18px 26px; }
h1, h2 { border-bottom: 1px solid #343a40; padding-bottom: 4px; } h1, h2, h3, h4, h5, h6 { color: #74c0fc; margin: 1.1em 0 .5em; }
a { color: #4dabf7; } code { font-family: Consolas, Menlo, monospace; background: #25282e; padding: 1px 5px; border-radius: 4px; color: #ffd43b; }
pre { background: #0f1115; border: 1px solid #343a40; padding: 10px 12px; overflow: auto; border-radius: 6px; }
pre code { background: none; padding: 0; color: #e9ecef; } blockquote { border-left: 4px solid #4dabf7; margin: 0; padding: 2px 14px; color: #adb5bd; }
table { border-collapse: collapse; margin: 8px 0; } th, td { border: 1px solid #343a40; padding: 5px 10px; text-align: left; vertical-align: top; } th { background: #25282e; }
hr { border: 0; border-top: 1px solid #343a40; } .alt { color: #868e96; } del { color: #868e96; } li { margin: 2px 0; }
.note { color: #868e96; font: 13px 'Segoe UI', -apple-system, sans-serif; margin: 10px 0; }
"""
SHEET_CSS = DARK_CSS + """
body { margin: 0; }
.tabs { position: fixed; top: 0; left: 0; right: 0; height: 34px; background: #0f1115; border-bottom: 1px solid #343a40; padding: 6px 8px 0; white-space: nowrap; overflow: hidden; z-index: 2; box-sizing: border-box; }
.tab { display: inline-block; padding: 4px 14px; margin-right: 4px; color: #74c0fc; cursor: pointer; border: 1px solid #343a40; border-bottom: 0; border-radius: 6px 6px 0 0; font: bold 13px 'Segoe UI', -apple-system, sans-serif; }
.tab.on { background: #74c0fc; color: #000; border-color: #74c0fc; }
.sheets { padding: 10px 12px; } .tabbed { padding-top: 50px; }
table.grid { border-collapse: collapse; margin: 0; font: 13px Consolas, Menlo, monospace; }
.grid th { background: #25282e; color: #868e96; font-weight: normal; padding: 2px 8px; border: 1px solid #343a40; text-align: center; }
.grid td { border: 1px solid #2b2f36; padding: 2px 8px; white-space: nowrap; max-width: 480px; overflow: hidden; text-overflow: ellipsis; color: #e9ecef; }
.grid td.n { text-align: right; color: #a5d8ff; }
.grid td.alt { color: #868e96; font-style: italic; }
"""
DOCUMENT_CSS = DARK_CSS + """
body { max-width: 900px; } p { margin: 0 0 .6em; white-space: pre-wrap; } td p { margin: 0; } li { white-space: pre-wrap; }
"""
HIDDEN = ' style="display:none"'
NUMBER = re.compile(r'^-?\d+(\.\d+)?([eE][-+]?\d+)?$')


def escape(text):
    return html.escape(str(text), quote=True)


def new_page(body, css=DARK_CSS):
    return f'<!DOCTYPE html><html><head><meta charset="utf-8"><style>\n{SCROLL_CSS}\n{css}\n</style></head><body>\n{body}\n</body></html>'


def message_page(text):
    """A page that says one thing: `text` is HTML."""
    return new_page('<p class="note" style="font-size:15px">' + text + '</p>')


def thousands(number):
    """A whole number with its thousands apart by a dot, as Spanish writes them."""
    return f'{int(number):,}'.replace(',', '.')


def format_size(size):
    if size < 1024:
        return f'{size} bytes'
    unit, share = ('KB', size / 1024) if size < 1024 * 1024 else ('MB', size / (1024 * 1024))
    whole, _, tenth = f'{share:.1f}'.partition('.')
    return f'{thousands(whole)},{tenth} {unit} ({thousands(size)} bytes)'


def short_size(size):
    """A size in a table's cell: bytes, KB, MB or GB, one decimal."""
    if size < 1024:
        return f'{size} B'
    for unit in ('KB', 'MB', 'GB'):
        size /= 1024
        if size < 1024 or unit == 'GB':
            return f'{size:.1f}'.replace('.', ',') + ' ' + unit
    return ''


def read_bytes(path, limit=0):
    with open(path, 'rb') as file:
        return file.read(limit) if limit else file.read()


def read_text(data):
    """A file's text, or None when it is not text: a NUL near the start, or too many control bytes. A byte
    order mark says the encoding; otherwise UTF-8 when it decodes as such, else Windows' Latin. A long file
    gives its first 2 MB."""
    count = min(len(data), TEXT_LIMIT)
    if data[:2] == b'\xff\xfe':
        return data[2:count - ((count - 2) % 2)].decode('utf-16-le', 'replace')
    if data[:2] == b'\xfe\xff':
        return data[2:count - ((count - 2) % 2)].decode('utf-16-be', 'replace')
    start = 3 if data[:3] == b'\xef\xbb\xbf' else 0
    probe = min(count, 8000)
    if b'\x00' in data[:probe]:
        return None
    # The cut never splits a UTF-8 character.
    while count < len(data) and count > start and (data[count] & 0xC0) == 0x80:
        count -= 1
    try:
        return data[start:count].decode('utf-8')
    except UnicodeDecodeError:
        pass
    controls = sum(1 for byte in data[:probe] if byte < 9 or (13 < byte < 32 and byte != 27))
    if controls * 100 > probe:
        return None
    return data[start:count].decode('cp1252', 'replace')


def kind_of(path, head):
    """The kind of view a file gets: by its name, then by how it starts (a database, a zip)."""
    extension = os.path.splitext(path)[1].lower()
    if not extension and os.path.basename(path).lower() == '.ds_store':
        extension = '.ds_store'
    kind = KINDS.get(extension, 'text')
    if kind in ('text', 'binary', 'sqlite'):
        is_sqlite = head[:16] == SQLITE_MAGIC
        if is_sqlite:
            kind = 'sqlite'
        elif kind == 'sqlite':
            kind = 'text'
        if kind in ('text', 'binary') and extension != '.crx' and head[:4] == b'PK\x03\x04':
            kind = 'zip'
    return kind


def is_prose(path):
    """Prose wraps: plain text, logs, and a LICENSE or README with no extension."""
    name = os.path.basename(path)
    extension = os.path.splitext(name)[1].lower()
    return extension in ('.txt', '.log') or (extension == '' and bool(PROSE_NAMES.match(name)))


# ---- Markdown -------------------------------------------------------------------------------------------

def markdown_inline(text):
    """Markdown's inline marks as HTML: code spans first, kept apart from the rest, then images and links,
    bold, italic and struck text. The text is escaped before any tag goes in."""
    out = []
    for part in re.split(r'(`+[^`]*?`+)', text):
        code = re.match(r'^(`+)(.*?)\1$', part, re.S)
        if code:
            out.append('<code>' + html.escape(code.group(2).strip()) + '</code>')
            continue
        piece = html.escape(part)
        piece = re.sub(r'!\[([^\]]*)\]\(([^)\s]+)[^)]*\)', r'<span class="alt">[\1]</span>', piece)
        piece = re.sub(r'\[([^\]]+)\]\(([^)\s]+)[^)]*\)', r'<a href="\2">\1</a>', piece)
        piece = re.sub(r'(?<![\w"=/])(https?://[^\s<]+)', r'<a href="\1">\1</a>', piece)
        piece = re.sub(r'\*\*(.+?)\*\*|__(.+?)__', lambda m: '<strong>' + (m.group(1) or m.group(2)) + '</strong>', piece)
        piece = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\w)|(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)', lambda m: '<em>' + (m.group(1) or m.group(2)) + '</em>', piece)
        piece = re.sub(r'~~(.+?)~~', r'<del>\1</del>', piece)
        out.append(piece)
    return ''.join(out)


def markdown_html(markdown):
    """A Markdown document as a page's body: headings, paragraphs, lists (nested by indent), quotes, fenced
    code, tables and rules. Enough to read a README, not every corner of CommonMark."""
    lines = re.split(r'\r?\n', markdown)
    out, paragraph, lists = [], [], []

    def flush():
        if paragraph:
            out.append('<p>' + markdown_inline(' '.join(paragraph)) + '</p>\n')
            paragraph.clear()

    def close_lists(above):
        while lists and lists[-1][0] >= above:
            out.append('</li></' + lists.pop()[1] + '>\n')

    def cells(row):
        return [markdown_inline(cell.strip()) for cell in re.sub(r'^\||\|$', '', row.strip()).split('|')]

    i = 0
    while i < len(lines):
        line = lines[i]
        fence = re.match(r'^\s*(```|~~~)\s*([\w+-]*)', line)
        if fence:
            flush(); close_lists(0)
            code = []
            i += 1
            while i < len(lines) and not re.match(r'^\s*' + re.escape(fence.group(1)), lines[i]):
                code.append(lines[i]); i += 1
            out.append('<pre><code>' + html.escape('\n'.join(code)) + '</code></pre>\n')
            i += 1
            continue
        if re.match(r'^\s*$', line):
            flush(); i += 1
            continue
        heading = re.match(r'^(#{1,6})\s+(.*?)\s*#*\s*$', line)
        if heading:
            flush(); close_lists(0)
            level = len(heading.group(1))
            out.append(f'<h{level}>' + markdown_inline(heading.group(2)) + f'</h{level}>\n')
            i += 1
            continue
        if re.match(r'^\s{0,3}([-*_])(\s*\1){2,}\s*$', line):
            flush(); close_lists(0); out.append('<hr>\n'); i += 1
            continue
        if re.match(r'^\s*\|.*\|\s*$', line) and i + 1 < len(lines) and re.match(r'^\s*\|?\s*:?-{2,}', lines[i + 1]):
            flush(); close_lists(0)
            out.append('<table><tr>' + ''.join(f'<th>{cell}</th>' for cell in cells(line)) + '</tr>\n')
            i += 2
            while i < len(lines) and re.match(r'^\s*\|', lines[i]):
                out.append('<tr>' + ''.join(f'<td>{cell}</td>' for cell in cells(lines[i])) + '</tr>\n'); i += 1
            out.append('</table>\n')
            continue
        if re.match(r'^\s*>\s?(.*)$', line):
            flush(); close_lists(0)
            quote = []
            while i < len(lines):
                quoted = re.match(r'^\s*>\s?(.*)$', lines[i])
                if not quoted:
                    break
                quote.append(quoted.group(1)); i += 1
            out.append('<blockquote>' + markdown_html('\n'.join(quote)) + '</blockquote>\n')
            continue
        item = re.match(r'^(\s*)([-*+]|\d+[.)])\s+(.*)$', line)
        if item:
            flush()
            indent = len(item.group(1).replace('\t', '    '))
            tag = 'ol' if re.search(r'\d', item.group(2)) else 'ul'
            text = item.group(3)
            # A task list's box, drawn as one.
            box = ''
            task = re.match(r'^\[([ xX])\]\s*(.*)$', text)
            if task:
                box = '&#9744; ' if task.group(1) == ' ' else '&#9745; '
                text = task.group(2)
            close_lists(indent + 1)
            if lists and lists[-1] == (indent, tag):
                out.append('</li>\n<li>')
            else:
                if lists and lists[-1][0] == indent:
                    close_lists(indent)
                out.append(f'<{tag}><li>')
                lists.append((indent, tag))
            out.append(box + markdown_inline(text))
            i += 1
            continue
        if lists and re.match(r'^\s+\S', line):
            out.append(' ' + markdown_inline(line.strip())); i += 1
            continue
        close_lists(0)
        paragraph.append(line.strip()); i += 1
    flush(); close_lists(0)
    return ''.join(out)


def markdown_page(markdown):
    return new_page(markdown_html(markdown))


# ---- What is not text -----------------------------------------------------------------------------------

def hex_dump(data, length):
    lines = []
    for offset in range(0, min(length, len(data)), 16):
        row = data[offset:min(offset + 16, length)]
        digits = ''.join(f'{byte:02X} ' for byte in row)
        letters = ''.join(chr(byte) if 32 <= byte < 127 else '.' for byte in row)
        lines.append(f'{offset:08X}  {digits:<48} {letters}')
    return '\n'.join(lines)


def ds_store_names(data):
    """The names a .DS_Store keeps data for. A record is its name's length, the name in UTF-16, four letters
    for what is kept and four for its type: the names are found by that shape."""
    types = (b'bool', b'long', b'shor', b'blob', b'type', b'ustr', b'comp', b'dutc')
    names = []
    at = data.find(b'\x00\x00\x00')
    while 0 <= at < len(data) - 12:
        length = data[at + 3]
        end = at + 4 + 2 * length
        if 0 < length and data[end + 4:end + 8] in types and data[end:end + 4].isalnum():
            name = data[at + 4:end].decode('utf-16-be', 'replace')
            if name.isprintable() and name not in names:
                names.append(name)
            at = end + 8
        else:
            at += 1
        at = data.find(b'\x00\x00\x00', at)
    return names


def zip_lines(data, offset):
    """A zip's entries as lines of text, for a file that holds one past a header (a Chrome extension)."""
    import io
    lines = []
    with zipfile.ZipFile(io.BytesIO(data[offset:])) as archive:
        entries = archive.infolist()
        lines.append(f'Contenido ({len(entries)} entradas):')
        for entry in entries[:500]:
            lines.append(f'  {entry.file_size:>12}  {entry.filename}')
        if len(entries) > 500:
            lines.append(f'  ... y {len(entries) - 500} más')
    return lines


def binary_info(path, data, problem=''):
    """What can be told about a file that is not text."""
    name = os.path.basename(path)
    extension = os.path.splitext(name)[1].lower() or ('.ds_store' if name.lower() == '.ds_store' else '')
    out = []
    if problem:
        out += ['No se pudo mostrar este archivo: ' + problem, '']
    out.append('Archivo:  ' + name)
    out.append('Tamaño:   ' + format_size(len(data)))
    zip_at = data.find(b'PK\x03\x04')
    if extension == '.ds_store':
        out.append('Tipo:     metadatos de carpeta del Finder de macOS (.DS_Store)')
        names = ds_store_names(data)
        out += ['', f'Archivos y carpetas con datos guardados: {len(names)}'] + ['  ' + one for one in names]
    elif zip_at >= 0 and (zip_at == 0 or extension == '.crx'):
        if extension == '.crx':
            version = f' CRX{data[4]}' if data[:4] == b'Cr24' and len(data) >= 8 else ''
            out.append(f'Tipo:     extensión de Chrome{version}, un ZIP desde el byte {zip_at}')
        else:
            out.append('Tipo:     archivo ZIP')
        out.append('')
        try:
            out += zip_lines(data, zip_at)
        except Exception as error:
            out.append(f'No se pudo leer el ZIP: {error}')
    else:
        out += ['Tipo:     binario', '', 'Primeros 512 bytes:', hex_dump(data, 512)]
    return '\n'.join(out)


def url_info(path, text):
    """An Internet shortcut (.url): where it leads, and what it holds."""
    url = icon = ''
    for line in re.split(r'\r?\n', text):
        found = re.match(r'^\s*URL\s*=\s*(.*)$', line)
        if found and not url:
            url = found.group(1).strip()
        found = re.match(r'^\s*IconFile\s*=\s*(.*)$', line)
        if found and not icon:
            icon = found.group(1).strip()
    out = ['Archivo:  ' + os.path.basename(path), 'Tipo:     acceso directo de Internet (.url)', '', 'URL:      ' + (url or '(no tiene)')]
    if icon:
        out.append('Icono:    ' + icon)
    out += ['', 'Contenido:', text.rstrip()]
    return '\n'.join(out)


def loose_text(data):
    """A .doc that could not be converted: the runs of readable text in it, UTF-16 or 8-bit, whichever gives more."""
    pattern = re.compile('[\\t\\r\\n\\x20-\\x7E\\u00A1\\u00BF\\u00C0-\\u00FF\\u2018-\\u201D\\u2026]{4,}')

    def pick(decoded):
        runs = []
        for found in pattern.finditer(decoded):
            value = found.group(0).strip()
            plain = len(re.findall('[A-Za-z0-9 ]', value))
            letters = len(re.findall('[A-Za-z]', value))
            if letters >= 3 and plain * 10 >= len(value) * 7 and len(set(value)) >= 3:
                runs.append(value)
        return runs

    wide = pick(data[:len(data) - len(data) % 2].decode('utf-16-le', 'replace'))
    narrow = pick(data.decode('cp1252', 'replace'))
    runs = wide if sum(map(len, wide)) >= sum(map(len, narrow)) else narrow
    return '\n'.join(runs).replace('\r', '\n')


# ---- Spreadsheets ---------------------------------------------------------------------------------------

def local(tag):
    return tag.rsplit('}', 1)[-1]


def zip_xml(archive, name):
    try:
        return ElementTree.fromstring(archive.read(name))
    except (KeyError, ElementTree.ParseError):
        return None


def column_index(letters):
    number = 0
    for letter in letters.upper():
        number = number * 26 + ord(letter) - 64
    return number


def column_name(number):
    name = ''
    while number > 0:
        number, rest = divmod(number - 1, 26)
        name = chr(65 + rest) + name
    return name


def cell_text(node):
    """A cell's text: its runs' texts together, the phonetic notes left out."""
    if local(node.tag) == 'rPh':
        return ''
    if local(node.tag) == 't':
        return node.text or ''
    return ''.join(cell_text(child) for child in node)


def read_xlsx(path):
    """A workbook's sheets: [{name, cells: {row: {column: text}}, max_row, max_col, rows}]."""
    ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
    rel_ns = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
    sheets = []
    with zipfile.ZipFile(path) as archive:
        strings = []
        shared = zip_xml(archive, 'xl/sharedStrings.xml')
        if shared is not None:
            strings = [cell_text(one) for one in shared if local(one.tag) == 'si']
        targets = {}
        rels = zip_xml(archive, 'xl/_rels/workbook.xml.rels')
        if rels is not None:
            targets = {one.get('Id'): one.get('Target') for one in rels if local(one.tag) == 'Relationship'}
        parts = []
        workbook = zip_xml(archive, 'xl/workbook.xml')
        if workbook is not None:
            for index, node in enumerate((one for one in workbook.iter() if local(one.tag) == 'sheet'), 1):
                target = targets.get(node.get(rel_ns + 'id'))
                entry = f'xl/worksheets/sheet{index}.xml' if not target else target[1:] if target.startswith('/') else 'xl/' + target
                parts.append((node.get('name') or f'sheet{index}', entry))
        if not parts:
            for name in archive.namelist():
                found = re.match(r'^xl/worksheets/(sheet\d+)\.xml$', name)
                if found:
                    parts.append((found.group(1), name))
        for name, entry in parts:
            sheet = {'name': name, 'cells': {}, 'max_row': 0, 'max_col': 0, 'rows': 0}
            sheets.append(sheet)
            document = zip_xml(archive, entry)
            if document is None:
                continue
            data = document.find(ns + 'sheetData')
            row_index = 0
            for row in (data if data is not None else []):
                if local(row.tag) != 'row':
                    continue
                row_index = int(row.get('r')) if row.get('r') else row_index + 1
                sheet['rows'] = row_index
                if row_index > ROW_CAP:
                    continue
                column = 0
                for cell in row:
                    if local(cell.tag) != 'c':
                        continue
                    ref = re.match(r'^([A-Za-z]+)\d+$', cell.get('r') or '')
                    column = column_index(ref.group(1)) if ref else column + 1
                    v = cell.find(ns + 'v')
                    kind = cell.get('t')
                    value = None
                    if kind == 's':
                        if v is not None and v.text and int(v.text) < len(strings):
                            value = strings[int(v.text)]
                    elif kind == 'inlineStr':
                        inline = cell.find(ns + 'is')
                        value = cell_text(inline) if inline is not None else None
                    elif kind == 'b':
                        value = None if v is None else 'TRUE' if v.text == '1' else 'FALSE'
                    elif v is not None:
                        value = v.text or ''
                    if value is None or value == '':
                        continue
                    sheet['cells'].setdefault(row_index, {})[column] = value
                    sheet['max_row'] = max(sheet['max_row'], row_index)
                    sheet['max_col'] = max(sheet['max_col'], column)
    return sheets


def sheets_text(sheets):
    """The sheets as text for Copiar: each sheet's name, then its rows with the cells apart by tabs."""
    out = []
    for sheet in sheets:
        if len(sheets) > 1:
            out.append(sheet['name'])
        for row in range(1, sheet['max_row'] + 1):
            cells = sheet['cells'].get(row, {})
            out.append('\t'.join(cells.get(column, '') for column in range(1, sheet['max_col'] + 1)))
        if len(sheets) > 1:
            out.append('')
    return '\n'.join(out) + '\n'


def tabs_html(names):
    return '<div class="tabs">' + ''.join(
        f'<span class="tab{" on" if index == 0 else ""}" id="t{index}" data-tab="{index}">{escape(name)}</span>' for index, name in enumerate(names)) + '</div>'


def cell_html(value):
    if value is None or value == '':
        return '<td></td>'
    if NUMBER.match(value):
        return f'<td class="n">{value}</td>'
    if re.match(r'^<blob \d+ bytes>$', value):
        return f'<td class="alt">{escape(value)}</td>'
    return f'<td title="{escape(value)}">{escape(value)}</td>'


def sheets_page(sheets):
    """The sheets as a page: a tab each when they are several, the columns lettered and the rows numbered."""
    out = []
    tabbed = len(sheets) > 1
    if tabbed:
        out.append(tabs_html([sheet['name'] for sheet in sheets]))
    out.append(f'<div class="sheets{" tabbed" if tabbed else ""}">')
    for index, sheet in enumerate(sheets):
        out.append(f'<div class="sheet" id="s{index}"{HIDDEN if index else ""}>')
        if not tabbed:
            out.append('<p class="note">' + escape(sheet['name']) + '</p>')
        if sheet['max_row'] == 0:
            out.append('<p class="note">(hoja vacía)</p></div>')
            continue
        columns = min(sheet['max_col'], COLUMN_CAP)
        out.append('<table class="grid"><tr><th></th>' + ''.join(f'<th>{column_name(column)}</th>' for column in range(1, columns + 1)) + '</tr>')
        for row in range(1, sheet['max_row'] + 1):
            cells = sheet['cells'].get(row, {})
            out.append(f'<tr><th>{row}</th>' + ''.join(cell_html(cells.get(column)) for column in range(1, columns + 1)) + '</tr>')
        out.append('</table>')
        if sheet['rows'] > ROW_CAP:
            out.append(f'<p class="note">Se muestran las primeras {ROW_CAP} filas de {sheet["rows"]}.</p>')
        if sheet['max_col'] > COLUMN_CAP:
            out.append(f'<p class="note">Se muestran las primeras {COLUMN_CAP} columnas de {sheet["max_col"]}.</p>')
        out.append('</div>')
    out.append('</div>')
    return new_page(''.join(out), SHEET_CSS)


# ---- Databases ------------------------------------------------------------------------------------------

def table_text(table):
    """A table's text for Copiar: the column names, then the rows, the cells apart by tabs."""
    return '\n'.join(['\t'.join(table.get('columns') or [])] + ['\t'.join(str(value) for value in row) for row in table.get('rows') or []]) + '\n'


def tables_page(tables):
    """A database's tables as a page, as the spreadsheets are drawn: a tab each, the rows numbered."""
    out = []
    tabbed = len(tables) > 1
    if tabbed:
        out.append(tabs_html([table['name'] for table in tables]))
    out.append(f'<div class="sheets{" tabbed" if tabbed else ""}">')
    for index, table in enumerate(tables):
        rows = table.get('rows') or []
        out.append(f'<div class="sheet" id="s{index}"{HIDDEN if index else ""}>')
        count = int(table.get('count') or 0)
        about = escape(table['name']) + (' &middot; vista &middot; ' if table.get('type') == 'view' else ' &middot; tabla &middot; ') + thousands(count) + (' fila' if count == 1 else ' filas')
        if count > len(rows):
            about += f' &middot; se muestran las primeras {len(rows)}'
        out.append(f'<p class="note">{about}</p>')
        if table.get('error'):
            out.append('<p class="note">No se pudo leer: ' + escape(table['error']) + '</p></div>')
            continue
        out.append('<table class="grid"><tr><th></th>' + ''.join(f'<th>{escape(column)}</th>' for column in table.get('columns') or []) + '</tr>')
        for number, row in enumerate(rows, 1):
            out.append(f'<tr><th>{number}</th>' + ''.join(cell_html(str(value)) for value in row) + '</tr>')
        out.append('</table>')
        if not rows:
            out.append('<p class="note">(sin filas)</p>')
        out.append('</div>')
    out.append('</div>')
    return new_page(''.join(out), SHEET_CSS)


# ---- Zip archives ---------------------------------------------------------------------------------------

def read_zip(path):
    """What a zip holds, in tree order: its rows, and how many files, folders and bytes."""
    by_path = {}
    files = total = packed = encrypted = 0
    with zipfile.ZipFile(path) as archive:
        for entry in archive.infolist():
            name = entry.filename.replace('\\', '/')
            is_folder = name.endswith('/')
            if not is_folder:
                files += 1
                total += entry.file_size
                packed += entry.compress_size
                encrypted += 1 if entry.flag_bits & 1 else 0
            try:
                date = datetime.datetime(*entry.date_time).strftime('%Y-%m-%d %H:%M')
            except (ValueError, TypeError):
                date = ''
            by_path[name] = {'path': name, 'folder': is_folder, 'size': entry.file_size, 'packed': entry.compress_size, 'date': date}
            cut = name.rstrip('/').rfind('/')
            while cut > 0:
                parent = name[:cut + 1]
                if parent in by_path:
                    break
                by_path[parent] = {'path': parent, 'folder': True, 'size': 0, 'packed': 0, 'date': ''}
                cut = parent.rstrip('/').rfind('/')
    # Tree order: a folder's rows right after it, as '/' sorts before any other character.
    rows = sorted(by_path.values(), key=lambda row: row['path'].lower().replace('/', '\x01'))
    return {'rows': rows, 'files': files, 'folders': sum(1 for row in rows if row['folder']), 'total': total, 'packed': packed, 'encrypted': encrypted}


def zip_page(listing):
    files, folders = listing['files'], listing['folders']
    about = f'{thousands(files)} {"archivo" if files == 1 else "archivos"}, {thousands(folders)} {"carpeta" if folders == 1 else "carpetas"}'
    about += f' &middot; {short_size(listing["total"])} en total &middot; {short_size(listing["packed"])} comprimido'
    out = ['<div class="sheets"><p class="note">' + about + '</p>']
    if listing['encrypted']:
        out.append(f'<p class="note" style="color:#ffd43b">Cifrado con contraseña: {listing["encrypted"]} de {files} archivos. Se ve la lista, no su contenido.</p>')
    if not listing['rows']:
        out.append('<p class="note">(ZIP vacío)</p></div>')
        return new_page(''.join(out), SHEET_CSS)
    out.append('<table class="grid"><tr><th style="text-align:left">Nombre</th><th>Tamaño</th><th>Comprimido</th><th>Fecha</th></tr>')
    for row in listing['rows'][:ZIP_ROW_CAP]:
        trimmed = row['path'].rstrip('/')
        depth = trimmed.count('/')
        style = f'padding-left:{8 + 18 * depth}px' + (';color:#74c0fc' if row['folder'] else '')
        out.append(f'<tr><td style="{style}" title="{escape(row["path"])}">{escape(trimmed.rsplit("/", 1)[-1])}{"/" if row["folder"] else ""}</td>')
        out.append('<td></td><td></td>' if row['folder'] else f'<td class="n">{short_size(row["size"])}</td><td class="n">{short_size(row["packed"])}</td>')
        out.append(f'<td>{row["date"]}</td></tr>')
    out.append('</table>')
    if len(listing['rows']) > ZIP_ROW_CAP:
        out.append(f'<p class="note">Se muestran las primeras {thousands(ZIP_ROW_CAP)} entradas de {thousands(len(listing["rows"]))}.</p>')
    out.append('</div>')
    return new_page(''.join(out), SHEET_CSS)


def zip_text(listing):
    """The rows shown, for Copiar: the full path, the sizes in bytes and the date, apart by tabs."""
    out = ['Nombre\tTamaño\tComprimido\tFecha']
    for row in listing['rows'][:ZIP_ROW_CAP]:
        sizes = '\t' if row['folder'] else f'{row["size"]}\t{row["packed"]}'
        out.append(f'{row["path"]}\t{sizes}\t{row["date"]}')
    return '\n'.join(out) + '\n'


def zip_fit(listing, room_width, room_height):
    """A short zip gets a popup sized to its rows."""
    rows = listing['rows'][:ZIP_ROW_CAP]
    longest = max((len(row['path'].rstrip('/').rsplit('/', 1)[-1]) + 1 + 2 * row['path'].rstrip('/').count('/') for row in rows), default=0)
    return int(min(room_width, max(640, 8 * longest + 420))), int(min(room_height, max(220, 23 * len(rows) + 120)))


# ---- Word documents -------------------------------------------------------------------------------------

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
R_EMBED = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed'


def word_toggle(properties, name):
    node = properties.find(W + name) if properties is not None else None
    return node is not None and node.get(W + 'val') not in ('0', 'false', 'none')


def word_paragraph(paragraph, styles):
    properties = paragraph.find(W + 'pPr')
    style_node = properties.find(W + 'pStyle') if properties is not None else None
    style_id = style_node.get(W + 'val') if style_node is not None else ''
    style = styles.get(style_id) or (style_id or '').lower()
    tag = 'p'
    heading = re.match(r'^heading\s*([1-6])$', style)
    if heading:
        tag = 'h' + heading.group(1)
    elif style == 'title':
        tag = 'h1'
    elif style == 'subtitle':
        tag = 'h3'
    elif (properties is not None and properties.find(W + 'numPr') is not None) or style.startswith('list'):
        tag = 'li'
    deleted = {id(run) for gone in paragraph.iter(W + 'del') for run in gone.iter(W + 'r')}
    out = []
    for run in paragraph.iter(W + 'r'):
        if id(run) in deleted:
            continue
        text = []
        for child in run:
            name = local(child.tag)
            if name == 't':
                text.append(html.escape(child.text or ''))
            elif name == 'tab':
                text.append('&emsp;')
            elif name in ('br', 'cr'):
                text.append('<br>')
            elif name == 'noBreakHyphen':
                text.append('-')
            elif name in ('drawing', 'pict'):
                text.append(word_picture(child, styles))
        if not text:
            continue
        piece = ''.join(text)
        run_properties = run.find(W + 'rPr')
        for mark, wrap in (('b', 'b'), ('i', 'i'), ('u', 'u'), ('strike', 's')):
            if word_toggle(run_properties, mark):
                piece = f'<{wrap}>{piece}</{wrap}>'
        out.append(piece)
    return tag, ''.join(out) or '&nbsp;'


def word_picture(drawing, styles):
    """A picture in a document: itself, at the size the document gives it, where its bytes were read (the
    pages); else its place, named."""
    blip = next((one for one in drawing.iter() if local(one.tag) == 'blip'), None)
    source = styles.get(('picture', blip.get(R_EMBED))) if blip is not None else None
    if not source:
        return '<span class="alt">[imagen]</span>'
    extent = next((one for one in drawing.iter() if local(one.tag) == 'extent'), None)
    size = ''
    if extent is not None and extent.get('cx') and extent.get('cy'):
        size = f' width="{round(int(extent.get("cx")) / 9525)}" height="{round(int(extent.get("cy")) / 9525)}"'
    return f'<img alt=""{size} src="{source}">'


def word_blocks(parent, styles):
    out = []
    in_list = False
    for node in parent:
        name = local(node.tag)
        if in_list and name != 'p':
            out.append('</ul>'); in_list = False
        if name == 'sdt':
            inner = node.find(W + 'sdtContent')
            if inner is not None:
                out.append(word_blocks(inner, styles))
            continue
        if name == 'tbl':
            out.append('<table>')
            for row in node.findall(W + 'tr'):
                out.append('<tr>')
                for cell in row.findall(W + 'tc'):
                    span = cell.find(W + 'tcPr/' + W + 'gridSpan')
                    colspan = f' colspan="{escape(span.get(W + "val"))}"' if span is not None else ''
                    out.append(f'<td{colspan}>' + word_blocks(cell, styles) + '</td>')
                out.append('</tr>')
            out.append('</table>')
            continue
        if name != 'p':
            continue
        tag, body = word_paragraph(node, styles)
        if tag == 'li':
            if not in_list:
                out.append('<ul>'); in_list = True
            out.append(f'<li>{body}</li>')
        else:
            if in_list:
                out.append('</ul>'); in_list = False
            out.append(f'<{tag}>{body}</{tag}>\n')
    if in_list:
        out.append('</ul>')
    return ''.join(out)


def word_text(parent):
    """A docx's text as Copiar takes it: a line to a paragraph, a tab between a table's cells and a line to its row."""
    out = []
    for node in parent:
        name = local(node.tag)
        if name == 'p':
            for piece in node.iter():
                kind = local(piece.tag)
                if kind == 't':
                    out.append(piece.text or '')
                elif kind == 'tab':
                    out.append('\t')
                elif kind in ('br', 'cr'):
                    out.append('\n')
            out.append('\n')
        elif name == 'tbl':
            for row in node.findall(W + 'tr'):
                out.append('\t'.join(word_text(cell).strip().replace('\n', ' ') for cell in row.findall(W + 'tc')) + '\n')
        elif name in ('sdt', 'sdtContent', 'customXml', 'smartTag'):
            out.append(word_text(node))
    return ''.join(out)


def docx_paper(path):
    """A Word document's paper, in points: (width, height, left, right, top, bottom); Letter with an inch of
    margin when it does not say."""
    paper = [612.0, 792.0, 72.0, 72.0, 72.0, 72.0]
    try:
        with zipfile.ZipFile(path) as archive:
            document = zip_xml(archive, 'word/document.xml')
        section = next((one for one in document.iter(W + 'sectPr')), None) if document is not None else None
        size = section.find(W + 'pgSz') if section is not None else None
        margin = section.find(W + 'pgMar') if section is not None else None
        if size is not None:
            paper[0], paper[1] = int(size.get(W + 'w')) / 20, int(size.get(W + 'h')) / 20
        if margin is not None:
            paper[2:] = [int(margin.get(W + name)) / 20 for name in ('left', 'right', 'top', 'bottom')]
    except (TypeError, ValueError, KeyError, OSError, zipfile.BadZipFile):
        pass
    return tuple(paper)


def read_docx(path, pictures=False):
    """A Word document as (the page's body, its text for Copiar). With `pictures`, its pictures are in the
    body as they are; without, each is named in its place."""
    with zipfile.ZipFile(path) as archive:
        document = zip_xml(archive, 'word/document.xml')
        if document is None:
            raise ValueError('word/document.xml no existe')
        styles = {}
        relations = zip_xml(archive, 'word/_rels/document.xml.rels') if pictures else None
        for one in (relations if relations is not None else []):
            target = (one.get('Target') or '').lstrip('/')
            member = target if target.startswith('word/') else 'word/' + target
            kind = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif'}.get(os.path.splitext(member)[1].lower())
            if kind and member in archive.namelist() and archive.getinfo(member).file_size <= 8 * 1024 * 1024:
                styles[('picture', one.get('Id'))] = f'data:{kind};base64,' + base64.b64encode(archive.read(member)).decode('ascii')
        sheet = zip_xml(archive, 'word/styles.xml')
        if sheet is not None:
            for style in sheet:
                name = style.find(W + 'name') if local(style.tag) == 'style' else None
                if name is not None:
                    styles[style.get(W + 'styleId')] = (name.get(W + 'val') or '').lower()
    body = document.find(W + 'body')
    if body is None:
        return '', ''
    return word_blocks(body, styles), word_text(body).rstrip()


def docx_page(body):
    return new_page(body, DOCUMENT_CSS)
