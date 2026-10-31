# Narrador

A Claude Code mod for Windows that reads Claude's answers aloud with Microsoft Edge neural voices.

- After every answer, the narrator speaks it in the language you picked.
- A short answer in that language (up to 3000 characters) is read as it is, with no model call.
- Any other answer goes to Haiku first: translated in full when it is short, summarized in two to four sentences when it is long.
- First, a button per social network with a user name set (GH GitHub, in LinkedIn, X, YT YouTube, IG Instagram, TT TikTok, FB Facebook, TW Twitch, TH Threads, RD Reddit, GM Gmail: its inbox, DC Discord: by numeric user ID), then a separator: a click opens the profile in the browser.
- Left of the voice, three prompt buttons: 📋 copies the draft to the clipboard, 📥 pastes the clipboard at the cursor, 🖼️ pastes the clipboard's image (it has Windows press Alt+V, Claude Code's own image paste: no mod can attach an image to the draft), 🗑️ clears the draft, and🖋️sends the whole draft to Groq's `openai/gpt-oss-120b`, which returns it with its grammar, punctuation and order fixed, filler dropped and misheard technical words put right (pitest → pytest), in your own language and register; the draft is replaced with it, unless you typed into it meanwhile. It shows ⏳ while it works, about a second. After it, ⏎ sends the prompt: Windows presses Enter, so it goes with its pasted images and @ mentions, which a prompt a mod submits leaves out.
- The footer shows the voice; a click opens a picker with eleven language tabs (Spanish, English, French, Italian, Portuguese, Russian, Chinese, Arabic, Hindi, Bengali, Urdu) and a switch between women's and men's voices, the ones shown laid in as many columns as the width holds (up to four), the tabs too. The voices are paged (◀ 1/2 ▶) so the menu never grows past the rows it has: a band taller than its rows scrolls whole, and fitting it keeps the title, tabs and switch in place.
- Beside the voice, a speaker switches the narrator on (🔊) and off (🔇). One play button, always in its place (gray and inert while the narrator is off or nothing was read yet), follows what it does: ▶ reads the last answer again, ⏸ pauses, ▶ goes on from where it paused, ⏳ cancels while Haiku writes the narration.
- After play, a clip (📎) reads aloud the text selected in the terminal with the mouse, or the clipboard's when nothing is selected; play then reads it again.
- Last, a microphone (🎙️) dictates into the prompt: click it and speak, and each phrase is appended to the draft as soon as Whisper writes it (`large-v3-turbo`, on the CPU, offline). It shows 🔵 while the model loads (it records already, nothing said is lost) and while the last phrases are written after a stop, 🔴 while it listens (an emoji takes no color, so the glyph tells); click it again to stop, and what you were saying is still written. Sending the prompt stops it too. While you speak, a band above the prompt shows what a quick model (`base`) hears of each phrase, updated about once a second; when the accurate text is written into the prompt, its preview leaves the band. The ▾ beside it opens a menu of the microphones connected, with the Windows default first; the one picked is kept for the next sessions.
- Right of the microphone, 🔄 runs /reload-plugins, so an edit to the mod takes effect at once.
- After it, ⚙️ opens the settings, framed above the prompt, in tabs. Redes sociales: a table of fixed columns (badge, network, user name field, link) so every row aligns; each user name is text at rest, always whole; a click makes it a field, focused, and Enter keeps it; a + before a network's badge adds another account of it (its button numbered: GH2, GH3), and an added account left empty goes; where the width holds them, the networks take two tables side by side, so they fit the band Claude Code caps at half the terminal; saved as typed, for the next sessions too.
- Last of all, ✕ runs /exit. Whenever the session ends (not a /clear), `claude --resume <id>` goes to the clipboard, to paste in the terminal and come back to it.
- The menus show above the prompt; the icon that opens one closes it when clicked again, as its ✕ does. They show framed, their title on the top border and a close button at its end, the same whatever the terminal's width (a pane beside the chat changed its layout with its width).
- A new prompt stops the narration.

## Requirements

- Windows, with PowerShell 5.1 (it ships with Windows).
- Python with `edge-tts`: `pip install edge-tts`.
- An internet connection: Edge voices are synthesized by Microsoft's servers, so each narration's text is sent there.
- For the wand: a Groq API key in the system variable `GROQ_API_KEY`. The draft's text is sent to Groq.
- For the microphone: a Python 3.12 environment at `~/.claude/narrador/venv` with `faster-whisper` and `sounddevice` (`uv venv --python 3.12 ~/.claude/narrador/venv`, then `uv pip install --python ~/.claude/narrador/venv/Scripts/python.exe faster-whisper sounddevice numpy`). faster-whisper's audio dependency has no build for newer Pythons. The model (about 1.6 GB) downloads on first use. Dictation never leaves the machine.

## Command

```text
/narrador          switch on or off
/narrador on|off
/narrador stop     stop the narration under way
/narrador leer     read the last answer again
/narrador voces    open the voice picker
```

## Files

| File | What it does |
| --- | --- |
| `hooks/register.tsx` | The mod: narration, footer controls, voice picker |
| `hooks/speak.ps1` | Cuts the text in up to five parts, plays the first as soon as it is made and the rest after it, pausing on request |
| `hooks/tts.py` | Makes the parts with `edge-tts` in one process: the first alone, then the rest at once |
| `hooks/listen.py` | Dictation: records the microphone, cuts it at pauses, prints a quick preview of the phrase being said and the accurate text of each phrase |
| `hooks/polish.py` | The wand: asks Groq to clean the draft up, reading and writing pure ASCII so no accent breaks on the way |
| `hooks/control.tsx` | A footer control: no background, a press on its region is a click |
| `types/index.d.ts` | The state contract |
| `tests/narrador.test.tsx` | Tests, run with `claude plugin test .` |

Saved across sessions (the plugin store): whether it is on, and the voice picked per language with the one narrated in. While it speaks, the play button writes `pause` or `play` to a file of that narration's own, `~/.claude/narrador/control-<id>.txt`, which `speak.ps1` reads every tenth of a second and removes as it ends: sessions narrating at once never pause each other. The audio stays an hour in the temp folder, named by its voice, rate and text, so reading an answer again plays at once.

## License

MIT
