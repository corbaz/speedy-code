"""Turns speedy-code's status line on or off in Claude Code's user settings, keeping the one before.

Usage: switch.py on|off|status

on:     copies statusline.ps1 to ~/.claude/speedy-code and points settings.json's `statusLine` at it;
        the status line set before is kept in ~/.claude/speedy-code/statusline-previous.json.
off:    puts the kept status line back (or removes `statusLine` when there was none).
status: says whether speedy-code's status line is the one in use.

Prints one line: "on", "off", or "error <why>". Every other key of settings.json is left as it is.
"""

import json
import os
import shutil
import sys

HOME = os.path.expanduser('~')
SETTINGS = os.path.join(HOME, '.claude', 'settings.json')
DATA = os.path.join(HOME, '.claude', 'speedy-code')
SCRIPT = os.path.join(DATA, 'statusline.ps1')
PREVIOUS = os.path.join(DATA, 'statusline-previous.json')
OURS = {
    'type': 'command',
    'command': f'powershell -NoProfile -ExecutionPolicy Bypass -File "{SCRIPT}"',
    'refreshInterval': 1,
}


def load(path, default):
    try:
        with open(path, encoding='utf-8') as source:
            return json.load(source)
    except FileNotFoundError:
        return default


def save(path, value):
    with open(path, 'w', encoding='utf-8') as target:
        json.dump(value, target, indent=2, ensure_ascii=False)
        target.write('\n')


def is_ours(settings):
    return 'speedy-code' in str((settings.get('statusLine') or {}).get('command', ''))


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else 'status'
    settings = load(SETTINGS, {})
    if action == 'on':
        os.makedirs(DATA, exist_ok=True)
        shutil.copyfile(os.path.join(os.path.dirname(__file__), 'statusline.ps1'), SCRIPT)
        if not is_ours(settings):
            save(PREVIOUS, {'statusLine': settings.get('statusLine')})
        settings['statusLine'] = OURS
        save(SETTINGS, settings)
    elif action == 'off':
        if is_ours(settings):
            previous = load(PREVIOUS, {}).get('statusLine')
            if previous:
                settings['statusLine'] = previous
            else:
                settings.pop('statusLine', None)
            save(SETTINGS, settings)
    print('on' if is_ours(settings) else 'off')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:  # pylint: disable=broad-except
        print(f'error {error}')
        sys.exit(1)
