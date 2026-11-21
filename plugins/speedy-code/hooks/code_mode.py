"""Turns Claude Code's experimental Code Mode on or off in the user's settings.

Usage: code_mode.py on|off|status

on:     sets `env.CLAUDE_CODE_EXPERIMENTAL_CODE_MODE` to "1" in ~/.claude/settings.json.
off:    removes that key (and `env`, when it held nothing else).
status: says whether the settings turn it on.

Claude Code reads it when it starts: the next session asks once whether to turn Code Mode on.
Prints one line: "on", "off", or "error <why>". Every other key of settings.json is left as it is,
and a settings.json that is not valid JSON, or whose `env` is not an object, is never written.
"""

import json
import os
import shutil
import stat
import sys
import tempfile

SETTINGS = os.path.join(os.path.expanduser('~'), '.claude', 'settings.json')
KEY = 'CLAUDE_CODE_EXPERIMENTAL_CODE_MODE'


def load():
    try:
        with open(SETTINGS, encoding='utf-8') as source:
            return json.load(source)
    except FileNotFoundError:
        return {}


def save(settings):
    # A whole new file put in place at once: a run cut short never leaves half a settings.json. A link
    # (a dotfiles setup) is followed, so the file it points at changes and the link stays; the file
    # keeps its permissions.
    target_path = os.path.realpath(SETTINGS)
    folder = os.path.dirname(target_path)
    os.makedirs(folder, exist_ok=True)
    handle, temporary = tempfile.mkstemp(dir=folder, prefix='.settings-', suffix='.json')
    try:
        with os.fdopen(handle, 'w', encoding='utf-8') as target:
            json.dump(settings, target, indent=2, ensure_ascii=False)
            target.write('\n')
        if os.path.exists(target_path):
            shutil.copymode(target_path, temporary)
        os.replace(temporary, target_path)
    except BaseException:
        # The copy may have taken a read-only mode: made writable, so it can go.
        try:
            os.chmod(temporary, stat.S_IWRITE | stat.S_IREAD)
            os.remove(temporary)
        except OSError:
            pass
        raise


def is_on(settings):
    env = settings.get('env')
    value = env.get(KEY) if isinstance(env, dict) else None
    return str(value).strip().lower() in ('1', 'true', 'yes', 'on')


def run(action):
    try:
        settings = load()
    except ValueError:
        return 'error settings.json no es JSON valido'
    if not isinstance(settings, dict):
        return 'error settings.json no es un objeto'
    env = settings.get('env')
    if action in ('on', 'off') and env is not None and not isinstance(env, dict):
        return 'error el env de settings.json no es un objeto'
    if action == 'on':
        env = env or {}
        env[KEY] = '1'
        settings['env'] = env
        save(settings)
    elif action == 'off' and env and KEY in env:
        del env[KEY]
        if not env:
            del settings['env']
        save(settings)
    return 'on' if is_on(settings) else 'off'


def main():
    try:
        print(run(sys.argv[1] if len(sys.argv) > 1 else 'status'))
    except OSError as error:
        print(f'error no pude leer o escribir settings.json: {error.strerror or error}')


if __name__ == '__main__':
    main()
