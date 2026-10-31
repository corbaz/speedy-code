# Changelog

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
