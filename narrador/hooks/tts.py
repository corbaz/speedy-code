"""Synthesizes the parts of a narration with edge-tts, for the narrador mod's speak.ps1.

Usage: tts.py VOICE RATE OUT_PREFIX TEXT_FILE...

The first part is made alone, so it plays as soon as possible; the rest are then made at once
while it plays. Each part is written to OUT_PREFIX-<n>.mp3.part and renamed to OUT_PREFIX-<n>.mp3
once whole, so a file that exists is always complete.
"""

import asyncio
import os
import sys

import edge_tts


async def make(voice: str, rate: str, text_file: str, audio: str) -> None:
    """Writes one part's audio, renamed into place once whole."""
    with open(text_file, encoding="utf-8") as source:
        text = source.read()
    await edge_tts.Communicate(text, voice, rate=rate).save(f"{audio}.part")
    os.replace(f"{audio}.part", audio)


async def main() -> None:
    voice, rate, prefix, *text_files = sys.argv[1:]
    audios = [f"{prefix}-{index}.mp3" for index in range(len(text_files))]
    await make(voice, rate, text_files[0], audios[0])
    await asyncio.gather(*(make(voice, rate, text_file, audio) for text_file, audio in zip(text_files[1:], audios[1:])))


if __name__ == "__main__":
    asyncio.run(main())
