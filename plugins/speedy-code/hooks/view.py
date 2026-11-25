"""One pasted image in a popup on macOS, as view.ps1 shows it on Windows: the file named by SPEEDY_IMAGE.

The popup stands in the middle of the screen the pointer is on, in the picture's own proportions, up to 80% of
that screen's working area and never larger than the picture. The close mark or Esc closes it. It says
`shown` once it is up, then `.` every tenth of a second, so the mod wakes to end it; with no one reading,
the write fails and it closes.

Exits 3 with nothing printed when pywebview is missing: the mod then shows the image with Quick Look.
"""
import base64
import mimetypes
import os
import sys
import threading
import time

import popup

# The frame's widths, as view.ps1 has them: the contour, the line, the margin, and the band under the top line.
CONTOUR, LINE, MARGIN, BAND = 24, 2, 12, 16
EXTRA_WIDTH = 2 * (CONTOUR + LINE + MARGIN)
EXTRA_HEIGHT = 2 * (CONTOUR + LINE) + BAND + MARGIN
# What the top line needs beside the title: the two marks at the right, and as much at the left.
MARKS_WIDTH = 2 * (26 + 26 + 2) + 48


def popup_size(image_width, image_height, area_width, area_height, title_width, left=0):
    """The popup's size for a picture of that size: (popup width, popup height, picture width, picture height).
    `left` is the room the terminal's name takes at the left of the top line."""
    scale = min(1.0, (area_width * 0.8 - EXTRA_WIDTH) / image_width, (area_height * 0.8 - EXTRA_HEIGHT) / image_height)
    width = max(1, round(image_width * scale))
    height = max(1, round(image_height * scale))
    # A small picture still leaves the top line room for its title and marks: it stays its size, centered.
    # The left side as wide as the terminal's name, when that is wider than the marks.
    return max(width + EXTRA_WIDTH, 2 * CONTOUR + title_width + max(MARKS_WIDTH, 2 * left)), height + EXTRA_HEIGHT, width, height


class Api:
    """What view.html asks and says."""

    def __init__(self, path, width, height):
        self._path = path
        self._width = width
        self._height = height

    def asked(self):
        kind = mimetypes.guess_type(self._path)[0] or 'image/png'
        with open(self._path, 'rb') as file:
            data = base64.b64encode(file.read()).decode('ascii')
        return {'name': os.path.basename(self._path), 'source': f'data:{kind};base64,{data}', 'width': self._width, 'height': self._height}

    def shown(self):
        popup.front()
        popup.say('shown')
        threading.Thread(target=self._dots, daemon=True).start()

    def _dots(self):
        while True:
            time.sleep(0.1)
            popup.say('.')

    def close(self):
        os._exit(0)


def main():
    try:
        import webview
        import AppKit
    except ImportError:
        return popup.MISSING
    path = os.environ.get('SPEEDY_IMAGE', '')
    picture = AppKit.NSImageRep.imageRepWithContentsOfFile_(path) if path else None
    if picture is None or picture.pixelsWide() < 1 or picture.pixelsHigh() < 1:
        return 1
    screen, area_width, area_height = popup.popup_screen(webview)
    # The title's width, near enough: bold, about nine points a letter, and its space at both sides.
    title_width = 9 * len(os.path.basename(path)) + 12
    width, height, shown_width, shown_height = popup_size(picture.pixelsWide(), picture.pixelsHigh(), area_width, area_height, title_width, popup.terminal_side())
    popup.open_window(webview, os.path.basename(path), 'view.html', Api(path, shown_width, shown_height), width, height, screen)
    return 0


if __name__ == '__main__':
    sys.exit(main())
