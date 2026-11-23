"""Joins one narration's parts into a single MP3 for the history, then keeps only the newest ones.

Usage: history.py [--wait] [--text FILE] DEST PART...

With --wait the parts need not be there yet: it waits for each to be made (a part that exists is whole),
so a narration is kept even when it was stopped halfway. If they never all come, nothing is written.

DEST is the file to write, `<description>-yy-mm-dd_hh-mm-ss.mp3`, in the history folder. A name already
taken gets `-2`, `-3`... before its extension. The parts are MP3 frames written one after another, which
players read as one file. The text narrated comes in the SPEEDY_NARRATION environment variable and is
written beside the MP3 as a `.txt` of the same name; with --text it is read from that file (UTF-8) instead. The folder is then cut to the KEEP newest MP3 files,
and each one cut takes its `.txt` with it.
"""

import glob
import os
import shutil
import sys
import time

KEEP = 10
# How long --wait gives the parts to be made: tts.py tries each one three times, twelve seconds a try.
WAIT_SECONDS = 120


def wait_for(parts: list[str], seconds: float = WAIT_SECONDS) -> bool:
    """Waits until every part exists; whether they all came in time."""
    deadline = time.monotonic() + seconds
    while not all(os.path.exists(part) for part in parts):
        if time.monotonic() >= deadline:
            return False
        time.sleep(0.2)
    return True


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
    arguments = sys.argv[1:]
    is_waiting = arguments[:1] == ["--wait"]
    if is_waiting:
        arguments = arguments[1:]
    text = os.environ.get("SPEEDY_NARRATION", "")
    if arguments[:1] == ["--text"]:
        with open(arguments[1], encoding="utf-8") as source:
            text = source.read()
        arguments = arguments[2:]
    dest, *parts = arguments
    if is_waiting and not wait_for(parts):
        return
    target = join(dest, parts)
    write_text(target, text)
    prune(os.path.dirname(dest))


if __name__ == "__main__":
    main()
