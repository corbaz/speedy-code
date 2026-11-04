"""Joins one narration's parts into a single MP3 for the history, then keeps only the newest ones.

Usage: history.py DEST PART...

DEST is the file to write, `<description>-yy-mm-dd_hh-mm-ss.mp3`, in the history folder. A name already
taken gets `-2`, `-3`... before its extension. The parts are MP3 frames written one after another, which
players read as one file. The text narrated comes in the SPEEDY_NARRATION environment variable and is
written beside the MP3 as a `.txt` of the same name. The folder is then cut to the KEEP newest MP3 files,
and each one cut takes its `.txt` with it.
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


def write_text(mp3: str, text: str) -> None:
    """Writes the narrated text beside the MP3, with the same name and a .txt extension."""
    with open(os.path.splitext(mp3)[0] + ".txt", "w", encoding="utf-8") as file:
        file.write(text)


def prune(folder: str) -> None:
    """Deletes the MP3 files past the KEEP newest, by when they were written, and their .txt."""
    files = sorted(glob.glob(os.path.join(folder, "*.mp3")), key=os.path.getmtime, reverse=True)
    for old in files[KEEP:]:
        for path in (old, os.path.splitext(old)[0] + ".txt"):
            try:
                os.remove(path)
            except OSError:
                pass


def main() -> None:
    dest, *parts = sys.argv[1:]
    target = join(dest, parts)
    write_text(target, os.environ.get("SPEEDY_NARRATION", ""))
    prune(os.path.dirname(dest))


if __name__ == "__main__":
    main()
