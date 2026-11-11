"""Dictation for the speedy-code mod: a streaming speech model on this machine, written as it is said.

Usage: listen.py LANGUAGE CONTROL_FILE [MICROPHONE]
       listen.py --list
       listen.py --check LANGUAGE

LANGUAGE is the narration's language (`es`, `en`): the model's own variant of it is used (`es-US`).
MICROPHONE is part of a microphone's name (`JBL Tune 520BT`); absent, the system's default.
`--list` prints "mic <name>" for each microphone, as the system names it, and exits.
`--check` prints "ok <language>" when dictation can start, or "fail <why>", and exits.

The model is NVIDIA's Nemotron 3.5 ASR Streaming (0.6B, 40 languages), the one Handy uses, run by
transcribe-cpp on the CPU from ~/.claude/speedy-code/models. Nothing leaves the machine.

Prints "ready" once the model is loaded (the microphone records from the start, so nothing said
while it loads is lost). The words come as the model commits them: "text <n> <words>", each to be
appended to the prompt as it is, spaces included: a piece without a leading space goes on the word
before it, and the first piece of a phrase always has one. What it still guesses at comes as "partial <n> <text>", shown above the
prompt until it is committed. A pause of PAUSE_SECONDS ends phrase n: the model is asked for its
last words, and the next phrase is n + 1. Writing "stop" to CONTROL_FILE ends it: the phrase under
way is written out first, then "done".
"""

import os
import queue
import sys
import threading
import time

import numpy as np
import sounddevice as sd

# The engine's native notes ("load_backend: …") go to stderr, which nobody reads: the mod reads
# stdout, and PowerShell 5.1 takes any stderr line as a failure. Errors still reach stdout as "error".
os.dup2(os.open(os.devnull, os.O_WRONLY), 2)
import transcribe_cpp  # noqa: E402  pylint: disable=wrong-import-position

RATE = 16000
BLOCK_SECONDS = 0.05
PAUSE_SECONDS = 0.8
MIN_SPEECH_SECONDS = 0.2
MODEL_FILE = "nemotron-3.5-asr-streaming-0.6b-Q8_0.gguf"
MODEL_PATH = os.path.join(os.path.expanduser("~"), ".claude", "speedy-code", "models", MODEL_FILE)
# The variant of each language the model is asked for: Latin American Spanish over Spain's.
PREFERRED = {"es": "es-US", "en": "en-US", "pt": "pt-BR", "fr": "fr-FR"}

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
    """The microphones by name: on Windows WASAPI's, which keeps names whole (MME cuts them at 31
    characters); on macOS Core Audio's, its only one."""
    found: "dict[str, int]" = {}
    for index, device in enumerate(sd.query_devices()):
        api = sd.query_hostapis(device["hostapi"])["name"]
        if device["max_input_channels"] > 0 and (sys.platform != "win32" or "WASAPI" in api):
            found.setdefault(device["name"], index)
    return found


def load_model() -> transcribe_cpp.Model:
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError("falta el modelo de dictado: instalalo desde ⚙️ → Instalación")
    return transcribe_cpp.Model(MODEL_PATH)


def model_language(model: transcribe_cpp.Model, wanted: str) -> str:
    """The model's variant of `wanted` (`es` → `es-US`), or an error naming the language."""
    offered = list(model.capabilities.languages)
    base = wanted.lower().split("-")[0]
    for tag in (wanted, PREFERRED.get(base, "")):
        if tag in offered:
            return tag
    for tag in offered:
        if tag.lower().split("-")[0] == base:
            return tag
    raise RuntimeError(f"el modelo de dictado no habla '{wanted}'")


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


class Pauses:
    """Tells speech from silence by loudness, against a noise floor learned from the quietest blocks."""

    def __init__(self) -> None:
        # A headset's microphone can be very quiet, so the least level that counts as speech is low.
        self.floor = 0.0005
        self.spoken = 0.0
        self.silent = 0.0
        self.loudest = 0.0

    def feed(self, block: np.ndarray) -> bool:
        """Whether the phrase under way just ended: enough speech, then a pause."""
        seconds = len(block) / RATE
        level = float(np.sqrt(np.mean(block ** 2))) if len(block) else 0.0
        self.loudest = max(self.loudest, level)
        if level > max(self.floor * 3, 0.002):
            self.spoken += seconds
            self.silent = 0.0
            return False
        self.floor = self.floor * 0.95 + level * 0.05
        self.silent += seconds
        if self.spoken >= MIN_SPEECH_SECONDS and self.silent >= PAUSE_SECONDS:
            self.spoken = 0.0
            return True
        return False


