# speedy-code

Talk to Claude Code and hear it answer. A Claude Code mod for Windows: Edge neural voices read the
answers aloud, Whisper turns your voice into the prompt offline, and a footer of shortcuts handles
the rest.

## The footer

From left to right:

| Control | What it does |
| --- | --- |
| `GH` `in` `X` … | One button per social account set in ⚙️ → Redes sociales; opens its profile in the browser |
| 📋 | Copies the draft to the clipboard |
| 📥 | Pastes the clipboard's text at the cursor |
| 🖼️ | Pastes the clipboard's image (Windows presses Alt+V for you) |
| 🖋️ | Sends the draft to Groq, which returns it with grammar, order and misheard technical words fixed; ⏳ while it works |
| ⏎ | Sends the prompt (Windows presses Enter for you, so pasted images and @ mentions go along) |
| 🗑️ | Clears the draft |
| 🗣 *Voice* · *LANG* ▾ | Opens the voice menu |
| 🔊 / 🔇 | Switches the narrator on and off; off while it reads, it pauses, and on again it goes on |
| ⏵ / ⏸︎ / ⧗ | Reads the last answer again / pauses / goes on; ⧗ while Haiku writes the narration. Gray while the narrator is off |
| 📎 | Reads aloud the text selected with the mouse, or the clipboard's |
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
columns as the width holds and paged so the menu always fits. ✦ marks a multilingual voice.

## Dictation

Click 🎙️ and speak. It shows 🔵 while it loads (it records already), 🔴 while it listens. Above the
prompt, a quick model shows what it hears as you speak; at each pause, the accurate model writes the
phrase into the prompt. Click 🎙️ again to stop: what you were saying is still written. Whisper runs
on the CPU and the audio never leaves the machine. ▾ picks the microphone; the choice is kept.

## Settings (⚙️)

- **Instalación:** checks what is in place and installs or repairs it with one button.
- **Redes sociales:** a user name per network (GitHub, LinkedIn, X, YouTube, Instagram, TikTok,
  Facebook, Twitch, Threads, Reddit, Gmail, Discord); + adds another account of a network. Click a
  user name to edit it, Enter keeps it. Discord takes the numeric user ID.

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
- Everything else (uv, Python 3.12, edge-tts, faster-whisper, the Whisper models) is installed by
  ⚙️ → Instalación, or by `setup/install.ps1`, under `~/.claude/speedy-code`.

## Privacy

What leaves the machine: each narration's text (Microsoft, for the voice), each answer narrated in
another language (Anthropic, Haiku), and the draft when 🖋️ is clicked (Groq). Dictation, settings and
social accounts stay on the machine.

## License

MIT
