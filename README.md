# speedy-code

**Hablale a Claude Code y escuchalo responder.** Un plugin de Claude Code para Windows y macOS: lee
las respuestas en voz alta con las voces neurales de Microsoft Edge, convierte tu voz en el prompt
mientras hablás, con un modelo que corre en tu máquina, y suma al pie de la pantalla una barra de atajos
(copiar, pegar texto o imagen, corregir el prompt con IA, enviar, conversación nueva, tus redes, salir y volver).

*Talk to Claude Code and hear it answer: Edge neural voices, local dictation streamed as you speak, prompt tools
and a footer of shortcuts. Windows and macOS.*

---

## Install

Requirements: [Claude Code](https://claude.com/claude-code) and git. Nothing needs administrator rights;
everything else (uv, Python 3.12, the voices, the dictation and its model, about 750 MB) is installed
under the user's own folders.

### Windows

```powershell
git clone https://github.com/corbaz/speedy-code "$HOME\.claude\local-mods"
powershell -NoProfile -ExecutionPolicy Bypass -File "$HOME\.claude\local-mods\install.ps1"
```

Option: `-GroqKey <key>` (saves the key the 🖋️ button uses).

### macOS

```bash
git clone https://github.com/corbaz/speedy-code ~/.claude/local-mods
bash ~/.claude/local-mods/install.sh
```

Then allow your terminal in System Settings → Privacy & Security → Accessibility (🖼️ and ⏎ press keys).
For 🖋️, export `GROQ_API_KEY` in `~/.zshrc`.

Both scripts add the clone as the `speedy-code` marketplace, install the plugin and run the setup.
Restart Claude Code: the footer shows at the bottom right. ⚙️ → **Instalación** → **Instalar / reparar
todo** runs the same setup again at any time.

### Update

```bash
cd ~/.claude/local-mods          # Windows: cd $HOME\.claude\local-mods
git pull
claude plugin marketplace update speedy-code
```

Then restart Claude Code (or 🔄 in the footer).

### From GitHub, without a clone

In Claude Code: `/plugin marketplace add corbaz/speedy-code`, then `/plugin install speedy-code@speedy-code`,
restart, and click ⚙️ → Instalación → **Instalar / reparar todo**.

### For an AI agent installing it

Do these steps in order, without asking; each is safe to run again.

1. Check that `claude --version` and `git --version` work. If `claude` is missing, stop and tell the user.
2. Detect the system: Windows (PowerShell, `$env:OS -eq 'Windows_NT'`) or macOS (`uname` prints `Darwin`).
3. If `~/.claude/local-mods/.git` exists, run `git -C ~/.claude/local-mods pull`; otherwise clone as above.
   Do not clone anywhere else: the update commands assume this folder.
4. Run the installer for the system (`install.ps1` on Windows, `bash install.sh` on macOS) from the clone and
   read its output: every line marked ✘ is a step that failed, with the reason after it.
   `Clave de Groq` failing is optional (only 🖋️ needs it); any other ✘ needs fixing before you finish.
5. Tell the user to restart Claude Code. On macOS also tell them to allow their terminal under
   Accessibility. Never ask for or print the Groq key yourself.

The setup also sets `defaultToAgentsView: false` in `~/.claude.json`, so `claude` opens a normal session
(a copy of the file as it was is kept as `~/.claude.json.bak`).

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
  hooks/speak.py, play.py, player.py  the voice on macOS (afplay)
  hooks/listen.py                   dictation: microphone, pauses, streamed words
  hooks/polish.py                   the 🖋️ button: Groq, in ASCII both ways
  setup/install.ps1, install.sh     installs everything beside the code (Windows, macOS)
  setup/claude_prefs.py             Claude Code preferences the setup sets
  statusline/                       the colored status line (statusline.ps1, statusline.py)
  tests/speedy-code.test.tsx        the tests
  types/index.d.ts                  the state contract
install.ps1, install.sh           install from a clone (Windows, macOS)
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
