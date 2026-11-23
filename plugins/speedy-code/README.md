# speedy-code

Talk to Claude Code and hear it answer. A Claude Code mod for Windows and macOS: Edge neural voices read the
answers aloud, a local speech model turns your voice into the prompt as you speak, and a footer of shortcuts handles
the rest.

## The footer

From left to right:

| Control | What it does |
| --- | --- |
| Redes ▾ | Opens the menu of the social accounts set in ⚙️ → Redes sociales; a click on one opens its profile in the browser |
| 📋 | Copies the draft to the clipboard |
| 📥 | Pastes the clipboard's text at the cursor |
| 🖼️ | Pastes the clipboard's image (the system presses Alt+V on Windows, Ctrl+V on macOS, for you) |
| 👁️ | The image history: the mod keeps a copy of each pasted image in `%LOCALAPPDATA%\speedy-code\images`, the newest 15. Each row has 👁️, which opens it in a framed popup in the middle of the screen (its own proportions, up to 80% of the screen, never enlarged; its ✕ or Esc closes it and leaves the menu open), and 🖼️, which puts it in the prompt again: an image of this session, which Claude already has, by writing its `[Image #N]`, so no new number is taken; one of another session by pasting it (through the clipboard and Alt+V), when Claude Code gives it a new number. 🗑️ deletes the mod's copies only, never Claude Code's files |
| 🗑️ | Clears the draft |
| │ *Model* · *effort* ▾ | Opens the model menu (see below); a bar sets it apart from the tools |
| 🗣 *Voice* · *LANG* ▾ | Opens the voice menu |
| *Mode* ▾ | The permission mode in force (Manual, Ediciones, Plan, Sin permisos, Auto). Opens the menu that explains what each lets Claude Code do without asking; a click on one changes to it, by pressing shift+tab until it is reached. shift+tab itself works as ever, and Claude Code's own line under the prompt stays |
| 🗜️ | Runs `/compact`; always shown, whatever the context used |
| 🔊 / 🔇 | Switches the narrator on and off; off while it reads, it pauses, and on again it goes on |
| ⏵ / ⏸︎ / ⧗ | Reads the last answer again / pauses / goes on; ⧗ while Haiku writes the narration. Gray only before the first answer; the narrator off (🔇) only keeps the answers from being read on their own, so this and 📎 work all the same |
| 📎 | Opens the audio menu: reads aloud the text selected with the mouse (or the clipboard's), and lists the last 10 narrations kept, newest first, each with ▶ to play it; 🗑️ clears them from disk. On Windows a kept narration plays in the viewer's popup, with its bar to seek back and forth; so does ⏵ once the answer was read and kept |
| 🎙️ ▾ | Dictates into the prompt; ▾ picks the microphone |
| 🖋️ | Sends the draft to Groq, which returns it with grammar, order and misheard technical words fixed; ⏳ while it works |
| ⏎ | Sends the prompt (the system presses Enter for you, so pasted images and @ mentions go along) |
| + | Asks the new conversation's name in a menu above the prompt, then runs `/clear` and, with a name, `/rename`: a new conversation in this terminal, its context empty again |
| ☰ | Opens the menu of the conversations Claude Code keeps for this folder, newest first, each with when it last changed; a click goes back to one, as `/resume` |
| 🔄 | Runs `/reload-plugins`. When GitHub has a newer version (a yellow ↓ after the version in the status line), it takes it first, as a fast-forward that never overwrites a change of your own, then reloads |
| ⚙️ | Opens the settings |
| × | Runs `/exit`; `claude --resume <id>` is left on the clipboard |
| `~\.claude\local-mods ⎇ main` | The session's folder, home as `~`, and its git branch, after ✕. A click on the folder opens the explorer beside the chat: the disks above, and the disk's tree open down to the session's folder, marked ●; a folder pressed opens or closes, a disk pressed shows its own tree, and ↗ opens the session's folder in Explorer, or in Finder. A file the viewer shows, drawn yellow, opens in a popup in the middle of the screen with dark scroll bars (Quick Look on macOS): text and code (txt, sh, bat, ps1, ts, tsx, js, jsx, cjs, mjs, json, lock, ini, po, poe, d, .gitignore), selectable, with Copiar; md, html and svg drawn, with a switch to their source; pdf and pictures; xls, xlsx, doc and docx (the old formats through Excel or Word when installed); A presentation (pptx, ppt) opens as its slides and a Word document (docx, doc) as its pages, under the bar a PDF has (go to a page, zoom, fit the width, the whole page), with Texto beside them: on Windows the pages are PowerPoint's and Word's own where they are installed, and without them Edge prints the popup's own drawing of a .pptx or a .docx. sound and video, played; sqlite and db databases as tables; .lnk and .url shortcuts with their target; yaml, logs, .bak, .tmp, LICENSE and dotfiles as text; crx, .DS_Store, .sys and other binaries described. Copiar and ✕ are on the popup's top and bottom lines, and ✥ at ✕'s left, held down with the mouse, carries the popup elsewhere to read what is behind it (opened again, it stands in the middle; the image popup and the rename and delete dialogs have it too, in one style); Copiar's text goes to the clipboard and into the prompt, on a line of its own. 🔗 puts the path in the prompt too, 📋 attaches the file to it as @path, and Under the disks, a field takes a path pasted (`D:\Excel\rand.xlsx`, quoted or not; one not absolute is taken from the session's folder) and, on Enter, opens the tree down to it and marks it in yellow until the next press. Under that field, the filter's: a pattern (`*.pdf`, `a*.docx`; `*` is any text, `?` one character, the case does not matter, and a pattern with neither is a part of the name) and, on Enter, the disk shown is searched, the session's folder and the person's own first, and the tree holds only the files found, under their folders, as they are found; the rule under it says how many, and that it still searches. `× limpiar` beside it ends the search and brings the whole tree back. A filter shows 1000 files at most, and leaves out Windows' own folder, the Recycle Bin and, on a Mac, the system's folders and each person's Library. While the pointer is on a file's row, its tools included, its name takes a yellow fill. ⊟ beside the disks collapses every disk: the session's stays open down to its folder, the others close to their first level, and the disk shown stays shown. At the right of every file and every folder (a disk's root aside), 📋 puts it on the clipboard, 🔗 its path, ✏ renames it and 🗑 asks ¿Borrar? and sends it to the Recycle Bin or the Trash, a folder with what it holds; each icon is pressed on its own cells, with a gap between them that takes no press. A folder's name is blue and takes a blue fill under the pointer, kept while the pointer is on its icons. Clicked again, the folder closes the explorer. It keeps its room before the controls ranked lowest, and goes only when even the ones always drawn would not fit |

Each `[Image #N]` in the draft is painted blue in the prompt, and gets a chip above it: a click opens
that image in the popup, with no menu.

Each menu (voices, microphones, models, audios, images, settings) shows framed above the prompt; its icon, clicked again,
closes it, as its ✕ does.

## Reading aloud

- After every answer the narrator speaks it in the language picked in the voice menu.
- An answer in that language, up to 3000 characters, is read as it is: no model call, no tokens.
- Any other answer goes to Haiku first: translated in full when short, summarized when long.
- The text is cut in up to five parts: the first plays as soon as it is made while the rest are made.
- Reading an answer again reuses its audio for an hour: it starts at once.
- A new prompt stops the narration.
- A short text whose language cannot be told (a phrase of few words) is read as it is too, never sent to be translated.
- Every narration is kept in the history from the moment it starts, whole even when it is stopped halfway;
  the same text read again is kept once.
- 📎 → **leer selección** reads the newer of the text selected with the mouse and the clipboard's, as they
  are when it is pressed, so a text copied by any means while the menu is open is read. What it reads is in
  the history at once, and that row is the one playing (⏸ while it sounds, ⏵ paused); the selection's own row
  stays ready for the next text. Clearing the history blanks it too, and passes over the text the clipboard
  and the selection held then.
- On Windows the popup a kept narration plays in and the footer follow each other: ⏸ on the footer or on the
  row pauses the popup, and a pause pressed in the popup shows on both.

**The voice menu:** eleven language tabs (Español, Inglés, Francés, Italiano, Portugués, Ruso, Chino,
Árabe, Hindi, Bengalí, Urdu), a switch between women's and men's voices, the voices in as many
columns as the width holds and paged so the menu always fits.

## A narrow terminal

The footer keeps the tools (📋 📥 🖼️ 🖋️ ⏎ 🗑️), the model, the voice and ✕; short of room, the model
goes short (`Opus ▾`) and then the voice (`🗣 ES ▾`); narrower still, the voice, 🗑️, 🖼️, 📋 and 🖋️
give way, so ⋯ and ✕ are always on screen. What does not fit goes in this order: the
networks first, then the narrator's controls, the microphone, 🔄 and ⚙️; a ⋯ appears. Click ⋯ for a
panel above the prompt: the session (context, time, cost) and the limits, then the networks and the
controls left out, each named (`🔄 recargar`), working as in the footer. ⋯ again, Esc or its ✕ closes it.
🗜️ beside the context runs `/compact`; 🗜️ is also always in the footer, whatever the context. In
narrow terminals the settings tabs stack their rows and the networks show the badge and user name.

## Model and effort

The footer shows the model in use and, beside it, the effort in force, in a traffic-light color:
`low` green, `medium` lime, `high` yellow, `xhigh` orange, `max` red. Both follow `/model` and
`/effort` typed in the terminal. Click either for the newest Claude models (Fable 5.2, Opus 5.5,
Sonnet 5.5, Haiku 5.5), each with what it is for, and the effort levels. The menu's title says what
is in use (`Modelo de Claude (Opus 5.5 · medium)`); the model and effort in use are filled with
their color. Pick a model, an effort or both, then **Aplicar**: it runs `/model <id>` and then
`/effort <level>`, as if you typed them.

## Icons

The footer, the menus and the status line have two icon sets: emojis, which every terminal has, and Nerd Fonts glyphs, one color each
and all the same width. ⚙️ → **Barra de estado** → **Usar Nerd Fonts** switches, and the row shows five
glyphs to tell whether the terminal draws them. The setup installs Symbols Nerd Font Mono in the user's
fonts; a terminal whose font is not a Nerd Font, and that does not fall back to the fonts installed,
needs a Nerd Font picked in its settings.

With **Ver labels** on (the default), the pointer on a footer control shows what it does just above it,
dark on yellow: `copiar`, `pegar`, `pegar imagen`, `salir`. ⚙️ → **Barra de estado** → **Ocultar labels**
turns them off, and the choice is kept.

The same tab sets the terminal's font: **Fuente de la terminal** puts JetBrains Mono or Meslo (their
Nerd Fonts builds, so the icons are in them) at 8 to 16 points in Windows Terminal, macOS Terminal (while open),
Ghostty, kitty, the terminal of VS Code, Kiro, Cursor, Windsurf, Antigravity or Zed (their own settings, when TERM_PROGRAM says it runs there) and iTerm2 (a profile of its own, `speedy-code`, that the tab is put on and whose new windows open maximized; set it as the default for new tabs), by `setup/terminal_font.py`. A program in a terminal has no font of its own: the
terminal's settings change, and each file keeps a copy as it first was (`.speedy-font.bak`).
Warp, WezTerm, Alacritty and editors take the font, `JetBrainsMono NF` or `MesloLGS Nerd Font`, in
their own settings. The setup installs both, and ⚙️ → Instalación says whether they are there.

