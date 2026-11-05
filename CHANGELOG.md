# Changelog

## Unreleased

- Image history of the mod's own: each pasted image is copied to `%LOCALAPPDATA%\speedy-code\images`,
  the newest 15 kept. 🗑️ clears those copies only, never Claude Code's files, and they are not copied
  again. Each row of the 👁️ menu has 🖼️, which pastes that image into the prompt again.
- The draft's `[Image #N]` are painted blue in the prompt, and each has a chip above it that opens the
  image in the popup straight away.
- Images: 👁️ in the footer lists the last 15 `[Image #N]` pasted in this session, newest first, and
  follows new pastes while it is open. A click opens the picture in a popup centered on the screen,
  in its own proportions (up to 80% of the screen, never enlarged), framed by a blue line and a black
  one. Its ✕ or Esc closes the picture and leaves the menu open; closing the menu closes the picture.
  Every folder Claude Code keeps the session's images in is read each time, so a session that changed
  folder still finds them all. 🗑️ deletes the session's images from disk, keeping those the prompt not
  yet sent still names, which Claude Code attaches when it is sent.
- Audio history: stopping a kept narration now ends its sound at once (play.ps1 wakes the mod ten
  times a second, as speak.ps1 does).
- Audio history: every narration is kept as an MP3 in `%LOCALAPPDATA%\speedy-code\audio`, named
  `<description>-yy-mm-dd_hh-mm-ss.mp3`; the newest 10 are kept. 📎 opens the menu: "leer selección"
  first, then the narrations newest first, each with ▶ to play it, and 🗑️ clears them from disk. The
  parts are joined in the background, after playback ends, so no sound waits for it. Beside each MP3
  there is a `.txt` with the text narrated; both go when the history is cleared, or when they pass
  the newest 10. Dictation is not kept, and saying the same text again keeps no second copy.
- Narrow terminals: the footer and the status line fit the width. Short of room, the model and
  the voice go short first, then some tools give way; ⋯ opens the rest with the figures. The
  status line keeps the parts by the priority set in ⚙️ → Barra de estado, and it no longer
  overflows.
- 🗜️ in the footer and in the ⋯ panel runs `/compact`.
- Settings: short tab names, plain status line words, and menus whose chosen option keeps its
  fill under the pointer; a click on the chosen effort takes the pick back.
- Status line: each part in a color of its own, short labels (`ctx:`, `in`, `out`), four-cell
  bars for the context used and the 5-hour and weekly limits, filled in a traffic-light color. The
  context shows its tokens out of the window size; the time goes in days, hours and minutes; the
  effort follows the model. Yellow and red levels are editable in ⚙️ → Barra de estado, and crossing
  a red one shows a notice once. A session start refreshes the copy Claude Code runs.
- Model menu: the ◆ footer button picks a Claude model and an effort; Aplicar runs `/model` and
  `/effort`. The footer shows the effort in force in a traffic-light color and follows `/model` and
  `/effort` typed in the terminal; the menu's title and fills mark what is in use.
- Dictation: NVIDIA's Nemotron 3.5 ASR Streaming, run by transcribe-cpp, replaces Whisper. The
  words go into the prompt as they are said, it loads in half a second, and it is still local.
  One model of about 750 MB instead of two of 1.8 GB.
- Setup: `-SkipModels` is gone; the model always downloads, and is loaded once to check it.

## 0.9.0 — 2026-10-31

First version as `speedy-code` (it was `narrador`, built as a local mod).

- Narration: Edge neural voices, eleven languages, a voice per language, women's and men's voices;
  short answers read as they are, the rest through Haiku; the text in five parts so it starts fast;
  pause, resume, read again with its audio reused.
- Dictation: offline Whisper (`large-v3-turbo`), a live preview (`base`) above the prompt, a
  microphone menu.
- Footer: social accounts, copy, paste text, paste image, the 🖋️ Groq clean-up, send, clear,
  reload, settings, exit with `claude --resume` on the clipboard.
- Settings: an install tab that checks and repairs everything; social networks with several
  accounts each.
- Status line: a colored one, switched on from ⚙️ → Instalación, the previous one kept.
- Setup: `install.ps1` installs uv, Python 3.12, the voices, the dictation and the models with no
  administrator rights; one Python environment for every script.
