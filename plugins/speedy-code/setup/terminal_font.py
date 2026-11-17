"""Sets the terminal's font: JetBrains Mono or Meslo, with the Nerd Fonts icons in it, at the size asked.

Usage: terminal_font.py --size <points> [--family jetbrains|meslo]
       terminal_font.py --install
       terminal_font.py --check [--folder <fonts folder>]
       terminal_font.py --size <points> --face <name> --windows-terminal <settings.json>
       terminal_font.py --size <points> --face <name> --ghostty <config>
       terminal_font.py --size <points> --face <name> --kitty <kitty.conf>

A program that runs in a terminal has no font of its own: the letters, their size and their
sharpness are the terminal's. So this changes the terminal's own settings, and the whole of it
follows: messages, answers, menus and bars.

The font is JetBrainsMono Nerd Font, or MesloLGS Nerd Font with --family meslo (Meslo is Apple's
Menlo, made free): in both every letter is as wide as any other, round and clear, and both hold the
icons the Nerd Fonts icon set draws, so no second font is needed for them. Not their Mono builds,
which shrink each icon into one cell: here an icon is as tall as the letters and spills over the
cell after it, which the plugin leaves for it. The four styles of a family are taken from the Nerd
Fonts release on GitHub (about 7 MB, 5 MB) and kept in the user's own fonts folder, which needs no
administrator rights. A font already there is left as it is.

--install fetches both families and changes no terminal: the setup's step. --check fetches nothing:
it prints "ok instaladas", or "fail falta <family>" and exits 1.

The terminals it knows, each changed only where it is found:
  Windows Terminal   `font.face` and `font.size` of the defaults, and of each profile with a font
                     of its own (settings.json)
  Terminal (macOS)   the font of the default and the startup profiles, while it is open
  Ghostty            `font-family` and `font-size` in its config, made if it has none; it reads
                     the config again on Cmd+Shift+, which on macOS is pressed for it
  kitty              `font_family` and `font_size` in kitty.conf
A file changed keeps a copy as it was before the first change, beside it: `<file>.speedy-font.bak`.
Any other terminal (iTerm2, Warp, WezTerm, Alacritty, an editor's) takes the font in its own
settings: its name is printed.

Prints one line: the font, the size and the terminals changed. Exits 1, with the reason, when the
font cannot be fetched or written, or the size is not between 6 and 40. The last three forms change
the one file given and fetch nothing: they are how the tests run it.
"""

import io
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tarfile
import tempfile
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nerd_font  # noqa: E402  pylint: disable=wrong-import-position

RELEASE = "https://github.com/ryanoasis/nerd-fonts/releases/latest/download"
STYLES = ["Regular", "Bold", "Italic", "BoldItalic"]
# Each family: the name shown, its archive in the release, the start of its files' names, and the
# names it gives itself, for where its own name table cannot be read.
FAMILIES = {
    "jetbrains": ("JetBrains Mono", "JetBrainsMono.tar.xz", "JetBrainsMonoNerdFont", "JetBrainsMono NF", "JetBrainsMonoNF-Regular"),
    "meslo": ("Meslo", "Meslo.tar.xz", "MesloLGSNerdFont", "MesloLGS Nerd Font", "MesloLGSNF-Regular"),
}
SIZES = (6, 40)


def files_of(family: str) -> list:
    return [f"{FAMILIES[family][2]}-{style}.ttf" for style in STYLES]


def has_family(family: str, folder: str) -> bool:
    return all(os.path.exists(os.path.join(folder, name)) for name in files_of(family))


def names_of(path: str) -> dict:
    """The names a font file gives itself, by name ID: 1 its family, 4 its full name, 6 its PostScript name."""
    with open(path, "rb") as source:
        data = source.read()
    count = struct.unpack(">H", data[4:6])[0]
    for index in range(count):
        tag, _checksum, offset, _length = struct.unpack(">4sLLL", data[12 + index * 16:28 + index * 16])
        if tag != b"name":
            continue
        _format, records, strings = struct.unpack(">HHH", data[offset:offset + 6])
        found = {}
        for record in range(records):
            start = offset + 6 + record * 12
            platform, _encoding, _language, name, length, at = struct.unpack(">HHHHHH", data[start:start + 12])
            raw = data[offset + strings + at:offset + strings + at + length]
            # Windows' names are UTF-16; the Macintosh ones stand in where there is no other.
            if platform == 3:
                found[name] = raw.decode("utf-16-be", "replace")
            elif name not in found:
                found[name] = raw.decode("latin-1", "replace")
        return found
    return {}


