"""Plays one saved narration for the speedy-code 📎 menu on macOS: the MP3 named by SPEEDY_CLIP.

It does what play.ps1 does on Windows. SPEEDY_CONTROL names a file that says "pause" or "play" while it
plays, so the footer's play button pauses and goes on. Exits 0 when it played to the end, 1 when the file
would not play. It says "." every tenth of a second, so the mod wakes to end it. Ending the process stops
it; the control file is removed as it ends.
"""

import os
import sys
import time

from player import Player, say, stop_on_signals


def asked(control: str) -> str:
    if not control:
        return ""
    try:
        with open(control, encoding="utf-8") as source:
            return source.read().strip()
    except OSError:
        return ""


def main() -> int:
    clip = os.environ.get("SPEEDY_CLIP", "")
    control = os.environ.get("SPEEDY_CONTROL", "")
    if not clip or not os.path.exists(clip):
        return 1
    player = Player()
    try:
        player.start(clip)
        while player.is_playing():
            time.sleep(0.1)
            say(".")
            wanted = asked(control)
            if wanted == "pause":
                player.pause()
            elif wanted == "play":
                player.resume()
        return 1 if player.failed() else 0
    finally:
        player.stop()
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
        sys.exit(0)
