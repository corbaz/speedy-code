# speedy-code

Talk to Claude Code and hear it answer. A Claude Code mod for Windows: Edge neural voices read the
answers aloud, a local speech model turns your voice into the prompt as you speak, and a footer of shortcuts handles
the rest.

## The footer

From left to right:

| Control | What it does |
| --- | --- |
| `GH` `in` `X` … | One button per social account set in ⚙️ → Redes sociales; opens its profile in the browser |
| 📋 | Copies the draft to the clipboard |
| 📥 | Pastes the clipboard's text at the cursor |
| 🖼️ | Pastes the clipboard's image (Windows presses Alt+V for you) |
| 👁️ | Lists the last 15 images pasted in this session, newest first, and follows new pastes while open; one clicked opens in a framed popup in the middle of the screen, in its own proportions, up to 80% of the screen and never enlarged. Its ✕ or Esc closes the picture and leaves the menu open; closing the menu closes the picture too |
| 🖋️ | Sends the draft to Groq, which returns it with grammar, order and misheard technical words fixed; ⏳ while it works |
| ⏎ | Sends the prompt (Windows presses Enter for you, so pasted images and @ mentions go along) |
| 🗑️ | Clears the draft |
| 🗣 *Voice* · *LANG* ▾ | Opens the voice menu |
| 🔊 / 🔇 | Switches the narrator on and off; off while it reads, it pauses, and on again it goes on |
| ⏵ / ⏸︎ / ⧗ | Reads the last answer again / pauses / goes on; ⧗ while Haiku writes the narration. Gray while the narrator is off |
| 📎 | Opens the audio menu: reads aloud the text selected with the mouse (or the clipboard's), and lists the last 10 narrations kept, newest first, each with ▶ to play it; 🗑️ clears them from disk |
| 🎙️ ▾ | Dictates into the prompt; ▾ picks the microphone |
| 🔄 | Runs `/reload-plugins` |
| ⚙️ | Opens the settings |
| ✕ | Runs `/exit`; `claude --resume <id>` is left on the clipboard |

Each menu (voices, microphones, settings) shows framed above the prompt; its icon, clicked again,
closes it, as its ✕ does.

## Reading aloud

- After every answer the narrator speaks it in the language picked in the voice menu.
- An answer in that language, up to 3000 characters, is read as it is: no model call, no tokens.
- Any other answer goes to Haiku first: translated in full when short, summarized when long.
- The text is cut in up to five parts: the first plays as soon as it is made while the rest are made.
- Reading an answer again reuses its audio for an hour: it starts at once.
- A new prompt stops the narration.

**The voice menu:** eleven language tabs (Español, Inglés, Francés, Italiano, Portugués, Ruso, Chino,
Árabe, Hindi, Bengalí, Urdu), a switch between women's and men's voices, the voices in as many
columns as the width holds and paged so the menu always fits.

## A narrow terminal

The footer keeps the tools (📋 📥 🖼️ 🖋️ ⏎ 🗑️), the model, the voice and ✕; short of room, the model
goes short (`◆ Opus ▾`) and then the voice (`🗣 ES ▾`); narrower still, the voice, 🗑️, 🖼️, 📋 and 🖋️
give way, so ⋯ and ✕ are always on screen. What does not fit goes in this order: the
networks first, then the narrator's controls, the microphone, 🔄 and ⚙️; a ⋯ appears. Click ⋯ for a
panel above the prompt: the session (context, time, cost) and the limits, then the networks and the
controls left out, each named (`🔄 recargar`), working as in the footer. ⋯ again, Esc or its ✕ closes it.
🗜️ beside the context runs `/compact`; once the context is red, 🗜️ also shows in the footer. In
narrow terminals the settings tabs stack their rows and the networks show the badge and user name.

## Model and effort

The footer shows the model in use and, beside it, the effort in force, in a traffic-light color:
`low` green, `medium` lime, `high` yellow, `xhigh` orange, `max` red. Both follow `/model` and
`/effort` typed in the terminal. Click either for the newest Claude models (Fable 5.1, Opus 5.5,
Sonnet 5.5, Haiku 5.5), each with what it is for, and the effort levels. The menu's title says what
is in use (`Modelo de Claude (Opus 5.5 · medium)`); the model and effort in use are filled with
their color. Pick a model, an effort or both, then **Aplicar**: it runs `/model <id>` and then
`/effort <level>`, as if you typed them.

## Status line

```
C:/cli » v2.1.316 ◆ Opus 5.5 · medium │ ⏱  1d 0h 36m │ in 2 out 712 caché 171.2k │ ctx: ▰▱▱▱ 17% 172.4k/1M │ sesión $85.88 │ 5hs ▱▱▱▱ 7% ↻ hoy 13:40 │ semana ▰▰▰▱ 86% ↻ hoy 13:40
```

- **v… ◆ model · effort:** the version of Claude Code running the session, the model, and the
  effort the turn runs at, in the footer's traffic-light colors.
- **⏱:** how long the session has run, in days, hours and minutes.
- **in / out / caché:** the tokens of the last request: new input, the answer, and input read from
  the prompt cache (cheap and fast).
- **ctx:** the share of the context window **used**, and the tokens it holds out of its size (`0/200k`
  before the first request). It turns yellow at 60% and red at 80%, where `⚠  compactar` asks for
  `/compact`.
- **sesión:** what the session has cost.
- **5hs / semana:** the share of each usage limit used, and when it resets. Yellow at 75%, red and
  `⚠` at 90%.

In a narrow terminal it keeps what matters most, each part whole: the version, model and effort
always, then the 5-hour limit, the weekly one, the context, the time, the cost, the tokens and the
folder; the limits drop their reset time before a part is left out. That priority is set in
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
  the defaults back, the priority too.
- **Redes sociales:** a user name per network (GitHub, LinkedIn, X, YouTube, Instagram, TikTok,
  Facebook, Twitch, Threads, Reddit, Gmail, Discord); + adds another account of a network and −
  removes an added one (a network always keeps its first). Click a user name to edit it, Enter keeps
  it. An added account left empty goes when the settings close. When the accounts do not fit, they
  go in pages (◀ 1/2 ▶).

## Command

```text
/speedy          switch the narrator on or off
/speedy on|off
/speedy stop     stop the narration under way
/speedy leer     read the last answer again
/speedy voces    open the voice menu
```

## Requirements

- Windows 10 or 11, with PowerShell 5.1 (it ships with Windows).
- Internet for the voices: Edge synthesizes them, so each narration's text is sent to Microsoft.
- For 🖋️: a Groq API key in the user variable `GROQ_API_KEY`; the draft is sent to Groq.
- Everything else (uv, Python 3.12, edge-tts, transcribe-cpp, the dictation model) is installed by
  ⚙️ → Instalación, or by `setup/install.ps1`, under `~/.claude/speedy-code`.

## Privacy

What leaves the machine: each narration's text (Microsoft, for the voice), each answer narrated in
another language (Anthropic, Haiku), and the draft when 🖋️ is clicked (Groq). Dictation, settings and
social accounts stay on the machine.

## License

MIT