def fetch(family: str, folder: str) -> list:
    """Writes the family's four styles to `folder`, each whole or not at all; says which ones are new."""
    with urllib.request.urlopen(f"{RELEASE}/{FAMILIES[family][1]}", timeout=120) as answer:
        archive = tarfile.open(fileobj=io.BytesIO(answer.read()), mode="r:xz")
    os.makedirs(folder, exist_ok=True)
    written = []
    for name in files_of(family):
        target = os.path.join(folder, name)
        if os.path.exists(target):
            continue
        member = archive.extractfile(name)
        if member is None:
            raise OSError(f"{name} no está en la descarga")
        handle, temporary = tempfile.mkstemp(prefix=".font.", dir=folder)
        try:
            with os.fdopen(handle, "wb") as out:
                out.write(member.read())
            os.replace(temporary, target)
        except BaseException:
            if os.path.exists(temporary):
                os.remove(temporary)
            raise
        written.append(target)
    return written


def keep_copy(path: str) -> None:
    """A copy of the file as it was before this script first changed it."""
    copy = f"{path}.speedy-font.bak"
    if os.path.exists(path) and not os.path.exists(copy):
        shutil.copyfile(path, copy)


def write_whole(path: str, text: str) -> None:
    folder = os.path.dirname(path)
    os.makedirs(folder, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=".settings.", dir=folder)
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="") as out:
            out.write(text)
        os.replace(temporary, path)
    except BaseException:
        if os.path.exists(temporary):
            os.remove(temporary)
        raise


def windows_terminal(path: str, face: str, size: int) -> bool:
    """Sets the font of the defaults, and of every profile with a font of its own. Says whether it changed."""
    with open(path, encoding="utf-8-sig") as source:
        settings = json.load(source)
    profiles = settings.get("profiles")
    if not isinstance(profiles, dict):
        raise ValueError("no tiene perfiles")
    before = json.dumps(settings, sort_keys=True)
    defaults = profiles.get("defaults") if isinstance(profiles.get("defaults"), dict) else {}
    font = dict(defaults["font"]) if isinstance(defaults.get("font"), dict) else {}
    defaults["font"] = {**font, "face": face, "size": size}
    profiles["defaults"] = defaults
    for profile in profiles.get("list") or []:
        if isinstance(profile, dict) and isinstance(profile.get("font"), dict):
            profile["font"] = {**profile["font"], "face": face, "size": size}
    if json.dumps(settings, sort_keys=True) == before:
        return False
    keep_copy(path)
    write_whole(path, json.dumps(settings, indent=4, ensure_ascii=False))
    return True


def line_config(path: str, values: dict, form: str) -> bool:
    """Sets `key value` lines in a config of one setting per line: the ones there go, the new close the file."""
    try:
        with open(path, encoding="utf-8") as source:
            before = source.read()
    except FileNotFoundError:
        before = ""
    keys = "|".join(re.escape(key) for key in values)
    kept = [line for line in before.splitlines() if not re.match(rf"\s*({keys})\s*(=|\s)", line)]
    after = "\n".join(kept + [form.format(key=key, value=value) for key, value in values.items()]) + "\n"
    if after == before:
        return False
    keep_copy(path)
    write_whole(path, after)
    return True


def ghostty(path: str, face: str, size: int) -> bool:
    return line_config(path, {"font-family": f'"{face}"', "font-size": size}, "{key} = {value}")


def kitty(path: str, face: str, size: int) -> bool:
    return line_config(path, {"font_family": face, "font_size": f"{size}.0"}, "{key} {value}")


def mac_terminal(postscript: str, size: int) -> bool:
    """Sets the font of Terminal's default and startup profiles. Only while it is open: asking would open it."""
    if subprocess.run(["pgrep", "-x", "Terminal"], capture_output=True, check=False).returncode != 0:
        return False
    script = "\n".join([
        'tell application "Terminal"',
        "  repeat with one in {default settings, startup settings}",
        f'    set font name of one to "{postscript}"',
        f"    set font size of one to {size}",
        "  end repeat",
        "end tell",
    ])
    done = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, check=False)
    if done.returncode != 0:
        raise OSError(done.stderr.strip() or "osascript falló")
    return True


def config_files(home: str) -> list:
    """The configs of the terminals found here, each with the function that sets its font."""
    config = os.environ.get("XDG_CONFIG_HOME") or os.path.join(home, ".config")
    found = []
    for folder in (os.path.join(config, "ghostty"), os.path.join(home, "Library", "Application Support", "com.mitchellh.ghostty")):
        if os.path.isdir(folder):
            named = [os.path.join(folder, name) for name in ("config", "config.ghostty") if os.path.exists(os.path.join(folder, name))]
            found.append(("Ghostty", ghostty, named[0] if named else os.path.join(folder, "config")))
    # Ghostty with no config of its own yet: it is here if this runs in it or its app is, and it gets one.
    is_here = os.environ.get("TERM_PROGRAM") == "ghostty" or os.path.isdir("/Applications/Ghostty.app")
    if not found and is_here:
        found.append(("Ghostty", ghostty, os.path.join(config, "ghostty", "config")))
    if os.path.isdir(os.path.join(config, "kitty")):
        found.append(("kitty", kitty, os.path.join(config, "kitty", "kitty.conf")))
    return found


