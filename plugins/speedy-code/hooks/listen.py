"""Dictation for the speedy-code mod: Windows' own speech recognizer, streamed phrase by phrase.

Usage: listen.py LANGUAGE CONTROL_FILE [MICROPHONE]
       listen.py --list
       listen.py --check LANGUAGE

LANGUAGE is the narration's language (`es`, `en`): the recognizer installed for it is used. MICROPHONE
is part of a microphone's name (`JBL Tune 520BT`); absent, the system's default.
`--list` prints "mic <name>" for each microphone connected, as Windows names it, and exits.
`--check` prints "ok <language>" when dictation can start, or "fail <why>", and exits.

The recognizer is Windows.Media.SpeechRecognition, the engine behind Windows' dictation, driven with
no window of its own. It listens to Windows' default microphone only: to dictate with another, that
one is made the default while the dictation runs, and the one before is put back as it ends.

Prints "ready" once the recognizer listens. While a phrase is being said, "partial <n> <text>" each
time the recognizer's guess grows; at the phrase's end, "text <n> <text>", its final text, which
replaces phrase n's guess. Writing "stop" to CONTROL_FILE ends it: the phrase under way is written
out first, then "done".

Runs in the mod's Python 3.12 environment (~/.claude/speedy-code/venv), with the winrt and pycaw packages.
"""

import asyncio
import datetime
import os
import sys
import threading
import time

from pycaw.constants import DEVICE_STATE, EDataFlow, ERole
from pycaw.utils import AudioUtilities
from winrt.windows.globalization import Language
from winrt.windows.media.speechrecognition import (SpeechRecognitionCompilationResult,
                                                   SpeechRecognitionResultStatus, SpeechRecognitionScenario,
                                                   SpeechRecognitionTopicConstraint, SpeechRecognizer)

# Every role Windows keeps a default microphone for: the recognizer may ask any of them.
ROLES = (ERole.eConsole, ERole.eMultimedia, ERole.eCommunications)
# Windows ends a dictation after this much silence: long enough that it only ends on "stop".
SILENCE_LIMIT = datetime.timedelta(hours=4)
# Why a recognizer refuses to start, in words the person can act on.
PRIVACY_ERROR = -2147199735  # 0x80045509: online speech recognition is off in Windows' privacy settings.

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


def microphones() -> "dict[str, str]":
    """The microphones connected, by Windows' name, with their endpoint ids."""
    found: "dict[str, str]" = {}
    for device in AudioUtilities.GetAllDevices(EDataFlow.eCapture.value, DEVICE_STATE.ACTIVE.value):
        if device.FriendlyName:
            found.setdefault(device.FriendlyName, device.id)
    return found


def default_microphones() -> "dict[ERole, str]":
    """The default microphone of each role, by endpoint id."""
    enumerator = AudioUtilities.GetDeviceEnumerator()
    return {role: enumerator.GetDefaultAudioEndpoint(EDataFlow.eCapture.value, role.value).GetId() for role in ROLES}


def make_default(ids: "dict[ERole, str]") -> None:
    """Makes each role's microphone the given one."""
    for role, device in ids.items():
        AudioUtilities.SetDefaultDevice(device, [role])


def recognizer_language(wanted: str) -> Language:
    """The dictation language installed for `wanted` (`es` → `es-ES`); none, Windows' own."""
    installed = list(SpeechRecognizer.supported_topic_languages)
    for language in installed:
        tag = language.language_tag.lower()
        if tag == wanted.lower() or tag.split("-")[0] == wanted.lower().split("-")[0]:
            return language
    return SpeechRecognizer.system_speech_language


async def open_recognizer(wanted: str) -> SpeechRecognizer:
    """A recognizer ready to dictate in `wanted`'s language, or an error that says why not."""
    recognizer = SpeechRecognizer(recognizer_language(wanted))
    recognizer.constraints.append(SpeechRecognitionTopicConstraint(SpeechRecognitionScenario.DICTATION, "dictation"))
    try:
        compiled: SpeechRecognitionCompilationResult = await recognizer.compile_constraints_async()
    except OSError as error:
        if getattr(error, "winerror", None) == PRIVACY_ERROR:
            raise RuntimeError("activá el reconocimiento de voz en línea en Configuración > Privacidad > Voz") from error
        raise
    if compiled.status != SpeechRecognitionResultStatus.SUCCESS:
        raise RuntimeError(f"Windows no pudo preparar el dictado ({compiled.status.name})")
    return recognizer


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


class Phrases:
    """Numbers the recognizer's phrases: guesses for the phrase under way, then its final text."""

    def __init__(self, log: Log) -> None:
        self.log = log
        self.lock = threading.Lock()
        self.number = 1
        self.count = 0

    def guess(self, text: str) -> None:
        with self.lock:
            if text.strip():
                say(f"partial {self.number} {text.strip()}")

    def final(self, text: str) -> None:
        with self.lock:
            text = text.strip()
            if not text:
                return
            say(f"text {self.number} {text}")
            self.log.write(f"phrase {self.number}: {len(text)} characters")
            self.number += 1
            self.count += 1


async def dictate(language: str, control: str, log: Log) -> None:
    recognizer = await open_recognizer(language)
    log.write(f"language: {recognizer.current_language.language_tag}")
    session = recognizer.continuous_recognition_session
    session.auto_stop_silence_timeout = SILENCE_LIMIT
    phrases = Phrases(log)
    stopping = False
    loop = asyncio.get_running_loop()
    ended = asyncio.Event()

    def on_guess(_sender, args) -> None:
        phrases.guess(args.hypothesis.text)

    def on_result(_sender, args) -> None:
        phrases.final(args.result.text)

    def on_completed(_sender, args) -> None:
        log.write(f"session ended: {args.status.name}")
        loop.call_soon_threadsafe(ended.set)

    # The tokens are kept: a handler nobody holds is dropped.
    tokens = (recognizer.add_hypothesis_generated(on_guess), session.add_result_generated(on_result),
              session.add_completed(on_completed))
    await session.start_async()
    say("ready")
    while not stopping:
        if is_stopped(control):
            stopping = True
        elif ended.is_set():
            # Windows ended the session on its own (a network hiccup, a long silence): it listens again.
            ended.clear()
            await session.start_async()
        else:
            await asyncio.sleep(0.1)
    # Stopping hands over the phrase under way before the session ends.
    if not ended.is_set():
        await session.stop_async()
    log.write(f"stopped: {phrases.count} phrases")
    del tokens
    recognizer.close()


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    if sys.argv[1:] == ["--list"]:
        for name in microphones():
            say(f"mic {name}")
        return
    if sys.argv[1:2] == ["--check"]:
        try:
            recognizer = asyncio.run(open_recognizer(sys.argv[2] if len(sys.argv) > 2 else "es"))
            say(f"ok {recognizer.current_language.language_tag}")
        except Exception as error:  # pylint: disable=broad-except
            say(f"fail {error}")
        return
    language, control = sys.argv[1:3]
    wanted = sys.argv[3] if len(sys.argv) > 3 else ""
    clear_stale(os.path.dirname(control))
    log = Log(os.path.join(os.path.dirname(control), "listen.log"))
    chosen = next((device for name, device in microphones().items() if wanted and wanted in name), None)
    before = default_microphones() if chosen else {}
    try:
        if chosen:
            make_default({role: chosen for role in ROLES})
        log.write(f"microphone: {wanted if chosen else 'default'}")
        asyncio.run(dictate(language, control, log))
    finally:
        if before:
            make_default(before)
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
