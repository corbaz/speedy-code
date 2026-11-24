"""One file in a popup on macOS, as view_file.ps1 shows it on Windows: the file named by SPEEDY_FILE.

The popup stands in the middle of the screen the pointer is on, framed as the others are, the file's name in
the middle of the top line, the move mark and the close mark at its right, with Copiar beside them when
there is something to copy. What it holds depends on the file, as on Windows: an image; a PDF's pages, with a
bar to go to a page and to zoom, and its text; Markdown, HTML and SVG drawn as a page, with a switch to their
source; a spreadsheet's sheets; a Word document's pages and a presentation's slides, under the bar a PDF has;
audio and video, with a dark bar to pause, seek and set the
volume; a SQLite database's tables; a zip's listing; any other file that reads as text; and for anything else
what can be told about it. A minified file also gets its text laid out by pretty.py, as Formateado.

It says `shown` once it is up, then `.` every tenth of a second, so the mod wakes to end it; with no one
reading, the write fails and it closes. Copiar says `copied <base64 of the UTF-8 text>` for a text and
`attach <base64 of the path>` for a picture; a sound says `media playing`, `media paused` and `media ended`,
and obeys SPEEDY_CONTROL, a file that says `pause` or `play`. SPEEDY_VIEW names the view it opens on.

The page (view_file.html) and what it shows come from a server of this popup's own, on this machine only and
under a path made for this run: a page reads a picture, a sound or a PDF's page by an address, as any page does.

Exits 3 with nothing printed when pywebview is missing: the mod then shows the file with Quick Look.
"""
import base64
import datetime
import http.server
import json
import mimetypes
import os
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import zipfile

import popup
import view_readers as readers
import view_slides as slides

# The frame's widths, as view_file.ps1 has them. The bottom line carries Copiar and the close mark as the top
# one does, so it gets the same band.
CONTOUR, LINE, MARGIN, BAND = 24, 2, 12, 16
EXTRA_WIDTH = 2 * (CONTOUR + LINE + MARGIN)
EXTRA_HEIGHT = 2 * (CONTOUR + LINE) + 2 * BAND
TOOLBAR_HEIGHT = 34
# What it exits with for a file it has no reader for: the mod then shows it with Quick Look, as when pywebview is missing.
NO_READER = 4
MEDIA_BAR = 40
PDF_GAP = 10
# A text view's letter and line, in points: Menlo at the size Consolas 11 has on Windows.
LETTER, TEXT_LINE = 8.84, 19


def text_view(name, text, wrap):
    return {'name': name, 'type': 'text', 'text': text.replace('\r\n', '\n'), 'wrap': wrap}


def text_fit(views, room):
    """A popup of text alone is as tall and as wide as its text asks, up to the room: a short file opens small."""
    if not views or any(view['type'] != 'text' for view in views):
        return None
    lines = longest = 1
    for view in views:
        rows = view['text'].split('\n')
        lines = max(lines, len(rows))
        longest = max(longest, max(map(len, rows)))
    return int(min(room[0], max(480, longest * LETTER + 48))), int(min(room[1], max(140, lines * TEXT_LINE + 40)))


class NoPopup(Exception):
    """A file this popup has no reader for, which Quick Look draws (an old .ppt, an .xls)."""