class Phrase:
    """One phrase's stream: hands on each word the model commits, and shows what it still guesses."""

    def __init__(self, session: transcribe_cpp.Session, language: str, number: int) -> None:
        self.stream = session.stream(language=language)
        self.number = number
        self.written = ""
        self.guess = ""

    def feed(self, audio: np.ndarray) -> None:
        self.stream.feed(audio)
        self.show()

    def finish(self) -> str:
        """The phrase's last words, then its whole text; the stream is let go."""
        self.stream.finalize()
        self.show(final=True)
        self.stream.reset()
        return self.written

    def show(self, final: bool = False) -> None:
        text = self.stream.text()
        committed = (text.committed + text.tentative) if final else text.committed
        if len(committed) > len(self.written) and committed.startswith(self.written):
            # Spaces as the model put them: a word can come in two pieces ("princi", "pal."). A
            # phrase's first piece starts with one, so it never sticks to the text before it.
            fresh = committed[len(self.written):]
            if not self.written:
                fresh = " " + fresh.lstrip()
            self.written = committed
            if fresh.strip():
                say(f"text {self.number} {fresh.rstrip()}")
        guess = "" if final else text.tentative.strip()
        if guess != self.guess:
            self.guess = guess
            if guess:
                say(f"partial {self.number} {guess}")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    if sys.argv[1:] == ["--list"]:
        for name in microphones():
            say(f"mic {name}")
        return
    if sys.argv[1:2] == ["--check"]:
        try:
            say(f"ok {model_language(load_model(), sys.argv[2] if len(sys.argv) > 2 else 'es')}")
        except Exception as error:  # pylint: disable=broad-except
            say(f"fail {error}")
        return
    wanted_language, control = sys.argv[1:3]
    wanted = sys.argv[3] if len(sys.argv) > 3 else ""
    device = next((index for name, index in microphones().items() if wanted and wanted in name), None)
    blocks: "queue.Queue[np.ndarray]" = queue.Queue()

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
        # WASAPI records at the device's own rate: auto_convert brings it to 16 kHz. Core Audio converts by itself.
        extra = sd.WasapiSettings(auto_convert=True) if device is not None and sys.platform == "win32" else None
        stream = sd.InputStream(samplerate=RATE, channels=1, dtype="float32", blocksize=int(RATE * BLOCK_SECONDS),
                                device=device, extra_settings=extra,
                                callback=lambda data, frames, when, status: blocks.put(data[:, 0].copy()))
        stream.start()

    clear_stale(os.path.dirname(control))
    log = Log(os.path.join(os.path.dirname(control), "listen.log"))
    log.write(f"microphone: {sd.query_devices(device)['name'] if device is not None else 'default'}")
    model = load_model()
    language = model_language(model, wanted_language)
    session = model.session(n_threads=max(1, (os.cpu_count() or 4) // 2))
    log.write(f"language: {language}")
    say("ready")

    pauses = Pauses()
    phrase = Phrase(session, language, 1)
    count = 0

    def take() -> np.ndarray:
        """Every block waiting, in one piece: a slow feed never leaves the model behind the voice."""
        waiting = [blocks.get(timeout=0.1)]
        while not blocks.empty():
            waiting.append(blocks.get())
        return np.concatenate(waiting)

    while not is_stopped(control):
        try:
            audio = take()
        except queue.Empty:
            continue
        phrase.feed(audio)
        if pauses.feed(audio):
            if phrase.finish():
                count += 1
                log.write(f"phrase {phrase.number}: {len(phrase.written)} characters")
            phrase = Phrase(session, language, phrase.number + 1)

    # Stopped, maybe mid-phrase: what was recorded is still written.
    if stream:
        stream.stop()
    while not blocks.empty():
        phrase.feed(blocks.get())
    if phrase.finish():
        count += 1
    log.write(f"stopped: loudest {pauses.loudest:.4f}, floor {pauses.floor:.4f}, {count} phrases")
    session.close()
    model.close()
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
