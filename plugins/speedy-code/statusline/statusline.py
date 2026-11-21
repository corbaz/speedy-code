"""speedy-code's status line, on Windows and on macOS.

Claude Code's version, time, tokens, context used, the 5-hour and weekly limits, the weekly limit of a
model that has one of its own (Fable) and speedy-code's version, in color; the model, the effort, the folder and the branch are the footer's. In a narrow terminal it keeps what matters most. Claude Code runs it with the session's JSON on
stdin; switch.py copies it to ~/.claude/speedy-code and points the settings at it with the mod's Python.

Every part has a color of its own, and its label is gray. Context used and limits used are green, yellow
or red by the levels set in ⚙️ → Barra de estado (levels.json). Times are local.

A model's own weekly limit is not in the session's JSON: it is asked of Anthropic, as Claude Code's own
/usage asks it (`--usage`, run apart so the line never waits for it), with the session's own sign-in, and
kept for a few minutes in ~/.claude/speedy-code/usage.json. The sign-in goes nowhere but to Anthropic.
"""

import json
import math
import os
import re
import subprocess
import sys
import time as clock
import urllib.request
from datetime import datetime, timedelta

ESC = "\x1b"

# What follows a glyph, so the terminal draws it whole: Windows Terminal takes a no-break space for it,
# Ghostty an en space.
GAP = "\u00a0" if os.name == "nt" else "\u2002"

C_TIME = "38;5;117"
C_IN = "38;5;79"
C_OUT = "38;5;211"
C_CACHE = "38;5;147"
C_LABEL = "38;5;245"
C_APP = "1;38;5;147"
C_UPDATE = "1;38;5;220"
# Claude's own orange, the one Claude Code draws its name in.
C_CLAUDE = "1;38;2;215;119;87"
C_DIM = "38;5;240"
C_GREEN = "38;5;114"
C_YELLOW = "38;5;221"
C_RED = "1;38;5;203"
DEFAULT_PRIORITY = ["core", "app", "five_hour", "seven_day", "scoped", "context", "time", "tokens"]
# Where Claude Code's /usage reads the account's limits, and how long an answer is kept.
USAGE_API = "https://api.anthropic.com/api/oauth/usage"
USAGE_KEPT_SECONDS = 300
# How long a fetch under way is waited for before another is started.
USAGE_FETCH_SECONDS = 60
DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
# Colors, and the start and end of a link: neither takes a cell.
ANSI = re.compile(ESC + r"\[[0-9;]*m|" + ESC + r"\]8;;[^" + ESC + r"]*" + ESC + r"\\")
# Where a click on a part goes: the notes of the version running, and the account's usage.
CHANGELOG = "https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md"
USAGE = "https://claude.ai/settings/usage"
# The signs of the line, in each icon set: the one chosen in ⚙️ → Barra de estado. The Nerd Fonts
# ones are Font Awesome's glyphs (microchip, clock, arrow_rotate_right,
# triangle_exclamation), which need a Nerd Font in the terminal. A terminal draws a glyph wider than its
# cell, so each is followed by a en space (U+2002, which Ghostty takes for a blank and so draws the glyph whole) to spill over, in its own color.
SIGNS = {
    "emoji": {"model": "◆", "time": "⏱ ", "reset": "↻", "warning": "⚠"},
    "nerd": {"model": f"\uf2db{GAP}", "time": f"\uf017{GAP}", "reset": f"\uf01e{GAP}", "warning": f"\uf071{GAP}"},
}


def paint(text, color):
    return f"{ESC}[{color}m{text}{ESC}[0m"


def link(text, url):
    """`text` as a link to `url` (OSC 8): Ctrl+click opens it, Cmd+click on macOS; a terminal that
    knows no links draws the text alone."""
    return f"{ESC}]8;;{url}{ESC}\\{text}{ESC}]8;;{ESC}\\"


def visible(text):
    return len(ANSI.sub("", text))


def number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def one_decimal(value):
    """`{0:0.#}` as .NET writes it: one decimal at most, none when it is .0."""
    text = f"{value:.1f}"
    return text[:-2] if text.endswith(".0") else text


