"""The explorer's dialog on macOS: dialog.html in a popup, as dialog.ps1 is on Windows.

  SPEEDY_MODE=rename: the name and the extension of SPEEDY_FILE. Prints `rename <base64 of the UTF-8 new name>`, or `cancel`.
  SPEEDY_KIND=dir: a folder; one field for its name, and Borrar says it goes with what it holds.
  SPEEDY_MODE=delete: asks whether SPEEDY_FILE goes to the Trash. Prints `delete` or `cancel`.
  SPEEDY_MODE=paste: asks whether SPEEDY_FILE is copied or moved into the folder SPEEDY_TARGET, then whether
    for sure. Prints `copy`, `move` or `cancel`. With SPEEDY_ONLY=copy (a file of another machine, which stays
    there) it only asks whether for sure.
  SPEEDY_MODE=mkdir: the name of a folder to make in the folder SPEEDY_FILE. Prints `mkdir <base64 of the UTF-8
    name>`, or `cancel`.

Exits 3 with nothing printed when pywebview is missing: the mod then asks with the system's dialog.
"""
import os
import re
import sys

import popup

# One size for Renombrar, Borrar and Pegar, the one dialog.ps1 has.
WIDTH, HEIGHT = 544, 282
TITLES = {'rename': 'Renombrar', 'delete': 'Borrar', 'paste': 'Pegar', 'mkdir': 'Nueva carpeta'}


class Api:
    """What dialog.html asks and answers."""

    def __init__(self, path, mode, kind, target=''):
        self._path = path
        self._mode = mode
        self._kind = kind
        self._target = target

    def asked(self):
        return {'name': os.path.basename(self._path), 'folder': self._path, 'mode': self._mode, 'kind': self._kind, 'target': self._target, 'only': os.environ.get('SPEEDY_ONLY', '')}

    def exists(self, name):
        # A new folder's name is looked for in the folder it goes into; a rename's beside the file.
        # A path of another machine (`windows:/C:/Users`) is not looked into here: the explorer says, once
        # asked, whether the name is taken there.
        if re.match(r'[A-Za-z][\w.-]+:/', self._path):
            return False
        folder = self._path if self._mode == 'mkdir' else os.path.dirname(self._path)
        return os.path.lexists(os.path.join(folder, name))

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
    mode = os.environ.get('SPEEDY_MODE')
    mode = mode if mode in TITLES else 'rename'
    kind = 'dir' if os.environ.get('SPEEDY_KIND') == 'dir' else 'file'
    screen = popup.pointer_screen(webview)[0]
    popup.open_window(webview, TITLES[mode], 'dialog.html', Api(path.rstrip('/') or path, mode, kind, os.environ.get('SPEEDY_TARGET', '')), WIDTH, HEIGHT, screen)
    return 0


if __name__ == '__main__':
    sys.exit(main())
