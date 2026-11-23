"""A Word document or a presentation as a PDF of its pages, for the Windows popup where Office is not
installed: view_file.ps1 then draws that PDF as it draws any other, under the same bar.

    office_pages.py <file> <pdf> <browser>

The file is read by the popup's own readers (view_readers for a .docx, view_slides for a .pptx) and written
as a page of HTML on its paper beside <pdf>; <browser> (Edge, or any Chromium), with no window, prints it to
<pdf>. It exits 0 once the PDF is there; otherwise it says why on stderr and exits 1.
"""
import os
import pathlib
import subprocess
import sys
import zipfile

import view_readers as readers
import view_slides as slides

# A document's look on paper, as view_file.py lays it out on a Mac.
DOCUMENT_STYLE = (
    "body { font: 11pt Calibri, Carlito, 'Helvetica Neue', Arial, sans-serif; color: #000; margin: 0; } p { margin: 0 0 8pt; }"
    ' h1 { font-size: 20pt; margin: 14pt 0 6pt; } h2 { font-size: 16pt; margin: 12pt 0 6pt; } h3 { font-size: 13pt; margin: 10pt 0 4pt; }'
    ' h4, h5, h6 { font-size: 11pt; margin: 8pt 0 4pt; } table { border-collapse: collapse; width: 100%; }'
    ' td { border: 1px solid #888; padding: 3pt 6pt; vertical-align: top; } img { max-width: 100%; height: auto; } .alt { color: #868e96; }'
)
EXACT_COLORS = '* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }'


def document_page(path):
    """A .docx as a page of HTML on its own paper, with its margins."""
    body, _ = readers.read_docx(path, True)
    width, height, left, right, top, bottom = readers.docx_paper(path)
    paper = f'@page {{ size: {width}pt {height}pt; margin: {top}pt {right}pt {bottom}pt {left}pt; }}'
    return f'<!DOCTYPE html><html><head><meta charset="utf-8"><style>{paper} {EXACT_COLORS} {DOCUMENT_STYLE}</style></head><body>{body}</body></html>'


def slides_page(path, folder):
    """A .pptx as a page of HTML, a slide a sheet of its size; its pictures are put beside it, under `zip`."""
    deck = slides.read_pptx(path)
    width, height = deck['width'], deck['height']
    with zipfile.ZipFile(path) as archive:
        for member in deck['members']:
            target = os.path.normpath(os.path.join(folder, 'zip', member))
            # A picture stays under the folder, whatever its path in the file says.
            if not target.startswith(os.path.join(folder, 'zip') + os.sep):
                continue
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, 'wb') as out:
                out.write(archive.read(member))
    paper = f'@page {{ size: {width}px {height}px; margin: 0; }} body {{ margin: 0; }}'
    sheet = f'.sheet {{ width: {width}px; height: {height}px; overflow: hidden; position: relative; page-break-after: always; break-after: page; }}'
    sheets = ''.join(f'<div class="sheet">{one}</div>' for one in deck['slides'])
    return f'<!DOCTYPE html><html><head><meta charset="utf-8"><style>{paper} {EXACT_COLORS} {sheet}</style></head><body>{sheets}</body></html>'


def main():
    if len(sys.argv) < 4:
        sys.stderr.write('office_pages.py <file> <pdf> <browser>')
        return 1
    path, pdf, browser = sys.argv[1], os.path.abspath(sys.argv[2]), sys.argv[3]
    folder = os.path.dirname(pdf)
    is_slides = os.path.splitext(path)[1].lower() in ('.pptx', '.pptm', '.ppsx', '.potx')
    page = slides_page(path, folder) if is_slides else document_page(path)
    source = os.path.join(folder, 'pages.html')
    with open(source, 'w', encoding='utf-8') as out:
        out.write(page)
    # A profile of its own: with the person's browser open, one started on their profile hands the page to
    # that one and ends with nothing printed.
    printed = subprocess.run(
        [browser, '--headless', '--disable-gpu', '--no-first-run', '--disable-extensions', '--no-pdf-header-footer',
         f'--user-data-dir={os.path.join(folder, "profile")}', f'--print-to-pdf={pdf}', pathlib.Path(source).as_uri()],
        capture_output=True, timeout=90, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if not os.path.exists(pdf) or os.path.getsize(pdf) == 0:
        sys.stderr.write('el navegador no escribió el PDF: ' + printed.stderr.decode('utf-8', 'replace').strip()[-300:])
        return 1
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        sys.stderr.write(str(error))
        sys.exit(1)
