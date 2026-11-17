"""Installs the icon font the Nerd Fonts icon set needs, for this user alone.

Usage: nerd_font.py [--check] [folder]

The font is Symbols Nerd Font Mono: the icons alone, to stand behind whatever font the terminal
uses. It is taken from the Nerd Fonts release on GitHub (about 3 MB) and kept in the user's own
fonts folder, which needs no administrator rights: ~/Library/Fonts on macOS,
%LOCALAPPDATA%\\Microsoft\\Windows\\Fonts on Windows, where it is also named in the user's registry
so Windows lists it. A font already there is left as it is.

Prints one line, what it did: "Symbols Nerd Font Mono instalada" or "ya estaba instalada". With
--check it changes nothing and prints "ok instalada" or "fail falta". Exits 1, with the reason,
when the font cannot be fetched or written, and when --check does not find it.

A terminal draws these icons only if its font is a Nerd Font, or if it falls back to the fonts
installed: where it does neither, pick a Nerd Font in the terminal's settings.
"""

import io
import os
import sys
import tempfile
import urllib.request
import zipfile

URL = "https://github.com/ryanoasis/nerd-fonts/releases/latest/download/NerdFontsSymbolsOnly.zip"
FILE = "SymbolsNerdFontMono-Regular.ttf"
NAME = "Symbols Nerd Font Mono"


def fonts_folder() -> str:
    home = os.path.expanduser("~")
    if sys.platform == "win32":
        local = os.environ.get("LOCALAPPDATA") or os.path.join(home, "AppData", "Local")
        return os.path.join(local, "Microsoft", "Windows", "Fonts")
    if sys.platform == "darwin":
        return os.path.join(home, "Library", "Fonts")
    return os.path.join(home, ".local", "share", "fonts")


def fetch(target: str) -> None:
    """Writes the font to `target`, whole or not at all."""
    with urllib.request.urlopen(URL, timeout=60) as answer:
        archive = zipfile.ZipFile(io.BytesIO(answer.read()))
    data = archive.read(FILE)
    folder = os.path.dirname(target)
    os.makedirs(folder, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=".nerd-font.", dir=folder)
    try:
        with os.fdopen(handle, "wb") as out:
            out.write(data)
        os.replace(temporary, target)
    except BaseException:
        if os.path.exists(temporary):
            os.remove(temporary)
        raise


def register_on_windows(path: str) -> None:
    """Names the font in the user's registry, and tells the open programs a font came."""
    import ctypes
    import winreg

    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows NT\CurrentVersion\Fonts") as key:
        winreg.SetValueEx(key, f"{NAME} (TrueType)", 0, winreg.REG_SZ, path)
    try:
        ctypes.windll.gdi32.AddFontResourceW(path)
        # HWND_BROADCAST, WM_FONTCHANGE; it returns at once, whoever does not answer.
        ctypes.windll.user32.SendNotifyMessageW(0xFFFF, 0x001D, 0, 0)
    except OSError:
        pass


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    arguments = [one for one in sys.argv[1:] if one != "--check"]
    # A folder given stands for the user's own, in a test: nothing is registered then.
    folder = arguments[0] if arguments else fonts_folder()
    target = os.path.join(folder, FILE)
    if "--check" in sys.argv[1:]:
        found = os.path.exists(target)
        print("ok instalada" if found else "fail falta")
        return 0 if found else 1
    if os.path.exists(target):
        print("ya estaba instalada")
        return 0
    try:
        fetch(target)
        if sys.platform == "win32" and not arguments:
            register_on_windows(target)
    except Exception as error:  # pylint: disable=broad-except
        print(f"no pude instalar {NAME}: {error}")
        return 1
    print(f"{NAME} instalada")
    return 0


if __name__ == "__main__":
    sys.exit(main())
