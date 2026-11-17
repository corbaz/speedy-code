"""Installs the icon font the Nerd Fonts icon set needs, for this user alone.

Usage: nerd_font.py [--check] [folder]
       nerd_font.py --windows-terminal <settings.json>

The font is Symbols Nerd Font Mono: the icons alone, to stand behind whatever font the terminal
uses. It is taken from the Nerd Fonts release on GitHub (about 3 MB) and kept in the user's own
fonts folder, which needs no administrator rights: ~/Library/Fonts on macOS,
%LOCALAPPDATA%\\Microsoft\\Windows\\Fonts on Windows, where it is also named in the user's registry
so Windows lists it. A font already there is left as it is.

Prints one line, what it did: "Symbols Nerd Font Mono instalada" or "ya estaba instalada". With
--check it changes nothing and prints "ok instalada" or "fail falta". Exits 1, with the reason,
when the font cannot be fetched or written, and when --check does not find it.

A terminal draws these icons only if its font is a Nerd Font, or if it falls back to the fonts
installed. Windows Terminal does neither by itself: it takes a list of fonts, so on Windows the
font is added after the one each profile uses (`font.face`, in its settings.json, of which a copy
as it was is kept as settings.json.speedy.bak). --windows-terminal does that alone, on the file
given. In any other terminal, pick a Nerd Font in its settings.
"""

import io
import json
import os
import shutil
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


def register_on_windows(path: str, name: str = NAME) -> None:
    """Names the font, `name`, in the user's registry, and tells the open programs a font came."""
    import ctypes
    import winreg

    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows NT\CurrentVersion\Fonts") as key:
        winreg.SetValueEx(key, f"{name} (TrueType)", 0, winreg.REG_SZ, path)
    try:
        ctypes.windll.gdi32.AddFontResourceW(path)
        # HWND_BROADCAST, WM_FONTCHANGE; it returns at once, whoever does not answer.
        ctypes.windll.user32.SendNotifyMessageW(0xFFFF, 0x001D, 0, 0)
    except OSError:
        pass


def with_icons(font: object) -> object:
    """A profile's font with the icon font after its face; one that has it, or a Nerd Font, is left."""
    held = dict(font) if isinstance(font, dict) else {}
    face = held.get("face") or "Cascadia Mono"
    if not isinstance(face, str) or "nerd font" in face.lower() or " nf" in face.lower():
        return font
    held["face"] = f"{face}, {NAME}"
    return held


def windows_terminal(path: str) -> str:
    """Adds the icon font to Windows Terminal's fonts: the defaults, and every profile with a face of its own."""
    with open(path, encoding="utf-8-sig") as source:
        settings = json.load(source)
    profiles = settings.get("profiles")
    if not isinstance(profiles, dict):
        raise ValueError("no tiene perfiles")
    before = json.dumps(settings, sort_keys=True)
    defaults = profiles.get("defaults") if isinstance(profiles.get("defaults"), dict) else {}
    defaults["font"] = with_icons(defaults.get("font"))
    profiles["defaults"] = defaults
    for profile in profiles.get("list") or []:
        if isinstance(profile, dict) and isinstance(profile.get("font"), dict) and profile["font"].get("face"):
            profile["font"] = with_icons(profile["font"])
    if json.dumps(settings, sort_keys=True) == before:
        return "Windows Terminal ya la usa"
    shutil.copyfile(path, f"{path}.speedy.bak")
    folder = os.path.dirname(path)
    handle, temporary = tempfile.mkstemp(prefix=".settings.", dir=folder)
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as out:
            json.dump(settings, out, indent=4, ensure_ascii=False)
        os.replace(temporary, path)
    except BaseException:
        if os.path.exists(temporary):
            os.remove(temporary)
        raise
    return "Windows Terminal la usa detrás de su fuente"


def terminal_settings() -> list:
    """Windows Terminal's settings files on this machine: the store one, its preview and the unpackaged one."""
    local = os.environ.get("LOCALAPPDATA") or ""
    found = [
        os.path.join(local, "Packages", "Microsoft.WindowsTerminal_8wekyb3d8bbwe", "LocalState", "settings.json"),
        os.path.join(local, "Packages", "Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe", "LocalState", "settings.json"),
        os.path.join(local, "Microsoft", "Windows Terminal", "settings.json"),
    ]
    return [one for one in found if local and os.path.exists(one)]


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    if sys.argv[1:2] == ["--windows-terminal"] and len(sys.argv) > 2:
        try:
            print(windows_terminal(sys.argv[2]))
            return 0
        except (OSError, ValueError) as error:
            print(f"no pude cambiar la fuente de Windows Terminal: {error}")
            return 1
    arguments = [one for one in sys.argv[1:] if one != "--check"]
    # A folder given stands for the user's own, in a test: nothing is registered then.
    folder = arguments[0] if arguments else fonts_folder()
    target = os.path.join(folder, FILE)
    if "--check" in sys.argv[1:]:
        found = os.path.exists(target)
        print("ok instalada" if found else "fail falta")
        return 0 if found else 1
    said = "ya estaba instalada"
    if not os.path.exists(target):
        try:
            fetch(target)
            if sys.platform == "win32" and not arguments:
                register_on_windows(target)
        except Exception as error:  # pylint: disable=broad-except
            print(f"no pude instalar {NAME}: {error}")
            return 1
        said = f"{NAME} instalada"
    # Windows Terminal draws the icons only with the font in its own list. A file it cannot read
    # (one with comments, say) is left alone, and said.
    if sys.platform == "win32" and not arguments:
        for settings in terminal_settings():
            try:
                said += f"; {windows_terminal(settings)}"
            except (OSError, ValueError) as error:
                said += f"; no pude cambiar Windows Terminal ({error}): agregá '{NAME}' a su fuente"
    print(said)
    return 0


if __name__ == "__main__":
    sys.exit(main())
