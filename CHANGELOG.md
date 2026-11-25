# Changelog

## Unreleased

- Viewer, Windows: Office's old files open with no Office installed, by readers the setup adds (`msdoc2docx`, `sharepoint-to-text`; `legacy_office.py`): a .doc as its pages with its headings, bold and tables, an .xls as its sheets, and a .ppt as slides of its words alone. With Office they open through it as before; `SPEEDY_NO_OFFICE=1` shows them as on a machine with none.
- Viewer: more kinds of sound and video open in the player on both systems (FLV, OGV, MTS, VOB, ASF, RM, AC3, DTS, AMR, APE, WavPack and others): what the system does not play by itself, ffmpeg makes again as one it does.
- Viewer, Windows: the same there: a video or a sound Windows does not play as it is, as AV1 with no decoder for it, is made again by ffmpeg, when there is one, and plays.
- Viewer, macOS: a video or a sound macOS does not play as it is (AV1 on a Mac with no decoder for it, VP9) is made again as H.264 by ffmpeg, when there is one, and plays; with none, the popup says ffmpeg is what is missing.
- Viewer, Windows: a sound is played by Windows' newer player (Windows.Media.Playback), which takes a new speed at once, from where it stands; the one before went silent for a second or two.
- Viewer: a sound's and a video's popup has a switch for the speed, x0.5 x0.75 x1 x1.25 x1.5 x2: after a sound's size, and in a video's bar.
- Narration: with the narrator on, an answer's narration is made whole first (`NARRATOR_ONLY_MAKE`) and then played in the viewer's popup, where there is one; a selection read is spoken as before.
- Explorer: 📥 goes across machines, copied or moved: from another machine here, from here to it, and within it, a folder too (`remote.py pull | push | paste`, by tar over ssh).
- Explorer: the filter's search is held and let go (`‖ pausar` / `▸ seguir`) in place of stopped, by a file `find_files.py` reads (`SPEEDY_PAUSE`); it finds up to 50,000 files, no longer 1,000.
- Explorer: a file pressed is green until its popup is up, then stays marked until another press.
- Explorer: `‖ pausar`, beside the filter's ×, stops a search that still runs; the tree keeps the files found.
- Explorer: a disk's root has the five tools too, to paste into it and to copy its path; 📋, ✏ and 🗑 are grey there.
- Explorer: a file's name pressed is green for a second.
- Explorer: a file 📋 took on another machine is pasted on this one (fetched, then copied; never moved).
- Explorer: 📥, a fifth tool on each row, pastes what 📋 took last: grey until a file or a folder was taken, then it asks whether to copy or to move it into the row's folder, and whether for sure (`paste.py`; a third mode of the dialog). Nothing is written over.
- Explorer: another machine's disk opens at its person's folder, marked and in the middle; one with Windows at its root.
- Explorer: a machine with Windows reached by ssh has a disk too (`windows`, when `~/.ssh/config` has a `Host windows`): its disks under its root, `windows:/C:/Users/ana`; its Python is `python` where there is no `python3`. A file is fetched by the machine's Python, no longer by `cat`.
- Explorer: the scroll bar moves the tree at a pace, so a terminal that reports pixels does not flood it.
- Explorer: the scroll bar stands an empty cell away from the tree's tools, on a dark track; held, its thumb follows the pointer at once and each row is asked for once, so it no longer lags on terminals that report pixels (iTerm2, Ghostty, kitty, WezTerm).
- Explorer: another machine's disk is reached by the first ssh program that connects: on Windows, Git's when Windows' own refuses `~/.ssh/config` ("Bad owner or permissions"), which left the disk at `(sin conexión por ssh)`.
- Explorer: another machine reached by ssh has a disk after this machine's (`mac`, when `~/.ssh/config` has a `Host mac`, or the names in `SPEEDY_REMOTES`): its folders, its files in the viewer (fetched to the temporary folder) and the filter over its disk, by `remote.py`. Nothing is installed on that machine; ✏ and 🗑 are not for its files.
- Viewer: a presentation's bar has `Run` (F5), on Windows and macOS: the slides played one at a time, each whole over the entire screen. The arrows, Space, Enter, the page keys or a click go on and back; Esc ends it.
- Explorer: the filter leaves every `node_modules` and `.git` unread.
- Explorer: a filter under the field for a path. A pattern (`*.pdf`, `a*.docx`), Enter, and the disk shown is searched (`find_files.py`, the session's folder first): the tree holds only the files found, under their folders. `× limpiar` brings the whole tree back.
- Windows: a presentation (pptx, ppt) opens as its slides and a Word document (docx, doc) as its pages, under the bar a PDF has, as on macOS. PowerPoint or Word writes the pages where installed; without them Edge prints the popup's own drawing of a .pptx or a .docx (`office_pages.py`). A notice stands in the middle of the screen while the pages are got ready.
- macOS: a file of the explorer opens in a popup drawn as the Windows one (`view_file.py`), in place of Quick Look: text and code with Copiar and Formateado, Markdown, HTML and SVG with their Preview, a PDF's pages and text, spreadsheets, Word documents, SQLite databases, zip listings, audio and video. A kept narration plays in it, as on Windows.
- macOS: a presentation (pptx) opens as its slides, and a Word document (docx, doc) as its pages on paper, both under the bar a PDF has: go to a page, zoom, fit the width, the whole page. An old .ppt or .xls opens in Quick Look.
- Explorer: the scroll bar's thumb is held and moved with the mouse; a press on its track brings it there.
- Explorer: a scroll bar at the tree's right when it is taller than its room.
- Status line on macOS: the model's weekly share is read again when `~/.claude/.credentials.json` holds no sign-in of Claude's (the keychain is asked).
- macOS: the rename and delete dialogs and the pasted image's popup are drawn as the Windows ones (`dialog.py`, `view.py`: an HTML page in a window by pywebview, which `install.sh` adds). Without pywebview they stay macOS's own dialog and Quick Look. Windows is unchanged.

- Docs: in VS Code the window's zoom must be a whole level, or the footer's clicks land on the wrong cells.
- Status line: the version closes the line, named (`claude:v2.1.329`).
- Terminal font: in an editor's terminal (VS Code, Kiro, Cursor, Windsurf) the editor's `terminal.integrated.fontFamily` and `fontSize` are set, and nothing else; there the Nerd Fonts glyphs showed as squares. Terminal's and iTerm2's window fills the screen again over three seconds, larger font or smaller.
- Terminal font on macOS: only the terminal the session runs in is changed (Terminal, iTerm2 or Ghostty, by TERM_PROGRAM), and Terminal's open tabs too; Terminal's and iTerm2's window, shrunk by a smaller font, fills the screen again.
- Status line: no model nor effort, which the footer shows and changes.
- Footer: the 📎, 👁 and ☰ menus open at once and fill as what they list is read; they waited for PowerShell or Python, seconds on a busy Windows machine. The narrations kept are read from their folder with no program run.
- Terminal font: iTerm2, by a dynamic profile of its own (`speedy-code`) the tab is put on.
- Status line: drawn by `statusline.py` on Windows too, asked for every 5 seconds. The PowerShell script took seconds to start on a busy machine and was asked for every second, so with a few sessions open the line never showed. On macOS the glyphs' gap was written as an octal escape and printed a stray `2`: it is the en space meant.
- Footer: the permission mode in force beside the voice, with a menu that explains each mode and changes to it. No call tells a mod the mode nor sets it: it is put together from the settings, the mode the line under the prompt names as it is left and what a prompt sent says, and it is changed by pressing shift+tab.
- Footer: **☰** after + opens the conversations kept for the session's folder, newest first (the name given by `/rename`, else Claude Code's own title, else what was first asked); a click goes back to one, as `/resume`. `hooks/sessions.py` reads them.
- Footer: the social accounts are one control, **Redes sociales ▾**, whose menu lists them (badge, network, user name); a click opens the profile. The footer no longer holds a button per account.
- Footer: **+** asks the new conversation's name first, then runs `/clear` and, with a name, `/rename`.
- Settings: a second font for the terminal, Meslo (MesloLGS Nerd Font), beside JetBrains Mono; the setup installs both, and ⚙️ → Instalación checks them (**Fuentes de texto**). The settings of ⚙️ → Barra de estado are a table: a name, what is in use, and what changes it.
- Settings: ⚙️ → Barra de estado → **Fuente de la terminal** sets the terminal's font to JetBrains Mono (the Nerd Fonts build, so the icons are in it) at 8 to 16 points. A program in a terminal has no font of its own, so `setup/terminal_font.py` installs the font for the user and changes the terminal's settings: Windows Terminal, macOS Terminal (while open), Ghostty and kitty; each file keeps a copy as it first was (`.speedy-font.bak`). Other terminals take the font in their own settings.
- Icons: each glyph is followed by a cell of its own, in its color, since a terminal draws a glyph wider than its cell: no icon glued to its text or shown in two colors.
- Icons: with Nerd Fonts the menus and the status line are drawn in glyphs too, not the footer alone: the checks, warnings, play and pause of every menu, and the status line's folder, branch, model, clock and reset signs (the mod writes the icon set to `levels.json`, which both status line scripts read). The exit and the close mark are Codicons' thin `close`, `/compact` is two arrows meeting, and the blank after a glyph is a no-break space in the glyph's color, so a glyph drawn wider than its cell shows one color.
- Icons: a second icon set, Nerd Fonts glyphs, beside the emojis. ⚙️ → Barra de estado → **Usar Nerd Fonts** draws the footer and the ⋯ panel with Font Awesome glyphs, one color each and as wide as the emoji they replace; the row shows five glyphs to tell whether the terminal draws them. The setup has a `font` step (`setup/nerd_font.py`) that installs Symbols Nerd Font Mono in the user's own fonts, with no administrator rights. The menus keep their emojis.
- Footer and menus: the exit and the menus' close mark are `×`, in every font, one cell and one color.
- Footer and menus: the exit and the menus' close mark are `╳`, a box-drawing character the terminal draws itself in one color; `✕` came from a fallback font on Windows and showed two tones.
- Footer and status line: both are drawn in the middle of the terminal's width. Claude Code sets the footer against the right edge, so a blank as wide as the room left before it follows it; the status line starts with its blanks after a reset code, since Claude Code strips the ones a line starts with.
- Footer: after ✕, the version, `v:yy.mmdd-(hhmm)`: the moment of the clone's last commit in Buenos Aires time (UTC-3), asked of git once. It is the first thing to go when the row is short, and is not drawn where the mod is not a git clone.
- Footer: + beside ⏎ runs `/clear`, a new conversation in the same terminal with its context empty.
- Setup: a last step sets `defaultToAgentsView: false` in `~/.claude.json` (`setup/claude_prefs.py`), so `claude` opens a normal session; only that key changes, and the file as it was is kept as `~/.claude.json.bak`.
- Install from a clone on macOS: `install.sh` at the root, as `install.ps1` on Windows. The README says step by step how a person or an AI agent installs and updates it on either system.
- Voice: a narration part whose connection to Edge stalls is dropped after 12 seconds and asked again, up to three times; before, the narration went silent after its first part.
- macOS setup: Python verifies HTTPS with the macOS keychain (truststore, loaded by a `.pth` file, since Homebrew's Python hides an environment's `sitecustomize.py`); a network that inspects HTTPS no longer leaves the Edge voices failing. The voices step shows the real error when it fails.
- Microphone menu: the system's default is named after the system running (Windows or macOS).
- Models: Fable 5.2 replaces Fable 5.1 in the model menu.
- Social networks: a fresh install comes with the author's profiles filled in; anyone else writes theirs over them in ⚙️ → Redes sociales. Names saved before are kept as they are.
- macOS: the mod runs on macOS beside Windows, whose commands and scripts stay as they were. The clipboard goes through `pbpaste` and `osascript`, 🖼️/⏎ press Ctrl+V and Return through System Events (the terminal needs the Accessibility permission), links open with `open`, images in Quick Look, and narrations and kept clips play with `afplay` (`speak.py`, `play.py`), paused and resumed as on Windows. The status line is `statusline.py`, drawing the same line as `statusline.ps1`; ⚙️ → Instalación runs `setup/install.sh`; dictation lists Core Audio's microphones. History and image copies live in `~/Library/Application Support/speedy-code`.
- Footer: the model shows without ◆, after a │ that sets it apart from the tools; the gaps after the networks' │ and after the voice are one cell, like the rest.
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
