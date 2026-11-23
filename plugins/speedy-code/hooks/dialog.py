"""The explorer's dialog on macOS: dialog.html in a popup, as dialog.ps1 is on Windows.

  SPEEDY_MODE=rename: the name and the extension of SPEEDY_FILE. Prints `rename <base64 of the UTF-8 new name>`, or `cancel`.
  SPEEDY_KIND=dir: a folder; one field for its name, and Borrar says it goes with what it holds.
  SPEEDY_MODE=delete: asks whether SPEEDY_FILE goes to the Trash. Prints `delete` or `cancel`.

Exits 3 with nothing printed when pywebview is missing: the mod then asks with the system's dialog.
"""
import os
import sys

import popup

# One size for Renombrar and Borrar, the one dialog.ps1 has.
WIDTH, HEIGHT = 544, 282


class Api:
    """What dialog.html asks and answers."""

    def __init__(self, path, mode, kind):
        self._path = path
        self._mode = mode
        self._kind = kind

    def asked(self):
        return {'name': os.path.basename(self._path), 'mode': self._mode, 'kind': self._kind}

    def exists(self, name):
        return os.path.lexists(os.path.join(os.path.dirname(self._path), name))

    def shown(self):
        popup.front()

    def finish(self, answer):
        """Says the answer and ends: one answer only, as the process ends with it."""
        popup.say(answer)
        os._exit(0)

    def close(self):
        self.finish('cancel')


def main():
    try:
        import webview
    except ImportError:
        return popup.MISSING
    path = os.environ.get('SPEEDY_FILE', '')
    mode = 'delete' if os.environ.get('SPEEDY_MODE') == 'delete' else 'rename'
    kind = 'dir' if os.environ.get('SPEEDY_KIND') == 'dir' else 'file'
    screen = popup.pointer_screen(webview)[0]
    popup.open_window(webview, 'Borrar' if mode == 'delete' else 'Renombrar', 'dialog.html', Api(path.rstrip('/') or path, mode, kind), WIDTH, HEIGHT, screen)
    return 0


if __name__ == '__main__':
    sys.exit(main())
