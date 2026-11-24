"""Another machine's disk for the explorer, reached by ssh: a Mac's files in the explorer of Windows.

    remote.py hosts   the machines there are, a JSON list of names: those of SPEEDY_REMOTES (names apart by
                      commas), or `mac` alone when ~/.ssh/config has a `Host mac`.
    remote.py list    a folder's entries: {"entries": [{"name", "kind": "dir" | "file", "isLink"}]}.
    remote.py stat    what a path is: {"kind": "dir" | "file" | ""}, empty when nothing is there.
    remote.py fetch   a file copied here, into a folder of its own under the temporary one, for the viewer
                      and the clipboard: {"file": its path here}.
    remote.py find    the explorer's filter there: find_files.py itself runs on the machine, over its whole
                      disk, and its lines are said again with each path as the explorer writes it, `mac:/...`.

SPEEDY_HOST is the machine, as ssh knows it; SPEEDY_PATH the path on it, with `/`; SPEEDY_PATTERN and
SPEEDY_MOST are find_files.py's. Nothing is installed on the machine: what runs there is sent with each
asking, to its `python3`. ssh never asks for anything (BatchMode): a machine that would ask a password is
not reached, and the answer is {"error": why} with the exit code 1.
"""
import hashlib
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
OPTIONS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8']
# What ssh itself ends with when it did not connect, whatever was to run there.
NOT_CONNECTED = 255
# No console window of ssh's own flashes on Windows.
HIDDEN = {'creationflags': 0x08000000} if sys.platform == 'win32' else {}
# A copy fetched stays a day: the viewer may still show it, the clipboard still hold it.
KEPT_SECONDS = 24 * 3600

LIST = '''
import json, os
out = []
with os.scandir(PATH) as entries:
    for entry in entries:
        try:
            link = entry.is_symlink()
            out.append({'name': entry.name, 'kind': 'dir' if entry.is_dir(follow_symlinks=False) else 'file', 'isLink': link})
        except OSError:
            pass
print(json.dumps({'entries': out}))
'''

STAT = '''
import json, os
print(json.dumps({'kind': 'dir' if os.path.isdir(PATH) else 'file' if os.path.exists(PATH) else ''}))
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
    return ['mac'] if 'mac' in known else []


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


def connects(program, host):
    """Whether one ssh program reaches the machine, with nothing to run there."""
    try:
        return subprocess.run([program] + OPTIONS + [host, 'true'], capture_output=True, stdin=subprocess.DEVNULL, timeout=20, **HIDDEN).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def run_there(host, command, **how):
    """A command run on the machine, by the first ssh program that connects; None when none ran."""
    done = None
    for program in ssh_programs():
        try:
            done = subprocess.run([program] + OPTIONS + [host] + command, **how, **HIDDEN)
        except (OSError, subprocess.TimeoutExpired):
            continue
        if done.returncode != NOT_CONNECTED:
            return done
    return done


def python_there(host, script, timeout=30):
    """Runs a script on the machine's python3, sent by its input; what it printed, or None."""
    done = run_there(host, ['python3', '-'], input=script.encode('utf-8'), capture_output=True, timeout=timeout)
    return done.stdout.decode('utf-8', 'replace') if done is not None and done.returncode == 0 else None


def ask(host, script, path):
    """A script's JSON answer about a path there."""
    script = f'PATH = {ascii(path)}\n{script}'
    # A connection refused or dropped once is tried again: a folder would stay unread until opened anew.
    out = python_there(host, script) or python_there(host, script)
    try:
        return json.loads(out.strip().splitlines()[-1]) if out and out.strip() else None
    except ValueError:
        return None


def fetch(host, path):
    """The file there copied here; its path here, or None."""
    base = os.path.join(tempfile.gettempdir(), 'speedy-remote')
    os.makedirs(base, exist_ok=True)
    for old in os.listdir(base):
        one = os.path.join(base, old)
        try:
            if time.time() - os.path.getmtime(one) > KEPT_SECONDS:
                shutil.rmtree(one, ignore_errors=True)
        except OSError:
            pass
    folder = os.path.join(base, hashlib.sha1(f'{host}:{path}'.encode('utf-8')).hexdigest()[:12])
    os.makedirs(folder, exist_ok=True)
    os.utime(folder, None)
    target = os.path.join(folder, re.sub(r'[\\/:*?"<>|]', '_', path.rsplit('/', 1)[-1]) or 'file')
    try:
        done = run_there(host, ['cat -- ' + shlex.quote(path)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL)
        if done is not None and done.returncode == 0:
            with open(target, 'wb') as file:
                file.write(done.stdout)
    except OSError:
        done = None
    if done is None or done.returncode != 0:
        shutil.rmtree(folder, ignore_errors=True)
        return None
    return target


def find(host):
    """find_files.py run there over the whole disk; its lines said again, each path with the machine before it."""
    with open(os.path.join(HERE, 'find_files.py'), encoding='utf-8') as file:
        source = file.read()
    settings = {'SPEEDY_ROOT': '/', 'SPEEDY_FIRST': '', 'SPEEDY_PATTERN': os.environ.get('SPEEDY_PATTERN', ''), 'SPEEDY_MOST': os.environ.get('SPEEDY_MOST', '')}
    script = f'import os\nos.environ.update({ascii(settings)})\n{source}'
    # The search goes by the ssh program that connects.
    programs = ssh_programs()
    program = next((one for one in programs if connects(one, host)), programs[0])
    try:
        search = subprocess.Popen([program] + OPTIONS + [host, 'python3', '-'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, **HIDDEN)
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
            said['paths'] = [f'{host}:{path}' for path in said.get('paths', [])]
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
