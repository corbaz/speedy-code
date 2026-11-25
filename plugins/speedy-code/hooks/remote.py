"""Another machine's disks for the explorer, reached by ssh: a Mac's files in the explorer of Windows, and
those of Windows in the explorer of a Mac.

    remote.py hosts   the machines there are, a JSON list of names: those of SPEEDY_REMOTES (names apart by
                      commas), or those of `mac` and `windows` that ~/.ssh/config has a `Host` for.
    remote.py mounts  this machine's folders that are another machine's disk mounted over the network (a
                      Mac's /Volumes/share, by smb, afp, nfs or webdav), a JSON list of paths: the explorer
                      leaves them out where the machine is reached by ssh, and its disks are shown once.
    remote.py list    a folder's entries: {"entries": [{"name", "kind": "dir" | "file", "isLink"}]}.
    remote.py stat    what a path is: {"kind": "dir" | "file" | ""}, empty when nothing is there.
    remote.py home    where the machine's disk opens: {"home": the person's folder there}, and `/` on Windows,
                      whose disks are under its root.
    remote.py fetch   a file copied here, into a folder of its own under the temporary one, for the viewer
                      and the clipboard: {"file": its path here}.
    remote.py find    the explorer's filter there: find_files.py itself runs on the machine, over its whole
                      disk (the system's, on Windows), and its lines are said again with each path as the
                      explorer writes it, `mac:/...`. With SPEEDY_TOKEN it can be held: see `pause`.
    remote.py pause   holds the search of that SPEEDY_TOKEN there (SPEEDY_PAUSED `1`), or lets it go on (`0`).
    remote.py pull    a file or a folder of the machine (SPEEDY_PATH) copied or moved (SPEEDY_VERB) here, to
                      SPEEDY_TARGET, its own name included.
    remote.py push    a file or a folder of this machine (SPEEDY_FILE) copied or moved to the machine, to
                      SPEEDY_PATH, its own name included.
    remote.py paste   the same within the machine: SPEEDY_PATH copied or moved to SPEEDY_TARGET, both there.
                      These three answer {"said": "done"}; "exists" when something is there already, which
                      is never written over; "kept" when it was copied but what was to move could not be
                      removed; "error". A folder goes with its files and folders, by tar; links are left out.

SPEEDY_HOST is the machine, as ssh knows it; SPEEDY_PATH the path on it, with `/`; SPEEDY_PATTERN and
SPEEDY_MOST are find_files.py's. A machine with Windows has its disks under its root: `/` holds `C:`, `D:`,
and a path is `/C:/Users/ana`. Nothing is installed on the machine: what runs there is sent with each
asking, to its Python (`python3`, or `python` where there is no such name, as on Windows). ssh never asks
for anything (BatchMode): a machine that would ask a password is not reached, and the answer is
{"error": why} with the exit code 1.
"""
import hashlib
import inspect
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import threading
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

HOME = '''
import json, os
print(json.dumps({'home': '/' if os.name == 'nt' else os.path.expanduser('~')}))
'''

FETCH = THERE + '''
import shutil, sys
with open(PATH, 'rb') as file:
    shutil.copyfileobj(file, sys.stdout.buffer)
'''

# Before find_files.py: the disk it searches there, the system's on Windows, and the file it is held by.
FIND = '''
import os, tempfile
SETTINGS['SPEEDY_ROOT'] = os.environ.get('SystemDrive', 'C:') + '/' if os.name == 'nt' else '/'
if TOKEN:
    SETTINGS['SPEEDY_PAUSE'] = os.path.join(tempfile.gettempdir(), 'speedy-find-' + TOKEN + '.pause')
os.environ.update(SETTINGS)
'''

# The file a search there is held by, written: `1` holds it.
PAUSE = '''
import json, os, tempfile
with open(os.path.join(tempfile.gettempdir(), 'speedy-find-' + TOKEN + '.pause'), 'w') as file:
    file.write(PAUSED)
print(json.dumps({'held': PAUSED == '1'}))
'''

# What was moved from there, removed once its copy is here.
REMOVE = THERE + '''
import json, shutil
if os.path.isdir(PATH) and not os.path.islink(PATH):
    shutil.rmtree(PATH)
else:
    os.remove(PATH)
print(json.dumps({'removed': True}))
'''

# Before paste.py, run there: a path of Windows as Windows writes it, and what paste.py reads.
PASTE = '''
import os
def there(path):
    return path[1:] + ('/' if len(path) == 3 else '') if os.name == 'nt' and path != '/' else path
os.environ.update({'SPEEDY_FILE': there(FROM), 'SPEEDY_TARGET': there(TO), 'SPEEDY_VERB': VERB})
'''


def plain(info):
    """A tar's entry when it is a file or a folder; a link, or anything else, is left out."""
    return info if info.isdir() or info.isreg() else None


