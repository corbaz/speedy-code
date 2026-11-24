"""Another machine's disks for the explorer, reached by ssh: a Mac's files in the explorer of Windows, and
those of Windows in the explorer of a Mac.

    remote.py hosts   the machines there are, a JSON list of names: those of SPEEDY_REMOTES (names apart by
                      commas), or those of `mac` and `windows` that ~/.ssh/config has a `Host` for.
    remote.py list    a folder's entries: {"entries": [{"name", "kind": "dir" | "file", "isLink"}]}.
    remote.py stat    what a path is: {"kind": "dir" | "file" | ""}, empty when nothing is there.
    remote.py fetch   a file copied here, into a folder of its own under the temporary one, for the viewer
                      and the clipboard: {"file": its path here}.
    remote.py find    the explorer's filter there: find_files.py itself runs on the machine, over its whole
                      disk (the system's, on Windows), and its lines are said again with each path as the
                      explorer writes it, `mac:/...`.

SPEEDY_HOST is the machine, as ssh knows it; SPEEDY_PATH the path on it, with `/`; SPEEDY_PATTERN and
SPEEDY_MOST are find_files.py's. A machine with Windows has its disks under its root: `/` holds `C:`, `D:`,
and a path is `/C:/Users/ana`. Nothing is installed on the machine: what runs there is sent with each
asking, to its Python (`python3`, or `python` where there is no such name, as on Windows). ssh never asks
for anything (BatchMode): a machine that would ask a password is not reached, and the answer is
{"error": why} with the exit code 1.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
OPTIONS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8']
# The machines a disk is shown of with nothing set, when ~/.ssh/config names them.
KNOWN_HOSTS = ('mac', 'windows')
# The names a machine's Python may have: `python3` on a Mac or Linux, `python` on Windows.
PYTHONS = ('python3', 'python')
# No console window of ssh's own flashes on Windows.
HIDDEN = {'creationflags': 0x08000000} if sys.platform == 'win32' else {}
# A copy fetched stays a day: the viewer may still show it, the clipboard still hold it.
KEPT_SECONDS = 24 * 3600

# Before each script: PATH is the path asked. On Windows `/C:/Users` is `C:/Users`, and `/C:` the disk's root.
THERE = '''
import os
ROOT = os.name == 'nt' and PATH == '/'
if os.name == 'nt' and not ROOT:
    PATH = PATH[1:] + ('/' if len(PATH) == 3 else '')
'''

LIST = THERE + '''
import json
out = []
if ROOT:
    out = [{'name': letter + ':', 'kind': 'dir', 'isLink': False} for letter in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' if os.path.isdir(letter + ':/')]
else:
    with os.scandir(PATH) as entries:
        for entry in entries:
            try:
                link = entry.is_symlink()
                out.append({'name': entry.name, 'kind': 'dir' if entry.is_dir(follow_symlinks=False) else 'file', 'isLink': link})
            except OSError:
                pass
print(json.dumps({'entries': out}))
'''

STAT = THERE + '''
import json
print(json.dumps({'kind': 'dir' if ROOT or os.path.isdir(PATH) else 'file' if os.path.exists(PATH) else ''}))
'''

FETCH = THERE + '''
import shutil, sys
with open(PATH, 'rb') as file:
    shutil.copyfileobj(file, sys.stdout.buffer)
'''

# Before find_files.py: the disk it searches there, the system's on Windows.
FIND = '''
import os
SETTINGS['SPEEDY_ROOT'] = os.environ.get('SystemDrive', 'C:') + '/' if os.name == 'nt' else '/'
os.environ.update(SETTINGS)
'''


def say(what):
    sys.stdout.write(json.dumps(what) + '\n')
    sys.stdout.flush()


def hosts():
    """The machines the explorer shows a disk of."""
    named = [name.strip() for name in os.environ.get('SPEEDY_REMOTES', '').split(',') if name.strip()]
    if named:
        return [name for name in named if re.fullmatch(r'[A-Za-z][\w.-]+', name)]
    try:
        with open(os.path.join(os.path.expanduser('~'), '.ssh', 'config'), encoding='utf-8', errors='replace') as file:
            known = [name for line in file if line.strip().lower().startswith('host ') for name in line.split()[1:]]
    except OSError:
        return []
    return [name for name in KNOWN_HOSTS if name in known]


def ssh_programs():
    """The ssh programs to try, in order: the one the PATH finds, then, on Windows, Git's own.

    Windows has two: its own refuses ~/.ssh/config when another account may read it ("Bad owner or
    permissions"), and Git's does not; which one the PATH finds first depends on where the program was started.
    """
    found = [shutil.which('ssh')]
    if sys.platform == 'win32':
        git = shutil.which('git')
        roots = [os.path.dirname(os.path.dirname(git))] if git else []
        roots += [os.path.join(os.environ[name], 'Git') for name in ('ProgramFiles', 'ProgramW6432') if os.environ.get(name)]
        if os.environ.get('LOCALAPPDATA'):
            roots.append(os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'Git'))
        found += [os.path.join(root, 'usr', 'bin', 'ssh.exe') for root in roots]
    programs = []
    for program in found:
        if program and os.path.isfile(program) and os.path.normcase(os.path.realpath(program)) not in [os.path.normcase(os.path.realpath(one)) for one in programs]:
            programs.append(program)
    return programs or ['ssh']


def base():
    """The folder under the temporary one where the copies fetched and what is known of each machine are kept."""
    folder = os.path.join(tempfile.gettempdir(), 'speedy-remote')
    os.makedirs(folder, exist_ok=True)
    return folder


def way_file(host):
    return os.path.join(base(), f'{host}.way.json')


def find_way(host):
    """How the machine is reached: the ssh program that connects and its Python's name, asked of it; or None."""
    for program in ssh_programs():
        for python in PYTHONS:
            try:
                done = subprocess.run([program] + OPTIONS + [host, python, '--version'], capture_output=True, stdin=subprocess.DEVNULL, timeout=20, **HIDDEN)
            except (OSError, subprocess.TimeoutExpired):
                break
            if done.returncode == 0:
                return [program, python]
            if done.returncode == 255:
                # ssh itself did not connect: its other program may.
                break
    return None


def way(host, anew=False):
    """How the machine is reached, as found before (kept a day) or found now; None when it is not reached."""
    kept = way_file(host)
    if not anew:
        try:
            if time.time() - os.path.getmtime(kept) < KEPT_SECONDS:
                with open(kept, encoding='utf-8') as file:
                    found = json.load(file)
                if isinstance(found, list) and len(found) == 2 and os.path.isfile(found[0]):
                    return found
        except (OSError, ValueError):
            pass
    found = find_way(host)
    try:
        if found:
            with open(kept, 'w', encoding='utf-8') as file:
                json.dump(found, file)
        elif os.path.exists(kept):
            os.remove(kept)
    except OSError:
        pass
    return found


def python_there(host, script, timeout=30):
    """Runs a script on the machine's Python, sent by its input; the bytes it printed, or None."""
    for anew in (False, True):
        found = way(host, anew)
        if not found:
            continue
        try:
            done = subprocess.run([found[0]] + OPTIONS + [host, found[1], '-'], input=script.encode('utf-8'), capture_output=True, timeout=timeout, **HIDDEN)
        except (OSError, subprocess.TimeoutExpired):
            continue
        if done.returncode == 0:
            return done.stdout
        # A way that no longer connects is found anew, once; a script that failed there has its answer: none.
        if done.returncode != 255:
            return None
    return None


def ask(host, script, path):
    """A script's JSON answer about a path there."""
    out = python_there(host, f'PATH = {ascii(path)}\n{script}')
    text = out.decode('utf-8', 'replace').strip() if out else ''
    try:
        return json.loads(text.splitlines()[-1]) if text else None
    except ValueError:
        return None


def fetch(host, path):
    """The file there copied here; its path here, or None."""
    for old in os.listdir(base()):
        one = os.path.join(base(), old)
        try:
            if os.path.isdir(one) and time.time() - os.path.getmtime(one) > KEPT_SECONDS:
                shutil.rmtree(one, ignore_errors=True)
        except OSError:
            pass
    folder = os.path.join(base(), hashlib.sha1(f'{host}:{path}'.encode('utf-8')).hexdigest()[:12])
    target = os.path.join(folder, re.sub(r'[\\/:*?"<>|]', '_', path.rsplit('/', 1)[-1]) or 'file')
    out = python_there(host, f'PATH = {ascii(path)}\n{FETCH}', timeout=300)
    if out is None:
        return None
    try:
        os.makedirs(folder, exist_ok=True)
        os.utime(folder, None)
        with open(target, 'wb') as file:
            file.write(out)
    except OSError:
        return None
    return target


def find(host):
    """find_files.py run there over the whole disk; its lines said again, each path with the machine before it."""
    with open(os.path.join(HERE, 'find_files.py'), encoding='utf-8') as file:
        source = file.read()
    settings = {'SPEEDY_FIRST': '', 'SPEEDY_PATTERN': os.environ.get('SPEEDY_PATTERN', ''), 'SPEEDY_MOST': os.environ.get('SPEEDY_MOST', '')}
    script = f'SETTINGS = {ascii(settings)}\n{FIND}\n{source}'
    found = way(host)
    try:
        if not found:
            raise OSError('not reached')
        search = subprocess.Popen([found[0]] + OPTIONS + [host, found[1], '-'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, **HIDDEN)
    except OSError:
        say({'paths': [], 'seen': 0, 'done': True, 'cut': False})
        return
    try:
        search.stdin.write(script.encode('utf-8'))
        search.stdin.close()
        ended = False
        for line in search.stdout:
            try:
                said = json.loads(line)
            except ValueError:
                continue
            # A path of Windows, `C:/Users/ana`, is under the machine's root as a Mac's is: `/C:/Users/ana`.
            said['paths'] = [f'{host}:{path}' if path.startswith('/') else f'{host}:/{path}' for path in said.get('paths', [])]
            ended = ended or said.get('done') is True
            say(said)
        if not ended:
            say({'paths': [], 'seen': 0, 'done': True, 'cut': False})
    except OSError:
        # Nobody reads any more: the filter was cleared, or the explorer closed.
        pass
    finally:
        try:
            search.kill()
        except OSError:
            pass


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ''
    if mode == 'hosts':
        say(hosts())
        return 0
    host = os.environ.get('SPEEDY_HOST', '')
    path = os.environ.get('SPEEDY_PATH', '')
    if not re.fullmatch(r'[A-Za-z][\w.-]+', host):
        say({'error': 'no machine'})
        return 1
    if mode == 'find':
        find(host)
        return 0
    if not path.startswith('/'):
        say({'error': 'no path'})
        return 1
    if mode in ('list', 'stat'):
        answer = ask(host, LIST if mode == 'list' else STAT, path)
        say(answer if answer is not None else {'error': 'not reached'})
        return 0 if answer is not None else 1
    if mode == 'fetch':
        target = fetch(host, path)
        say({'file': target.replace('\\', '/')} if target else {'error': 'not fetched'})
        return 0 if target else 1
    say({'error': 'no mode'})
    return 1


if __name__ == '__main__':
    sys.exit(main())
