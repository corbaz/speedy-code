# speedy-code

**Hablale a Claude Code y escuchalo responder.** Un plugin de Claude Code para Windows: lee las
respuestas en voz alta con las voces neurales de Microsoft Edge, convierte tu voz en el prompt con
Whisper sin internet, y suma al pie de la pantalla una barra de atajos (copiar, pegar texto o
imagen, corregir el prompt con IA, enviar, tus redes, salir y volver).

*Talk to Claude Code and hear it answer: Edge neural voices, offline Whisper dictation, prompt tools
and a footer of shortcuts. Windows.*

---

## Install

### From GitHub

In Claude Code:

```text
/plugin marketplace add <owner>/speedy-code
/plugin install speedy-code@speedy-code
```

Restart Claude Code. On its first start it opens ⚙️ → **Instalación**: click **Instalar / reparar
todo** and it installs the rest (uv, Python 3.12, the voices, the dictation, about 1.8 GB of Whisper
models). Nothing needs administrator rights.

### From a clone

```powershell
git clone https://github.com/<owner>/speedy-code
cd speedy-code
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1
```

`install.ps1` adds the clone as the `speedy-code` marketplace, installs the plugin and runs the setup.
Options: `-SkipModels` (the models download on the first dictation instead), `-GroqKey <key>` (saves
the key the 🖋️ button uses).

## What it does

See [plugins/speedy-code/README.md](plugins/speedy-code/README.md): every footer control, the voice
menu, dictation, settings, privacy.

## Repository

```text
.claude-plugin/marketplace.json   the marketplace Claude Code installs from
plugins/speedy-code/              the plugin: what Claude Code copies and runs
  hooks/register.tsx                the mod: footer, menus, narration, dictation, settings
  hooks/control.tsx                 a footer control with no hover background
  hooks/speak.ps1, tts.py           the voice: Edge TTS in parts, played with pause and resume
  hooks/listen.py                   dictation: microphone, pauses, Whisper preview and text
  hooks/polish.py                   the 🖋️ button: Groq, in ASCII both ways
  setup/install.ps1                 installs everything beside the code
  tests/speedy-code.test.tsx        the tests
  types/index.d.ts                  the state contract
install.ps1                       installs from a clone
docs/architecture.md              how it works inside, and what was learned building it
```

## Develop

The plugin is read from its folder: an edit takes effect with 🔄 (or `/reload-plugins`), no build.

```powershell
claude plugin test plugins/speedy-code       # the tests (about two minutes)
claude plugin validate plugins/speedy-code   # what Claude Code would refuse
```

Type-check with `tsc` against the types Claude Code writes beside a loaded mod
(`plugins/speedy-code/.claude-plugin/types/`, ignored by git). Read
[docs/architecture.md](docs/architecture.md) before changing the voice, the dictation or the footer.

## License

[MIT](LICENSE) © 2026 Julio Cesar Corbaz
