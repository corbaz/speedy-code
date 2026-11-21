"""Sets the terminal's font: JetBrains Mono or Meslo, with the Nerd Fonts icons in it, at the size asked.

Usage: terminal_font.py --size <points> [--family jetbrains|meslo]
       terminal_font.py --install
       terminal_font.py --check [--folder <fonts folder>]
       terminal_font.py --size <points> --face <name> --windows-terminal <settings.json>
       terminal_font.py --size <points> --face <name> --ghostty <config>
       terminal_font.py --size <points> --face <name> --kitty <kitty.conf>
       terminal_font.py --size <points> --face <PostScript name> --iterm <DynamicProfiles folder>
       terminal_font.py --size <points> --face <name> --editor <settings.json>

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
  VS Code, Kiro,     `terminal.integrated.fontFamily` and `fontSize` in the editor's settings.json,
  Cursor, Windsurf,  when this runs in its terminal: then only that editor changes
  Antigravity
  iTerm2             a profile of its own, `speedy-code`, in its DynamicProfiles folder, which it
                     reads again by itself; it takes the rest from the default profile. The tab
                     this runs in is put on it; for new ones, set it as the default once
A file changed keeps a copy as it was before the first change, beside it: `<file>.speedy-font.bak`.
Terminal and iTerm2 keep their rows and columns, so a smaller font shrinks the window: the window
this runs in is made to fill the screen again. On macOS only the terminal this runs in is changed,
when it says which it is (TERM_PROGRAM): Terminal, iTerm2 or Ghostty.
Any other terminal (Warp, WezTerm, Alacritty, an editor's) takes the font in its own
settings: its name is printed.

Prints one line: the font, the size and the terminals changed. Exits 1, with the reason, when the
font cannot be fetched or written, or the size is not between 6 and 40. The last three forms change
the one file (or folder) given and fetch nothing: they are how the tests run it.
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
import time
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


# The editors whose terminal takes its font from their own settings.json, by their settings folder's name:
# a terminal inside one of them does not use the system terminal's font.
EDITORS = {"Code": "VS Code", "Code - Insiders": "VS Code Insiders", "Kiro": "Kiro", "Cursor": "Cursor",
           "Windsurf": "Windsurf", "VSCodium": "VSCodium", "Antigravity": "Antigravity", "Antigravity IDE": "Antigravity IDE"}
# What each one's own paths carry (its program's folder or app), to tell which one this runs in.
EDITOR_MARKS = {"Code": ("Microsoft VS Code", "Visual Studio Code.app"), "Code - Insiders": ("Insiders",),
                "Kiro": ("Kiro",), "Cursor": ("Cursor",), "Windsurf": ("Windsurf",), "VSCodium": ("VSCodium",),
                "Antigravity": ("Antigravity",), "Antigravity IDE": ("Antigravity",)}


def editor_settings(path: str, face: str, size: int) -> bool:
    """Sets `terminal.integrated.fontFamily` and `fontSize` in an editor's settings.json, which may hold
    comments: each value is put in place of the one it had, or added first; the rest is left as it is."""
    try:
        with open(path, encoding="utf-8") as source:
            before = source.read()
    except FileNotFoundError:
        before = "{}\n"
    after = before
    values = {"terminal.integrated.fontFamily": json.dumps(f"'{face}'"), "terminal.integrated.fontSize": str(size)}
    for key, value in values.items():
        found = re.compile(r'("' + re.escape(key) + r'"\s*:\s*)("(?:[^"\\]|\\.)*"|[0-9.]+)')
        if found.search(after):
            after = found.sub(lambda match, value=value: match.group(1) + value, after, count=1)
        else:
            start = after.index("{") + 1
            rest = after[start:].lstrip()
            comma = "" if rest.startswith("}") else ","
            after = after[:start] + f'\n  "{key}": {value}{comma}' + after[start:]
    if after == before:
        return False
    keep_copy(path)
    write_whole(path, after)
    return True


def editors_here(base: str) -> list:
    """The editors' settings files to change when this runs in an editor's terminal, as (name, path); None
    when it does not. The one this runs in when its paths tell, else every one found."""
    # Only TERM_PROGRAM tells: a VS Code variable can be left over in Ghostty or iTerm2 (a terminal opened
    # from the editor, a shell that exports it), and their font is their own.
    if os.environ.get("TERM_PROGRAM", "").lower() not in ("vscode", "kiro", "cursor", "windsurf"):
        return None
    found = [(name, os.path.join(base, folder, "User", "settings.json")) for folder, name in EDITORS.items()
             if os.path.isdir(os.path.join(base, folder, "User"))]
    told = " ".join(value for key, value in os.environ.items() if key.startswith(("VSCODE_", "__CF", "TERM_PROGRAM")))
    mine = [(name, path) for folder, name in EDITORS.items() for one, path in found
            if one == name and any(mark.lower() in told.lower() for mark in EDITOR_MARKS[folder])]
    return mine or found


def editors_base() -> str:
    """Where the editors keep their settings: the app data on Windows, Application Support on macOS."""
    if sys.platform == "win32":
        return os.environ.get("APPDATA", os.path.join(os.path.expanduser("~"), "AppData", "Roaming"))
    if sys.platform == "darwin":
        return os.path.join(os.path.expanduser("~"), "Library", "Application Support")
    return os.environ.get("XDG_CONFIG_HOME") or os.path.join(os.path.expanduser("~"), ".config")


# The macOS terminals by the TERM_PROGRAM they set, as this script names them (and as System Events does).
MAC_TERMINALS = {"Apple_Terminal": "Terminal", "iTerm.app": "iTerm2", "ghostty": "Ghostty"}

ITERM_PROFILE = "speedy-code"
# iTerm2's WINDOW_TYPE_MAXIMIZED (sources/Settings/Profiles/ITAddressBookMgr.h).
ITERM_MAXIMIZED = 15
ITERM_FILE = "speedy-code.json"


def iterm(folder: str, postscript: str, size: int) -> bool:
    """Writes iTerm2's `speedy-code` profile with the font: iTerm2 reads its DynamicProfiles folder again
    as soon as it changes, and the tabs on that profile follow. Says whether it changed."""
    font = f"{postscript} {size}"
    profile = {
        "Name": ITERM_PROFILE,
        "Guid": "speedy-code-font-profile",
        "Normal Font": font,
        "Non Ascii Font": font,
        # A new window on the profile fills the screen and keeps filling it whatever the font's size.
        "Window Type": ITERM_MAXIMIZED,
    }
    path = os.path.join(folder, ITERM_FILE)
    after = json.dumps({"Profiles": [profile]}, indent=2, ensure_ascii=False) + "\n"
    try:
        with open(path, encoding="utf-8") as source:
            if source.read() == after:
                return False
    except FileNotFoundError:
        pass
    os.makedirs(folder, exist_ok=True)
    write_whole(path, after)
    return True


def iterm_folder(home: str) -> str:
    """iTerm2's folder of dynamic profiles, where it is installed or running; empty where it is not."""
    if sys.platform != "darwin":
        return ""
    if os.environ.get("TERM_PROGRAM") != "iTerm.app" and not os.path.isdir("/Applications/iTerm.app"):
        return ""
    return os.path.join(home, "Library", "Application Support", "iTerm2", "DynamicProfiles")


