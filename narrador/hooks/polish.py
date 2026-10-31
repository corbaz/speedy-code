"""The wand of the narrador mod: asks Groq to clean a prompt up, and prints the cleaned text.

Reads one JSON object on stdin, {"model", "system", "text"}, and prints one JSON object on stdout,
{"text"} or {"error"}. Both are pure ASCII (every other character escaped as \\uXXXX), so no
decoding on the way can break an accent: the mod's own HTTP client read Groq's UTF-8 as another
encoding and turned "mágica" into "m?gica". The key is the system's GROQ_API_KEY.
"""

import json
import os
import sys
import urllib.error
import urllib.request

URL = "https://api.groq.com/openai/v1/chat/completions"


def main() -> None:
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
        "Authorization": f"Bearer {key}", "Content-Type": "application/json; charset=utf-8", "User-Agent": "narrador"})
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