def extract(tar, parent, name):
    """Writes under `parent` what a tar holds: only `name` and what lies under it, files and folders alone."""
    more = {'filter': 'data'} if hasattr(tarfile, 'data_filter') else {}
    for member in tar:
        inside = member.name == name or member.name.startswith(name + '/')
        if inside and '..' not in member.name.split('/') and (member.isdir() or member.isreg()):
            tar.extract(member, parent, **more)


# Run there: PATH, a file or a folder, as a tar on its output, named NAME in it.
TAR_OUT = THERE + 'import sys, tarfile\n' + inspect.getsource(plain) + '''
with tarfile.open(fileobj=sys.stdout.buffer, mode='w|') as tar:
    tar.add(PATH, arcname=NAME, filter=plain)
'''

# Run there: the tar on its input written as PATH, unless something is there already.
TAR_IN = THERE + 'import sys, tarfile\n' + inspect.getsource(extract) + '''
if os.path.lexists(PATH):
    print('exists')
    sys.exit(0)
parent, name = os.path.split(PATH.rstrip('/'))
with tarfile.open(fileobj=sys.stdin.buffer, mode='r|') as tar:
    extract(tar, parent, name)
print('done' if os.path.lexists(PATH) else 'error')
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


# The file systems that are another machine's disk.
NETWORK_DISKS = ('smbfs', 'afpfs', 'nfs', 'webdav', 'cifs', 'ftp')


def network_mounts(listing):
    """The folders `mount` lists as another machine's disk: `//ana@pc/d on /Volumes/d (smbfs, nodev)`."""
    found = []
    for line in listing.splitlines():
        mounted = re.match(r'.+ on (/.+) \(([a-z0-9]+)[,)]', line)
        if mounted and mounted.group(2) in NETWORK_DISKS:
            found.append(mounted.group(1))
    return found


def mounts():
    """This machine's folders that are another machine's disk; none where it is not a Mac, or `mount` does not say."""
    if sys.platform != 'darwin':
        return []
    try:
        listed = subprocess.run(['/sbin/mount'], capture_output=True, stdin=subprocess.DEVNULL, timeout=10)
    except (OSError, subprocess.TimeoutExpired):
        return []
    return network_mounts(listed.stdout.decode('utf-8', 'replace'))


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


# A connection cut at once (reset, refused, a name not found for a moment) is tried again after these pauses:
# a network that falters, as Wi-Fi does, gives it the next time. One that waited its whole time out is not:
# the machine is off, and saying so is not to take three times as long.
AGAIN_PAUSES = (0.7, 1.5)
CUT_SECONDS = 3


def find_way(host):
    """How the machine is reached: the ssh program that connects and its Python's name, asked of it; or None."""
    for pause in (0,) + AGAIN_PAUSES:
        time.sleep(pause)
        was_cut = False
        for program in ssh_programs():
            for python in PYTHONS:
                started = time.time()
                try:
                    done = subprocess.run([program] + OPTIONS + [host, python, '--version'], capture_output=True, stdin=subprocess.DEVNULL, timeout=20, **HIDDEN)
                except (OSError, subprocess.TimeoutExpired):
                    break
                if done.returncode == 0:
                    return [program, python]
                if done.returncode == 255:
                    # ssh itself did not connect: its other program may.
                    was_cut = was_cut or time.time() - started < CUT_SECONDS
                    break
        if not was_cut:
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
        for pause in (0,) + AGAIN_PAUSES:
            time.sleep(pause)
            started = time.time()
            try:
                done = subprocess.run([found[0]] + OPTIONS + [host, found[1], '-'], input=script.encode('utf-8'), capture_output=True, timeout=timeout, **HIDDEN)
            except (OSError, subprocess.TimeoutExpired):
                break
            if done.returncode == 0:
                return done.stdout
            # A script that failed there has its answer: none.
            if done.returncode != 255:
                return None
            # A connection cut at once is tried again; a way that no longer connects is found anew, once.
            if time.time() - started >= CUT_SECONDS:
                break
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


def remove(path):
    """Removes a file, or a folder with what it holds; whether it did."""
    try:
        if os.path.isdir(path) and not os.path.islink(path):
            shutil.rmtree(path)
        elif os.path.lexists(path):
            os.remove(path)
    except OSError:
        return False
    return True


def pull(host, path, target, verb):
    """A file or a folder there copied here as `target`, by tar; moved, it is removed there after."""
    if not target or verb not in ('copy', 'move'):
        return 'error'
    if os.path.lexists(target):
        return 'exists'
    found = way(host)
    if not found:
        return 'error'
    parent, name = os.path.split(os.path.abspath(target))
    script = f'PATH = {ascii(path)}\nNAME = {ascii(name)}\n{TAR_OUT}'
    try:
        ssh = subprocess.Popen([found[0]] + OPTIONS + [host, found[1], '-'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, **HIDDEN)
        ssh.stdin.write(script.encode('utf-8'))
        ssh.stdin.close()
        with tarfile.open(fileobj=ssh.stdout, mode='r|') as tar:
            extract(tar, parent, name)
        # What a tar is filled with after its end is read too: unread, the machine would wait to write it.
        while ssh.stdout.read(65536):
            pass
        whole = ssh.wait() == 0 and os.path.lexists(target)
    except (OSError, tarfile.TarError):
        whole = False
    if not whole:
        # What was written of it is not left half done: nothing was there before.
        remove(target)
        return 'error'
    if verb == 'move':
        return 'done' if ask(host, REMOVE, path) == {'removed': True} else 'kept'
    return 'done'


def push(host, source, path, verb):
    """A file or a folder of this machine copied there as `path`, by tar; moved, it is removed here after."""
    if verb not in ('copy', 'move') or not source or not os.path.lexists(source):
        return 'error'
    found = way(host)
    if not found:
        return 'error'
    name = path.rstrip('/').rsplit('/', 1)[-1]
    script = f'PATH = {ascii(path)}\n{TAR_IN}'.encode('utf-8')
    # The script goes first on the input, then the tar: the machine's Python reads its own length of it.
    start = f'{found[1]} -c "import sys;exec(sys.stdin.buffer.read({len(script)}).decode())"'
    try:
        ssh = subprocess.Popen([found[0]] + OPTIONS + [host, start], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, **HIDDEN)
    except OSError:
        return 'error'

    def send():
        try:
            ssh.stdin.write(script)
            with tarfile.open(fileobj=ssh.stdin, mode='w|') as tar:
                tar.add(source, arcname=name, filter=plain)
        except (OSError, tarfile.TarError):
            pass
        finally:
            try:
                ssh.stdin.close()
            except OSError:
                pass

    sending = threading.Thread(target=send, daemon=True)
    sending.start()
    out = ssh.stdout.read().decode('utf-8', 'replace').strip()
    sending.join()
    said = out.splitlines()[-1].strip() if ssh.wait() == 0 and out else 'error'
    if said != 'done':
        return 'exists' if said == 'exists' else 'error'
    if verb == 'move':
        return 'done' if remove(source) else 'kept'
    return 'done'


def paste_there(host, path, target, verb):
    """A file or a folder of the machine copied or moved within it: paste.py itself runs there."""
    with open(os.path.join(HERE, 'paste.py'), encoding='utf-8') as file:
        source = file.read()
    out = python_there(host, f'FROM = {ascii(path)}\nTO = {ascii(target)}\nVERB = {ascii(verb)}\n{PASTE}\n{source}', timeout=None)
    text = out.decode('utf-8', 'replace').strip() if out else ''
    return text.splitlines()[-1].strip() if text else 'error'


def find(host):
    """find_files.py run there over the whole disk; its lines said again, each path with the machine before it."""
    with open(os.path.join(HERE, 'find_files.py'), encoding='utf-8') as file:
        source = file.read()
    settings = {'SPEEDY_FIRST': '', 'SPEEDY_PATTERN': os.environ.get('SPEEDY_PATTERN', ''), 'SPEEDY_MOST': os.environ.get('SPEEDY_MOST', '')}
    token = os.environ.get('SPEEDY_TOKEN', '')
    script = f'SETTINGS = {ascii(settings)}\nTOKEN = {ascii(token if re.fullmatch(r"[A-Za-z0-9-]+", token) else "")}\n{FIND}\n{source}'
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
    if mode == 'mounts':
        say(mounts())
        return 0
    host = os.environ.get('SPEEDY_HOST', '')
    path = os.environ.get('SPEEDY_PATH', '')
    if not re.fullmatch(r'[A-Za-z][\w.-]+', host):
        say({'error': 'no machine'})
        return 1
    if mode == 'find':
        find(host)
        return 0
    if mode == 'pause':
        token = os.environ.get('SPEEDY_TOKEN', '')
        if not re.fullmatch(r'[A-Za-z0-9-]+', token):
            say({'error': 'no token'})
            return 1
        out = python_there(host, f'TOKEN = {ascii(token)}\nPAUSED = {ascii("1" if os.environ.get("SPEEDY_PAUSED") == "1" else "0")}\n{PAUSE}')
        say({'held': os.environ.get('SPEEDY_PAUSED') == '1'} if out is not None else {'error': 'not reached'})
        return 0 if out is not None else 1
    if mode == 'home':
        answer = ask(host, HOME, '/')
        say(answer if answer is not None else {'error': 'not reached'})
        return 0 if answer is not None else 1
    if not path.startswith('/'):
        say({'error': 'no path'})
        return 1
    if mode in ('pull', 'push', 'paste'):
        verb = os.environ.get('SPEEDY_VERB', '')
        target = os.environ.get('SPEEDY_TARGET', '')
        if mode == 'pull':
            said = pull(host, path, target, verb)
        elif mode == 'push':
            said = push(host, os.environ.get('SPEEDY_FILE', ''), path, verb)
        else:
            said = paste_there(host, path, target, verb) if target.startswith('/') and verb in ('copy', 'move') else 'error'
        say({'said': said})
        return 0 if said in ('done', 'kept') else 1
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
