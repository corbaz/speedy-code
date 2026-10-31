"""Dictation for the speedy-code mod: listens to the microphone and prints what is said, phrase by phrase.

Usage: listen.py MODEL LANGUAGE CONTROL_FILE [MICROPHONE]
       listen.py --list

MICROPHONE is part of a microphone's name (`JBL Tune 520BT`); absent, the system's default.
`--list` prints "mic <name>" for each microphone, as the system names it, and exits.

Prints "ready" once the preview model is loaded (the microphone records from the start, so nothing
said while it loads is lost). While a phrase is being said, "partial <n> <text>" about once a second:
a quick, rough transcription by a small model, so the person sees at once what is heard. A phrase
ends at a pause of PAUSE_SECONDS or after MAX_SECONDS; then "text <n> <text>", written by MODEL, the
accurate one, which replaces phrase n's preview. Writing "stop" to CONTROL_FILE ends it: the phrase
under way is written out first, then "done".

Runs in its own Python 3.12 environment (~/.claude/speedy-code/venv): faster-whisper's audio
dependency publishes no build for newer Pythons.
"""

import os
import queue
import sys
import threading
import time

import numpy as np
import sounddevice as sd
from faster_whisper import WhisperModel

RATE = 16000
BLOCK_SECONDS = 0.03
PAUSE_SECONDS = 0.7
MAX_SECONDS = 8.0
MIN_SPEECH_SECONDS = 0.3
# The quick model the previews come from, and how often one is made.
PREVIEW_MODEL = "base"
PREVIEW_SECONDS = 0.8
# Words the transcription is nudged towards: Spanish with a developer's English in it.
PROMPT = (
    "Programación en español con términos en inglés: refactor, endpoint, API, pull request, merge, "
    "commit, push, deploy, hook, React, useEffect, useState, pytest (no pitest), unit tests, TypeScript, Python, "
    "frontend, backend, bug, fix, branch, main, script, JSON, CLI, plugin, Claude Code."
)

_say_lock = threading.Lock()


def say(line: str) -> None:
    """One line to the mod, at once; the threads that write never mix their lines."""
    with _say_lock:
        sys.stdout.write(line.replace("\n", " ") + "\n")
        sys.stdout.flush()


def is_stopped(control: str) -> bool:
    """Whether the mod wrote "stop"; a read that meets the mod writing is tried again later."""
    try:
        with open(control, encoding="utf-8") as source:
            return source.read().strip() == "stop"
    except OSError:
        return False


def microphones() -> "dict[str, int]":
    """The microphones by name: WASAPI's, which keeps names whole (MME cuts them at 31 characters)."""
    found: "dict[str, int]" = {}
    for index, device in enumerate(sd.query_devices()):
        api = sd.query_hostapis(device["hostapi"])["name"]
        if device["max_input_channels"] > 0 and "WASAPI" in api:
            found.setdefault(device["name"], index)
    return found


def transcribe(model: WhisperModel, audio: np.ndarray, language: str) -> str:
    segments, _ = model.transcribe(audio, language=language, beam_size=1, initial_prompt=PROMPT,
                                   condition_on_previous_text=False, without_timestamps=True)
    return " ".join(segment.text.strip() for segment in segments).strip()


def clear_stale(folder: str) -> None:
    """Stop files a dictation ended by force left behind: those an hour old go."""
    cutoff = time.time() - 3600
    try:
        names = os.listdir(folder)
    except OSError:
        return
    for name in names:
        path = os.path.join(folder, name)
        if name.startswith("listen-") and name.endswith(".txt"):
            try:
                if os.path.getmtime(path) < cutoff:
                    os.remove(path)
            except OSError:
                pass


class Log:
    """What each dictation heard, kept beside the stop files: why a dictation wrote nothing shows there."""

    def __init__(self, path: str) -> None:
        self.path = path

    def write(self, line: str) -> None:
        try:
            with open(self.path, "a", encoding="utf-8") as target:
                target.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {line}\n")
        except OSError:
            pass


