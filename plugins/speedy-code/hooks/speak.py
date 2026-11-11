"""Speaks NARRATOR_TEXT with the Microsoft Edge neural voice NARRATOR_VOICE (edge-tts), for the speedy-code mod on macOS.

It does what speak.ps1 does on Windows, with afplay in place of Windows' media player:
prints "voice <name>" once the audio plays, "." every tenth of a second while it plays, "error ..." on failure.
Reads NARRATOR_CONTROL while it plays: "pause" pauses it, "play" goes on from where it stands.
With NARRATOR_SAVE_AS set, the whole narration is joined into that file once it has played (history.py).

The text is cut in up to five parts at sentence ends, all synthesized at once (tts.py): the first plays as
soon as it is ready while the rest are still being made, and each plays after the one before.
"""

import glob
import hashlib
import math
import os
import re
import subprocess
import sys
import tempfile
import time

from player import Player, say, stop_on_signals

MAX_PARTS = 5
HERE = os.path.dirname(os.path.abspath(__file__))
HOUR = 3600


def rate_of(speed_text: str) -> str:
    """The edge-tts rate for a speed multiple: 1.3 → +30%."""
    try:
        speed = float(speed_text)
    except ValueError:
        speed = 1.0
    if speed <= 0:
        speed = 1.0
    percent = round((speed - 1) * 100)
    return f"+{percent}%" if percent >= 0 else f"{percent}%"


def parts_of(text: str) -> list[str]:
    """Up to five parts of about the same length, each ending where a sentence ends."""
    sentences = [one for one in re.split(r"(?<=[.!?…:;])\s+", text.strip()) if one.strip()]
    size = max(1, math.ceil(len(text) / MAX_PARTS))
    parts: list[str] = []
    part = ""
    for sentence in sentences:
        part = f"{part} {sentence}" if part else sentence
        if len(part) >= size and len(parts) < MAX_PARTS - 1:
            parts.append(part)
            part = ""
    if part:
        parts.append(part)
    return parts


def remove_older(pattern: str) -> None:
    """A narration cut short never cleans up after itself: its files go an hour later."""
    limit = time.time() - HOUR
    for path in glob.glob(pattern):
        try:
            if os.path.getmtime(path) < limit:
                os.remove(path)
        except OSError:
            pass


def asked(control: str) -> str:
    """What the mod wrote in the control file: "pause", "play", or nothing."""
    if not control:
        return ""
    try:
        with open(control, encoding="utf-8") as source:
            return source.read().strip()
    except OSError:
        return ""


def main() -> int:
    text = os.environ.get("NARRATOR_TEXT", "")
    voice = os.environ.get("NARRATOR_VOICE", "")
    control = os.environ.get("NARRATOR_CONTROL", "")
    save_as = os.environ.get("NARRATOR_SAVE_AS", "")
    if not text or not voice:
        return 0
    rate = rate_of(os.environ.get("NARRATOR_SPEED", "1"))
    temp = tempfile.gettempdir()
    if control:
        remove_older(os.path.join(os.path.dirname(control), "control-*.txt"))
    remove_older(os.path.join(temp, "speedy-code-*"))

    parts = parts_of(text)
    # The audio is kept for an hour, named by its voice, rate and text: saying it again reuses it.
    key = hashlib.sha256(f"{voice}|{rate}|{text}".encode("utf-8")).hexdigest()[:16].upper()
    prefix = os.path.join(temp, f"speedy-code-{key}")
    audios = [f"{prefix}-{index}.mp3" for index in range(len(parts))]
    is_kept = all(os.path.exists(audio) for audio in audios)

    maker = None
    text_files: list[str] = []
    player = Player()
    try:
        if not is_kept:
            for index, part in enumerate(parts):
                text_file = os.path.join(temp, f"speedy-code-{os.getpid()}-{index}.txt")
                with open(text_file, "w", encoding="utf-8") as target:
                    target.write(part)
                text_files.append(text_file)
            # One process makes them all: the first alone, then the rest at once while it plays.
            maker = subprocess.Popen([sys.executable, os.path.join(HERE, "tts.py"), voice, rate, prefix, *text_files])

        is_told = False
        is_paused = False
        for index, audio in enumerate(audios):
            # A part still being made: wait for it, as long as its maker runs.
            while not os.path.exists(audio):
                if maker and maker.poll() is not None and not os.path.exists(audio):
                    say(f"error edge-tts failed on part {index + 1} ({maker.returncode})")
                    return 1
                time.sleep(0.05)
                if is_told:
                    say(".")
            player.start(audio, is_paused)
            if not is_told:
                say(f"voice {voice}")
                is_told = True
            while player.is_playing():
                time.sleep(0.1)
                say(".")
                wanted = asked(control)
                if wanted == "pause" and not is_paused:
                    player.pause()
                    is_paused = True
                elif wanted == "play" and is_paused:
                    player.resume()
                    is_paused = False
            if player.failed():
                say(f"error could not play part {index + 1}")
                return 1
        # Every part has played, so each exists whole. The join runs detached: the sound has already ended.
        if save_as:
            environment = {**os.environ, "SPEEDY_NARRATION": text}
            subprocess.Popen([sys.executable, os.path.join(HERE, "history.py"), save_as, *audios], env=environment, start_new_session=True)
        return 0
    finally:
        player.stop()
        # Ended early: the maker, if it still runs, stops with it.
        if maker and maker.poll() is None:
            maker.kill()
        for text_file in text_files:
            try:
                os.remove(text_file)
            except OSError:
                pass
        if control:
            try:
                os.remove(control)
            except OSError:
                pass


if __name__ == "__main__":
    stop_on_signals()
    try:
        sys.exit(main())
    except BrokenPipeError:
        # The mod stopped reading: it ended the narration.
        sys.exit(0)
    except Exception as error:  # pylint: disable=broad-except
        try:
            say(f"error {error}")
        except BrokenPipeError:
            pass
        sys.exit(1)
