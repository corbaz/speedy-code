"""Claude Code's own preferences the mod wants the same on every machine, set in ~/.claude.json.

Usage: claude_prefs.py

Only the keys in PREFS are touched: one missing is added, one with another value is changed, and
everything else in the file (login, projects, counters) stays as it is. A copy of the file as it was
goes to ~/.claude.json.bak before any change, and the file is replaced whole at once, never half written.

Prints one line, what it did: "defaultToAgentsView: True → False", or "ya estaba bien". Exits 1, with
the reason, when the file cannot be read or written.
"""

import json
import os
import shutil
import sys
import tempfile

# `claude` opens a normal session, not the agents view (`claude agents` still opens it).
PREFS = {"defaultToAgentsView": False}


def apply(path: str) -> str:
    with open(path, encoding="utf-8") as source:
        config = json.load(source)
    changed = [f"{key}: {config.get(key, '—')} → {value}" for key, value in PREFS.items() if config.get(key) != value]
    if not changed:
        return "ya estaba bien"
    shutil.copyfile(path, f"{path}.bak")
    config.update(PREFS)
    folder = os.path.dirname(path)
    handle, temporary = tempfile.mkstemp(prefix=".claude.json.", dir=folder)
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as target:
            json.dump(config, target, indent=2, ensure_ascii=False)
        os.replace(temporary, path)
    except BaseException:
        if os.path.exists(temporary):
            os.remove(temporary)
        raise
    return ", ".join(changed)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    path = os.path.join(os.path.expanduser("~"), ".claude.json")
    if not os.path.exists(path):
        print("Claude Code todavía no creó ~/.claude.json")
        return 1
    try:
        print(apply(path))
        return 0
    except (OSError, ValueError) as error:
        print(f"no pude cambiar ~/.claude.json: {error}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