class Cutter:
    """Cuts the microphone's blocks into phrases at the pauses, and hands each, numbered, to be written."""

    def __init__(self, phrases: "queue.Queue[tuple[int, np.ndarray] | None]", log: Log) -> None:
        self.phrases = phrases
        self.log = log
        self.lock = threading.Lock()
        # The noise floor, learned from the quietest blocks: speech is well above it. A headset's
        # microphone can be very quiet, so the least level that counts as speech is low.
        self.floor = 0.0005
        self.phrase: list[np.ndarray] = []
        self.spoken = 0.0
        self.silent = 0.0
        self.number = 1
        self.blocks = 0
        self.loudest = 0.0
        self.count = 0

    def feed(self, block: np.ndarray) -> None:
        level = float(np.sqrt(np.mean(block ** 2)))
        self.blocks += 1
        self.loudest = max(self.loudest, level)
        is_speech = level > max(self.floor * 3, 0.002)
        if not is_speech:
            self.floor = self.floor * 0.95 + level * 0.05
        with self.lock:
            if is_speech or self.phrase:
                self.phrase.append(block)
                self.spoken += BLOCK_SECONDS if is_speech else 0
                self.silent = 0.0 if is_speech else self.silent + BLOCK_SECONDS
        if self.silent >= PAUSE_SECONDS or len(self.phrase) * BLOCK_SECONDS >= MAX_SECONDS:
            self.flush()

    def current(self) -> "tuple[int, np.ndarray | None]":
        """The phrase being said, for a preview: its number and its audio so far, if it holds speech."""
        with self.lock:
            if not self.phrase or self.spoken < MIN_SPEECH_SECONDS:
                return self.number, None
            return self.number, np.concatenate(self.phrase)

    def flush(self) -> None:
        with self.lock:
            if self.phrase and self.spoken >= MIN_SPEECH_SECONDS:
                self.phrases.put((self.number, np.concatenate(self.phrase)))
                self.log.write(f"phrase {self.number}: {len(self.phrase) * BLOCK_SECONDS:.1f}s, speech {self.spoken:.1f}s")
                self.number += 1
                self.count += 1
            self.phrase, self.spoken, self.silent = [], 0.0, 0.0


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    if sys.argv[1:] == ["--list"]:
        for name in microphones():
            say(f"mic {name}")
        return
    model_name, language, control = sys.argv[1:4]
    wanted = sys.argv[4] if len(sys.argv) > 4 else ""
    device = next((index for name, index in microphones().items() if wanted and wanted in name), None)
    blocks: "queue.Queue[np.ndarray]" = queue.Queue()
    phrases: "queue.Queue[tuple[int, np.ndarray] | None]" = queue.Queue()

    # NARRADOR_LISTEN_FILE, raw 16 kHz mono float32, stands for the microphone in a test: fed in real time.
    test_audio = os.environ.get("NARRADOR_LISTEN_FILE")
    if test_audio:
        samples = np.fromfile(test_audio, dtype=np.float32)
        size = int(RATE * BLOCK_SECONDS)

        def feed() -> None:
            for start in range(0, len(samples), size):
                blocks.put(samples[start:start + size])
                time.sleep(BLOCK_SECONDS)

        stream = None
        threading.Thread(target=feed, daemon=True).start()
    else:
        # WASAPI records at the device's own rate: auto_convert brings it to 16 kHz.
        extra = sd.WasapiSettings(auto_convert=True) if device is not None else None
        stream = sd.InputStream(samplerate=RATE, channels=1, dtype="float32", blocksize=int(RATE * BLOCK_SECONDS),
                                device=device, extra_settings=extra,
                                callback=lambda data, frames, when, status: blocks.put(data[:, 0].copy()))
        stream.start()

    clear_stale(os.path.dirname(control))
    log = Log(os.path.join(os.path.dirname(control), "listen.log"))
    log.write(f"microphone: {sd.query_devices(device)['name'] if device is not None else 'default'}")
    cores = os.cpu_count() or 4
    # The quick model loads in a second: previews start while the accurate one still loads.
    preview = WhisperModel(PREVIEW_MODEL, device="cpu", compute_type="int8", cpu_threads=2)
    say("ready")
    cutter = Cutter(phrases, log)
    stopped = threading.Event()

    def write_phrases() -> None:
        # Most of the cores, the rest left to the previews.
        model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=max(1, cores // 2 - 2))
        while (item := phrases.get()) is not None:
            number, audio = item
            say(f"text {number} {transcribe(model, audio, language)}")

    def preview_phrases() -> None:
        shown = (0, 0)
        while not stopped.is_set():
            time.sleep(PREVIEW_SECONDS)
            number, audio = cutter.current()
            # Only a phrase that grew since its last preview is transcribed again.
            if audio is None or (number, len(audio)) == shown:
                continue
            shown = (number, len(audio))
            text = transcribe(preview, audio, language)
            if text and not stopped.is_set():
                say(f"partial {number} {text}")

    writer = threading.Thread(target=write_phrases)
    writer.start()
    previewer = threading.Thread(target=preview_phrases, daemon=True)
    previewer.start()

    while not is_stopped(control):
        try:
            cutter.feed(blocks.get(timeout=0.1))
        except queue.Empty:
            continue

    # Stopped, maybe before a phrase ended: what was recorded is still cut and written.
    stopped.set()
    if stream:
        stream.stop()
    while not blocks.empty():
        cutter.feed(blocks.get())
    cutter.flush()
    phrases.put(None)
    writer.join()
    log.write(f"stopped: {cutter.blocks} blocks, loudest {cutter.loudest:.4f}, floor {cutter.floor:.4f}, {cutter.count} phrases")
    try:
        os.remove(control)
    except OSError:
        pass
    say("done")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # pylint: disable=broad-except
        say(f"error {error}")
        time.sleep(0.1)
        sys.exit(1)