In VS Code (and its forks) the window's zoom must be a whole level (`window.zoomLevel` 0, 1, 2…): at a fractional one the terminal places the clicks in the wrong cells, and the footer's controls do not answer or answer for their neighbor. A terminal opened before the zoom changed keeps the old measures: open a new one.

## Status line

The line and the footer are both drawn in the middle of the terminal's width.

```
claude:v2.1.329 » ⏱  1d 0h 36m │ in 2 out 712 caché 171.2k │ ctx: ▰▱▱▱ 17% 172.4k/1M │ 5hs ▱▱▱▱ 7% ↻ hoy 13:40 │ semana ▰▰▰▱ 86% ↻ hoy 13:40 │ Fable ▰▰▰▰ 93% ↻ mañana 13:00 │ v26.1121(1012)
```

- **claude:v…:** the version of Claude Code running the session, in Claude's orange; Ctrl+click
  (Cmd+click on macOS) opens its notes in the changelog. The model and the effort are the
  footer's, where a click changes them, and so are the folder and the branch.
- **⏱:** how long the session has run, in days, hours and minutes.
- **in / out / caché:** the tokens of the last request: new input, the answer, and input read from
  the prompt cache (cheap and fast).
- **ctx:** the share of the context window **used**, and the tokens it holds out of its size (`0/200k`
  before the first request). It turns yellow at 60% and red at 80%, where `⚠  compactar` asks for
  `/compact`.
