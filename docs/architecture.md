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
3.12. The data folder
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

`listen.py` records 16 kHz mono by WASAPI (MME cuts device names at 31 characters) and feeds it to
NVIDIA's Nemotron 3.5 ASR Streaming (0.6B, Q8_0 GGUF, the model Handy uses) through `transcribe-cpp`,
the engine behind Handy, on the CPU. The model lives at `~/.claude/speedy-code/models`. It loads in
about half a second and transcribes about 7× faster than real time, so the words follow the voice
by about a second.

How the words reach the prompt:

- The stream's `text().committed` only grows. Each new piece is a `text <n> <piece>` line, appended
  to the prompt **as it is**: the model can cut a word in two (`princi`, `pal.`), so `listen.py`
  keeps its spaces and `register.tsx` adds none. A phrase's first piece starts with a space; the
  mod drops it only at the prompt's start or after a space already there.
- `tentative` is a `partial` line, shown above the prompt. Nemotron rarely leaves anything
  tentative: it commits as it goes.
- A pause of 0.8 s (loudness over a learned noise floor, low because headsets are quiet) ends the
  phrase: `finalize()` hands over its last word, and a fresh stream starts the next phrase.
- Blocks waiting when a feed ends are fed together, so a slow feed never leaves the model behind.

Gotchas, each one measured:

- `language` takes the model's own tags: `es` is refused, `es-US` and `es-ES` are taken. `listen.py`
  maps the narration's language to them (`es` → `es-US`).
- The model takes no vocabulary list (`transcribe-cpp` says so and ignores it): "commit" can come
  out "camit". The 🖋️ pen fixes those.
- The engine writes notes on stderr as it loads. PowerShell 5.1 takes any stderr line as a failure,
  even redirected, so `listen.py` points its stderr at `os.devnull` before importing it; errors
  still reach stdout as `error …`.

`listen.py --check LANG` loads the model and answers `ok <language>` or `fail <why>`: the setup tab
and `install.ps1` use it. `listen.log` keeps each dictation's microphone, language and levels.
`NARRADOR_LISTEN_FILE` (raw 16 kHz float32) stands for the microphone in a test.

## The pen (🖋️)

`polish.py` asks Groq's `openai/gpt-oss-120b`, the key from `GROQ_API_KEY`. It exists because the
mod's own `$.http.fetch` decoded Groq's UTF-8 as another encoding ("mágica" came back "m?gica"):
the mod and the script talk in pure ASCII (`\uXXXX`), so nothing on the way can break an accent. If
the draft changed while Groq answered, nothing is overwritten.

## Attachments and the pen

A pasted image or text lives in the draft as its chip, `[Image #1]` or `[Pasted text #2 +40 lines]`;
a draft written back without the chip loses the attachment. The pen sends each chip to Groq as a
`[[n]]` marker it is told to keep, and puts the chips back; one the model dropped goes at the end.

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

## Status line

`statusline/statusline.ps1` reads the JSON Claude Code sends on stdin: `model`, `effort.level`, `version`,
`cost`, `context_window` (`used_percentage`, `context_window_size`, `current_usage`) and
`rate_limits`. The tokens the context holds are `input + cache_creation + cache_read` of the last
request. The yellow and red levels come from `~/.claude/speedy-code/levels.json`, which the
⚙️ → Barra de estado tab writes; a missing or broken file falls back to the defaults (context 60/80,
limits 75/90). The status line is plain text: it takes no clicks, so the footer is where the model
and effort are changed.

## Narrow terminals

The status line reads its width from `$env:COLUMNS`, which Claude Code sets (`[Console]::WindowWidth`
fails there: no console handle). Its parts are taken by rank in their short form until one does not
fit, then the limits get their reset time back while there is room; a lower rank never takes a higher
one's place. The footer reads `e.viewport.columns`, which every drawing carries and which a resize
redraws. `footerGroups()` builds the controls in groups with their widths; `footerFit()` picks those
that fit by `FOOTER_RANKS`; the ones left out are kept in `hiddenGroups` for the ⋯ panel, which draws
the very same Clients, so a click there runs the footer's own handler.

## Model and effort in the footer

`/model` and `/effort` typed in the terminal are not events a mod sees. The model is polled every
1.5 s (`$.session.model()`). The effort rides on each model request: a `turn.step` hook reads
`e.effort`, keeps it, and redraws the footer. `turn.step` streams, so its hook must be an
`async function*` that ends with `return yield* next(e)`; a plain async hook fails validation.

## Gotchas when editing these files

- PowerShell 5.1 reads a script without a BOM in the system code page: `.ps1` files with accents are
  saved as UTF-8 with BOM, and set `[Console]::OutputEncoding` to UTF-8.
- PowerShell 5.1 turns a native program's stderr into errors under `$ErrorActionPreference = 'Stop'`
  (uv writes its notes there): run such programs with it set to `Continue`, and judge by exit code.
- PowerShell variables are case-insensitive: `$PARTS` and `$parts` are one variable. It bit the
  status line twice: a color `$MODEL` was the model's name `$model`, and a parameter `$label` was
  the color `$LABEL`. Its colors are named `$C_…` for that.
- The status line Claude Code runs is a copy, at `~/.claude/speedy-code/statusline.ps1`. Each
  session start copies it again when it is switched on, so a new version of the mod reaches it.
  It keeps its UTF-8 BOM: PowerShell 5.1 reads a file without one as ANSI.
- In the hooks module, every function that takes `$` is declared at the top of the file; the
  validator refuses one declared inside `register`.
- A test that mocks `state.get` must seed every atom a drawing reads.
- A test hook on a streaming event (`turn.step`) is registered before the first `$` call, and
  returns the event's result (`{ turnId, index, answer, toolUses }`); `ui.find` with `in:` throws
  when the keyed element is not drawn, it does not return undefined.
- `⚠` is drawn two columns wide by most terminals but counted as one: leave two spaces after it, or
  it covers the next glyph.
