"""The wand of the speedy-code mod: asks Groq to clean a prompt up, and prints the cleaned text.

Reads one JSON object on stdin, {"model", "system", "text"}, and prints one JSON object on stdout,
{"text"} or {"error"}. Both are pure ASCII (every other character escaped as \\uXXXX), so no
decoding on the way can break an accent: the mod's own HTTP client read Groq's UTF-8 as another
encoding and turned "mágica" into "m?gica". The key is the system's GROQ_API_KEY.

`polish.py --summary FILE` asks Groq instead for a narration's summary: FILE is the narrated text (UTF-8, the
`.txt` beside its MP3), and the answer's text is a Markdown list of its points, for the player's Resumen.
"""

import json
import os
import sys
import urllib.error
import urllib.request

URL = "https://api.groq.com/openai/v1/chat/completions"
# The player's Resumen: the model the wand asks, and what it is told.
SUMMARY_MODEL = "openai/gpt-oss-120b"
SUMMARY_SYSTEM = """You summarize the spoken narration of an AI coding assistant's answer, for a developer who has no time to listen to all of it.

Return only a Markdown bullet list: one line per point, each starting with "- ", between 3 and 8 points, each short (one sentence).
- Keep what matters: what was done, what was found, what failed or is pending, and any question the assistant asks.
- Keep file names, commands, numbers and names exactly as they are, in `code` when they are code.
- Write in the narration's own language.
- No title, no introduction, no closing line, nothing but the list."""


def summary_ask(file: str) -> dict:
    """The asking for a narration's summary: its text, read from FILE."""
    with open(file, encoding="utf-8") as source:
        return {"model": SUMMARY_MODEL, "system": SUMMARY_SYSTEM, "text": source.read()}


def main() -> None:
    if len(sys.argv) > 2 and sys.argv[1] == "--summary":
        try:
            ask = summary_ask(sys.argv[2])
        except OSError:
            print(json.dumps({"error": "no encontré el texto de esta narración"}))
            return
    else:
        ask = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    key = os.environ.get("GROQ_API_KEY", "")
    if not key:
        print(json.dumps({"error": "falta la variable de sistema GROQ_API_KEY"}))
        return
    body = json.dumps({
        "model": ask["model"],
        "messages": [{"role": "system", "content": ask["system"]}, {"role": "user", "content": ask["text"]}],
        "temperature": 0.2,
        "reasoning_effort": "low",
    }).encode("utf-8")
    request = urllib.request.Request(URL, data=body, headers={
        "Authorization": f"Bearer {key}", "Content-Type": "application/json; charset=utf-8", "User-Agent": "speedy-code"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            answer = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        print(json.dumps({"error": f"Groq respondió {error.code}"}))
        return
    except OSError as error:
        print(json.dumps({"error": f"no pude hablar con Groq: {error}"}))
        return
    text = (answer.get("choices") or [{}])[0].get("message", {}).get("content", "") or ""
    print(json.dumps({"text": text.strip()} if text.strip() else {"error": "Groq no devolvió texto"}))


if __name__ == "__main__":
    main()
