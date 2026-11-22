"""Prints a PDF's text, page by page, for the viewer's Texto view: view_file.ps1 runs it.

Usage: pdf_text.py <file.pdf>

Each page's text under a `--- Página N ---` line, in UTF-8; a page with no text layer (a scan) says so.
pdfminer.six places the words by their positions, so a PDF that draws each word apart (as a browser's
print does) keeps its spaces. Exit code 2 and one line on stderr when pdfminer.six is missing; 1 when the
file cannot be read.
"""

import logging
import sys


def main():
    sys.stdout.reconfigure(encoding='utf-8', newline='\n')
    # A font it reads in part is a warning of pdfminer's, not a failure: the text still comes.
    logging.getLogger('pdfminer').setLevel(logging.ERROR)
    try:
        from pdfminer.high_level import extract_pages
        from pdfminer.layout import LTTextContainer
    except ImportError:
        print('missing pdfminer.six', file=sys.stderr)
        sys.exit(2)
    try:
        for number, page in enumerate(extract_pages(sys.argv[1]), start=1):
            text = ''.join(element.get_text() for element in page if isinstance(element, LTTextContainer)).strip()
            print(f'--- Página {number} ---')
            print(text if text else '(esta página no tiene texto: es una imagen)')
            print()
    except Exception as error:  # noqa: BLE001 - any failure is told to the viewer as text
        print(f'{type(error).__name__}: {error}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