def iterm_switch() -> bool:
    """Puts the tab this runs under on the `speedy-code` profile: iTerm2 takes OSC 1337 SetProfile from
    what is written to its terminal. The terminal is the first one up the line of processes."""
    if os.environ.get("TERM_PROGRAM") != "iTerm.app":
        return False
    pid = os.getpid()
    for _ in range(12):
        asked = subprocess.run(["ps", "-o", "ppid=,tty=", "-p", str(pid)], capture_output=True, text=True, check=False)
        found = asked.stdout.split()
        if len(found) < 2:
            return False
        parent, tty = found[0], found[1]
        if tty not in ("??", "-"):
            try:
                with open(f"/dev/{tty}", "w", encoding="utf-8") as terminal:
                    terminal.write(f"\033]1337;SetProfile={ITERM_PROFILE}\a")
                return True
            except OSError:
                return False
        pid = int(parent)
    return False


# Fills the screen with the front window of a process, less the menu bar and the Dock: macOS gives the
# room left (visibleFrame, from the bottom) and System Events places the window (from the top).
FILL_SCRIPT = """
ObjC.import('AppKit');
function run(argv) {
  const screen = $.NSScreen.mainScreen;
  const whole = screen.frame;
  const room = screen.visibleFrame;
  const top = whole.size.height - (room.origin.y + room.size.height);
  const window = Application('System Events').processes.byName(argv[0]).windows[0];
  // A window grown past the screen is first brought back to the screen's size, then placed, then sized
  // again: macOS keeps a window's frame where it can, so a move alone can leave it hanging off the edge.
  // iTerm2 is also told its own window's bounds, which it keeps to its grid.
  for (let turn = 0; turn < 12; turn++) {
    delay(0.5);
    try {
      window.size = [room.size.width, room.size.height];
      window.position = [room.origin.x, top];
      window.size = [room.size.width, room.size.height];
    } catch (error) {}
    if (argv[0] === 'iTerm2') {
      try {
        Application('iTerm2').currentWindow.bounds = { x: room.origin.x, y: top, width: room.size.width, height: room.size.height };
      } catch (error) {}
    }
  }
  return 'ok';
}
"""