class Popup:
    """What the popup shows of one file, and the page's side of it: what view_file.html asks and says."""

    def __init__(self, path, room):
        self._path = path
        self._room = room
        self._folder = os.path.dirname(path)
        self._token = secrets.token_urlsafe(16)
        self._pages = {}
        self._pdf = None
        self._members = set()
        self._pdf_lock = threading.Lock()
        self._jobs = []
        self._scratch = None
        self._window = None
        self._doc = self._read()

    # ---- What the file is -------------------------------------------------------------------------------

    def _read(self):
        path, room = self._path, self._room
        name = os.path.basename(path)
        doc = {'name': name, 'kind': 'text', 'views': [], 'raw': None, 'copy': True, 'room': list(room), 'tables': None, 'pdfText': None}
        inner = None
        data = b''
        try:
            kind = readers.kind_of(path, readers.read_bytes(path, 16))
            doc['kind'] = kind
            if kind == 'sqlite':
                # db_view.py reads it while the popup stands; its tables are drawn when it is through.
                self._pages['page'] = readers.message_page('Leyendo la base de datos...')
                doc['views'].append({'name': 'Page', 'type': 'page', 'page': 'page'})
                self._jobs.append(self._read_database)
            elif kind == 'zip':
                try:
                    listing = readers.read_zip(path)
                    self._pages['page'] = readers.zip_page(listing)
                    doc['raw'] = readers.zip_text(listing)
                    inner = readers.zip_fit(listing, *room)
                except Exception as error:
                    size = readers.format_size(os.path.getsize(path))
                    self._pages['page'] = readers.message_page(
                        'No se pudo leer este ZIP: está dañado, incompleto o no es un ZIP.<br><br>' + readers.escape(error) + '<br><br>' + readers.escape(name) + ' &middot; ' + readers.escape(size))
                    inner = (min(room[0], 640), 220)
                doc['views'].append({'name': 'Page', 'type': 'page', 'page': 'page'})
            elif kind == 'image':
                width, height = self._image_size()
                scale = min(1.0, room[0] / width, room[1] / height)
                doc['views'].append({'name': 'Image', 'type': 'image'})
                inner = (round(width * scale), round(height * scale))
            elif kind == 'pdf':
                # Texto: the PDF's text, selectable and copied by Copiar, read by pdf_text.py while the pages are drawn.
                inner = self._paged(doc, 'PDF', self._open_pdf(path), 'Leyendo el texto del PDF...')
                self._jobs.append(self._read_pdf_text)
            elif kind == 'pptx':
                # A presentation's slides, a page each, under the bar a PDF has: its pages and its zoom.
                deck = slides.read_pptx(path)
                self._members = deck['members']
                pages = [[deck['width'], deck['height']] for _ in deck['slides']] or [[deck['width'], deck['height']]]
                inner = self._paged(doc, 'Diapositivas', pages, deck['text'], deck['slides'] or ['<div style="background:#fff;width:100%;height:100%"></div>'])
                doc['pdfText'] = deck['text']
            elif kind in ('ppt', 'xls'):
                # No reader of its own here: Quick Look draws it, as the mod falls back to when the popup ends so.
                raise NoPopup(kind)
            elif kind in ('audio', 'video'):
                doc['copy'] = False
                extension = os.path.splitext(name)[1].lstrip('.').upper()
                about = f'Audio {extension}  -  {readers.format_size(os.path.getsize(path))}'
                doc['views'].append({'name': 'Media', 'type': 'media', 'video': kind == 'video', 'about': about})
                inner = (min(640, room[0]), min(360 + MEDIA_BAR, room[1])) if kind == 'video' else (620, 90)
            else:
                data = readers.read_bytes(path)
                text = None
                if kind in ('text', 'markdown', 'html', 'svg', 'url'):
                    text = readers.read_text(data)
                    if text is None:
                        kind = doc['kind'] = 'binary'
                    else:
                        text = text.lstrip('﻿')
                        if len(data) > readers.TEXT_LIMIT:
                            text += '\n\n[...] (the file goes on past 2 MB)'
                if kind == 'markdown':
                    # Markdown opens drawn as a page, the Preview; the switch shows its text, MD, and back.
                    self._pages['preview'] = readers.markdown_page(text)
                    doc['views'] += [{'name': 'Preview', 'type': 'page', 'page': 'preview', 'zoom': True}, text_view('MD', text, True)]
                    doc['raw'] = text
                elif kind == 'html':
                    doc['views'] += [{'name': 'Preview', 'type': 'page', 'file': True, 'zoom': True}, text_view('HTML', text, False)]
                    doc['raw'] = text
                    self._pretty('HTML', text, len(data))
                elif kind == 'svg':
                    self._pages['preview'] = readers.new_page(
                        f'<img src="../file" alt="">', 'html, body { height: 100%; margin: 0; background: #16181d; } body { display: flex; align-items: center; justify-content: center; } img { max-width: 100%; max-height: 100%; }')
                    doc['views'] += [{'name': 'Preview', 'type': 'page', 'page': 'preview', 'picture': True}, text_view('SVG', text, False)]
                    doc['raw'] = text
                    self._pretty('SVG', text, len(data))
                elif kind == 'xlsx':
                    sheets = readers.read_xlsx(path)
                    self._pages['page'] = readers.sheets_page(sheets)
                    doc['views'].append({'name': 'Page', 'type': 'page', 'page': 'page'})
                    doc['raw'] = readers.sheets_text(sheets)
                elif kind in ('docx', 'doc'):
                    try:
                        source = path if kind == 'docx' else self._doc_as_docx()
                    except Exception:
                        source = None
                    if source is None:
                        doc['views'].append(text_view('Text', 'Texto aproximado: no se pudo convertir este .doc, se muestran los textos legibles del archivo.\n\n' + readers.loose_text(data), True))
                    else:
                        try:
                            # The document laid out on its paper, page by page, shown as a PDF's pages are, with
                            # the same bar: its pages and its zoom.
                            body, raw = readers.read_docx(source, True)
                            inner = self._paged(doc, 'Documento', self._open_pdf(self._document_pdf(body, readers.docx_paper(source))), raw)
                            doc['pdfText'] = raw
                        except Exception:
                            # Where the pages cannot be made, the document as one page, with the zoom's bar.
                            body, doc['raw'] = readers.read_docx(source)
                            self._pages['page'] = readers.docx_page(body)
                            doc['views'] = [{'name': 'Page', 'type': 'page', 'page': 'page', 'zoom': True}]
                            inner = None
                elif kind == 'url':
                    doc['views'].append(text_view('Text', readers.url_info(path, text), False))
                elif kind == 'text':
                    doc['views'].append(text_view('Text', text, readers.is_prose(path)))
                    self._pretty('Text', text, len(data))
                if kind == 'binary':
                    doc['views'].append(text_view('Text', readers.binary_info(path, data), False))
        except NoPopup:
            raise
        except Exception as error:
            # Whatever goes wrong, the popup still comes up and says so.
            self._jobs.clear()
            if not data:
                try:
                    data = readers.read_bytes(path)
                except OSError:
                    data = b''
            doc['kind'] = 'binary'
            doc['copy'] = True
            doc['views'] = [text_view('Text', readers.binary_info(path, data, str(error)), False)]
            inner = room
        inner = text_fit(doc['views'], room) or inner or room
        # A bar above a view takes its height inside the frame, within the room.
        if any(view['type'] == 'pdf' or view.get('zoom') for view in doc['views']):
            inner = (inner[0], min(inner[1] + TOOLBAR_HEIGHT, max(inner[1], room[1])))
        doc['width'] = int(inner[0]) + EXTRA_WIDTH
        doc['height'] = int(inner[1]) + EXTRA_HEIGHT
        wanted = os.environ.get('SPEEDY_VIEW', '')
        doc['open'] = wanted if any(view['name'] == wanted for view in doc['views']) else doc['views'][0]['name']
        return doc

    def _image_size(self):
        import AppKit
        picture = AppKit.NSImageRep.imageRepWithContentsOfFile_(self._path)
        if picture is None or picture.pixelsWide() < 1 or picture.pixelsHigh() < 1:
            raise ValueError('no se pudo leer la imagen')
        return picture.pixelsWide(), picture.pixelsHigh()

    def _paged(self, doc, name, pages, text, drawn=None):
        """A view of pages one under the other, as a PDF's, and its text beside it as Texto. `drawn` holds each
        page as HTML (a slide); without it the pages are pictures the server draws. It gives the popup's size."""
        room = self._room
        # The pages fit the view's width at first, up to 1100 points wide.
        page_width = int(min(room[0] - 12 - 2 * PDF_GAP, 1100))
        view = {'name': name, 'type': 'pdf', 'pages': pages, 'zoom': page_width / max(page[0] for page in pages), 'gap': PDF_GAP}
        if drawn is not None:
            view['drawn'] = drawn
        doc['views'] += [view, text_view('Texto', text, True)]
        return page_width + 12 + 2 * PDF_GAP, room[1]

    def _document_pdf(self, body, paper):
        """A document's body (HTML) laid out on its paper by macOS's text system, a page a column of text, as a
        PDF in a folder of this popup's own. It gives the PDF's path."""
        import AppKit
        import Foundation
        import Quartz
        width, height, left, right, top, bottom = paper
        style = ("body { font: 11pt Calibri, Carlito, 'Helvetica Neue', Arial, sans-serif; color: #000; } p { margin: 0 0 8pt; }"
                 ' h1 { font-size: 20pt; margin: 14pt 0 6pt; } h2 { font-size: 16pt; margin: 12pt 0 6pt; } h3 { font-size: 13pt; margin: 10pt 0 4pt; }'
                 ' h4, h5, h6 { font-size: 11pt; margin: 8pt 0 4pt; } table { border-collapse: collapse; width: 100%; } td { border: 1px solid #888; padding: 3pt 6pt; vertical-align: top; }'
                 ' .alt { color: #868e96; }')
        page = f'<html><head><meta charset="utf-8"><style>{style}</style></head><body>{body}</body></html>'.encode('utf-8')
        text, _ = AppKit.NSAttributedString.alloc().initWithHTML_documentAttributes_(Foundation.NSData.dataWithBytes_length_(page, len(page)), None)
        if text is None or text.length() == 0:
            raise ValueError('el documento no tiene texto')
        if self._scratch is None:
            self._scratch = tempfile.mkdtemp(prefix='speedy-code-doc-')
        target = os.path.join(self._scratch, 'pages.pdf')
        storage = AppKit.NSTextStorage.alloc().initWithAttributedString_(text)
        layout = AppKit.NSLayoutManager.alloc().init()
        storage.addLayoutManager_(layout)
        box = Quartz.CGRectMake(0, 0, width, height)
        context = Quartz.CGPDFContextCreateWithURL(Foundation.NSURL.fileURLWithPath_(target), box, None)
        pages = 0
        while pages < 2000:
            container = AppKit.NSTextContainer.alloc().initWithSize_(Foundation.NSMakeSize(width - left - right, height - top - bottom))
            layout.addTextContainer_(container)
            glyphs = layout.glyphRangeForTextContainer_(container)
            if glyphs.length == 0 and pages > 0:
                break
            Quartz.CGPDFContextBeginPage(context, None)
            Quartz.CGContextSetRGBFillColor(context, 1, 1, 1, 1)
            Quartz.CGContextFillRect(context, box)
            Quartz.CGContextTranslateCTM(context, 0, height)
            Quartz.CGContextScaleCTM(context, 1, -1)
            AppKit.NSGraphicsContext.saveGraphicsState()
            AppKit.NSGraphicsContext.setCurrentContext_(AppKit.NSGraphicsContext.graphicsContextWithCGContext_flipped_(context, True))
            at = Foundation.NSMakePoint(left, top)
            layout.drawBackgroundForGlyphRange_atPoint_(glyphs, at)
            layout.drawGlyphsForGlyphRange_atPoint_(glyphs, at)
            AppKit.NSGraphicsContext.restoreGraphicsState()
            Quartz.CGPDFContextEndPage(context)
            pages += 1
            if glyphs.location + glyphs.length >= layout.numberOfGlyphs():
                break
        Quartz.CGPDFContextClose(context)
        return target

    def _open_pdf(self, path):
        """A PDF by macOS's own reader: each page's size in points, as it is shown (turned, when it is)."""
        import Foundation
        import Quartz
        document = Quartz.PDFDocument.alloc().initWithURL_(Foundation.NSURL.fileURLWithPath_(path))
        if document is None:
            raise ValueError('no se pudo abrir el PDF')
        if document.isLocked():
            raise ValueError('el PDF pide una contraseña')
        if document.pageCount() < 1:
            raise ValueError('el PDF no tiene páginas')
        self._pdf = document
        pages = []
        for index in range(document.pageCount()):
            page = document.pageAtIndex_(index)
            size = page.boundsForBox_(Quartz.kPDFDisplayBoxCropBox).size
            turned = page.rotation() % 180 != 0
            pages.append([size.height, size.width] if turned else [size.width, size.height])
        return pages

    def _pdf_png(self, index, width):
        """One page drawn `width` pixels wide, as a PNG."""
        import AppKit
        import Quartz
        with self._pdf_lock:
            page = self._pdf.pageAtIndex_(index)
            size = page.boundsForBox_(Quartz.kPDFDisplayBoxCropBox).size
            turned = page.rotation() % 180 != 0
            shown_width, shown_height = (size.height, size.width) if turned else (size.width, size.height)
            width = int(max(16, min(width, 4000)))
            scale = width / shown_width
            height = int(max(16, round(shown_height * scale)))
            space = Quartz.CGColorSpaceCreateDeviceRGB()
            context = Quartz.CGBitmapContextCreate(None, width, height, 8, 0, space, Quartz.kCGImageAlphaPremultipliedLast)
            Quartz.CGContextSetRGBFillColor(context, 1, 1, 1, 1)
            Quartz.CGContextFillRect(context, Quartz.CGRectMake(0, 0, width, height))
            Quartz.CGContextScaleCTM(context, scale, scale)
            page.drawWithBox_toContext_(Quartz.kPDFDisplayBoxCropBox, context)
            image = Quartz.CGBitmapContextCreateImage(context)
            picture = AppKit.NSBitmapImageRep.alloc().initWithCGImage_(image)
            return bytes(picture.representationUsingType_properties_(AppKit.NSBitmapImageFileTypePNG, None))

    def _doc_as_docx(self):
        """A .doc as a .docx in a folder of its own under the temporary one, by macOS's textutil: the popup then
        draws it as it draws those, as Word's copy is drawn on Windows."""
        self._scratch = tempfile.mkdtemp(prefix='speedy-code-doc-')
        target = os.path.join(self._scratch, 'copy.docx')
        subprocess.run(['textutil', '-convert', 'docx', '-output', target, self._path], check=True, capture_output=True, timeout=60)
        return target

    # ---- What is read while the popup stands ---------------------------------------------------------------

    def _run(self, script, timeout=120):
        return subprocess.run([sys.executable, os.path.join(popup.HERE, script), self._path], capture_output=True, timeout=timeout,
                              env={**os.environ, 'PYTHONIOENCODING': 'utf-8'})

    def _pretty(self, source, original, size):
        """pretty.py lays out a minified file while the popup stands; the file on disk is never touched. Once it
        answers with a layout that differs from the text, the popup gets Formateado, and the source is Original."""
        if size > 5 * 1024 * 1024:
            return

        def work():
            done = self._run('pretty.py')
            if done.returncode != 0:
                return
            laid = done.stdout.decode('utf-8', 'replace').replace('\r\n', '\n')
            if not laid.strip() or laid.rstrip() == original.replace('\r\n', '\n').rstrip():
                return
            self._news({'pretty': {'source': source, 'text': laid}})

        self._jobs.append(work)

    def _read_pdf_text(self):
        try:
            done = self._run('pdf_text.py')
            if done.returncode == 0:
                text = done.stdout.decode('utf-8', 'replace')
            else:
                text = 'No se pudo leer el texto del PDF: ' + done.stderr.decode('utf-8', 'replace').strip()
        except Exception as error:
            text = f'No se pudo leer el texto del PDF: {error}'
        self._news({'pdfText': text})

    def _read_database(self):
        try:
            done = self._run('db_view.py')
            if done.returncode != 0:
                page = readers.message_page('No se pudo abrir la base de datos: ' + readers.escape(done.stderr.decode('utf-8', 'replace').strip()))
                tables = None
            else:
                found = json.loads(done.stdout.decode('utf-8', 'replace')).get('tables') or []
                if found:
                    page = readers.tables_page(found)
                    tables = [readers.table_text(table) for table in found]
                else:
                    page, tables = readers.message_page('La base de datos no tiene tablas.'), None
        except Exception as error:
            page, tables = readers.message_page('No se pudo mostrar la base de datos: ' + readers.escape(error)), None
        self._pages['page'] = page
        self._news({'page': 'page', 'tables': tables})

    def _news(self, news):
        """Something read while the popup stands, handed to the page."""
        if self._window is not None:
            self._window.evaluate_js('news(' + json.dumps(news) + ')')

    def _watch_control(self):
        """The mod's own pause and play (SPEEDY_CONTROL, a file saying `pause` or `play`) drive the sound too:
        what it asks is done once, when it changes, so a pause pressed in the popup stands."""
        control = os.environ.get('SPEEDY_CONTROL')
        if not control or self._doc['kind'] not in ('audio', 'video'):
            return
        asked = 'play'
        while True:
            time.sleep(0.1)
            try:
                with open(control, encoding='utf-8') as file:
                    now = file.read().strip()
            except OSError:
                continue
            if now in ('pause', 'play') and now != asked:
                asked = now
                self._news({'control': now})

    def _dots(self):
        while True:
            time.sleep(0.1)
            popup.say('.')

    # ---- What the page asks and says ------------------------------------------------------------------------

    def asked(self):
        return self._doc

    def shown(self):
        popup.front()
        popup.say('shown')
        for work in [self._dots, self._watch_control] + self._jobs:
            threading.Thread(target=work, daemon=True).start()

    def copy_text(self, text):
        """Copiar took a text: on the clipboard, and said to the mod, for it to put it in the prompt."""
        import AppKit
        text = str(text or '').replace('\r\n', '\n')
        if not text:
            return False
        board = AppKit.NSPasteboard.generalPasteboard()
        board.clearContents()
        board.setString_forType_(text, AppKit.NSPasteboardTypeString)
        popup.say('copied ' + base64.b64encode(text.encode('utf-8')).decode('ascii'))
        return True

    def _copy_picture(self, path):
        import AppKit
        picture = AppKit.NSImage.alloc().initWithContentsOfFile_(path)
        if picture is not None:
            board = AppKit.NSPasteboard.generalPasteboard()
            board.clearContents()
            board.writeObjects_([picture])
        popup.say('attach ' + base64.b64encode(os.path.abspath(path).encode('utf-8')).decode('ascii'))
        return True

    def copy_image(self):
        """Copiar took the picture shown: on the clipboard, and its file said to the mod, to attach it."""
        return self._copy_picture(self._path)

    def copy_png(self, source):
        """An SVG's Preview as a picture, drawn by the page: saved as a PNG under the temporary folder's
        speedy-code/copies, put on the clipboard, and said to the mod to attach."""
        head, _, data = str(source).partition(',')
        if 'base64' not in head or not data:
            return False
        folder = os.path.join(tempfile.gettempdir(), 'speedy-code', 'copies')
        os.makedirs(folder, exist_ok=True)
        stem = os.path.splitext(os.path.basename(self._path))[0]
        target = os.path.join(folder, f'{stem}-{datetime.datetime.now():%y%m%d-%H%M%S}.png')
        with open(target, 'wb') as file:
            file.write(base64.b64decode(data))
        return self._copy_picture(target)

    def media(self, state):
        if state in ('playing', 'paused', 'ended'):
            popup.say('media ' + state)

    def resize(self, width, height):
        """The popup at another size, in the middle of its screen: a video once its own size is known, a text
        grown by its layout."""
        popup.resize(self._window, width, height)

    def cover(self, on):
        """The popup over its whole screen while a presentation is played, and back as it was."""
        popup.cover(self._window, bool(on))

    def close(self):
        if self._scratch:
            shutil.rmtree(self._scratch, ignore_errors=True)
        os._exit(0)

    # ---- The server -----------------------------------------------------------------------------------------

    def _serve(self):
        """Starts the popup's own server and gives the page's address."""
        owner = self

        class Handler(http.server.BaseHTTPRequestHandler):
            protocol_version = 'HTTP/1.1'

            def log_message(self, *args):
                pass

            def do_GET(self):
                try:
                    owner._answer(self)
                except (BrokenPipeError, ConnectionResetError):
                    pass
                except Exception as error:
                    try:
                        self._send(500, 'text/plain; charset=utf-8', str(error).encode('utf-8'))
                    except OSError:
                        pass

            def _send(self, status, kind, body, extra=()):
                self.send_response(status)
                self.send_header('Content-Type', kind)
                self.send_header('Content-Length', str(len(body)))
                self.send_header('Cache-Control', 'no-store')
                for name, value in extra:
                    self.send_header(name, value)
                self.end_headers()
                self.wfile.write(body)

        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        server.daemon_threads = True
        threading.Thread(target=server.serve_forever, daemon=True).start()
        return f'http://127.0.0.1:{server.server_address[1]}/{self._token}/page'

    def _answer(self, request):
        parts = urllib.parse.urlsplit(request.path)
        steps = parts.path.split('/')
        if len(steps) < 3 or steps[1] != self._token:
            request._send(404, 'text/plain', b'')
            return
        route = steps[2]
        if route == 'page':
            request._send(200, 'text/html; charset=utf-8', popup.page('view_file.html').encode('utf-8'))
        elif route == 'doc' and len(steps) > 3 and steps[3] in self._pages:
            request._send(200, 'text/html; charset=utf-8', self._pages[steps[3]].encode('utf-8'))
        elif route == 'file':
            self._send_file(request, self._path)
        elif route == 'dir':
            # What a page of the file's own folder asks for: its pictures, its styles. Nothing above the folder.
            wanted = os.path.realpath(os.path.join(self._folder, *[urllib.parse.unquote(step) for step in steps[3:]]))
            folder = os.path.realpath(self._folder)
            if wanted != folder and not wanted.startswith(folder + os.sep):
                request._send(403, 'text/plain', b'')
                return
            self._send_file(request, wanted)
        elif route == 'zip':
            # A picture of a presentation, by its path inside the file: only the pictures its slides may ask for.
            member = '/'.join(urllib.parse.unquote(step) for step in steps[3:])
            if member not in self._members:
                request._send(404, 'text/plain', b'')
                return
            with zipfile.ZipFile(self._path) as archive:
                request._send(200, mimetypes.guess_type(member)[0] or 'application/octet-stream', archive.read(member))
        elif route == 'pdf' and len(steps) > 3 and self._pdf is not None:
            width = int(urllib.parse.parse_qs(parts.query).get('w', ['800'])[0])
            request._send(200, 'image/png', self._pdf_png(int(steps[3]), width))
        else:
            request._send(404, 'text/plain', b'')

    def _send_file(self, request, path):
        """A file's bytes, or the part of them a player asks for as it seeks."""
        if not os.path.isfile(path):
            request._send(404, 'text/plain', b'')
            return
        size = os.path.getsize(path)
        kind = mimetypes.guess_type(path)[0] or 'application/octet-stream'
        if kind.startswith('text/') or kind in ('application/javascript', 'application/json', 'image/svg+xml'):
            kind += '; charset=utf-8'
        start, end, status = 0, size - 1, 200
        asked = request.headers.get('Range', '')
        if asked.startswith('bytes=') and size:
            first, _, last = asked[6:].split(',')[0].partition('-')
            if first:
                start = int(first)
                end = min(int(last), size - 1) if last else size - 1
            elif last:
                start = max(0, size - int(last))
            if start > end or start >= size:
                request._send(416, 'text/plain', b'', [('Content-Range', f'bytes */{size}')])
                return
            status = 206
        length = end - start + 1 if size else 0
        request.send_response(status)
        request.send_header('Content-Type', kind)
        request.send_header('Content-Length', str(length))
        request.send_header('Accept-Ranges', 'bytes')
        request.send_header('Cache-Control', 'no-store')
        if status == 206:
            request.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        request.end_headers()
        with open(path, 'rb') as file:
            file.seek(start)
            left = length
            while left > 0:
                piece = file.read(min(left, 256 * 1024))
                if not piece:
                    break
                request.wfile.write(piece)
                left -= len(piece)


def main():
    try:
        import webview
        import AppKit  # noqa: F401
    except ImportError:
        return popup.MISSING
    path = os.path.abspath(os.environ.get('SPEEDY_FILE', ''))
    if not os.path.isfile(path):
        return 1
    screen, area_width, area_height = popup.pointer_screen(webview)
    room = (int(area_width * 0.8 - EXTRA_WIDTH), int(area_height * 0.8 - EXTRA_HEIGHT))
    try:
        shown = Popup(path, room)
    except NoPopup:
        return NO_READER
    shown._doc['area'] = [int(area_width), int(area_height)]
    popup.open_window(webview, os.path.basename(path), None, shown, shown._doc['width'], shown._doc['height'], screen, url=shown._serve())
    return 0


if __name__ == '__main__':
    sys.exit(main())
