"""Office's old files (doc, xls, ppt) read with no Office, for the Windows popup where it is not installed.

    legacy_office.py <file> <copy>

A .doc is written as a .docx and an .xls as an .xlsx at <copy>, which the popup then draws as it draws those.
It exits 0 once the copy is there; otherwise it says why on stderr and exits 1. A .ppt has no copy: read_ppt
gives its slides as view_slides gives a .pptx's, for office_pages.py to lay out.

The readers are the setup's: msdoc2docx for a .doc, xlrd for an .xls and sharepoint-to-text for a .ppt. Of a
.ppt only the words are read, a slide's title and its lines: its drawing is not.
"""
import datetime
import html
import os
import re
import sys
import zipfile

MISSING = 'Falta el lector de archivos viejos de Office: instalalo desde ⚙ → Instalación.'
# An old presentation's slide: 4:3, as those were.
SLIDE_WIDTH, SLIDE_HEIGHT = 960, 720
SLIDE_STYLE = (
    f'background:#fff;color:#212529;width:{SLIDE_WIDTH}px;height:{SLIDE_HEIGHT}px;box-sizing:border-box;padding:56px 64px;'
    "overflow:hidden;position:relative;font:26px Calibri,Carlito,'Helvetica Neue',Arial,sans-serif")


def doc_to_docx(path, target):
    """A .doc as a .docx: its text with its headings, its bold and its tables."""
    import doc2docx
    doc2docx.convert(path, target)
    name_headings(target)


def name_headings(target):
    """The heading styles under the names a .docx has for them, `heading 1` to `heading 6`: the copy keeps the
    names of the language the document was written in (Título 1), and the popup tells a heading by its name.
    A heading is told by its level in the outline, whatever it is called."""
    with zipfile.ZipFile(target) as archive:
        parts = {name: archive.read(name) for name in archive.namelist()}
    if 'word/styles.xml' not in parts:
        return

    def named(found):
        style = found.group(0)
        level = re.search(r'<w:outlineLvl w:val="([0-5])"', style)
        return re.sub(r'<w:name w:val="[^"]*"', f'<w:name w:val="heading {int(level.group(1)) + 1}"', style, count=1) if level else style

    styles = parts['word/styles.xml'].decode('utf-8')
    parts['word/styles.xml'] = re.sub(r'<w:style\b[^>]*w:type="paragraph"[^>]*>.*?</w:style>', named, styles, flags=re.S).encode('utf-8')
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, data in parts.items():
            archive.writestr(name, data)


def cell_text(book, cell):
    """A cell as the sheet shows it: a date as a date, a whole number with no decimals, a truth as Excel says it."""
    import xlrd
    if cell.ctype == xlrd.XL_CELL_DATE:
        try:
            moment = xlrd.xldate_as_datetime(cell.value, book.datemode)
        except Exception:
            return str(cell.value)
        if cell.value < 1:
            return moment.strftime('%H:%M:%S')
        return moment.strftime('%Y-%m-%d') if moment.time() == datetime.time() else moment.strftime('%Y-%m-%d %H:%M:%S')
    if cell.ctype == xlrd.XL_CELL_BOOLEAN:
        return 'TRUE' if cell.value else 'FALSE'
    if cell.ctype == xlrd.XL_CELL_ERROR:
        return xlrd.error_text_from_code.get(cell.value, '#ERROR')
    if cell.ctype == xlrd.XL_CELL_NUMBER:
        return str(int(cell.value)) if cell.value == int(cell.value) and abs(cell.value) < 1e15 else repr(cell.value)
    return str(cell.value)


def xls_to_xlsx(path, target):
    """An .xls as an .xlsx: its sheets by their names, each cell with the text it shows."""
    import openpyxl
    import xlrd
    book = xlrd.open_workbook(path)
    copy = openpyxl.Workbook(write_only=True)
    for sheet in book.sheets():
        # A name Excel would refuse (too long, a character it has no place for) is cut to one it takes.
        page = copy.create_sheet(title=''.join(one for one in sheet.name if one not in '[]:*?/\\')[:31] or 'Hoja')
        for row in range(sheet.nrows):
            page.append([cell_text(book, cell) if cell.ctype not in (xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_BLANK) else None for cell in sheet.row(row)])
    if not book.nsheets:
        copy.create_sheet(title='Hoja')
    copy.save(target)


def read_ppt(path):
    """A .ppt's slides as view_slides.read_pptx gives a .pptx's: their size, a page of HTML each, and their text."""
    import sharepoint2text
    slides, texts = [], []
    for found in sharepoint2text.read_file(path):
        for unit in found.units:
            title = (getattr(unit, 'title', '') or '').strip()
            lines = [line.strip() for line in (getattr(unit, 'text', '') or '').splitlines() if line.strip()]
            heading = f'<div style="font-size:40px;font-weight:bold;margin:0 0 28px">{html.escape(title)}</div>' if title else ''
            points = ''.join(f'<li style="margin:0 0 12px">{html.escape(line)}</li>' for line in lines)
            body = f'<ul style="margin:0;padding-left:30px">{points}</ul>' if points else ''
            note = '<div style="position:absolute;left:64px;bottom:18px;font-size:14px;color:#868e96">.ppt sin PowerPoint: solo el texto de la diapositiva</div>'
            slides.append(f'<div style="{SLIDE_STYLE}">{heading}{body}{note}</div>')
            texts.append('\n'.join(([title] if title else []) + lines))
    return {'width': SLIDE_WIDTH, 'height': SLIDE_HEIGHT, 'slides': slides, 'text': '\n\n'.join(texts), 'members': []}


def main():
    if len(sys.argv) < 3:
        sys.stderr.write('legacy_office.py <file> <copy>')
        return 1
    path, target = sys.argv[1], sys.argv[2]
    if os.path.splitext(path)[1].lower() == '.xls':
        xls_to_xlsx(path, target)
    else:
        doc_to_docx(path, target)
    if not os.path.exists(target) or os.path.getsize(target) == 0:
        sys.stderr.write('la copia no se escribió')
        return 1
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except ImportError:
        sys.stderr.buffer.write(MISSING.encode('utf-8'))
        sys.exit(1)
    except Exception as error:
        sys.stderr.buffer.write(str(error).encode('utf-8'))
        sys.exit(1)