def format_tokens(n):
    n = number(n)
    if not n:
        return "0"
    # Past 999.95k the k rounds to 1000.0: that is already a million.
    if n >= 999950:
        return f"{one_decimal(n / 1000000)}M"
    if n >= 1000:
        return f"{one_decimal(n / 1000)}k"
    return str(int(n))


def format_duration(ms):
    ms = number(ms)
    if not ms:
        return "0m"
    minutes = round(ms / 60000)
    days, hours, mins = minutes // 1440, (minutes % 1440) // 60, minutes % 60
    if days >= 1:
        return f"{days}d {hours}h {mins}m"
    if hours >= 1:
        return f"{hours}h {mins}m"
    return f"{mins}m"


def format_reset(epoch, now=None):
    if not epoch:
        return ""
    at = datetime.fromtimestamp(int(epoch))
    today = (now or datetime.now()).date()
    time = at.strftime("%H:%M")
    if at.date() == today:
        return f"hoy {time}"
    if at.date() == today + timedelta(days=1):
        return f"mañana {time}"
    return f"{DAYS[at.weekday()]} {time}"


def sign_in(home):
    """The session's sign-in with Anthropic, as Claude Code keeps it: in its credentials file, or in the
    macOS keychain. None when there is none, or it has run out (Claude Code renews it when it runs)."""
    raw = ""
    try:
        with open(os.path.join(home, ".claude", ".credentials.json"), encoding="utf-8") as source:
            raw = source.read()
    except OSError:
        if sys.platform == "darwin":
            try:
                asked = subprocess.run(["security", "find-generic-password", "-s", "Claude Code-credentials", "-w"],
                                       capture_output=True, text=True, check=False, timeout=5)
                raw = asked.stdout if asked.returncode == 0 else ""
            except (OSError, subprocess.SubprocessError):
                raw = ""
    try:
        kept = (json.loads(raw) or {}).get("claudeAiOauth") or {}
    except ValueError:
        return None
    token = kept.get("accessToken")
    if not token or number(kept.get("expiresAt")) / 1000 < clock.time():
        return None
    return token


def scoped_of(answer):
    """The weekly limits of one model each in the account's usage, as (name, share used, reset in seconds
    since 1970)."""
    found = []
    for limit in (answer or {}).get("limits") or []:
        model = ((limit.get("scope") or {}).get("model") or {}).get("display_name")
        if limit.get("kind") != "weekly_scoped" or not model or limit.get("percent") is None:
            continue
        try:
            # To the minute: the answer's moment comes a fraction of a second off the hour.
            resets = round(datetime.fromisoformat(limit.get("resets_at") or "").timestamp() / 60) * 60
        except (TypeError, ValueError):
            resets = 0
        found.append({"name": str(model), "percent": number(limit["percent"]), "resets_at": resets})
    return found


def fetch_usage(home):
    """Asks Anthropic for the account's usage and keeps the models' own limits: `--usage`, run apart."""
    token = sign_in(home)
    if not token:
        return
    asked = urllib.request.Request(USAGE_API, headers={
        "Authorization": f"Bearer {token}", "anthropic-beta": "oauth-2025-04-20", "User-Agent": "speedy-code-statusline"})
    try:
        with urllib.request.urlopen(asked, timeout=10) as answer:
            scoped = scoped_of(json.load(answer))
    except (OSError, ValueError):
        return
    path = os.path.join(home, ".claude", "speedy-code", "usage.json")
    with open(path + ".new", "w", encoding="utf-8") as target:
        json.dump({"at": int(clock.time()), "scoped": scoped}, target)
    os.replace(path + ".new", path)


