"""What the mod uses beside its own Python: checked, and ffmpeg installed where it can be, for the setup.

    extras.py ffmpeg [--install]   ffmpeg, which makes again a video or a sound the system does not play. On
                                   Windows --install downloads it (gyan.dev's release build, about 120 MB)
                                   into the mod's own folder, beside its Python; on macOS it is only told
                                   how to get it.
    extras.py git                  git: the footer's branch, and the update.
    extras.py bun                  bun, which OpenCode's port is built with.
    extras.py remotes              the other machines the explorer shows a disk of (remote.py's): whether
                                   each is reached by ssh and has a Python.
    extras.py access               on macOS, whether the terminal may press keys (Accessibility); opens the
                                   settings' pane when it may not.

Each says one line, `ok <text>` or `fail <text>`, and exits 0 or 1, as nerd_font.py's check does.
"""
import ctypes
import os
import shutil
import subprocess
import sys
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
FFMPEG_URL = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
IS_WINDOWS = sys.platform == 'win32'
HIDDEN = {'creationflags': 0x08000000} if IS_WINDOWS else {}


def data_folder():
    """The mod's own folder, where its Python is: the one above the environment this runs in; none outside one."""
    return os.path.dirname(sys.prefix) if sys.prefix != sys.base_prefix else ''


def own_ffmpeg():
    """Where the mod keeps its own ffmpeg."""
    folder = data_folder()
    return os.path.join(folder, 'bin', 'ffmpeg.exe' if IS_WINDOWS else 'ffmpeg') if folder else ''


def find_ffmpeg():
    """The ffmpeg there is: the PATH's, the mod's own, or Homebrew's on a Mac."""
    places = [shutil.which('ffmpeg'), own_ffmpeg()]
    if sys.platform == 'darwin':
        places += ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg']
    for place in places:
        if place and os.path.isfile(place):
            return place
    return ''


def version_of(program, flag='--version'):
    """A program's first line about itself, or nothing when it does not run."""
    try:
        said = subprocess.run([program, flag], capture_output=True, stdin=subprocess.DEVNULL, timeout=20, **HIDDEN)
    except (OSError, subprocess.TimeoutExpired):
        return ''
    lines = said.stdout.decode('utf-8', 'replace').strip().splitlines()
    return lines[0].strip() if said.returncode == 0 and lines else ''


def download_ffmpeg(target, url=FFMPEG_URL):
    """ffmpeg.exe alone out of the build's zip, to `target`; to a .part first, so one cut halfway is not it."""
    folder = os.path.dirname(target)
    os.makedirs(folder, exist_ok=True)
    packed = os.path.join(folder, 'ffmpeg.zip.part')
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'speedy-code-setup'})
        with urllib.request.urlopen(request, timeout=60) as answer, open(packed, 'wb') as out:
            shutil.copyfileobj(answer, out, 1 << 20)
        with zipfile.ZipFile(packed) as archive:
            member = next((name for name in archive.namelist() if name.replace('\\', '/').endswith('/bin/ffmpeg.exe')), '')
            if not member:
                raise ValueError('el paquete no trae ffmpeg.exe')
            with archive.open(member) as source, open(target + '.part', 'wb') as out:
                shutil.copyfileobj(source, out, 1 << 20)
        os.replace(target + '.part', target)
    finally:
        for left in (packed, target + '.part'):
            try:
                os.remove(left)
            except OSError:
                pass


def ffmpeg(install):
    found = find_ffmpeg()
    if not found and install and IS_WINDOWS and own_ffmpeg():
        try:
            download_ffmpeg(own_ffmpeg())
        except Exception as problem:
            return False, f'no se pudo descargar: {problem}'
        found = find_ffmpeg()
    if not found:
        how = 'se instala con Instalar / reparar todo' if IS_WINDOWS else 'opcional: brew install ffmpeg'
        return False, f'falta ({how}); sin él no se ven los videos que el sistema no reproduce'
    said = version_of(found, '-version')
    if not said:
        return False, f'no corre: {found}'
    words = said.split()
    return True, f'{" ".join(words[:3])}' + (' (propio de speedy-code)' if os.path.normcase(found) == os.path.normcase(own_ffmpeg()) else '')


def tool(name, why, link):
    # bun keeps itself under the person's folder, which a program started outside a terminal may not have on its PATH.
    own = os.path.join(os.path.expanduser('~'), f'.{name}', 'bin', name + ('.exe' if IS_WINDOWS else ''))
    said = version_of(shutil.which(name) or (own if os.path.isfile(own) else name))
    return (True, said) if said else (False, f'falta ({why}): {link}')


def remote_module():
    """remote.py, beside this folder: under `hooks` in Claude Code's mod, under `engine` in OpenCode's."""
    for folder in ('hooks', 'engine'):
        if os.path.isfile(os.path.join(HERE, '..', folder, 'remote.py')):
            sys.path.insert(0, os.path.join(HERE, '..', folder))
            import remote
            return remote
    return None


def remotes():
    remote = remote_module()
    if remote is None:
        return False, 'no encontré remote.py'
    hosts = remote.hosts()
    if not hosts:
        return True, 'ninguna configurada (opcional: un Host mac o windows en ~/.ssh/config)'
    said, is_fine = [], True
    for host in hosts:
        if remote.way(host, True):
            said.append(f'{host}: conectada')
            continue
        is_fine = False
        # ssh alone tells a machine that is not reached from one with no Python.
        reached = False
        for program in remote.ssh_programs():
            try:
                reached = subprocess.run([program] + remote.OPTIONS + [host, 'echo', 'up'], capture_output=True, stdin=subprocess.DEVNULL, timeout=20, **HIDDEN).returncode == 0
            except (OSError, subprocess.TimeoutExpired):
                reached = False
            if reached:
                break
        said.append(f'{host}: falta Python allá' if reached else f'{host}: sin conexión por ssh (clave sin contraseña y servidor ssh encendido)')
    return is_fine, '; '.join(said)


def access():
    if sys.platform != 'darwin':
        return True, 'no hace falta en este sistema'
    try:
        library = ctypes.cdll.LoadLibrary('/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices')
        library.AXIsProcessTrusted.restype = ctypes.c_bool
        is_trusted = bool(library.AXIsProcessTrusted())
    except (OSError, AttributeError) as problem:
        return False, f'no se pudo revisar: {problem}'
    if is_trusted:
        return True, 'la terminal puede pulsar teclas'
    if '--open' in sys.argv:
        subprocess.run(['open', 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'], capture_output=True)
    return False, 'permití tu terminal en Ajustes del Sistema → Privacidad y seguridad → Accesibilidad (pegar imágenes y ⏎)'


def main():
    what = sys.argv[1] if len(sys.argv) > 1 else ''
    if what == 'ffmpeg':
        is_fine, text = ffmpeg('--install' in sys.argv)
    elif what == 'git':
        is_fine, text = tool('git', 'la rama y la actualización', 'https://git-scm.com')
    elif what == 'bun':
        is_fine, text = tool('bun', 'OpenCode lo usa para armar el plugin', 'https://bun.sh')
    elif what == 'remotes':
        is_fine, text = remotes()
    elif what == 'access':
        is_fine, text = access()
    else:
        is_fine, text = False, 'extras.py ffmpeg | git | bun | remotes | access'
    sys.stdout.buffer.write(f'{"ok" if is_fine else "fail"} {text}\n'.encode('utf-8'))
    return 0 if is_fine else 1


if __name__ == '__main__':
    sys.exit(main())
