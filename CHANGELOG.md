# Changelog

## Unreleased

- Status line: each part in a color of its own, gray labels, and eight-cell bars for the context
  left and the 5-hour and weekly limits, filled in the color of their level. A session start
  refreshes the copy Claude Code runs.
- Model menu: the ◆ footer button picks a Claude model and an effort; Aplicar runs `/model` and
  `/effort`.
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