def reload_ghostty() -> None:
    """Ghostty reads its config again on Cmd+Shift+, and not by itself: pressed for it while it is in front."""
    if sys.platform != "darwin":
        return
    front = 'tell application "System Events" to get name of first process whose frontmost is true'
    press = 'tell application "System Events" to keystroke "," using {command down, shift down}'
    try:
        asked = subprocess.run(["osascript", "-e", front], capture_output=True, text=True, check=False, timeout=5)
        if asked.stdout.strip().lower() == "ghostty":
            subprocess.run(["osascript", "-e", press], capture_output=True, check=False, timeout=5)
    except (OSError, subprocess.SubprocessError):
        pass


def option(name: str) -> str:
    arguments = sys.argv[1:]
    return arguments[arguments.index(name) + 1] if name in arguments and arguments.index(name) + 1 < len(arguments) else ""


def install(family: str, folder: str) -> bool:
    """Puts the family in `folder` if it is not whole there, naming it to Windows. Says whether it fetched."""
    if has_family(family, folder):
        return False
    for path in fetch(family, folder):
        if sys.platform == "win32":
            nerd_font.register_on_windows(path, names_of(path).get(4) or os.path.basename(path))
    return True


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    folder = option("--folder") or nerd_font.fonts_folder()
    shown = " y ".join(names[0] for names in FAMILIES.values())
    if "--check" in sys.argv[1:]:
        missing = [names[0] for family, names in FAMILIES.items() if not has_family(family, folder)]
        print(f"fail falta {' y '.join(missing)}" if missing else "ok instaladas")
        return 1 if missing else 0
    if "--install" in sys.argv[1:]:
        try:
            fetched = [install(family, folder) for family in FAMILIES]
        except Exception as error:  # pylint: disable=broad-except
            print(f"no pude instalar {shown}: {error}")
            return 1
        print(f"{shown} instaladas" if any(fetched) else "ya estaban instaladas")
        return 0
    family = option("--family") or "jetbrains"
    if family not in FAMILIES:
        print(f"la fuente es una de: {', '.join(FAMILIES)}")
        return 1
    try:
        size = int(option("--size"))
    except ValueError:
        size = 0
    if not SIZES[0] <= size <= SIZES[1]:
        print(f"el tamaño va de {SIZES[0]} a {SIZES[1]} puntos")
        return 1
    # One file given: that one alone, with the face named, and nothing fetched.
    for flag, apply in (("--windows-terminal", windows_terminal), ("--ghostty", ghostty), ("--kitty", kitty)):
        if option(flag):
            try:
                print("cambiada" if apply(option(flag), option("--face"), size) else "ya estaba")
                return 0
            except (OSError, ValueError) as error:
                print(f"no pude cambiar la fuente: {error}")
                return 1

    try:
        install(family, folder)
        names = names_of(os.path.join(folder, files_of(family)[0]))
    except Exception as error:  # pylint: disable=broad-except
        print(f"no pude instalar {FAMILIES[family][0]}: {error}")
        return 1
    face = names.get(16) or names.get(1) or FAMILIES[family][3]

    changed, failed = [], []

    def attempt(name, apply):
        try:
            apply()
            changed.append(name)
        except (OSError, ValueError) as error:
            failed.append(f"{name} ({error})")

    if sys.platform == "win32":
        for settings in nerd_font.terminal_settings():
            attempt("Windows Terminal", lambda settings=settings: windows_terminal(settings, face, size))
    if sys.platform == "darwin":
        try:
            if mac_terminal(names.get(6) or FAMILIES[family][4], size):
                changed.append("Terminal")
        except OSError as error:
            failed.append(f"Terminal ({error})")
    for name, apply, path in config_files(os.path.expanduser("~")):
        attempt(name, lambda apply=apply, path=path: apply(path, face, size))

    said = f"{face}, {size} pt"
    said += f": {', '.join(dict.fromkeys(changed))}" if changed else f": no encontré una terminal que sepa cambiar; elegí '{face}' en la tuya"
    if "Ghostty" in changed:
        reload_ghostty()
        said += " (Ghostty: si no cambió, Cmd+Shift+, o reiniciarlo)"
    if failed:
        said += f"; no pude con {', '.join(failed)}"
    print(said)
    return 0


if __name__ == "__main__":
    sys.exit(main())
