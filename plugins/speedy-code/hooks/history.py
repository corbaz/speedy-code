"""Joins one narration's parts into a single MP3 for the history, then keeps only the newest ones.

Usage: history.py DEST PART...

DEST is the file to write, `<description>-yy-mm-dd_hh-mm-ss.mp3`, in the history folder. A name already
taken gets `-2`, `-3`... before its extension. The parts are MP3 frames written one after another, which
players read as one file. The folder is then cut to the KEEP newest MP3 files.
"""

import glob
import os
import shutil
import sys

KEEP = 10


def target_for(dest: str) -> str:
    """The name to write: DEST, or DEST with -2, -3... if that name is taken."""
    base, extension = os.path.splitext(dest)
    target, number = dest, 2
    while os.path.exists(target):
        target = f"{base}-{number}{extension}"
        number += 1
    return target


def join(dest: str, parts: list[str]) -> str:
    """Writes the parts into one file, renamed into place once whole. Returns the file written."""
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    target = target_for(dest)
    temporary = f"{target}.part"
    with open(temporary, "wb") as out:
        for part in parts:
            with open(part, "rb") as source:
                shutil.copyfileobj(source, out)
    os.replace(temporary, target)
    return target


def prune(folder: str) -> None:
    """Deletes the MP3 files past the KEEP newest, by when they were written."""
    files = sorted(glob.glob(os.path.join(folder, "*.mp3")), key=os.path.getmtime, reverse=True)
    for old in files[KEEP:]:
        try:
            os.remove(old)
        except OSError:
            pass


def main() -> None:
    dest, *parts = sys.argv[1:]
    join(dest, parts)
    prune(os.path.dirname(dest))


if __name__ == "__main__":
    main()
