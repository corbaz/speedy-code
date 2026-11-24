"""The explorer's paste: the file or the folder 📋 took, copied or moved into another folder.

SPEEDY_FILE is what goes, SPEEDY_TARGET where, its own name included, and SPEEDY_VERB `copy` or `move`.
Prints `done`. Nothing is ever written over: `exists` when something is there already. A folder does not go
into itself: `inside`. Anything else that fails says `error`. All but `done` exit with the code 1.
"""
import os
import shutil
import sys


def is_inside(folder, target):
    """Whether `target` is `folder` or lies under it."""
    try:
        whole = os.path.realpath(folder)
        return os.path.commonpath([whole, os.path.realpath(target)]) == whole
    except ValueError:
        # Two disks of Windows have no path in common.
        return False


def paste(source, target, verb):
    if not source or not target or verb not in ('copy', 'move') or not os.path.lexists(source):
        return 'error'
    if os.path.lexists(target):
        return 'exists'
    is_folder = os.path.isdir(source) and not os.path.islink(source)
    if is_folder and is_inside(source, os.path.dirname(os.path.abspath(target))):
        return 'inside'
    try:
        if verb == 'move':
            shutil.move(source, target)
        elif is_folder:
            shutil.copytree(source, target, symlinks=True)
        else:
            shutil.copy2(source, target, follow_symlinks=False)
    except (OSError, shutil.Error):
        return 'error'
    return 'done'


def main():
    said = paste(os.environ.get('SPEEDY_FILE', ''), os.environ.get('SPEEDY_TARGET', ''), os.environ.get('SPEEDY_VERB', ''))
    sys.stdout.write(said + '\n')
    sys.stdout.flush()
    return 0 if said == 'done' else 1


if __name__ == '__main__':
    sys.exit(main())