- **5hs / semana:** the share of each usage limit used, and when it resets; Ctrl+click (Cmd+click
  on macOS) on the label opens the account's usage page. Every link is in Claude's orange. Yellow at 75%, red and
  `⚠` at 90%.
- **Fable (a model's own weekly limit):** the share used of the weekly limit a model has of its own, named
  by the model, whether or not that model is in use. The session's JSON does not carry it, so the line
  asks Anthropic for the account's usage as Claude Code's own `/usage` does, with the session's sign-in
  (the credentials file, or the keychain on macOS), apart from the line and at most every five minutes;
  the answer is kept in `~/.claude/speedy-code/usage.json`. The sign-in goes nowhere but to Anthropic.
- **vyy.mmdd(hhmm):** speedy-code's version, last: the moment of the clone's last commit, in Buenos
  Aires time. The plugin writes it beside the levels when a session starts.
  It is asked of git every minute. Every hour the plugin also asks GitHub (a `git fetch`, which changes
  no file) whether main has commits the clone lacks: then a yellow `↓` follows the version until 🔄
  takes them.

In a narrow terminal it keeps what matters most, each part whole: the two versions always, then
the 5-hour limit, the weekly one, a model's own weekly limit, the context, the time and the tokens; the limits drop
their reset time before a part is left out. That priority is set in
⚙️ → Barra de estado; a part keeps its place on the line whatever its priority.

The levels are the defaults; ⚙️ → Barra de estado changes them. Crossing a red level also shows a
notice once.

## Dictation

Click 🎙️ and speak. It shows 🔵 for the half second the model takes to load, 🔴 while it listens.
The words go into the prompt as you say them, about a second behind your voice; a pause closes the
phrase. Click 🎙️ again to stop: what you were saying is still written. The model is NVIDIA's
Nemotron 3.5 ASR Streaming, the one Handy uses, run by transcribe-cpp on the CPU: the audio never
leaves the machine. ▾ picks the microphone; the choice is kept.

## Settings (⚙️)

- **Instalación:** checks what is in place and installs or repairs it with one button.
- **Barra de estado:** switches speedy-code's status line on ("Usar barra speedy-code"); the one
  you had is kept and comes back with "Restaurar mi barra". It also sets the levels where
  the context and the limits turn yellow and red, with − and + in steps of 5, and the priority of
  each part where the width is short, with ▲ and ▼. "Restaurar los valores por defecto" brings
  the defaults back, the priority too. The same tab switches the icon set (emojis or Nerd Fonts),
  the controls' names over them (**Ver labels**) and the terminal's font.
- **Redes sociales:** a user name per network (GitHub, LinkedIn, X, YouTube, Instagram, TikTok,
  Facebook, Twitch, Threads, Reddit, Gmail, Discord); + adds another account of a network and −
  removes an added one (a network always keeps its first). Click a user name to edit it, Enter keeps
  it. An added account left empty goes when the settings close. When the accounts do not fit, they
  go in pages (◀ 1/2 ▶).
- **Claude Code:** switches Claude Code's experimental Code Mode on or off (off unless switched on).
  On, it sets `env.CLAUDE_CODE_EXPERIMENTAL_CODE_MODE` to `"1"` in `~/.claude/settings.json`; off, it
  removes it. Claude Code reads it when it starts: the next session asks once whether to turn Code Mode
  on. In Code Mode Claude writes JavaScript that calls its tools instead of calling them one at a time;
  Claude in Chrome, computer use and Remote Control are off, and a session started in it resumes only
  with it on.

## Command

```text
/speedy          switch the narrator on or off
/speedy on|off
/speedy stop     stop the narration under way
/speedy leer     read the last answer again
/speedy voces    open the voice menu
```

## Requirements

- Windows 10 or 11, with PowerShell 5.1 (it ships with Windows); or macOS.
- On macOS, 🖼️, ⏎ and pasting a kept image press keys through System Events: allow your terminal in
  System Settings → Privacy & Security → Accessibility. The explorer's files, a pasted image, a kept narration
  and the rename and delete dialogs open in popups drawn as the Windows ones (Python with pywebview, which the
  installer adds; without it, Quick Look and macOS's own dialogs, and narrations play with `afplay`). There
  an .xls has no preview and a .doc is read through `textutil`, and the history and image copies live in `~/Library/Application Support/speedy-code`.
- Internet for the voices: Edge synthesizes them, so each narration's text is sent to Microsoft.
- For 🖋️: a Groq API key in the user variable `GROQ_API_KEY` (on macOS, exported in `~/.zshrc`); the draft is sent to Groq.
- Everything else (uv, Python 3.12, edge-tts, transcribe-cpp, the dictation model) is installed by
  ⚙️ → Instalación, or by `setup/install.ps1` (Windows) or `setup/install.sh` (macOS), under `~/.claude/speedy-code`.
- The setup also sets Claude Code's own preferences the mod wants on every machine (`setup/claude_prefs.py`):
  `defaultToAgentsView: false` in `~/.claude.json`, so `claude` opens a normal session (`claude agents`
  still opens the agents view). Only those keys change; the file as it was is kept as `~/.claude.json.bak`.

## Privacy

What leaves the machine: each narration's text (Microsoft, for the voice), each answer narrated in
another language (Anthropic, Haiku), and the draft when 🖋️ is clicked (Groq). Dictation, settings and
social accounts stay on the machine.

## License

MIT
