"""speedy-code's status line on macOS: the same line statusline.ps1 draws on Windows.

Folder, branch, version, model, effort, time, tokens, context used, cost and the 5-hour and weekly limits,
in color. In a narrow terminal it keeps what matters most. Claude Code runs it with the session's JSON on
stdin; switch.py copies it to ~/.claude/speedy-code and points the settings at it with the mod's Python.

Every part has a color of its own, and its label is gray. Context used and limits used are green, yellow
or red by the levels set in ⚙️ → Barra de estado (levels.json), as on Windows. Times are local.
"""

import json
import math
import os
import re
import sys
from datetime import datetime, timedelta

ESC = "\x1b"

C_FOLDER = "1;38;5;81"
C_BRANCH = "38;5;177"
C_MODEL = "1;38;5;215"
C_TIME = "38;5;117"
C_IN = "38;5;79"
C_OUT = "38;5;211"
C_CACHE = "38;5;147"
C_COST = "1;38;5;220"
C_FIVE = "38;5;111"
C_WEEK = "38;5;183"
C_LABEL = "38;5;245"
C_DIM = "38;5;240"
C_GREEN = "38;5;114"
C_YELLOW = "38;5;221"
C_RED = "1;38;5;203"
EFFORT_COLORS = {"low": "38;5;114", "medium": "38;5;149", "high": "38;5;221", "xhigh": "38;5;215", "max": "1;38;5;203"}
DEFAULT_PRIORITY = ["core", "five_hour", "seven_day", "context", "time", "cost", "tokens", "folder"]
DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
ANSI = re.compile(ESC + r"\[[0-9;]*m")


def paint(text, color):
    return f"{ESC}[{color}m{text}{ESC}[0m"


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


def load_levels(path):
    levels = {"contextYellow": 60, "contextRed": 80, "limitYellow": 75, "limitRed": 90}
    priority = list(DEFAULT_PRIORITY)
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
                if key in priority and key not in known:
                    known.append(key)
            priority = known + [key for key in priority if key not in known]
    except (OSError, ValueError, TypeError, AttributeError):
        pass
    return levels, priority


def line_of(data, columns, levels, priority, home):
    def rank(key):
        return priority.index(key) + 1

    def level_color(used, yellow, red):
        return C_RED if used >= levels[red] else C_YELLOW if used >= levels[yellow] else C_GREEN

    def meter(percent, color):
        full = int(round(min(100, max(0, percent)) / 100 * 4))
        return paint("▰" * full, color) + paint("▱" * (4 - full), C_DIM)

    def part(name, value, tone):
        return paint(name, C_LABEL) + " " + paint(value, tone)

    cwd = data.get("cwd") or (data.get("workspace") or {}).get("current_dir") or ""
    if home:
        cwd = cwd.replace(home, "~")
    model_data = data.get("model")
    model = (model_data.get("display_name") if isinstance(model_data, dict) else model_data) or ""
    effort = (data.get("effort") or {}).get("level")
    version = data.get("version")

    left = paint(cwd, C_FOLDER)
    branch = (data.get("git") or {}).get("branch")
    if branch:
        left = f"{left} {paint(f'⎇ {branch}', C_BRANCH)}"

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
    warning = " " + paint("⚠  compactar", C_RED) if used >= levels["contextRed"] else ""
    context = paint("ctx:", C_LABEL) + " " + meter(used, ctx_color) + " " + paint(f"{used}%", ctx_color) + amount + warning

    cost = part("sesión", f"${number((data.get('cost') or {}).get('total_cost_usd')):,.2f}", C_COST)

    core = (paint(f"v{version}", C_TIME) + " " if version else "") + paint(f"◆ {model}", C_MODEL)
    if effort:
        core += " " + paint("·", C_LABEL) + " " + paint(effort, EFFORT_COLORS.get(effort, C_LABEL))
    time = paint(f"⏱  {format_duration((data.get('cost') or {}).get('total_duration_ms'))}", C_TIME)

    parts = [
        {"rank": rank("folder"), "full": left},
        {"rank": rank("core"), "full": core},
        {"rank": rank("time"), "full": time},
        {"rank": rank("tokens"), "full": tokens},
        {"rank": rank("context"), "full": context},
        {"rank": rank("cost"), "full": cost},
    ]
    limits = data.get("rate_limits") or {}
    for key, label, color in (("five_hour", "5hs", C_FIVE), ("seven_day", "semana", C_WEEK)):
        limit = limits.get(key)
        # 0% is a limit too: the value's presence counts, not its truth.
        if limit and limit.get("used_percentage") is not None:
            limit_used = round(number(limit["used_percentage"]))
            limit_color = level_color(limit_used, "limitYellow", "limitRed")
            short = paint(label, color) + " " + meter(limit_used, limit_color) + " " + paint(f"{limit_used}%", limit_color)
            if limit_used >= levels["limitRed"]:
                short += " " + paint("⚠", C_RED) + " "
            parts.append({"rank": rank(key), "full": short + " " + paint(f"↻ {format_reset(limit.get('resets_at'))}", C_LABEL), "short": short})

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
    shown = [one["shown"] for one in parts if one.get("shown")]
    bar = paint(" │ ", C_DIM)
    # The folder is set off by », the rest by │.
    if parts[0].get("shown"):
        return parts[0]["shown"] + " " + paint("»", C_DIM) + " " + bar.join(shown[1:])
    return bar.join(shown)


def main():
    raw = sys.stdin.buffer.read().decode("utf-8", errors="replace")
    if not raw.strip():
        return
    data = json.loads(raw)
    home = os.path.expanduser("~")
    levels, priority = load_levels(os.path.join(home, ".claude", "speedy-code", "levels.json"))
    try:
        columns = int(os.environ.get("COLUMNS", "0"))
    except ValueError:
        columns = 0
    sys.stdout.buffer.write((line_of(data, columns, levels, priority, home) + "\n").encode("utf-8"))


if __name__ == "__main__":
    main()