def load_scoped(home):
    """The models' own weekly limits as last kept. When what is kept is old, a fetch is started apart,
    one at a time, and the line goes on with what it has: it never waits for the network."""
    folder = os.path.join(home, ".claude", "speedy-code")
    kept = {}
    try:
        with open(os.path.join(folder, "usage.json"), encoding="utf-8") as source:
            kept = json.load(source)
    except (OSError, ValueError):
        pass
    if clock.time() - number(kept.get("at")) > USAGE_KEPT_SECONDS:
        mark = os.path.join(folder, "usage.fetching")
        try:
            is_under_way = clock.time() - os.path.getmtime(mark) < USAGE_FETCH_SECONDS
        except OSError:
            is_under_way = False
        if not is_under_way:
            try:
                with open(mark, "w", encoding="utf-8") as target:
                    target.write(str(int(clock.time())))
                apart = {"creationflags": 0x08000000 | 0x00000200} if os.name == "nt" else {"start_new_session": True}
                subprocess.Popen([sys.executable, os.path.abspath(__file__), "--usage"], stdin=subprocess.DEVNULL,
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **apart)
            except OSError:
                pass
    return [one for one in kept.get("scoped") or [] if isinstance(one, dict) and one.get("name")]


def load_levels(path):
    levels = {"contextYellow": 60, "contextRed": 80, "limitYellow": 75, "limitRed": 90}
    priority = list(DEFAULT_PRIORITY)
    icons = "emoji"
    app = ""
    update = False
    try:
        with open(path, encoding="utf-8-sig") as source:
            saved = json.load(source)
        for key in list(levels):
            if saved.get(key) is not None:
                levels[key] = int(saved[key])
        if saved.get("priority"):
            # The parts it knows in its order, once each; any it lacks after them, in the default order.
            known = []
            for key in saved["priority"]:
                # An order saved when the session's cost was a part: the model's own limit takes its place.
                key = "scoped" if key == "cost" else key
                if key in priority and key not in known:
                    known.append(key)
            priority = known + [key for key in priority if key not in known]
        if saved.get("icons") in SIGNS:
            icons = saved["icons"]
        # speedy-code's version, as the plugin writes it when a session starts: vyy.mmdd(hhmm).
        if isinstance(saved.get("version"), str):
            app = saved["version"]
        # A newer version on GitHub, as the plugin last found: a ↓ after the version.
        update = saved.get("update") is True
    except (OSError, ValueError, TypeError, AttributeError):
        pass
    return levels, priority, icons, app, update


