"""Plays an MP3 on macOS for the speedy-code mod: afplay, paused and resumed by signals.

Used by speak.py and play.py, the macOS side of speak.ps1 and play.ps1.
"""

import signal
import subprocess
import sys


def say(line: str) -> None:
    """One line to the mod, at once: it reads each as it comes."""
    sys.stdout.write(f"{line}\n")
    sys.stdout.flush()


def stop_on_signals() -> None:
    """Ended by the mod: the script exits through its `finally`, so the sound ends with it."""
    def leave(_signal, _frame):
        raise SystemExit(0)
    for name in ("SIGTERM", "SIGHUP", "SIGINT"):
        if hasattr(signal, name):
            signal.signal(getattr(signal, name), leave)


class Player:
    """One afplay at a time. A pause stops the process where it stands; a resume lets it go on."""

    def __init__(self) -> None:
        self.process: subprocess.Popen | None = None
        self.is_paused = False

    def start(self, path: str, is_paused: bool = False) -> None:
        self.stop()
        self.process = subprocess.Popen(["afplay", path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.is_paused = False
        if is_paused:
            self.pause()

    def is_playing(self) -> bool:
        return self.process is not None and self.process.poll() is None

    def failed(self) -> bool:
        return self.process is not None and self.process.poll() not in (None, 0)

    def pause(self) -> None:
        if self.is_playing() and not self.is_paused:
            self.process.send_signal(signal.SIGSTOP)
            self.is_paused = True

    def resume(self) -> None:
        if self.is_playing() and self.is_paused:
            self.process.send_signal(signal.SIGCONT)
            self.is_paused = False

    def stop(self) -> None:
        if self.is_playing():
            # A stopped process takes no TERM until it goes on.
            self.process.send_signal(signal.SIGCONT)
            self.process.terminate()
            try:
                self.process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                self.process.kill()
        self.is_paused = False
