"""Finds the files of a disk whose names match a pattern, for the explorer's filter.

SPEEDY_ROOT is the folder searched, with all it holds. SPEEDY_PATTERN is the pattern, `*.pdf` or `a*.docx`:
`*` is any text and `?` any one character, whatever the case; a pattern with neither is a part of the name.
SPEEDY_MOST is the most files it finds (1000 when not given). SPEEDY_FIRST, a folder under the root, is
searched before the rest, and the person's own folder after it: what is looked for is most often there, and
a whole disk takes minutes.

Four times a second it says a JSON object on a line of its own, in ASCII: {"paths": [...], "seen": n}, the
files found since the line before (each path with `/` alone) and the entries looked at so far. The last line
has "done": true and "cut", whether it stopped at the most with folders still unread.

SPEEDY_PAUSE, when given, is a file the search is held by: while it holds `1` the search waits where it is,
and goes on from there once it holds anything else. Held, it says a line with nothing found every two
seconds, so it ends when nobody reads any more. The file is removed when the search ends.

Links and junctions are never followed. The folders of the system that hold no file of a person's and take
the longest, or that macOS asks a permission for, are not read: see `unread`. Nor are the folders named
`node_modules` and `.git`, wherever they are: they hold a great many files, and none a person keeps.
"""
import collections
import json
import os
import re
import sys
import time

SAY_EVERY = 0.25
# Held, how often it looks whether it was let go, and how often it says it is still there.
HELD_LOOK = 0.2
HELD_SAY = 2.0
# A junction, as Windows tags it: a folder that is another one, never followed.
JUNCTION = 0xA0000003
# Folders left unread wherever they are, by their names in small letters.
NEVER_READ = {'node_modules', '.git'}


def matcher(pattern):
    """The pattern as what tells whether a name matches it."""
    text = pattern.strip()
    if '*' not in text and '?' not in text:
        text = f'*{text}*'
    body = ''.join('.*' if char == '*' else '.' if char == '?' else re.escape(char) for char in text)
    return re.compile(body, re.IGNORECASE | re.DOTALL).fullmatch


def unread(root):
    """The folders under `root` that are not read, as scandir writes their paths."""
    if sys.platform == 'win32':
        return {os.path.join(root, name).lower() for name in ('$Recycle.Bin', 'System Volume Information', 'Windows')}
    if root == '/':
        return {'/System', '/private', '/dev', '/Volumes', '/cores', '/proc', '/net', '/Network'}
    return set()


def is_unread(path, name, skipped):
    """Whether a folder is left unread: node_modules or .git, one of the system's, a person's Library or a
    Photos library on a Mac."""
    if name.lower() in NEVER_READ:
        return True
    if sys.platform == 'win32':
        return path.lower() in skipped
    if path in skipped or name.endswith('.photoslibrary'):
        return True
    return name == 'Library' and os.path.dirname(os.path.dirname(path)) == '/Users'


def is_junction(entry):
    if sys.platform != 'win32':
        return False
    try:
        return getattr(entry.stat(follow_symlinks=False), 'st_reparse_tag', 0) == JUNCTION
    except OSError:
        return True


def say(found, seen, **more):
    line = json.dumps({'paths': [path.replace('\\', '/') for path in found], 'seen': seen, **more})
    try:
        sys.stdout.write(line + '\n')
        sys.stdout.flush()
    except OSError:
        # Nobody reads any more: the filter was cleared, or the explorer closed.
        os._exit(0)


def is_held(pause):
    """Whether the file the search is held by says so."""
    try:
        with open(pause, encoding='ascii', errors='replace') as file:
            return file.read(1) == '1'
    except OSError:
        return False


def wait_while_held(pause, seen):
    """Waits while the search is held, saying now and then that it is still there."""
    said = time.monotonic()
    while is_held(pause):
        time.sleep(HELD_LOOK)
        if time.monotonic() - said >= HELD_SAY:
            say([], seen)
            said = time.monotonic()


def forget_old(pause):
    """Removes the files other searches were held by and left, a day old: one that was killed never removes its own."""
    folder, name = os.path.split(pause)
    start, end = name.split('-')[0] + '-', os.path.splitext(name)[1]
    try:
        for entry in os.scandir(folder):
            if entry.name.startswith(start) and entry.name.endswith(end) and time.time() - entry.stat().st_mtime > 24 * 3600:
                os.remove(entry.path)
    except OSError:
        pass


def main():
    if os.environ.get('SPEEDY_PAUSE'):
        forget_old(os.environ['SPEEDY_PAUSE'])
    try:
        search()
    finally:
        pause = os.environ.get('SPEEDY_PAUSE', '')
        if pause:
            try:
                os.remove(pause)
            except OSError:
                pass


def search():
    root = os.environ.get('SPEEDY_ROOT', '')
    pause = os.environ.get('SPEEDY_PAUSE', '')
    pattern = os.environ.get('SPEEDY_PATTERN', '')
    most = int(os.environ.get('SPEEDY_MOST', '') or 1000)
    if not root or not pattern.strip():
        say([], 0, done=True, cut=False)
        return
    matches = matcher(pattern)
    skipped = unread(root)
    # The folders searched first, then the root; each is left out when the search of the root meets it again.
    key = os.path.normcase
    starts = []
    for start in (os.environ.get('SPEEDY_FIRST', ''), os.path.expanduser('~'), root):
        start = os.path.normpath(start) if start else ''
        inside = start and (key(start) + os.sep).startswith(key(os.path.normpath(root)).rstrip(os.sep) + os.sep)
        if inside and os.path.isdir(start) and key(start) not in map(key, starts):
            starts.append(start)
    done = {key(start) for start in starts[:-1]}
    folders = collections.deque()
    found, total, seen, said = [], 0, 0, time.monotonic()
    # Looked at before its first folder: a search may start held.
    looked = said - SAY_EVERY
    while (folders or starts) and total < most:
        if not folders:
            folders.append(starts.pop(0))
        # Held: what was found goes out first, then it waits, and goes on from this folder.
        if pause and time.monotonic() - looked >= SAY_EVERY:
            if is_held(pause):
                say(found, seen)
                found = []
                wait_while_held(pause, seen)
                said = time.monotonic()
            looked = time.monotonic()
        try:
            entries = os.scandir(folders.popleft())
        except OSError:
            continue
        with entries:
            while total < most:
                try:
                    entry = next(entries, None)
                except OSError:
                    break
                if entry is None:
                    break
                seen += 1
                try:
                    if entry.is_symlink():
                        continue
                    if entry.is_dir(follow_symlinks=False):
                        if key(entry.path) not in done and not is_unread(entry.path, entry.name, skipped) and not is_junction(entry):
                            folders.append(entry.path)
                    elif matches(entry.name):
                        found.append(entry.path)
                        total += 1
                except OSError:
                    continue
                if seen % 256 == 0 and time.monotonic() - said >= SAY_EVERY:
                    say(found, seen)
                    found, said = [], time.monotonic()
                    if pause and is_held(pause):
                        wait_while_held(pause, seen)
                        said = looked = time.monotonic()
    say(found, seen, done=True, cut=total >= most and bool(folders or starts))


if __name__ == '__main__':
    main()
