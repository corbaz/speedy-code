"""Synthesizes the parts of a narration with edge-tts, for the speedy-code mod's speak.ps1.

Usage: tts.py VOICE RATE OUT_PREFIX TEXT_FILE...

The first part is made alone, so it plays as soon as possible; the rest are then made at once
while it plays. Each part is written to OUT_PREFIX-<n>.mp3.part and renamed to OUT_PREFIX-<n>.mp3
once whole, so a file that exists is always complete.
"""

import asyncio
import os
import sys

import edge_tts


# A part is a few seconds of speech, made in one or two. A connection that stalls sends nothing and
# edge-tts waits up to a minute for it, the narration silent all along: it is dropped sooner and asked again.
PART_SECONDS = 12
ATTEMPTS = 3


async def make(voice: str, rate: str, text_file: str, audio: str) -> None:
    """Writes one part's audio, renamed into place once whole; a stalled try is made again."""
    with open(text_file, encoding="utf-8") as source:
        text = source.read()
    for attempt in range(1, ATTEMPTS + 1):
        try:
            await asyncio.wait_for(edge_tts.Communicate(text, voice, rate=rate).save(f"{audio}.part"), PART_SECONDS)
            break
        except Exception:  # pylint: disable=broad-except
            if attempt == ATTEMPTS:
                raise
    os.replace(f"{audio}.part", audio)


async def main() -> None:
    voice, rate, prefix, *text_files = sys.argv[1:]
    audios = [f"{prefix}-{index}.mp3" for index in range(len(text_files))]
    await make(voice, rate, text_files[0], audios[0])
    await asyncio.gather(*(make(voice, rate, text_file, audio) for text_file, audio in zip(text_files[1:], audios[1:])))


if __name__ == "__main__":
    asyncio.run(main())