def fill_screen(process: str) -> bool:
    """A terminal that keeps its rows and columns shrinks its window with a smaller font and widens it past
    the screen with a larger one: the window is made to fill the screen again, a few times over six
    seconds, as the terminal resizes it a moment after the change. In the background, so this returns at
    once. Needs System Events, as the plugin's keys do."""
    if sys.platform != "darwin":
        return False
    try:
        subprocess.Popen(["osascript", "-l", "JavaScript", "-e", FILL_SCRIPT, process],
                         stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        return True
    except OSError:
        return False


def mac_terminal(postscript: str, size: int, is_here: bool = False) -> bool:
    """Sets the font of Terminal's default and startup profiles, and of the profile of each tab open.
    Only while it is open: asking would open it. When this runs in it, it is open; it is not looked for
    among the processes, which a sandboxed run may not see."""
    if not is_here and subprocess.run(["pgrep", "-x", "Terminal"], capture_output=True, check=False).returncode != 0:
        return False
    script = "\n".join([
        'tell application "Terminal"',
        "  repeat with one in {default settings, startup settings}",
        f'    set font name of one to "{postscript}"',
        f"    set font size of one to {size}",
        "  end repeat",
        "  try",
        f'    set font name of current settings of every tab of every window to "{postscript}"',
        f"    set font size of current settings of every tab of every window to {size}",
        "  end try",
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


def report(face: str, size: int, changed: list, failed: list, is_new: bool, here: str) -> int:
    """Prints the one line: the font, the size, the terminals changed and what is left to do."""
    said = f"{face}, {size} pt"
    said += f": {', '.join(dict.fromkeys(changed))}" if changed else f": no encontré una terminal que sepa cambiar; elegí '{face}' en la tuya"
    if "Ghostty" in changed:
        reload_ghostty()
        said += " (Ghostty: si no cambió, Cmd+Shift+, o reiniciarlo)"
    if "iTerm2" in changed:
        said += " (iTerm2: esta pestaña pasa al perfil speedy-code" if iterm_switch() else " (iTerm2: elegí el perfil speedy-code"
        said += "; para las nuevas, Settings → Profiles → speedy-code → Other Actions → Set as Default)"
    # The window the change shrank fills the screen again: the one this runs in.
    if here in ("Terminal", "iTerm2") and here in changed:
        fill_screen(here)
    if is_new and changed:
        said += " (fuente recién instalada: si la terminal no la encuentra, cerrala y abrila)"
    if failed:
        said += f"; no pude con {', '.join(failed)}"
    print(said)
    return 0


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
    for flag, apply in (("--windows-terminal", windows_terminal), ("--ghostty", ghostty), ("--kitty", kitty), ("--iterm", iterm),
                        ("--editor", editor_settings)):
        if option(flag):
            try:
                print("cambiada" if apply(option(flag), option("--face"), size) else "ya estaba")
                return 0
            except (OSError, ValueError) as error:
                print(f"no pude cambiar la fuente: {error}")
                return 1

    try:
        is_new = install(family, folder)
        names = names_of(os.path.join(folder, files_of(family)[0]))
    except Exception as error:  # pylint: disable=broad-except
        print(f"no pude instalar {FAMILIES[family][0]}: {error}")
        return 1
    face = names.get(16) or names.get(1) or FAMILIES[family][3]
    # A terminal open since before the font came may not list it yet: Windows gets a moment to tell it.
    if is_new and sys.platform == "win32":
        time.sleep(2)

    changed, failed = [], []

    def attempt(name, apply):
        try:
            apply()
            changed.append(name)
        except (OSError, ValueError) as error:
            failed.append(f"{name} ({error})")

    # In an editor's terminal (VS Code, Kiro, Cursor...) the font is the editor's: only it changes.
    editors = editors_here(editors_base())
    for name, path in editors or []:
        attempt(name, lambda path=path: editor_settings(path, face, size))
    if editors is not None:
        return report(face, size, changed, failed, is_new, "")
    if sys.platform == "win32":
        for settings in nerd_font.terminal_settings():
            attempt("Windows Terminal", lambda settings=settings: windows_terminal(settings, face, size))
    # On macOS the terminal this runs in is the one changed, when it says which it is: with Terminal and
    # iTerm2 both open, the font asked for in one is not the other's.
    here = MAC_TERMINALS.get(os.environ.get("TERM_PROGRAM", ""), "") if sys.platform == "darwin" else ""
    postscript = names.get(6) or FAMILIES[family][4]
    if sys.platform == "darwin" and here in ("", "Terminal"):
        try:
            if mac_terminal(postscript, size, here == "Terminal"):
                changed.append("Terminal")
        except OSError as error:
            failed.append(f"Terminal ({error})")
    for name, apply, path in config_files(os.path.expanduser("~")):
        if here in ("", name):
            attempt(name, lambda apply=apply, path=path: apply(path, face, size))
    profiles = iterm_folder(os.path.expanduser("~"))
    if profiles and here in ("", "iTerm2"):
        attempt("iTerm2", lambda: iterm(profiles, postscript, size))

    return report(face, size, changed, failed, is_new, here)


if __name__ == "__main__":
    sys.exit(main())
