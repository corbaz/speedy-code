"""Lists the conversations Claude Code keeps for a folder, newest first.

Usage: sessions.py <session's folder>
       sessions.py --dir <transcripts folder>

Claude Code keeps each conversation as `<id>.jsonl` under `~/.claude/projects/<folder>`, the
session's folder with every character that is not a letter or a digit turned into `-`
(`$CLAUDE_CONFIG_DIR` in place of `~/.claude` when it is set). `--dir` names that folder itself:
it is how a check runs it.

Prints one JSON line per conversation: `{"id", "title", "updated"}`, `updated` in seconds since
1970, the file's last change. The title is the name given by /rename, else the one Claude Code
wrote for it, else what was first asked. Only the start and the end of each file are read: a
conversation can be many megabytes. At most LIMIT lines; nothing for a folder with none.
"""

import glob
import json
import os
import re
import sys

LIMIT = 60
EDGE = 256 * 1024
TITLE = 90
NAMED = re.compile(r'"type":"custom-title","customTitle":("(?:[^"\\]|\\.)*")')
WRITTEN = re.compile(r'"type":"ai-title","aiTitle":("(?:[^"\\]|\\.)*")')


def transcripts_of(folder: str) -> str:
    home = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.join(os.path.expanduser("~"), ".claude")
    return os.path.join(home, "projects", re.sub(r"[^A-Za-z0-9]", "-", folder))


def edges(path: str) -> tuple:
    """The file's start and its end, as text; the end is empty when the start holds it all."""
    size = os.path.getsize(path)
    with open(path, "rb") as source:
        head = source.read(EDGE)
        tail = b""
        if size > EDGE:
            source.seek(max(EDGE, size - EDGE))
            tail = source.read()
    return head.decode("utf-8", "replace"), tail.decode("utf-8", "replace")


def last_of(pattern: re.Pattern, *texts: str) -> str:
    for text in reversed(texts):
        found = pattern.findall(text)
        if found:
            try:
                return json.loads(found[-1])
            except ValueError:
                continue
    return ""


def first_asked(head: str) -> str:
    """What the person first wrote: the first user message that is theirs, not the harness's."""
    for line in head.splitlines():
        if '"type":"user"' not in line:
            continue
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        if entry.get("type") != "user" or entry.get("isMeta") or entry.get("isSidechain"):
            continue
        content = (entry.get("message") or {}).get("content")
        if isinstance(content, list):
            content = " ".join(part.get("text", "") for part in content if isinstance(part, dict) and part.get("type") == "text")
        if isinstance(content, str) and content.strip() and not content.lstrip().startswith("<"):
            return content
    return ""


def title_of(path: str) -> str:
    head, tail = edges(path)
    title = last_of(NAMED, head, tail) or last_of(WRITTEN, head, tail) or first_asked(head)
    title = " ".join(title.split())
    return title[:TITLE]


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    arguments = sys.argv[1:]
    if len(arguments) == 2 and arguments[0] == "--dir":
        folder = arguments[1]
    elif len(arguments) == 1:
        folder = transcripts_of(arguments[0])
    else:
        print("usage: sessions.py <session's folder> | --dir <transcripts folder>", file=sys.stderr)
        return 2
    files = sorted(glob.glob(os.path.join(glob.escape(folder), "*.jsonl")), key=os.path.getmtime, reverse=True)
    shown = 0
    for path in files:
        if shown == LIMIT:
            break
        try:
            title = title_of(path)
            updated = int(os.path.getmtime(path))
        except OSError:
            continue
        # A conversation nothing was asked in has nothing to come back to.
        if not title:
            continue
        print(json.dumps({"id": os.path.splitext(os.path.basename(path))[0], "title": title, "updated": updated}, ensure_ascii=False))
        shown += 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