def line_of(data, columns, levels, priority, icons="emoji", app="", scoped=(), update=False):
    sign = SIGNS[icons]

    def rank(key):
        return priority.index(key) + 1

    def level_color(used, yellow, red):
        return C_RED if used >= levels[red] else C_YELLOW if used >= levels[yellow] else C_GREEN

    def meter(percent, color):
        full = int(round(min(100, max(0, percent)) / 100 * 4))
        return paint("▰" * full, color) + paint("▱" * (4 - full), C_DIM)

    def part(name, value, tone):
        return paint(name, C_LABEL) + " " + paint(value, tone)

    version = data.get("version")

    window = data.get("context_window") or {}
    usage = window.get("current_usage") or {}
    tokens = " ".join([
        part("in", format_tokens(usage.get("input_tokens")), C_IN),
        part("out", format_tokens(usage.get("output_tokens")), C_OUT),
        part("caché", format_tokens(usage.get("cache_read_input_tokens")), C_CACHE),
    ])

    size = number(window.get("context_window_size"))
    held = number(usage.get("input_tokens")) + number(usage.get("cache_creation_input_tokens")) + number(usage.get("cache_read_input_tokens"))
    used = window.get("used_percentage")
    if used is None:
        remaining = window.get("remaining_percentage")
        used = 100 - number(remaining) if remaining is not None else (held / size * 100 if size else 0)
    used = round(number(used))
    ctx_color = level_color(used, "contextYellow", "contextRed")
    amount = " " + paint(f"{format_tokens(held)}/{format_tokens(size)}", ctx_color) if size else ""
    warning = " " + paint(f"{sign['warning']}  compactar", C_RED) if used >= levels["contextRed"] else ""
    context = paint("ctx:", C_LABEL) + " " + meter(used, ctx_color) + " " + paint(f"{used}%", ctx_color) + amount + warning

    # Claude Code's version opens the line, named: claude:v2.1.329. speedy-code's closes it.
    # A click opens its notes: the changelog's heading for the version, named without its dots.
    core = link(paint(f"claude:v{version}", C_CLAUDE), f"{CHANGELOG}#{str(version).replace('.', '')}") if version else ""
    time = paint(f"{sign['time']} {format_duration((data.get('cost') or {}).get('total_duration_ms'))}", C_TIME)

    parts = [
        {"rank": rank("core"), "full": core},
        {"rank": rank("time"), "full": time},
        {"rank": rank("tokens"), "full": tokens},
        {"rank": rank("context"), "full": context},
    ]
    limits = data.get("rate_limits") or {}
    # After the two windows, the weekly limit of each model that has one of its own, named by the model.
    windows = [("five_hour", "5hs", limits.get("five_hour")), ("seven_day", "semana", limits.get("seven_day"))]
    windows += [("scoped", one["name"], {"used_percentage": one.get("percent"), "resets_at": one.get("resets_at")}) for one in scoped]
    for key, label, limit in windows:
        # 0% is a limit too: the value's presence counts, not its truth.
        if limit and limit.get("used_percentage") is not None:
            limit_used = round(number(limit["used_percentage"]))
            limit_color = level_color(limit_used, "limitYellow", "limitRed")
            # The label is the link, in Claude's orange as every link is: a click opens the account's usage.
            # The meter and the share keep the colors that say how much is used.
            short = link(paint(label, C_CLAUDE), USAGE) + " " + meter(limit_used, limit_color) + " " + paint(f"{limit_used}%", limit_color)
            if limit_used >= levels["limitRed"]:
                short += " " + paint(sign["warning"], C_RED) + " "
            full = short + " " + paint(f"{sign['reset']} {format_reset(limit.get('resets_at'))}", C_LABEL)
            parts.append({"rank": rank(key), "full": full, "short": short})

    if app:
        # A newer version waits on GitHub: a yellow ↓ after it, until 🔄 takes it.
        mark = " " + paint("↓", C_UPDATE) if update else ""
        parts.append({"rank": rank("app"), "full": paint(app, C_APP) + mark})

    # The parts in rank order, each in its short form, until one does not fit; then the limits get their
    # reset time back with the room left. The first by priority always goes. Nothing is cut with "…".
    room = columns - 4 if columns > 0 else math.inf
    ranked = sorted(parts, key=lambda one: one["rank"])
    taken = 0
    for one in ranked:
        form = one.get("short") or one["full"]
        gap = 3 if taken else 0
        if taken > 0 and taken + gap + visible(form) > room:
            break
        one["shown"] = form
        taken += gap + visible(form)
    for one in ranked:
        if not one.get("shown") or not one.get("short"):
            continue
        more = visible(one["full"]) - visible(one["short"])
        if taken + more <= room:
            one["shown"] = one["full"]
            taken += more
    shown = [one["shown"] for one in parts if one.get("shown") and visible(one["shown"])]
    bar = paint(" │ ", C_DIM)
    # Claude Code's version is set off by », the rest by │.
    if core and parts[0].get("shown"):
        return parts[0]["shown"] + " " + paint("»", C_DIM) + " " + bar.join(shown[1:])
    return bar.join(shown)


def centered(line, columns):
    """The line set in the middle of `columns`. Claude Code strips the blanks a line starts with, so
    they go after a reset code, which draws nothing; it also sets the line two cells in."""
    pad = (columns - visible(line)) // 2 - 2 if columns > 0 else 0
    return f"{ESC}[0m{' ' * pad}{line}" if pad > 0 else line


def main():
    home = os.path.expanduser("~")
    if "--usage" in sys.argv[1:]:
        fetch_usage(home)
        return
    raw = sys.stdin.buffer.read().decode("utf-8", errors="replace")
    if not raw.strip():
        return
    data = json.loads(raw)
    levels, priority, icons, app, update = load_levels(os.path.join(home, ".claude", "speedy-code", "levels.json"))
    try:
        columns = int(os.environ.get("COLUMNS", "0"))
    except ValueError:
        columns = 0
    sys.stdout.buffer.write((centered(line_of(data, columns, levels, priority, icons, app, load_scoped(home), update), columns) + "\n").encode("utf-8"))


if __name__ == "__main__":
    main()
