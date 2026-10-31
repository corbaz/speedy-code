# How speedy-code works

A Claude Code mod: one hooks module (`hooks/register.tsx`) the engine loads, and a few scripts it
runs as processes. Read this before changing the voice, the dictation or the footer: most of what
looks odd in the code is the answer to something that broke.

## The pieces

| Piece | Runs as | Talks to the mod by |
| --- | --- | --- |
| `hooks/register.tsx` | the hooks module, in Claude Code | — |
| `hooks/control.tsx` | a `Client` surface module, per footer control | `surface.post({ isClicked })` → `ui.message` |
| `hooks/speak.ps1` | PowerShell, one per narration | stdout lines; a pause file |
| `hooks/tts.py` | Python, started by `speak.ps1` | the audio files it writes |
| `hooks/listen.py` | Python, one per dictation | stdout lines; a stop file |
| `hooks/polish.py` | Python, one per 🖋️ click | stdin and stdout, JSON in ASCII |
| `setup/install.ps1` | PowerShell, from ⚙️ → Instalación or `install.ps1` | stdout lines |

Every Python script runs in one environment of the mod's own, `~/.claude/speedy-code/venv`, Python
3.12: faster-whisper's audio dependency (`av`) publishes no build for newer Pythons. The data folder
`~/.claude/speedy-code` also holds the pause and stop files and `listen.log`.

Saved across sessions, in the plugin store (`~/.claude/plugins/store/speedy-code_*.json`):
`isEnabled`, `picks` (a voice per language and `active`, the language narrated in), `mic`,
`socials` (accounts by network: `github`, then `github#2`, `github#3`...).

## The footer

- **Controls are `Client`s, not `Button`s.** A `Button` inverts its colors under the pointer and no
  prop turns that off; a `Client` (`control.tsx`) draws its label and posts on a left-button press.
  It posts on the press, not the release, and its region is wider than its glyph: a click need not
  land exactly.
- **A `Client` gets no background either way, and an emoji takes no color.** State shows by glyph:
  🔊/🔇, 🔵/🔴 for the microphone, ⏳ for the pen.
- **Play and pause use text glyphs (⏵ ⏸︎ ⧗), never emojis:** emoji widths differ from one to the next,
  so the footer moved as play turned to pause. U+FE0E asks for the text form.
- **Nothing hides:** play and the clip stay in place, gray, while the narrator is off. Controls that
  appeared and disappeared moved the rest.
- **A pane is not used for the menus.** A pane opened from a `Client` counts as unasked, and an
  unasked pane needs 110 columns or more; it also laid itself out differently with the width. The
  menus draw in the band above the prompt instead, framed. The band has no sticky rows (taller than
  its rows, it scrolls whole), and the engine caps it at half the terminal: the voice menu pages its
  voices and the settings split the networks into two tables to fit it.
- **The frame's title sits on its top border** by drawing order: the title row comes after the
  framed box in the tree (`column-reverse`, `marginBottom={-1}`), so it paints over the border, and
  paints its own letters alone. `position: absolute` is clipped and draws nothing.
- **Claude Code's own `[-]` on the band cannot be hidden or hooked**: no event reaches the mod.

## Reading aloud

1. `turn.complete` hands the answer; `plain()` strips markdown.
2. In the language narrated in and up to 3000 characters (`guessLanguage()` counts stopwords): read
   as it is. Otherwise Haiku translates it (short) or summarizes it (long). The narration is kept,
   so reading it again calls no model.
3. `speak.ps1` cuts it in up to five parts at sentence ends; `tts.py` makes the first alone, then the
   rest at once while the first plays (five Python processes at once were slower than one: 8.1 s to
   the first sound against 2.8 s). Two `MediaPlayer`s alternate so the next part is already open.
4. Audio is kept an hour as `%TEMP%\speedy-code-<hash>-<n>.mp3`, named by voice, rate and text, so
   sessions never share a file and reading again starts in under a second.
5. Pause: the mod writes `pause` or `play` to a file of that narration's own,
   `~/.claude/speedy-code/control-<uuid>.txt`. One shared file let one session pause another's
   voice. A read that meets the mod writing fails on Windows: it is read again on the next tick
   instead of ending the narration.
6. Switching off while it reads pauses (the audio is kept); switching on goes on.

## Dictation

`listen.py` records 16 kHz mono by WASAPI (MME cuts device names at 31 characters), cuts phrases at a
0.7 s pause or 8 s, and runs two models: `base` every 0.8 s on the phrase being said, for the preview
above the prompt (about 1 s on a 6-core CPU), and `large-v3-turbo` on each finished phrase, written
into the prompt (about 0.8× the phrase's length). The mic records while the models load, so nothing
said early is lost; a stop before the first phrase ended still cuts and writes what was recorded.
The speech threshold is low (0.002) because headset microphones are quiet. `listen.log` keeps each
dictation's microphone and levels.

`NARRADOR_LISTEN_FILE` (raw 16 kHz float32) stands for the microphone in a test.

## The pen (🖋️)

`polish.py` asks Groq's `openai/gpt-oss-120b`, the key from `GROQ_API_KEY`. It exists because the
mod's own `$.http.fetch` decoded Groq's UTF-8 as another encoding ("mágica" came back "m?gica"):
the mod and the script talk in pure ASCII (`\uXXXX`), so nothing on the way can break an accent. If
the draft changed while Groq answered, nothing is overwritten.

## Image paste and send

No mod API attaches an image to the draft, and a prompt a mod submits drops pasted images and `@`
mentions. So 🖼️ and ⏎ have Windows press Alt+V and Enter (`SendKeys`): the terminal, just clicked,
has the focus.

## Exit

✕ runs `/exit` through `$.command.run`. On `session.end` (not `/clear`, not a resume), the mod puts
`claude --resume <id>` on the clipboard: it cannot print after Claude Code closes.

## Settings fields

A user name is text at rest and a field only while edited: an `Input` drawn at rest did not always
show the value it was given, and its Enter label took a second line. Fields are keyed by how many
times the settings opened, so each opening starts from what is saved.

## Gotchas when editing these files

- PowerShell 5.1 reads a script without a BOM in the system code page: `.ps1` files with accents are
  saved as UTF-8 with BOM, and set `[Console]::OutputEncoding` to UTF-8.
- PowerShell 5.1 turns a native program's stderr into errors under `$ErrorActionPreference = 'Stop'`
  (uv writes its notes there): run such programs with it set to `Continue`, and judge by exit code.
- PowerShell variables are case-insensitive: `$PARTS` and `$parts` are one variable.
- In the hooks module, every function that takes `$` is declared at the top of the file; the
  validator refuses one declared inside `register`.
- A test that mocks `state.get` must seed every atom a drawing reads.
