import { atom, read, update } from 'claude-code'
import type { EngineInterface, FsEntry, Register } from 'claude-code'

/** What a render hook hands `$.ui.resolve`: a pane's or the band's. */
type Drawn = Parameters<EngineInterface['ui']['resolve']>[0]

import type { BarLevels, BarPart, Explorer, ExplorerEntry, ExplorerFilter, ExplorerListing, Heard, HistoryClip, LevelKey, Listening, Menu, PastedImage, PermissionMode, Picks, SessionRow, SetupCheck, Socials, Speech, Voice } from '../types'

const PANE = 'speedy-code'
const MIC_PANE = 'speedy-code-mic'
const DEFAULT_LANG = 'es'
const DEFAULT_PICKS: Picks = { es: 'es-AR-ElenaNeural' }
/** How fast the voice speaks, as a multiple of its own pace. */
const SPEED = 1.3
/** An answer up to this many characters, in the language narrated in, is read as it is: no Haiku call. */
const SHORT_ANSWER = 3000
/** Where the pause button leaves its word for speak.ps1: a file per narration, so sessions narrating
 * at once never pause each other. speak.ps1 removes it as it ends. */
const CONTROL_DIR = '.claude/speedy-code'
/** The narrations kept for the 📎 menu: a folder under the local app data, and how many of the newest.
 * history.py keeps the same count when it saves. */
const HISTORY_DIR = 'speedy-code/audio'
const HISTORY_LENGTH = 10
/** How much of a narration's text names its file. */
const HISTORY_NAME_LENGTH = 40
/** How many of the newest pasted images the mod keeps copies of, and its menu lists. */
const IMAGES_LENGTH = 15
/** The mod's own copies of the pasted images, under the local app data: Claude Code's may go. */
const IMAGES_DIR = 'speedy-code/images'
/** The color of an `[Image #N]`: painted in the prompt, and on the chips above it. */
const IMAGE_COLOR = '#74c0fc'
/**
 * The Python environment every script runs in: the voice (edge-tts), the dictation (transcribe-cpp
 * with a local streaming model) and the pen. One environment of the mod's own, so a machine
 * needs no Python package installed by hand.
 */
export function pythonOf (os: Os) {
  return os === 'windows' ? '.claude/speedy-code/venv/Scripts/python.exe' : '.claude/speedy-code/venv/bin/python'
}

/** The system the mod runs on. Windows keeps its PowerShell scripts; macOS has its own tools beside them. */
export type Os = 'windows' | 'mac'

/** Windows always sets USERPROFILE and macOS never does: the mod API names no system of its own. */
export function osOf (userProfile: string | undefined): Os {
  return userProfile ? 'windows' : 'mac'
}

/**
 * What macOS runs where Windows runs PowerShell. Paths go in by the environment or as their own argument,
 * never spliced into a script. Key presses go through System Events: the terminal needs the Accessibility
 * permission. Claude Code on macOS pastes an image with Ctrl+V, where Windows uses Alt+V.
 */
export const MAC = {
  clipboardRead: ['pbpaste'],
  clipboardWrite: (text: string) => ['osascript', '-e', 'on run argv', '-e', 'set the clipboard to item 1 of argv', '-e', 'end run', text],
  open: (link: string) => ['open', link],
  /** A file to the clipboard as a file, as Finder's Copy leaves it. */
  copyFile: (path: string) => ['osascript', '-e', 'on run argv', '-e', 'set the clipboard to (POSIX file (item 1 of argv))', '-e', 'return "copied"', '-e', 'end run', path],
  /** 📥's dialog, by AppleScript: whether the file is copied or moved into a folder, then whether for sure. */
  pasteDialog: (name: string, folder: string) => ['osascript', '-e', 'on run argv', '-e', 'try', '-e', 'set verb to button returned of (display dialog ("¿Copiar o mover " & (item 1 of argv) & " a " & (item 2 of argv) & "?") with title "Pegar" buttons {"Cancelar", "Mover", "Copiar"} default button "Copiar" cancel button "Cancelar")', '-e', 'display dialog ("¿Seguro? " & verb & " " & (item 1 of argv) & " a " & (item 2 of argv)) with title "Pegar" buttons {"No", "Sí"} default button "No" cancel button "No"', '-e', 'if verb is "Mover" then return "move"', '-e', 'return "copy"', '-e', 'on error', '-e', 'return "cancel"', '-e', 'end try', '-e', 'end run', name, folder],
  /** The explorer's dialogs, by AppleScript: the new name (`name <text>`), the new folder's (`name <text>`), or whether the file goes to the Trash. */
  dialog: (mode: 'rename' | 'delete' | 'mkdir', name: string) => mode === 'mkdir'
    ? ['osascript', '-e', 'on run argv', '-e', 'try', '-e', 'set answer to text returned of (display dialog ("Nombre de la carpeta nueva, en " & (item 1 of argv) & ":") default answer "Nueva carpeta" with title "Nueva carpeta" buttons {"Cancelar", "Crear"} default button "Crear" cancel button "Cancelar")', '-e', 'return "name " & answer', '-e', 'on error', '-e', 'return "cancel"', '-e', 'end try', '-e', 'end run', name]
    : mode === 'rename'
    ? ['osascript', '-e', 'on run argv', '-e', 'try', '-e', 'set answer to text returned of (display dialog "Nombre nuevo:" default answer (item 1 of argv) with title "Renombrar" buttons {"Cancelar", "Aceptar"} default button "Aceptar" cancel button "Cancelar")', '-e', 'return "name " & answer', '-e', 'on error', '-e', 'return "cancel"', '-e', 'end try', '-e', 'end run', name]
    : ['osascript', '-e', 'on run argv', '-e', 'try', '-e', 'display dialog ("¿Mandar " & (item 1 of argv) & " a la papelera?") with title "Borrar" buttons {"No", "Sí, borrar"} default button "No" cancel button "No"', '-e', 'return "delete"', '-e', 'on error', '-e', 'return "cancel"', '-e', 'end try', '-e', 'end run', name],
  /** A file to the Trash by Finder, where Put Back brings it again. */
  trash: (path: string) => ['osascript', '-e', 'on run argv', '-e', 'tell application "Finder" to delete (POSIX file (item 1 of argv) as alias)', '-e', 'return "deleted"', '-e', 'end run', path],
  clearClips: ['/bin/sh', '-c', 'rm -f "$SPEEDY_HISTORY"/*.mp3 "$SPEEDY_HISTORY"/*.txt'],
  clearImages: ['/bin/sh', '-c', 'find "$SPEEDY_DIR" -maxdepth 1 -type f -delete 2>/dev/null; true'],
  /** As Windows keeps them: a copy whose bytes are already kept is skipped, and the newest SPEEDY_KEEP by name stay. */
  keepImages: ['/bin/sh', '-c', [
    'mkdir -p "$SPEEDY_DIR"',
    "known=''",
    'for f in "$SPEEDY_DIR"/*; do [ -f "$f" ] && known="$known $(shasum -a 256 "$f" | cut -d" " -f1)"; done',
    "while IFS='|' read -r src dst; do",
    '  [ -n "$src" ] || continue',
    '  hash=$(shasum -a 256 "$src" 2>/dev/null | cut -d" " -f1)',
    '  [ -n "$hash" ] || continue',
    '  case "$known" in *"$hash"*) continue ;; esac',
    '  cp -f "$src" "$dst" 2>/dev/null && known="$known $hash"',
    'done <<EOF',
    '$SPEEDY_COPIES',
    'EOF',
    'ls -1 "$SPEEDY_DIR" | sort -r | tail -n +$((SPEEDY_KEEP + 1)) | while IFS= read -r name; do rm -f "$SPEEDY_DIR/$name"; done'
  ].join('\n')],
  pasteImage: ['/bin/sh', '-c', `if osascript -e 'clipboard info' 2>/dev/null | grep -qE 'PNGf|TIFF|JPEG|GIFf'; then osascript -e 'tell application "System Events" to keystroke "v" using control down' >/dev/null && echo pasted; else echo none; fi`],
  repasteImage: ['/bin/sh', '-c', [
    "case \"$SPEEDY_IMAGE\" in *.[jJ][pP][gG]|*.[jJ][pP][eE][gG]) kind='JPEG picture' ;; *) kind='«class PNGf»' ;; esac",
    'osascript -e \'on run argv\' -e "set the clipboard to (read (POSIX file (item 1 of argv)) as $kind)" -e \'end run\' "$SPEEDY_IMAGE" >/dev/null &&',
    '  osascript -e \'tell application "System Events" to keystroke "v" using control down\' >/dev/null && echo pasted'
  ].join('\n')],
  cycleMode: ['osascript', '-e', 'tell application "System Events" to key code 48 using shift down', '-e', 'return "sent"'],
  sendEnter: ['osascript', '-e', 'tell application "System Events" to key code 36', '-e', 'return "sent"'],
  /**
   * A file in a popup framed as the Windows ones: view.py for a pasted image, view_file.py for a file of the
   * explorer, as view.ps1 and view_file.ps1 are on Windows. SPEEDY_POPUP names the script, SPEEDY_PYTHON the
   * mod's Python. Where the popup does not come up (pywebview is not installed, or it failed), Quick Look
   * shows the file as before, with a dot each tenth of a second as the popups say them, so the mod can end it.
   */
  popup: ['/bin/sh', '-c', [
    '"$SPEEDY_PYTHON" "$SPEEDY_POPUP" & viewer=$!',
    "trap 'kill $viewer 2>/dev/null' EXIT",
    "trap 'exit 0' HUP INT TERM PIPE",
    'wait $viewer && exit 0',
    'qlmanage -p "$SPEEDY_IMAGE" >/dev/null 2>&1 & viewer=$!',
    'while kill -0 $viewer 2>/dev/null; do echo .; sleep 0.1; done'
  ].join('\n')],
  /** Whether the mod's Python has pywebview, which the popups are drawn with: it exits 0 when it does. */
  hasPopup: (python: string) => [python, '-c', 'import importlib.util, sys; sys.exit(0 if importlib.util.find_spec("webview") else 1)']
}

/** The system, read once: it does not change while the mod runs. */
let osKnown: Os | undefined
/** The system's name as the user knows it. */
export function systemName (os: Os) {
  return os === 'mac' ? 'macOS' : 'Windows'
}

async function osNow ($: EngineInterface) {
  osKnown ??= osOf(await $.env.get('USERPROFILE'))
  return osKnown
}

/** The mod's Python, as this system lays out a virtual environment. */
async function python ($: EngineInterface) {
  return homeFile($, pythonOf(await osNow($)))
}

/** The folder under the system's per-user app data: `%LOCALAPPDATA%` on Windows, `~/Library/Application Support` on macOS. */
async function appDataDir ($: EngineInterface, folder: string) {
  if ((await osNow($)) === 'mac') return homeFile($, `Library/Application Support/${folder}`)
  const local = (await $.env.get('LOCALAPPDATA')) || ''
  return local ? `${local.replace(/\\/g, '/')}/${folder}` : homeFile($, `AppData/Local/${folder}`)
}

/** A path as the system's own tools take it: backslashes on Windows. */
async function nativePath ($: EngineInterface, path: string) {
  return (await osNow($)) === 'windows' ? path.replace(/\//g, '\\') : path
}
/** The wand: Groq's model that cleans the prompt up, and where it is asked. The key is the system's
 * GROQ_API_KEY: it never leaves the request's header. */
const POLISH_MODEL = 'openai/gpt-oss-120b'
const POLISH_SYSTEM = `You clean up a message a developer is about to send to an AI coding assistant. It was dictated to a microphone and transcribed, typed by hand, or both.

Return the same message, improved:
- Fix grammar, spelling, punctuation and syntax.
- Fix words the transcription most likely misheard, using the context: technical terms above all (pitest -> pytest, empoint -> endpoint, log de React -> hook de React, use effect -> useEffect).
- Put spoken thoughts in a clear, logical order; drop fillers, repetitions and false starts.
- Keep every marker like [[1]] exactly as it is, where it belongs in the message: it stands for an attached image or text.
- Keep the person's language, voice and register (rioplatense Spanish stays rioplatense) and keep English technical terms in English.
- Keep every request, detail, name, path, number and piece of code. Add nothing, answer nothing, explain nothing.

Answer with the improved message alone: no quotes, no preamble, no notes.`
/** The social networks a footer button opens: id, name, label, color, the profile's link, and what to type. */
const SOCIALS: ReadonlyArray<readonly [string, string, string, string, string, string?]> = [
  ['github', 'GitHub', 'GH', '#e6edf3', 'https://github.com/{u}'],
  ['linkedin', 'LinkedIn', 'in', '#4dabf7', 'https://www.linkedin.com/in/{u}'],
  ['x', 'X', 'X', '#e6edf3', 'https://x.com/{u}'],
  ['youtube', 'YouTube', 'YT', '#ff4d4d', 'https://www.youtube.com/@{u}'],
  ['instagram', 'Instagram', 'IG', '#f06595', 'https://www.instagram.com/{u}'],
  ['tiktok', 'TikTok', 'TT', '#3bc9db', 'https://www.tiktok.com/@{u}'],
  ['facebook', 'Facebook', 'FB', '#748ffc', 'https://www.facebook.com/{u}'],
  ['twitch', 'Twitch', 'TW', '#9775fa', 'https://www.twitch.tv/{u}'],
  ['threads', 'Threads', 'TH', '#e6edf3', 'https://www.threads.com/@{u}'],
  ['reddit', 'Reddit', 'RD', '#ff8c42', 'https://www.reddit.com/user/{u}'],
  // Gmail has no public profile: the button opens the inbox of that account.
  ['gmail', 'Gmail', 'GM', '#fa5252', 'https://mail.google.com/mail/u/?authuser={u}@gmail.com', 'usuario, sin @gmail.com'],
  // Discord's profile link takes the numeric user ID, not the user name.
  ['discord', 'Discord', 'DC', '#91a7ff', 'https://discord.com/users/{u}', 'ID numérico de usuario']
]
// The columns of the social table: badge, network, user name field; the link takes the rest.
const SOCIAL_PLUS_WIDTH = 4
const SOCIAL_BADGE_WIDTH = 5
const SOCIAL_NAME_WIDTH = 12
const SOCIAL_FIELD_WIDTH = 28
/** The gap between two tables of networks, and the least a link column may be. */
const TABLE_GAP = 3
/** How many of the setup's last lines the tab shows. */
const SETUP_LOG_LINES = 6
const MIN_LINK_WIDTH = 26
/** The settings tabs; more will come. */
/** The settings tabs, each in a color of its own: the one open is filled with it. */
const SETTINGS_TABS: ReadonlyArray<readonly [string, string, string, string]> = [
  ['setup', 'Instalación', '#51cf66', 'Instalar'], ['bar', 'Barra de estado', '#4dabf7', 'Barra'], ['socials', 'Redes sociales', '#f783ac', 'Redes'], ['claude', 'Claude Code', '#ffa94d', 'Claude']
]

/** The setup steps, by the name install.ps1 prints, and what each is for. */
const SETUP_STEPS: ReadonlyArray<readonly [string, string]> = [
  ['uv', 'uv, el administrador de Python'],
  ['python', 'Entorno de Python 3.12'],
  ['packages', 'Voces y dictado (edge-tts, transcribe-cpp)'],
  ['model', 'Modelo de dictado Nemotron (~750 MB, local)'],
  ['mics', 'Micrófonos'],
  ['voices', 'Voces de Edge (internet)'],
  ['font', 'Fuente de iconos (Symbols Nerd Font)'],
  ['fonts', 'Fuentes de texto (JetBrains Mono, Meslo)'],
  ['ffmpeg', 'ffmpeg (videos que el sistema no reproduce)'],
  ['git', 'git (la rama y la actualización)'],
  ['remotes', 'Otras máquinas por ssh (opcional)'],
  ['access', 'Accesibilidad (macOS: pegar imágenes y enviar)'],
  ['groq', 'Clave de Groq (la pluma, opcional)'],
  ['prefs', 'Claude Code: sesión normal al iniciar']
]


/** The tabs, in the person's order: Spanish, English, French, Italian, Portuguese, Russian, Chinese, Arabic, then Hindi, Bengali and Urdu; each with a color of its own. */
const LANGUAGES: ReadonlyArray<readonly [string, string, string, string]> = [
  ['es', 'Español', 'Spanish', '#ff6b6b'], ['en', 'Inglés', 'English', '#4dabf7'],
  ['fr', 'Francés', 'French', '#748ffc'], ['it', 'Italiano', 'Italian', '#f06595'],
  ['pt', 'Portugués', 'Portuguese', '#51cf66'], ['ru', 'Ruso', 'Russian', '#da77f2'],
  ['zh', 'Chino', 'Chinese', '#ffa94d'], ['ar', 'Árabe', 'Arabic', '#20c997'],
  ['hi', 'Hindi', 'Hindi', '#ff922b'], ['bn', 'Bengalí', 'Bengali', '#94d82d'],
  ['ur', 'Urdu', 'Urdu', '#38d9a9']
]
const CODES = new Set(LANGUAGES.map(([code]) => code))
/** A language tab: the longest label (`Portugués ●`) and a space either side. */
const TAB_WIDTH = 14
/** Columns a footer control takes: its two-column glyph and one on either side. */
const CONTROL_WIDTH = 4
/** Columns the play button takes: its one-column glyph and one on either side. */
const PLAY_WIDTH = 3
/** A footer control that does nothing now. */
const DISABLED = '#495057'
/** The microphone: off, loading the model, writing what is said. An emoji takes no color, so the
 * glyph itself tells: red while it records, blue while it loads or writes the last phrases. */
const MIC_COLORS = { off: '#adb5bd', loading: '#748ffc', on: '#ff6b6b' } as const
const MIC_GLYPHS = { off: '🎙️', loading: '🔵', on: '🔴' } as const
const FEMALE = '#f783ac'
const MALE = '#74c0fc'

/**
 * The Claude models the model menu offers, the most capable first: id (what `/model` takes), name,
 * what it is for, and its color. The newest of each line, as Anthropic lists them on 2026-10-31.
 */
const MODELS: ReadonlyArray<readonly [string, string, string, string]> = [
  ['claude-fable-5-2', 'Fable 5.2', 'el más capaz: razonamiento difícil y tareas largas', '#e599f7'],
  ['claude-opus-5-5', 'Opus 5.5', 'el Opus actual y el predeterminado', '#ff922b'],
  ['claude-sonnet-5-5', 'Sonnet 5.5', 'velocidad y capacidad para el día a día', '#4dabf7'],
  ['claude-haiku-5-5', 'Haiku 5.5', 'el más rápido y barato', '#63e6be']
]
const MODEL_COLOR = '#ffa94d'
/**
 * The status line's levels, in percent used, as they start out: the context turns yellow at 60% and red
 * at 80%, where Claude Code compacts (the sources put it between 80% and 95%); a limit turns yellow at 75%
 * and red at 90%, where the warning appears (anecdotal, 80% to 90%). They are edited in ⚙️ → Barra de estado.
 */
const DEFAULT_LEVELS: BarLevels = { contextYellow: 60, contextRed: 80, limitYellow: 75, limitRed: 90 }
const PRIORITY_COLOR = '#74c0fc'
const LEVEL_COLORS: Record<LevelKey, string> = { contextYellow: '#ffd43b', contextRed: '#ff6b6b', limitYellow: '#ffd43b', limitRed: '#ff6b6b' }
/** The level that goes with each, in the other direction: yellow stays under its red, red over its yellow. */
const PAIR: Record<LevelKey, LevelKey> = { contextYellow: 'contextRed', contextRed: 'contextYellow', limitYellow: 'limitRed', limitRed: 'limitYellow' }
/**
 * The status line's parts in their default priority, and how the settings name them: where the width is
 * short, the first ones go in. Each keeps its place on the line whatever its priority.
 */
const BAR_PARTS: ReadonlyArray<readonly [BarPart, string]> = [
  ['core', 'Versión de Claude Code'], ['app', 'Versión de speedy-code'], ['five_hour', 'Límite de 5 horas'],
  ['seven_day', 'Límite semanal'], ['scoped', 'Límite semanal del modelo'], ['context', 'Contexto'], ['time', 'Tiempo de sesión'],
  ['tokens', 'Tokens in, out y caché']
]
const DEFAULT_ORDER: BarPart[] = BAR_PARTS.map(([key]) => key)

/** Where the levels are kept for the status line, which reads this file: under the user's own folder. */
const LEVELS_FILE = '.claude/speedy-code/levels.json'
/** The levels `/effort` takes, as `claude --help` lists them, from the lightest to the deepest. */
const EFFORTS: ReadonlyArray<readonly [string, string]> = [
  ['low', '#69db7c'], ['medium', '#a9e34b'], ['high', '#ffd43b'], ['xhigh', '#ffa94d'], ['max', '#ff6b6b']
]

/** Region names that would not fit their column, said short. */
const SHORT_COUNTRIES: Record<string, string> = {
  AE: 'Emiratos', DO: 'R. Dominicana', GB: 'Reino Unido', GQ: 'Guinea Ecuat.', HK: 'Hong Kong',
  SA: 'Arabia Saudí', US: 'EE. UU.', ZA: 'Sudáfrica'
}

/** Words common enough to tell a language by: an answer is read as it is only in the language narrated in. */
const STOPWORDS: Record<string, readonly string[]> = {
  es: ['el', 'la', 'que', 'de', 'y', 'en', 'los', 'las', 'es', 'por', 'con', 'una', 'para', 'del', 'se'],
  en: ['the', 'and', 'is', 'of', 'to', 'you', 'it', 'that', 'with', 'for', 'this', 'are'],
  pt: ['não', 'você', 'é', 'uma', 'com', 'os', 'do', 'da', 'que', 'para', 'em', 'são'],
  fr: ['le', 'les', 'est', 'et', 'une', 'des', 'vous', 'pas', 'pour', 'dans', 'que', 'sur'],
  it: ['il', 'gli', 'che', 'di', 'non', 'per', 'sono', 'della', 'questo', 'anche', 'come', 'più']
}

// A voice cell: mark (3), name, a space, country, the multilingual star (2). Narrow enough for three
// or four columns in a wide terminal.
const NAME_WIDTH = 10
const COUNTRY_WIDTH = 12
const VOICE_WIDTH = 3 + NAME_WIDTH + 1 + COUNTRY_WIDTH + 2
const COLUMN_GAP = 2

const isEnabled = atom({ plugin: 'speedy-code', key: 'isEnabled' } as const, false)
const picks = atom({ plugin: 'speedy-code', key: 'picks' } as const, DEFAULT_PICKS, { shape: 'picks-1' })
const voices = atom({ plugin: 'speedy-code', key: 'voices' } as const, [] as Voice[], { shape: 'voices-1' })
const tab = atom({ plugin: 'speedy-code', key: 'tab' } as const, DEFAULT_LANG)
const gender = atom({ plugin: 'speedy-code', key: 'gender' } as const, 'Female' as Voice['gender'])
const page = atom({ plugin: 'speedy-code', key: 'page' } as const, 0)
const socialPage = atom({ plugin: 'speedy-code', key: 'socialPage' } as const, 0)
const speech = atom({ plugin: 'speedy-code', key: 'speech' } as const, 'idle' as Speech)
const listening = atom({ plugin: 'speedy-code', key: 'listening' } as const, 'off' as Listening)
const mics = atom({ plugin: 'speedy-code', key: 'mics' } as const, [] as string[])
const heard = atom({ plugin: 'speedy-code', key: 'heard' } as const, [] as Heard[])
const isPolishing = atom({ plugin: 'speedy-code', key: 'isPolishing' } as const, false)
const menu = atom({ plugin: 'speedy-code', key: 'menu' } as const, '' as Menu)
const clips = atom({ plugin: 'speedy-code', key: 'clips' } as const, [] as HistoryClip[])
const sessionRows = atom({ plugin: 'speedy-code', key: 'sessionRows' } as const, [] as SessionRow[])
const isLoadingSessions = atom({ plugin: 'speedy-code', key: 'isLoadingSessions' } as const, false)
const permissionMode = atom({ plugin: 'speedy-code', key: 'permissionMode' } as const, '' as PermissionMode)
/** The images the mod keeps, newest first, as the 👁 menu lists them. */
const pastedImages = atom({ plugin: 'speedy-code', key: 'pastedImages' } as const, [] as PastedImage[])
/** The image numbers the draft names, in order: a chip each above the prompt. */
const draftIds = atom({ plugin: 'speedy-code', key: 'draftIds' } as const, [] as number[])
/** The kept narration playing from the 📎 menu: its path; empty when none. Its row shows ⏸ or ⏵. */
const clipNow = atom({ plugin: 'speedy-code', key: 'clipNow' } as const, '')
/** The author's own profiles, filled in on a fresh install; anyone else writes theirs over them in ⚙️ → Redes sociales. */
export const DEFAULT_SOCIALS: Socials = {
  github: 'corbaz',
  linkedin: 'julio-corbaz',
  x: 'chipy_corbaz',
  youtube: 'juliocorbaz',
  instagram: 'chipy_corbaz',
  tiktok: 'chipy.mdp',
  facebook: 'JulioCesarCorbazArgentina',
  twitch: 'che_argentino',
  threads: 'chipy_corbaz',
  reddit: 'corbazjcc',
  gmail: 'julio.corbaz',
  discord: 'chipy_corbaz'
}
const socials = atom({ plugin: 'speedy-code', key: 'socials' } as const, DEFAULT_SOCIALS)
const settingsTab = atom({ plugin: 'speedy-code', key: 'settingsTab' } as const, 'socials')
const settingsOpened = atom({ plugin: 'speedy-code', key: 'settingsOpened' } as const, 0)
const editing = atom({ plugin: 'speedy-code', key: 'editing' } as const, '')
const setupChecks = atom({ plugin: 'speedy-code', key: 'setupChecks' } as const, {} as Record<string, SetupCheck>)
const setupLog = atom({ plugin: 'speedy-code', key: 'setupLog' } as const, [] as string[])
const isInstalling = atom({ plugin: 'speedy-code', key: 'isInstalling' } as const, false)
const modelNow = atom({ plugin: 'speedy-code', key: 'modelNow' } as const, '')
const statusLine = atom({ plugin: 'speedy-code', key: 'statusLine' } as const, '' as '' | 'on' | 'off')
/** Whether the user's settings turn Claude Code's experimental Code Mode on; empty: not read yet. */
const codeMode = atom({ plugin: 'speedy-code', key: 'codeMode' } as const, '' as '' | 'on' | 'off')
const barLevels = atom({ plugin: 'speedy-code', key: 'barLevels' } as const, DEFAULT_LEVELS, { shape: 'bar-1' })
const barOrder = atom({ plugin: 'speedy-code', key: 'barOrder' } as const, DEFAULT_ORDER, { shape: 'order-1' })
const mic = atom({ plugin: 'speedy-code', key: 'mic' } as const, '')
/** Whether a footer control's name shows above it while the pointer is on it, as set in ⚙ → Barra de estado. */
const hasLabels = atom({ plugin: 'speedy-code', key: 'hasLabels' } as const, true)
/** A control's name above it: dark on yellow, as the explorer marks the row under the pointer. */
const LABEL_TEXT = '#1a1a1a'
const LABEL_FILL = '#ffd43b'
/** The icons the footer is drawn with, as set in ⚙ → Barra de estado. */
const icons = atom({ plugin: 'speedy-code', key: 'icons' } as const, 'emoji' as IconSet)
/** The size, in points, the terminal's font was last set to from ⚙ → Barra de estado; 0 while it never was. */
const fontSize = atom({ plugin: 'speedy-code', key: 'fontSize' } as const, 0)
/** The sizes offered there. */
const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16] as const
/** The fonts terminal_font.py knows, by the name it takes: what each is called, and the start of its files' names. */
const FONT_FAMILIES = [['jetbrains', 'JetBrains Mono', 'JetBrainsMonoNerdFont'], ['meslo', 'Meslo', 'MesloLGSNerdFont']] as const
type FontFamily = typeof FONT_FAMILIES[number][0]
const fontFamily = atom({ plugin: 'speedy-code', key: 'fontFamily' } as const, 'jetbrains' as FontFamily)
/** The size a font is set at when none was picked yet. */
const DEFAULT_FONT_SIZE = 12
const modelPick = atom({ plugin: 'speedy-code', key: 'modelPick' } as const, '')
const effortPick = atom({ plugin: 'speedy-code', key: 'effortPick' } as const, '')
const effort = atom({ plugin: 'speedy-code', key: 'effort' } as const, '')

const regions = (() => {
  try { return new Intl.DisplayNames(['es'], { type: 'region' }) } catch { return undefined }
})()

/** Cuts `text` to `width`, with an ellipsis, and pads it to it. */
const fit = (text: string, width: number) => (text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width))

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * A voice's name and what sets it apart: `en-US-AvaMultilingualNeural` → `Ava`, `✦ multi`;
 * `zh-CN-liaoning-XiaobeiNeural` → `Xiaobei`, `Liaoning`.
 */
function nameOf (id: string) {
  const parts = id.split('-').slice(2)
  let name = (parts.at(-1) ?? '').replace(/Neural$/, '')
  const tags: string[] = []
  if (parts.length > 1) tags.push(capitalize(parts.slice(0, -1).join('-')))
  if (/Multilingual$/.test(name)) { name = name.replace(/Multilingual$/, ''); tags.push('✦ multi') }
  if (/Expressive$/.test(name)) { name = name.replace(/Expressive$/, ''); tags.push('✦ expresiva') }
  return { name, tag: tags.join(' ') }
}

/**
 * One voice per name, country and gender: `AndrewNeural` and `AndrewMultilingualNeural` sound the
 * same, and listing both repeats the name. The one in use stays; else the multilingual one, which
 * also reads text in another language. An expressive voice is a different style and stays apart.
 */
export function distinctVoices (list: readonly Voice[], current: string) {
  const kept = new Map<string, Voice>()
  for (const v of list) {
    const key = `${v.name}|${v.country}|${v.gender}|${v.tag.includes('expresiva')}`
    const was = kept.get(key)
    const isBetter = !was || (was.value !== current &&
      (v.value === current || (v.tag.includes('multi') && !was.tag.includes('multi'))))
    if (isBetter) kept.set(key, v)
  }
  return [...kept.values()]
}

/** `es-AR-TomasNeural` → `Argentina`. */
function countryOf (id: string) {
  const code = id.split('-')[1] ?? ''
  if (SHORT_COUNTRIES[code]) return SHORT_COUNTRIES[code]
  try { return regions?.of(code) ?? code } catch { return code }
}

const language = (code: string) => LANGUAGES.find(([one]) => one === code)
const languageName = (code: string) => language(code)?.[1] ?? code
const languageColor = (code: string) => language(code)?.[3] ?? 'cyan'

/** The text a voice can say: no code blocks, markup, tables, links or URLs. */
export function plain (markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s*\|?[\s:-]*\|[\s|:-]*$/gm, '')
    .replace(/\|/g, ', ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** The language `text` is in, among the ones the stopwords know; empty when it cannot tell. */
export function guessLanguage (text: string) {
  const words = text.toLowerCase().split(/[^\p{L}]+/u)
  let best = ''
  let bestCount = 2
  for (const [code, list] of Object.entries(STOPWORDS)) {
    const known = new Set(list)
    const count = words.filter(word => known.has(word)).length
    if (count > bestCount) { best = code; bestCount = count }
  }
  return best
}

async function homeFile ($: EngineInterface, path: string) {
  const home = (await $.env.get('USERPROFILE')) || (await $.env.get('HOME')) || ''
  return `${home.replace(/\\/g, '/')}/${path}`
}

/** The saved picks, else Elena. */
async function loadPicks ($: EngineInterface): Promise<Picks> {
  const stored = await $.store.get('picks')
  return stored && typeof stored === 'object' ? stored as Picks : DEFAULT_PICKS
}

/** The neural voices edge-tts offers in the tabs' languages, by `python -m edge_tts --list-voices`. */
async function loadVoices ($: EngineInterface) {
  const result = await $.process.run([await python($), '-m', 'edge_tts', '--list-voices']).catch(() => undefined)
  if (!result || result.exitCode !== 0) return
  const found: Voice[] = []
  for (const line of result.stdout.split(/\r?\n/)) {
    const [id, gender] = line.trim().split(/\s+/)
    const lang = id?.split('-')[0] ?? ''
    if (!id || !id.endsWith('Neural') || !CODES.has(lang) || (gender !== 'Female' && gender !== 'Male')) continue
    found.push({ value: id, lang, ...nameOf(id), country: countryOf(id), gender })
  }
  found.sort((a, b) => a.country.localeCompare(b.country, 'es') || a.name.localeCompare(b.name, 'es'))
  if (found.length > 0) await update($, voices, () => found)
}

/** The microphones connected, by `listen.py --list`, as Windows names them. */
async function loadMics ($: EngineInterface) {
  const result = await $.process.run([await python($), `${$.plugin.root}/hooks/listen.py`, '--list'], { env: { PYTHONIOENCODING: 'utf-8' } }).catch(() => undefined)
  if (!result || result.exitCode !== 0) return
  const found = result.stdout.split(/\r?\n/).filter(line => line.startsWith('mic ')).map(line => line.slice(4).trim())
  await update($, mics, () => found)
}

/** `Auriculares con micrófono (2- JBL Tune 520BT)` → `JBL Tune 520BT`: the device, not its kind. */
export function micName (name: string) {
  const inner = /\(([^()]*)\)\s*$/.exec(name)?.[1] ?? name
  return inner.replace(/^\d+-\s*/, '').trim()
}

async function savePicks ($: EngineInterface, next: Picks) {
  await update($, picks, () => next)
  await $.store.set('picks', next)
}

/**
 * Opens a menu: always above the prompt, framed, whatever the terminal's width. A pane beside the
 * chat changed its layout with its width (and needs 110 columns or more when the footer opens it).
 */
async function openMenu ($: EngineInterface, which: Exclude<Menu, ''>) {
  await dropEmptyAccounts($)
  // Its icon clicked again while it is open: it closes, as its ✕ does.
  if ((await read($, menu)) === which) {
    await closeMenu($, which)
    return
  }
  // A field keeps what was typed in it while it lives: new fields, keyed anew, show what is saved.
  // The model menu opens on what is in use: applying without a click changes nothing.
  if (which === 'models') {
    const current = modelOf(await $.session.model().catch(() => ''))?.[0] ?? ''
    await update($, modelPick, () => current)
    await update($, effortPick, () => '')
  }
  if (which === 'settings') {
    await update($, settingsOpened, count => count + 1)
    await update($, editing, () => '')
    void checkSetup($)
    void switchStatusLine($, 'status')
    void switchCodeMode($, 'status')
  }
  // The narrations kept are read when the menu opens, so it lists what is on disk now.
  if (which === 'history') {
    const found = await listClips($)
    await update($, clips, () => withStarted(found))
  }
  // The images too: the copies kept are listed at once, and one pasted a moment ago is copied after
  // the menu is open, by PowerShell on Windows, slow to start: the menu shows it as it comes.
  if (which === 'images') {
    const kept = await ourImages($)
    await update($, pastedImages, () => kept)
    void keepImages($).then(async () => {
      const found = await ourImages($)
      await update($, pastedImages, () => found)
    }).catch(() => {})
  }
  // The conversations kept, read by Python after the menu is open: it says so while they are read.
  if (which === 'sessions') {
    await update($, isLoadingSessions, () => true)
    // The folder is read here, in the click's own hook: the list is read after it has returned.
    const folder = await $.session.cwd().catch(() => '')
    void listSessions($, folder).catch(() => [] as SessionRow[]).then(async found => {
      await update($, sessionRows, () => found)
      await update($, isLoadingSessions, () => false)
    })
  }
  // Opened by 📍 on a folder, the name is the folder's; by the footer's +, none.
  if (which === 'new') {
    newName = newFolder ? (slashed(newFolder).split('/').filter(Boolean).pop() ?? '').replace(/:$/, '') : ''
    newOpened += 1
  }
  await update($, menu, () => which)
}

/** The networks' control in the footer, in the color of their settings tab. */
const SOCIALS_LABEL = ' Redes ▾ '
const SOCIALS_COLOR = '#f783ac'

/** The accounts with a user name that makes a link, in SOCIALS' order. */
function linkedAccounts (users: Socials) {
  return SOCIALS.flatMap(([id, name, label, color]) => accountsOf(users, id)
    .filter(key => socialLink(id, users[key] ?? ''))
    .map(key => ({ key, name, label: accountLabel(label, key), color })))
}

/** The networks' menu: each account, its badge, its network and its user name; a click opens its profile. */
async function socialsMenu ($: EngineInterface, e: Drawn, width = 90) {
  const users = await read($, socials)
  const { Box, Button, Text } = glyphed($.ui.resolve(e))
  const accounts = linkedAccounts(users)
  if (accounts.length === 0) return <Text dimColor>{'  Todavía no hay redes: cargalas en ⚙️ → Redes sociales.'}</Text>
  // As many columns as the width holds, three at most: badge, network and user name.
  const [BADGE, NAME, USER] = [5, 11, 28]
  const cell = BADGE + NAME + USER
  const columns = Math.max(1, Math.min(3, Math.floor((width - 4 + 2) / (cell + 2))))
  const per = Math.ceil(accounts.length / columns)
  return (
    <Box flexDirection="row" columnGap={2}>
      {Array.from({ length: columns }, (_, index) => (
        <Box key={`socials-column:${index}`} flexDirection="column" width={cell} flexShrink={0}>
          {accounts.slice(index * per, (index + 1) * per).map(one => (
            <Button key={`social-open:${one.key}`} plain onPress={() => { void openSocial($, one.key) }}>
              <Text>
                <Text bold color={one.color}>{fit(` ${one.label}`, BADGE) + fit(one.name, NAME)}</Text>
                <Text>{fit(users[one.key] ?? '', USER).trimEnd()}</Text>
              </Text>
            </Button>
          ))}
        </Box>
      ))}
    </Box>
  )
}

/** Opens an account's profile in the browser, and closes the networks' menu. */
async function openSocial ($: EngineInterface, key: string) {
  const link = socialLink(networkOf(key), (await read($, socials))[key] ?? '')
  if (link) await openLink($, link)
  await closeMenu($, 'socials')
}

/**
 * The permission modes shift+tab cycles, in its order: the id, the name, the name short for the footer,
 * the color, and what the mode lets Claude Code do without asking.
 */
export const MODES: ReadonlyArray<readonly [Exclude<PermissionMode, ''>, string, string, string, string]> = [
  ['default', 'Manual', 'Manual', '#e9ecef', 'Pregunta antes de editar un archivo o de correr un comando: vos aprobás cada acción.'],
  ['acceptEdits', 'Aceptar ediciones', 'Ediciones', '#b197fc', 'Edita los archivos sin preguntar; los comandos y lo demás siguen pidiendo permiso.'],
  ['plan', 'Plan', 'Plan', '#38d9a9', 'Solo lee e investiga, y propone un plan: no cambia nada hasta que lo aprobás.'],
  ['bypassPermissions', 'Sin permisos (YOLO)', 'Sin permisos', '#ff6b6b', 'No pregunta nada: edita y ejecuta todo. Solo para carpetas de confianza.'],
  ['auto', 'Auto', 'Auto', '#ffd43b', 'No te pregunta: otro modelo revisa cada acción, deja pasar lo seguro y frena lo riesgoso.']
]
const MODE_COLOR = '#ffa94d'
const modeOf = (id: PermissionMode) => MODES.find(([one]) => one === id)

/** The words the line under the prompt names each mode with. */
const MODE_WORDS: ReadonlyArray<readonly [string, Exclude<PermissionMode, ''>]> = [
  ['bypass permissions on', 'bypassPermissions'], ['auto mode on', 'auto'], ['accept edits on', 'acceptEdits'],
  ['plan mode on', 'plan'], ['manual mode on', 'default']
]

/** The mode the line under the prompt names as its first words, if it names one. */
export function namedMode (hint: string): Exclude<PermissionMode, ''> | undefined {
  return MODE_WORDS.find(([words]) => hint.startsWith(words))?.[1]
}

/**
 * Where shift+tab goes from a mode. The cycle is manual, accept edits, plan, then no permissions and
 * auto where the session has them, and manual again. `isCycling`: the line still offers the cycle,
 * which it does in every mode but manual. `hasBypass`: the session was seen without permissions.
 */
export function nextMode (left: Exclude<PermissionMode, ''>, isCycling: boolean, hasBypass: boolean): Exclude<PermissionMode, ''> {
  if (left === 'default') return 'acceptEdits'
  if (left === 'acceptEdits') return 'plan'
  if (!isCycling || left === 'auto') return 'default'
  return left === 'plan' && hasBypass ? 'bypassPermissions' : 'auto'
}

/**
 * What is known of the permission mode. No call tells a mod the mode in force, so it is put together:
 * the settings say where a session starts, the line under the prompt names the mode it leaves as
 * shift+tab is pressed, and a prompt sent or an answer ended say it outright.
 */
export type ModeKnown = { now: PermissionMode, left?: Exclude<PermissionMode, ''>, start: PermissionMode, hasBypass: boolean }

/** What a line under the prompt adds to what is known of the mode. */
export function modeAfterHint (known: ModeKnown, hint: string): ModeKnown {
  const named = namedMode(hint)
  // The line names the mode only as it is left: the next line tells where it went.
  if (named) return { ...known, left: named, hasBypass: known.hasBypass || named === 'bypassPermissions' }
  const isCycling = hint.includes('shift+tab to cycle')
  if (known.left) return { ...known, left: undefined, now: nextMode(known.left, isCycling, known.hasBypass) }
  // Nothing said, or the shortcuts alone: the mode that asks.
  if (hint === '' || hint.startsWith('? for shortcuts')) return { ...known, now: 'default' }
  // The cycle offered and no mode known: the one the settings start in, when that is not manual.
  if (isCycling && known.now === '') return { ...known, now: known.start === 'default' ? '' : known.start }
  // The cycle offered while manual was taken to be in force: it is not, and which one is, is not known.
  if (isCycling && known.now === 'default') return { ...known, now: '' }
  return known
}

/** What is known of the mode in this session. */
let modeKnown: ModeKnown = { now: '', start: '', hasBypass: false }

/** A mode said outright, by a prompt sent or an answer ended: it stands over what was put together. */
function modeSaid (mode: unknown) {
  const said = MODES.find(([id]) => id === mode)?.[0]
  // A mode with no row here (dontAsk) is in no cycle: not known as one of these.
  modeKnown = { ...modeKnown, left: undefined, now: said ?? '', hasBypass: modeKnown.hasBypass || said === 'bypassPermissions' }
}

/** The mode a session starts in, by the settings as Claude Code merges them. */
async function settingsMode ($: EngineInterface): Promise<PermissionMode> {
  const settings = await $.settings.read().catch(() => undefined) as { permissions?: { defaultMode?: unknown } } | undefined
  const mode = settings?.permissions?.defaultMode
  return MODES.find(([id]) => id === mode)?.[0] ?? (mode === undefined ? 'default' : '')
}

/** How often the mode put together is handed to the footer. */
const MODE_FOLLOW_MS = 300

/** Hands the mode known to the footer and the menu, which draw it from the state. */
async function followMode ($: EngineInterface) {
  if (modeKnown.now !== (await read($, permissionMode))) await update($, permissionMode, () => modeKnown.now)
}

/** The modes' menu: each one with what it lets Claude Code do; a click on one changes to it. */
async function modeMenu ($: EngineInterface, e: Drawn) {
  const { Box, Button, Text } = glyphed($.ui.resolve(e))
  const current = await read($, permissionMode)
  return (
    <Box flexDirection="column">
      {MODES.map(([id, name, , color, what]) => (
        <Box key={`mode:${id}`} flexDirection="column">
          <Button key={`mode-set:${id}`} plain onPress={() => { void setMode($, id) }}>
            <Text>
              <Text bold color={id === current ? '#51cf66' : '#868e96'}>{id === current ? ' ● ' : ' ○ '}</Text>
              <Text bold color={color}>{name}</Text>
              {id === current ? <Text dimColor>{'  (en uso)'}</Text> : null}
            </Text>
          </Button>
          <Text dimColor>{`    ${what}`}</Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>{'  shift+tab también lo cambia. Auto y Sin permisos solo están si la sesión los tiene habilitados.'}</Text>
      </Box>
    </Box>
  )
}

/** Presses shift+tab, as the person would: no mod can set the mode, the key cycles it. */
async function pressCycle ($: EngineInterface) {
  const script = "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('+{TAB}'); 'sent'"
  const argv = (await osNow($)) === 'windows' ? ['powershell', '-NoProfile', '-NonInteractive', '-STA', '-Command', script] : MAC.cycleMode
  const result = await $.process.run(argv).catch(() => undefined)
  return result?.stdout.trim() === 'sent'
}

/** How long a press is waited for to show in the line under the prompt, and how often it is looked at. */
const MODE_WAIT_MS = 2000
const MODE_LOOK_MS = 100

/**
 * Changes to a mode: shift+tab pressed until the line under the prompt names it. A session cycles
 * only the modes it has, so one that comes back to where it began has not got the mode asked.
 */
async function setMode ($: EngineInterface, target: Exclude<PermissionMode, ''>) {
  // The menu closes first: its band holds the keyboard after a click, and the key is for the prompt.
  await closeMenu($, 'mode')
  const start = modeKnown.now
  if (start === target) return
  for (let presses = 0; presses < MODES.length; presses++) {
    const before = modeKnown.now
    if (!(await pressCycle($))) break
    for (let waited = 0; waited < MODE_WAIT_MS && modeKnown.now === before; waited += MODE_LOOK_MS) {
      await new Promise(resolve => setTimeout(resolve, MODE_LOOK_MS))
    }
    const now = modeKnown.now
    if (now === target) return
    if (now === before) break
    if (now === start) {
      $.ui.toast(`speedy-code: esta sesión no tiene el modo ${modeOf(target)?.[1] ?? target}.`)
      return
    }
  }
  $.ui.toast('speedy-code: no pude cambiar el modo; usá shift+tab.')
}

/** The conversations' control and menu: the color of what was said before. */
const SESSIONS_COLOR = '#63e6be'

/** The conversations Claude Code keeps for this session's folder, newest first: sessions.py reads them. */
async function listSessions ($: EngineInterface, folder: string): Promise<SessionRow[]> {
  if (!folder) return []
  const result = await $.process.run([await python($), `${$.plugin.root}/hooks/sessions.py`, folder], { env: { PYTHONIOENCODING: 'utf-8' } }).catch(() => undefined)
  if (result?.exitCode !== 0) return []
  return result.stdout.split(/\r?\n/).flatMap(line => {
    try {
      const row = JSON.parse(line) as Partial<SessionRow>
      return typeof row.id === 'string' && typeof row.title === 'string' && typeof row.updated === 'number' ? [{ id: row.id, title: row.title, updated: row.updated }] : []
    } catch {
      return []
    }
  })
}

/** When a conversation last changed, as the menu writes it: `dd/mm hh:mm`, in this machine's time. */
export function sessionStamp (seconds: number) {
  const at = new Date(seconds * 1000)
  const two = (value: number) => String(value).padStart(2, '0')
  return `${two(at.getDate())}/${two(at.getMonth() + 1)} ${two(at.getHours())}:${two(at.getMinutes())}`
}

/** The conversations' menu: each one's title and when it last changed; a click goes back to it, as /resume. */
async function sessionsMenu ($: EngineInterface, e: Drawn, width = 90) {
  const { Box, Button, Text } = glyphed($.ui.resolve(e))
  const list = await read($, sessionRows)
  if (list.length === 0 && await read($, isLoadingSessions)) return <Text dimColor>{'  Leyendo las conversaciones…'}</Text>
  if (list.length === 0) return <Text dimColor>{'  No hay conversaciones guardadas de esta carpeta (o falta instalar: ⚙️ → Instalación).'}</Text>
  const current = await $.session.id().catch(() => '')
  // The title takes the room left after the mark and the stamp, so every stamp starts in one column.
  const titleWidth = Math.max(10, width - 4 - 3 - 12)
  return (
    <Box flexDirection="column">
      {list.map(row => (
        <Button key={`session-open:${row.id}`} plain onPress={() => { void openSession($, row.id) }}>
          <Text>
            <Text bold color={row.id === current ? '#51cf66' : '#868e96'}>{row.id === current ? ' ● ' : ' ○ '}</Text>
            <Text bold={row.id === current}>{fit(row.title, titleWidth)}</Text>
            <Text color={SESSIONS_COLOR}>{` ${sessionStamp(row.updated)}`}</Text>
          </Text>
        </Button>
      ))}
    </Box>
  )
}

/** Goes back to a conversation, as the person typing /resume with its id; the one open stays. */
async function openSession ($: EngineInterface, id: string) {
  await closeMenu($, 'sessions')
  if (id === await $.session.id().catch(() => '')) return
  await $.command.run({ command: 'resume', args: id }).catch(() => { $.ui.toast(`speedy-code: no pude volver a esa conversación; escribí /resume ${id}`) })
}

/** The name typed for the new conversation, and how many times its menu opened: a field keyed anew starts empty. */
let newName = ''
let newOpened = 0

/**
 * The folder 📍 opened the new conversation's menu for: the session goes there, in a new conversation or
 * in this one. Empty: the footer's +, a new conversation where the session is.
 */
let newFolder = ''

/**
 * The new conversation's menu: its name, typed in a field; Enter or the button starts it. Opened by 📍 it
 * says the folder, and has two more buttons: Seguir esta moves this conversation there, Cancelar does nothing.
 */
async function newMenu ($: EngineInterface, e: Drawn) {
  const elements = glyphed($.ui.resolve(e))
  const { Box, Button, Text } = elements
  const Input = 'Input' in elements ? elements.Input : undefined
  const folder = newFolder ? await nativePath($, newFolder) : ''
  return (
    <Box flexDirection="column">
      {folder ? <Text><Text bold color={NEW_COLOR}>{' Trabajar en: '}</Text><Text>{folder}</Text></Text> : null}
      <Text bold color="#74c0fc">{' Nombre de la conversación '}<Text dimColor>(clic en el campo para escribirlo)</Text></Text>
      {Input
        ? (
          <Input
            key={`new:name:${newOpened}`}
            value={newName}
            placeholder="vacío: sin nombre"
            submitLabel="↵"
            autoFocus
            onInput={value => { newName = value }}
            onSubmit={value => { void startConversation($, value) }}
          />
          )
        : null}
      <Box flexDirection="row" marginTop={1} columnGap={2}>
        <Button key="new:start" plain onPress={() => { void startConversation($, newName) }}>
          <Text bold color="black" backgroundColor={NEW_COLOR}>{folder ? ' Nueva conversación ' : ' Empezar '}</Text>
        </Button>
        {folder
          ? (
            <Button key="new:keep" plain onPress={() => { void keepConversation($) }}>
              <Text bold color="black" backgroundColor="#74c0fc">{' Seguir esta '}</Text>
            </Button>
            )
          : null}
        {folder
          ? (
            <Button key="new:cancel" plain onPress={() => { void cancelNew($) }}>
              <Text bold color="black" backgroundColor="#adb5bd">{' Cancelar '}</Text>
            </Button>
            )
          : null}
      </Box>
    </Box>
  )
}

/** 📍 on a folder of the explorer: the + menu for it, unless the session already works there. */
async function openNewIn ($: EngineInterface, folder: string) {
  const caseless = (await osNow($)) === 'windows'
  const here = await $.session.root().catch(() => '')
  if (here && pathKey(here, caseless) === pathKey(folder, caseless)) {
    $.ui.toast(`speedy-code: la sesión ya trabaja en ${slashed(folder).split('/').filter(Boolean).pop() ?? folder}.`)
    return
  }
  // Open already, for another folder or none: it opens again, for this one.
  await closeMenu($, 'new')
  newFolder = folder
  await openMenu($, 'new')
}

/**
 * As the person typing /cd: the session moves to `folder`, its conversation with it. Whether it is there
 * now: /cd can refuse (a folder gone, a rule), and says why itself.
 */
async function moveTo ($: EngineInterface, folder: string) {
  const target = await nativePath($, folder)
  await $.command.run({ command: 'cd', args: target }).catch(() => undefined)
  const caseless = (await osNow($)) === 'windows'
  const now = await $.session.root().catch(() => '')
  if (now && pathKey(now, caseless) === pathKey(target, caseless)) return true
  $.ui.toast(`speedy-code: no pude pasar a ${target}; escribí /cd ${target}`)
  return false
}

/** Seguir esta: the conversation goes on in the folder 📍 was pressed on. */
async function keepConversation ($: EngineInterface) {
  const folder = newFolder
  newFolder = ''
  await closeMenu($, 'new')
  if (folder) await moveTo($, folder)
}

/** Cancelar: the menu closes, and the session stays where it is. */
async function cancelNew ($: EngineInterface) {
  newFolder = ''
  await closeMenu($, 'new')
}

/** The color of a new conversation: the footer's own `+`. */
const NEW_COLOR = '#51cf66'

/**
 * As the person typing /clear, then /rename with the name given: a new conversation in this terminal, named.
 * Opened by 📍, /cd takes the session to that folder first; where it could not, nothing is cleared.
 */
async function startConversation ($: EngineInterface, name: string) {
  const folder = newFolder
  newFolder = ''
  await closeMenu($, 'new')
  if (folder && !(await moveTo($, folder))) return
  const title = name.trim()
  const cleared = await $.command.run({ command: 'clear' }).then(() => true, () => false)
  if (!cleared) {
    $.ui.toast('speedy-code: no pude empezar otra conversación; escribí /clear.')
    return
  }
  if (title) await $.command.run({ command: 'rename', args: title }).catch(() => { $.ui.toast(`speedy-code: no pude nombrarla; escribí /rename ${title}`) })
}

/** The voice menu's title: `Voz: Natasha (Inglés - Australia)`, the voice narrating now. */
function voiceTitle (chosen: Picks) {
  const active = chosen.active ?? DEFAULT_LANG
  const id = chosen[active] ?? DEFAULT_PICKS[DEFAULT_LANG] ?? ''
  return `Voz: ${nameOf(id).name} (${languageName(active)} - ${countryOf(id)})`
}

/** Closes a menu, wherever it shows. The images menu takes its open picture with it. */
async function closeMenu ($: EngineInterface, which: Exclude<Menu, ''>) {
  await dropEmptyAccounts($)
  if (which === 'images') {
    viewing?.abort()
    viewing = undefined
  }
  if ((await read($, menu)) === which) await update($, menu, () => '')
}

const openPicker = ($: EngineInterface) => openMenu($, 'voices')

/** Whether someone is at the session: `claude -p` is not narrated. */
let isInteractive = true
/** The narration under way: ending it stops Haiku and the voice. */
let current: AbortController | undefined
let lastAnswer = ''
/** The last narration written, so saying it again calls no model: the answer, its language, the text. */
let lastNarration = { answer: '', lang: '', text: '', file: '' }
/** Whether switching the narrator off paused the voice: switching it on goes on. */
let isPausedByOff = false
/** The pause file of the narration under way. */
let controlFile = ''
/** The text selected when 📎 was pressed, read by the menu's first row. Taken then: the menu's own click
 * could clear the selection on screen. */
let pendingSelection = ''
/** The kept narration playing from the history menu, if any. */
let historyPlay: AbortController | undefined

async function stop ($: EngineInterface) {
  isPausedByOff = false
  current?.abort()
  current = undefined
  historyPlay?.abort()
  historyPlay = undefined
  // A narration sounding in the viewer's popup ends with it: its popup closes.
  popupPlay?.abort()
  popupPlay = undefined
  await update($, clipNow, () => '')
  await update($, speech, () => 'idle')
}

/** Writes the narration of `answer` in the language narrated in: as it is, or by Haiku. */
async function narrationOf ($: EngineInterface, answer: string, lang: string, signal: AbortSignal) {
  const text = plain(answer)
  if (!text) return ''
  // A short text is read as it is in the language narrated in, and when its language cannot be told (a
  // phrase of few words): asked to translate that, a model answers about it instead of reading it.
  const guessed = guessLanguage(text)
  if (text.length <= SHORT_ANSWER && (guessed === lang || guessed === '')) return text
  const target = language(lang)?.[2] ?? 'Spanish'
  const prompt = text.length <= SHORT_ANSWER
    ? `Translate this reply into ${target}, faithfully and completely. If it is already in ${target}, answer with it unchanged:\n\n${text}`
    : `Say what this reply tells, in ${target}, in two to four short sentences, in first person, speaking to the reader:\n\n${text}`
  const reply = await $.model.complete({
    model: 'haiku',
    effort: 'low',
    maxTokens: 2000,
    system: 'You turn an assistant reply into text a speech synthesizer reads aloud. Plain sentences only: no markdown, lists, emojis or code; no URLs, file paths or hashes spelled out. Answer with the text alone.',
    prompt
  }, { signal })
  return reply.isAnswered ? reply.text.trim() : ''
}

/** What `clipNow` holds while the 📎 menu's selection is being read: its row shows ⏸ and ⏵ as a kept one does. */
const SELECTION_CLIP = 'selection'

/**
 * Reads `answer` aloud: ends any narration under way first. `source` marks the 📎 row it plays from, if any.
 * `inPopup`, for an answer: where there is the viewer's popup the narration is made first, whole, and then
 * played in the popup, with its bar to seek and its speeds; elsewhere it is spoken as it is made.
 */
async function narrate ($: EngineInterface, answer: string, source = '', inPopup = false) {
  await stop($)
  const controller = new AbortController()
  current = controller
  const hasPopup = inPopup && ((await osNow($)) === 'windows' || await macHasPopup($))
  if (source) await update($, clipNow, () => source)
  const chosen = await read($, picks)
  const lang = chosen.active ?? DEFAULT_LANG
  const voice = chosen[lang] ?? DEFAULT_PICKS[DEFAULT_LANG] ?? ''
  try {
    const isSame = lastNarration.answer === answer && lastNarration.lang === lang
    // Said again where there is the popup: the file it was kept in plays there. A selection's row in the
    // history is the one marked playing, as it is while it sounds anywhere else.
    const shownFrom = (file: string) => (source === SELECTION_CLIP ? file : source)
    if (isSame && hasPopup && await playInViewer($, lastNarration.file, shownFrom(lastNarration.file))) return
    // Said again, nothing is written nor made: it shows as playing at once.
    await update($, speech, () => (isSame ? 'playing' : 'thinking'))
    const text = isSame ? lastNarration.text : await narrationOf($, answer, lang, controller.signal)
    if (text) lastNarration = { answer, lang, text, file: isSame ? lastNarration.file : '' }
    if (!text || controller.signal.aborted) return
    const control = await homeFile($, `${CONTROL_DIR}/control-${crypto.randomUUID()}.txt`)
    controlFile = control
    await $.fs.write(control, 'play')
    // A new narration is kept in the history; saying the same one again is not, it is already there.
    const saveAs = isSame && lastNarration.file ? '' : `${await historyDir($)}/${historyName(text, new Date())}`
    // Where this narration is kept once it has played: the play button opens it from there.
    if (saveAs) lastNarration.file = saveAs
    // A selection read is in the history as it starts: its row there is the one playing, with ⏸ and ⏵, and
    // the selection's own row is free for the next text.
    if (source === SELECTION_CLIP && lastNarration.file) {
      const kept = lastNarration.file
      await update($, clipNow, () => kept)
      if (saveAs) {
        startedClips.add(saveAs)
        await update($, clips, list => withStarted(list))
      }
    }
    // Only made when it goes to the popup, which needs the file it is kept in.
    const isOnlyMade = hasPopup && saveAs !== ''
    let isMade = false
    const pythonFile = await python($)
    const speaker = $.process.spawn({
      argv: (await osNow($)) === 'windows'
        ? ['powershell', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/hooks/speak.ps1`]
        : [pythonFile, `${$.plugin.root}/hooks/speak.py`],
      env: { NARRATOR_TEXT: text, NARRATOR_VOICE: voice, NARRATOR_SPEED: String(SPEED), NARRATOR_CONTROL: control, NARRATOR_PYTHON: pythonFile, NARRATOR_SAVE_AS: await nativePath($, saveAs), ...(isOnlyMade ? { NARRATOR_ONLY_MAKE: '1' } : {}) }
    })
    for await (const { text: said } of speaker) {
      // Leaving the loop ends the process, and its sound with it.
      if (controller.signal.aborted) break
      // `made`: the narration is whole in its file.
      if (isOnlyMade && /^made\s*$/m.test(said)) {
        isMade = true
        break
      }
      if (/^voice /m.test(said) && (await read($, speech)) === 'thinking') await update($, speech, () => 'playing')
      if (/^error /m.test(said)) $.ui.log(`speedy: ${said.trim()}`, { to: 'debug' })
    }
    // Made: it plays in the popup at once. The popup takes this narration's place, as any other would.
    if (isMade && !controller.signal.aborted) await playInViewer($, saveAs, shownFrom(saveAs))
  } catch (error) {
    $.ui.log(`speedy: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
  } finally {
    if (current === controller) {
      current = undefined
      if (source) await update($, clipNow, () => '')
      await update($, speech, () => 'idle')
      void refreshClipsLater($)
    }
  }
}

/** The narrations started and listed before their file is written: a selection read shows in the history at once. */
const startedClips = new Set<string>()

/** The list with the narrations started and not yet on the disk on top, newest first; one found there is no longer waited for. */
function withStarted (list: HistoryClip[]) {
  for (const clip of list) startedClips.delete(clip.path)
  const started = [...startedClips].reverse().map(path => ({ path, name: (path.split('/').pop() ?? path).replace(/\.mp3$/i, '') }))
  return [...started, ...list].slice(0, HISTORY_LENGTH)
}

/** Reads the kept narrations again once the join has written the new one, a moment after the sound ends. */
async function refreshClipsLater ($: EngineInterface) {
  await new Promise(resolve => setTimeout(resolve, 1500))
  if ((await read($, menu)) !== 'history') return
  const found = await listClips($)
  await update($, clips, () => withStarted(found))
}

async function control ($: EngineInterface, asked: 'pause' | 'play') {
  if (controlFile) await $.fs.write(controlFile, asked)
  await update($, speech, () => (asked === 'pause' ? 'paused' : 'playing'))
}

async function setEnabled ($: EngineInterface, value: boolean) {
  await update($, isEnabled, () => value)
  await $.store.set('isEnabled', value)
  const now = await read($, speech)
  if (!value) {
    // Off while it speaks: a pause, the audio kept, so switching on goes on from there.
    if (now === 'playing') { await control($, 'pause'); isPausedByOff = true } else if (now === 'thinking') await stop($)
  } else if (isPausedByOff && now === 'paused') {
    await control($, 'play')
  }
  if (value) isPausedByOff = false
  return value
}

/** The clipboard's text while it is still being read for the 📎 menu: its first row waits for it. */
let pendingRead: Promise<void> | undefined
/** The selection as 📎 took it, and what was last looked at and read: the newer of the two texts is read. */
let takenSelection = ''
let lastRead: { selection: string, clipboard: string, source: '' | 'selection' | 'clipboard' } = { selection: '', clipboard: '', source: '' }

/**
 * Which of the two 📎 reads: the selection or the clipboard's text, the one that changed since they were last
 * looked at; a new selection first. A text sent to the clipboard by any means is so read even while an
 * older selection is still there. With nothing changed, what was read last.
 */
export function readSource (selection: string, clipboard: string, last: { selection: string, clipboard: string, source: '' | 'selection' | 'clipboard' }) {
  if (selection && selection !== last.selection) return 'selection'
  if (clipboard && clipboard !== last.clipboard) return 'clipboard'
  if (last.source === 'selection' && selection) return 'selection'
  if (last.source === 'clipboard' && clipboard) return 'clipboard'
  return selection ? 'selection' : 'clipboard'
}

/** Sets what 📎 reads from the selection taken and the clipboard as it is now. */
async function choosePending ($: EngineInterface) {
  const clipboard = freshClipboard(await clipboardText($))
  const source = readSource(takenSelection, clipboard, lastRead)
  lastRead = { selection: takenSelection, clipboard, source }
  pendingSelection = source === 'selection' ? takenSelection : clipboard
}

/**
 * What 📎 reads: the text selected with the mouse, taken at once, before the menu opens and the
 * selection goes, or the clipboard's, read after, as PowerShell is slow to start on Windows.
 */
async function takeSelection ($: EngineInterface) {
  const selection = await $.ui.selection().catch(() => undefined)
  const selected = selection?.text.trim() ?? ''
  // The selection the history was cleared with is passed over, as the clipboard's text is, until another is made.
  if (clearedSelection !== undefined && selected !== clearedSelection) clearedSelection = undefined
  takenSelection = clearedSelection === undefined ? selected : ''
  pendingSelection = takenSelection
  pendingRead = choosePending($)
}

/** The clipboard's text as it was when the history was cleared: passed over until the clipboard holds another. */
let clearedClipboard: string | undefined
/** The selection there when the history was cleared, passed over the same way. */
let clearedSelection: string | undefined

/** The clipboard's text for 📎 to read: none while it is still the one the history was cleared with. */
function freshClipboard (text: string) {
  if (clearedClipboard !== undefined && text === clearedClipboard) return ''
  clearedClipboard = undefined
  return text
}

/** The clipboard's text, as Windows holds it: the clip reads it, the paste button puts it in the prompt. */
/** The clipboard's text, written in UTF-8 whatever the console's code page. */
export const CLIPBOARD_READ = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Clipboard -Raw'

async function clipboardText ($: EngineInterface) {
  // PowerShell writes to a pipe in the console's code page, where á and ñ come out as `?`: UTF-8 keeps them.
  const argv = (await osNow($)) === 'windows' ? ['powershell', '-NoProfile', '-NonInteractive', '-Command', CLIPBOARD_READ] : MAC.clipboardRead
  const clipboard = await $.process.run(argv).catch(() => undefined)
  return clipboard?.exitCode === 0 ? clipboard.stdout.replace(/\r\n/g, '\n').replace(/\n+$/, '') : ''
}

/**
 * A narration's file name: the start of its text, safe in a file name, then when it was written, as
 * `<description>-yy-mm-dd_hh-mm-ss.mp3`.
 */
export function historyName (text: string, now: Date) {
  const start = Array.from(text.replace(/\p{Cc}/gu, ' ').replace(/[<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').trim())
    .slice(0, HISTORY_NAME_LENGTH).join('').trim()
  const description = start.replace(/ /g, '-') || 'audio'
  return `${description}-${stampOf(now)}.mp3`
}

/** When something was kept, local time, as the mod's file names carry it: `yy-mm-dd_hh-mm-ss`. */
export function stampOf (now: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [pad(now.getFullYear() % 100), pad(now.getMonth() + 1), pad(now.getDate())].join('-') +
    '_' + [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('-')
}

/** A kept narration's name split in its description and its stamp, for the menu's aligned columns. A name
 * without a stamp keeps all of it as the description. */
export function historySplit (name: string) {
  const match = /-(\d{2}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})(?:-\d+)?(?:\.mp3)?$/i.exec(name)
  return match ? { description: name.slice(0, match.index), stamp: match[1] ?? '' } : { description: name, stamp: '' }
}

/** The folder the narrations are kept in: `speedy-code/audio` under the app data. */
async function historyDir ($: EngineInterface) {
  return appDataDir($, HISTORY_DIR)
}

/**
 * The newest narrations kept, newest first, as the folder holds them now: by the moment each one's
 * name carries. Read with no program started, so the 📎 menu opens at once: PowerShell takes seconds
 * to start on a busy machine, and the menu waited for it.
 */
async function listClips ($: EngineInterface): Promise<HistoryClip[]> {
  const dir = await historyDir($)
  return (await $.fs.list(dir).catch(() => []))
    .filter(entry => entry.kind === 'file' && /\.mp3$/i.test(entry.name))
    .map(entry => ({ path: `${dir}/${entry.name}`, name: entry.name.replace(/\.mp3$/i, '') }))
    .sort((a, b) => historySplit(b.name).stamp.localeCompare(historySplit(a.name).stamp) || b.name.localeCompare(a.name))
    .slice(0, HISTORY_LENGTH)
}

/** Deletes every narration kept, from the disk, and empties the menu's list. */
async function clearClips ($: EngineInterface) {
  await $.process.run(
    (await osNow($)) === 'windows'
      ? ['powershell', '-NoProfile', '-NonInteractive', '-Command', 'Get-ChildItem -LiteralPath $env:SPEEDY_HISTORY -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in ".mp3", ".txt" } | Remove-Item -Force -ErrorAction SilentlyContinue']
      : MAC.clearClips,
    { env: { SPEEDY_HISTORY: await historyDir($) } }
  ).catch(() => undefined)
  await update($, clips, () => [])
  // The selection's row is blanked with them: its text goes, and its narration ends if it is the one sounding.
  // The answer kept for the play button has no file any more.
  await pendingRead?.catch(() => {})
  pendingSelection = ''
  pendingRead = undefined
  startedClips.clear()
  clearedSelection = takenSelection || undefined
  takenSelection = ''
  // What the clipboard holds now was there before the clearing: it is not read again, only a text copied after.
  clearedClipboard = await clipboardText($)
  lastNarration.file = ''
  if (await read($, clipNow)) await stop($)
  $.ui.toast('speedy-code: historial borrado.')
}

/**
 * Plays one narration kept, ending the narration under way. It is driven as the footer's play button
 * drives a narration: the same speech state, and its control file, so ⏸ pauses it and ⏵ goes on.
 */
async function playClip ($: EngineInterface, clip: HistoryClip) {
  await stop($)
  const controller = new AbortController()
  historyPlay = controller
  const control = await homeFile($, `${CONTROL_DIR}/clip-${crypto.randomUUID()}.txt`)
  controlFile = control
  await $.fs.write(control, 'play')
  await update($, speech, () => 'playing')
  await update($, clipNow, () => clip.path)
  const player = $.process.spawn({
    argv: (await osNow($)) === 'windows'
      ? ['powershell', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/hooks/play.ps1`]
      : [await python($), `${$.plugin.root}/hooks/play.py`],
    env: { SPEEDY_CLIP: await nativePath($, clip.path), SPEEDY_CONTROL: await nativePath($, control) }
  })
  try {
    // Leaving the loop ends the process, and its sound with it.
    for await (const _line of player) {
      if (controller.signal.aborted) break
    }
  } catch (error) {
    $.ui.log(`speedy: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
  } finally {
    // Ended by its own end, not by a stop or another narration: the footer goes back to idle.
    if (historyPlay === controller) {
      historyPlay = undefined
      await update($, clipNow, () => '')
      await update($, speech, () => 'idle')
    }
  }
}

/** Whether macOS has the popups (pywebview in the mod's Python): asked once. */
let macPopupKnown: boolean | undefined
async function macHasPopup ($: EngineInterface) {
  macPopupKnown ??= await $.process.run(MAC.hasPopup(await python($))).then(result => result.exitCode === 0, () => false)
  return macPopupKnown
}

/**
 * A narration kept, played in the viewer's popup, where its bar seeks back and forth: where there is the
 * popup (Windows; macOS with pywebview), and only while the file is there. It says whether it opened;
 * elsewhere the player plays it.
 */
async function playInViewer ($: EngineInterface, path: string, source = '') {
  if (!path) return false
  if ((await osNow($)) !== 'windows' && !(await macHasPopup($))) return false
  if (!(await $.fs.stat(path).then(found => found.kind === 'file', () => false))) return false
  await stop($)
  // It is driven as a narration is: the same speech state and a control file, so the footer's ⏸ and the
  // row's pause it and go on, and their marks follow what the popup's own button does.
  const control = await homeFile($, `${CONTROL_DIR}/popup-${crypto.randomUUID()}.txt`)
  controlFile = control
  await $.fs.write(control, 'play')
  await update($, speech, () => 'playing')
  await update($, clipNow, () => source)
  void runViewer($, 'view_file.ps1', path, control)
  return true
}

/** The first row of the 📎 menu: reads the selection taken when 📎 was pressed, else says there is none. */
async function readPending ($: EngineInterface) {
  await pendingRead?.catch(() => {})
  // The clipboard as it is now, not as it was when the menu opened: a text copied since is the one read.
  await choosePending($)
  if (!pendingSelection) {
    $.ui.toast('speedy-code: seleccioná o copiá un texto primero.')
    return
  }
  lastAnswer = pendingSelection
  // Made first, whole, then played in the viewer's popup with its bar and speeds, as an answer is.
  void narrate($, pendingSelection, SELECTION_CLIP, true)
}

/**
 * A row's button, as the footer's: the narration playing from this row pauses or goes on; another row,
 * or none, starts this one.
 */
async function clipPress ($: EngineInterface, clip: HistoryClip) {
  const playing = await read($, clipNow)
  const now = await read($, speech)
  if (playing === clip.path && now === 'playing') return control($, 'pause')
  if (playing === clip.path && now === 'paused') return control($, 'play')
  if (await playInViewer($, clip.path, clip.path)) return
  return playClip($, clip)
}

/** The 📎 menu: the selection, the narrations kept newest first, each with its play button, and clear. */
async function historyMenu ($: EngineInterface, e: Drawn, width = 90) {
  const elements = glyphed($.ui.resolve(e))
  const { Box, Client, Text } = elements
  const list = await read($, clips)
  const playing = await read($, clipNow)
  const now = await read($, speech)
  // The description takes the room left after the ▶ and the stamp, so every stamp starts in one column.
  const descriptionWidth = Math.max(10, width - 12 - 18)
  // Clients, not Buttons: no fill under the pointer, as the footer's controls. A click posts to the
  // footer's handler by key (speedy:clip-read, speedy:clip-play:<n>, speedy:clip-clear).
  const action = (key: string, label: string, color: string) => (
    <Client key={key} module="./control.tsx" width={cells(label)} props={{ label, color, bold: true }} />
  )
  return (
    <Box flexDirection="column">
      {/* The selection plays as the narrations below do: its ▶ in the same column, ⧗ while Haiku writes it, then ⏸ and ⏵. */}
      <Box flexDirection="row">
        {playing === SELECTION_CLIP
          ? action('speedy:clip-read', ` ${({ idle: '▶', thinking: '⧗', playing: '⏸︎', paused: '⏵' } as const)[now]} `, now === 'playing' ? '#ffd43b' : '#63e6be')
          : action('speedy:clip-read', ' ▶ ', '#63e6be')}
        <Text bold color="#ffd43b">{' leer selección'}</Text>
      </Box>
      {list.length === 0
        ? <Text dimColor>{'  Todavía no hay audios. Se guardan cada vez que se lee una respuesta o una selección.'}</Text>
        : list.map((clip, index) => {
          // The row playing shows what the footer shows: ⏸ while it plays, ⏵ paused, ▶ otherwise.
          const isHere = playing === clip.path
          const glyph = isHere && now === 'playing' ? '⏸︎' : isHere && now === 'paused' ? '⏵' : '▶'
          const color = isHere && now === 'playing' ? '#ffd43b' : '#63e6be'
          return (
          <Box key={`clip:${clip.path}`} flexDirection="row">
            {action(`speedy:clip-play:${index}`, ` ${glyph} `, color)}
            <Text>{` ${fit(historySplit(clip.name).description, descriptionWidth)} ${historySplit(clip.name).stamp}`}</Text>
          </Box>
          )
        })}
      <Box marginTop={1} flexDirection="row">{action('speedy:clip-clear', ' 🗑️ limpiar historial ', '#ff6b6b')}</Box>
    </Box>
  )
}

/**
 * The images pasted in this session, newest first. Claude Code stores each as `images/<N>.<ext>` in
 * `<CLAUDE_CODE_TMPDIR or %TEMP%>/claude/<folder>/<session id>`, and the folder follows the project: a
 * session that changes folder keeps its images in several. Every one is looked in, each time, so none
 * is missed; none is remembered, so a folder made later is found too.
 */
async function sessionImages ($: EngineInterface, limit = IMAGES_LENGTH): Promise<PastedImage[]> {
  // TEMP on Windows, TMPDIR on macOS.
  const temp = (await $.env.get('CLAUDE_CODE_TMPDIR')) || (await $.env.get('TEMP')) || (await $.env.get('TMP')) || (await $.env.get('TMPDIR')) || ''
  if (!temp) return []
  const root = `${temp.replace(/\\/g, '/').replace(/\/+$/, '')}/claude`
  // No session id: no folder to look in, and the menu still opens, empty.
  const id = await $.session.id().catch(() => '')
  if (!id) return []
  const found = new Map<number, string>()
  for (const entry of await $.fs.list(root).catch(() => [])) {
    if (entry.kind !== 'dir') continue
    const folder = `${root}/${entry.name}/${id}/images`
    for (const file of await $.fs.list(folder).catch(() => [])) {
      const number = /^(\d+)\.[a-z]+$/i.exec(file.name)?.[1]
      if (number) found.set(Number(number), `${folder}/${file.name}`)
    }
  }
  return [...found].sort((a, b) => b[0] - a[0]).slice(0, limit).map(([number, path]) => ({ id: number, path }))
}

/** The image numbers the draft names, `[Image #N]`, in the order they first appear in it. */
export function draftImages (draft: string) {
  return new Set([...draft.matchAll(/\[Image #(\d+)\]/g)].map(match => Number(match[1])))
}

/** The runs that paint each `[Image #N]` of the draft, in UTF-16 offsets, as `$.prompt.paint` takes them. */
export function imageRuns (draft: string) {
  return [...draft.matchAll(/\[Image #\d+\]/g)].map(match => {
    const start = match.index ?? 0
    return { start, end: start + match[0].length, color: IMAGE_COLOR, bold: true }
  })
}

/** A copy's name, `<stamp>_<session, 8>-<N>.<ext>`, read back: its number, its session and its stamp. */
export function keptImage (name: string) {
  const match = /^(\d{2}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})_([0-9a-z]{8})-(\d+)\.[a-z]+$/i.exec(name)
  return match ? { stamp: match[1] ?? '', session: match[2] ?? '', id: Number(match[3]) } : undefined
}

/** The folder the mod keeps its copies of the pasted images in: `speedy-code/images` under the app data. */
async function imagesDir ($: EngineInterface) {
  return appDataDir($, IMAGES_DIR)
}

/** The mod's copies, newest first: what the 👁 menu lists. */
async function ourImages ($: EngineInterface): Promise<PastedImage[]> {
  const dir = await imagesDir($)
  return (await $.fs.list(dir).catch(() => []))
    .flatMap(entry => {
      const kept = keptImage(entry.name)
      return kept ? [{ id: kept.id, path: `${dir}/${entry.name}`, stamp: kept.stamp, session: kept.session }] : []
    })
    .sort((a, b) => b.stamp.localeCompare(a.stamp) || b.id - a.id)
    .slice(0, IMAGES_LENGTH)
}

/** The session images already copied in this run, by `<session>-<N>`: none is copied twice. */
const copied = new Set<string>()

/**
 * Copies the session's newest pasted images Claude Code holds into the mod's own folder, once each, and
 * keeps the newest IMAGES_LENGTH there. Those at or under the number the history was last cleared at,
 * in this session, are not copied again: clearing would undo itself. One with the same bytes as a copy
 * already kept is not copied either: pasting a kept image again does not list it twice.
 */
async function keepImages ($: EngineInterface) {
  const session = (await $.session.id().catch(() => '')).replace(/-/g, '').slice(0, 8)
  if (!session) return
  const cleared = ((await $.store.get('imagesCleared')) ?? {}) as Record<string, number>
  const dir = await imagesDir($)
  const ours = new Set((await $.fs.list(dir).catch(() => [])).flatMap(entry => {
    const kept = keptImage(entry.name)
    return kept ? [`${kept.session}-${kept.id}`] : []
  }))
  const fresh = (await sessionImages($)).filter(image => {
    const key = `${session}-${image.id}`
    return image.id > (cleared[session] ?? 0) && !ours.has(key) && !copied.has(key)
  })
  if (fresh.length === 0) return
  const stamp = stampOf(new Date())
  for (const image of fresh) copied.add(`${session}-${image.id}`)
  const isWindows = (await osNow($)) === 'windows'
  const copies = isWindows
    ? fresh.map(image => `${image.path.replace(/\//g, '\\')}|${dir.replace(/\//g, '\\')}\\${stamp}_${session}-${image.id}.${image.path.split('.').pop() ?? 'png'}`)
    : fresh.map(image => `${image.path}|${dir}/${stamp}_${session}-${image.id}.${image.path.split('.').pop() ?? 'png'}`)
  await $.process.run(
    !isWindows ? MAC.keepImages : ['powershell', '-NoProfile', '-NonInteractive', '-Command', [
      'New-Item -ItemType Directory -Force -Path $env:SPEEDY_DIR | Out-Null',
      // An image already kept, pasted again (from the menu's 🖼️), has the same bytes: it is not kept twice.
      // SHA-256 by .NET itself: Get-FileHash is missing from some PowerShell 5.1 setups.
      '$sha = [Security.Cryptography.SHA256]::Create(); function Hash($path) { try { [BitConverter]::ToString($sha.ComputeHash([IO.File]::ReadAllBytes($path))) } catch { "" } }',
      '$known = @{}; Get-ChildItem -LiteralPath $env:SPEEDY_DIR -File | ForEach-Object { $known[(Hash $_.FullName)] = $true }',
      '$env:SPEEDY_COPIES -split "`n" | Where-Object { $_ } | ForEach-Object { $pair = $_ -split "\\|", 2; $hash = Hash $pair[0]; if ($hash -and -not $known.ContainsKey($hash)) { Copy-Item -LiteralPath $pair[0] -Destination $pair[1] -Force -ErrorAction SilentlyContinue; $known[$hash] = $true } }',
      'Get-ChildItem -LiteralPath $env:SPEEDY_DIR -File | Sort-Object Name -Descending | Select-Object -Skip ([int]$env:SPEEDY_KEEP) | Remove-Item -Force -ErrorAction SilentlyContinue'
    ].join('; ')],
    { env: { SPEEDY_DIR: await nativePath($, dir), SPEEDY_COPIES: copies.join('\n'), SPEEDY_KEEP: String(IMAGES_LENGTH) } }
  ).catch(() => undefined)
}

/**
 * Deletes the mod's copies, every one, and notes the highest number of this session cleared: those are not
 * copied again. Claude Code's own files are never touched: it may still need them.
 */
async function clearImages ($: EngineInterface) {
  viewing?.abort()
  viewing = undefined
  const session = (await $.session.id().catch(() => '')).replace(/-/g, '').slice(0, 8)
  const highest = Math.max(0, ...(await sessionImages($, Infinity)).map(image => image.id))
  if (session) await $.store.set('imagesCleared', { ...((await $.store.get('imagesCleared')) ?? {}) as Record<string, number>, [session]: highest })
  const gone = (await ourImages($)).length
  await $.process.run(
    (await osNow($)) === 'windows'
      ? ['powershell', '-NoProfile', '-NonInteractive', '-Command', 'Get-ChildItem -LiteralPath $env:SPEEDY_DIR -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue']
      : MAC.clearImages,
    { env: { SPEEDY_DIR: await nativePath($, await imagesDir($)) } }
  ).catch(() => undefined)
  await update($, pastedImages, () => [])
  $.ui.toast(`speedy-code: borré ${gone} imágenes del historial.`)
}

/** While the images menu is open, keeps and lists the images again: one pasted meanwhile shows. */
async function followImages ($: EngineInterface) {
  if ((await read($, menu)) !== 'images') return
  await keepImages($)
  const found = await ourImages($)
  const shown = await read($, pastedImages)
  // Only a change draws the menu again.
  if (found.map(image => image.path).join('|') !== shown.map(image => image.path).join('|')) await update($, pastedImages, () => found)
}

/** The draft as last painted: painting again only on a change. */
let paintedDraft: string | undefined
/** Whether a paint is on the draft: a draft with no image clears it once. */
let isPainted = false

/**
 * Keeps the draft's `[Image #N]` painted and its chips above the prompt in step. A paste puts the
 * placeholder in the box with no edit event, so the box is looked at on a clock.
 */
async function followDraft ($: EngineInterface) {
  const box = await $.prompt.read().catch(() => undefined)
  if (!box || box.text === paintedDraft) return
  paintedDraft = box.text
  // In the order the draft names them, as they were put in: the chips follow the prompt.
  const ids = [...draftImages(box.text)]
  if (ids.join(',') !== (await read($, draftIds)).join(',')) {
    await update($, draftIds, () => ids)
    if (ids.length > 0) void keepImages($)
  }
  const runs = imageRuns(box.text)
  if (runs.length === 0 && !isPainted) return
  const painted = await $.prompt.paint(runs.length > 0 ? { text: box.text, decorations: runs } : { decorations: [] }).catch(() => undefined)
  isPainted = runs.length > 0
  // Not painted (the box changed meanwhile): the next look tries again.
  if (runs.length > 0 && !painted?.isPainted) paintedDraft = undefined
}

/**
 * Puts a kept image in the prompt again. One of this session Claude already has: its `[Image #N]` is
 * written at the caret, so no new number is taken and the clipboard is left alone. One of another session
 * is pasted: it goes on the clipboard, then Windows presses Alt+V, as the 🖼️ button pastes (no mod can
 * attach an image to the draft), and Claude Code gives it a new number.
 */
async function repasteImage ($: EngineInterface, image: PastedImage) {
  const session = (await $.session.id().catch(() => '')).replace(/-/g, '').slice(0, 8)
  // The session is read from the copy's own name: a list kept from before a reload may lack the field.
  const owner = keptImage(image.path.split('/').pop() ?? '')?.session ?? image.session
  if (session && owner === session) {
    const draft = (await $.prompt.read().catch(() => ({ text: '' }))).text
    const before = draft === '' || /\s$/.test(draft) ? '' : ' '
    await $.prompt.fill({ text: `${before}[Image #${image.id}] `, mode: 'insert' })
    return
  }
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms, System.Drawing',
    '$picture = [System.Drawing.Image]::FromFile($env:SPEEDY_IMAGE)',
    '[System.Windows.Forms.Clipboard]::SetImage($picture)',
    '$picture.Dispose()',
    "[System.Windows.Forms.SendKeys]::SendWait('%v'); 'pasted'"
  ].join('; ')
  const result = await $.process.run(
    (await osNow($)) === 'windows' ? ['powershell', '-NoProfile', '-NonInteractive', '-STA', '-Command', script] : MAC.repasteImage,
    { env: { SPEEDY_IMAGE: await nativePath($, image.path) } }
  ).catch(() => undefined)
  if (result?.stdout.trim() !== 'pasted') $.ui.toast('speedy-code: no pude pegar la imagen.')
}

/** The image `[Image #N]` names in this session: Claude Code's file, else the mod's copy of it. */
async function draftImage ($: EngineInterface, id: number) {
  const held = (await sessionImages($, Infinity)).find(image => image.id === id)
  if (held) return held
  const session = (await $.session.id().catch(() => '')).replace(/-/g, '').slice(0, 8)
  const dir = await imagesDir($)
  const name = (await $.fs.list(dir).catch(() => [])).find(entry => {
    const kept = keptImage(entry.name)
    return kept?.session === session && kept.id === id
  })?.name
  return name ? { id, path: `${dir}/${name}` } : undefined
}

/** The image popup open, if any: opening another closes it. */
let viewing: AbortController | undefined

/** Windows PowerShell 5.1, which every Windows has under its system folder. */
async function windowsPowerShell ($: EngineInterface) {
  const root = (await $.env.get('SystemRoot')) || 'C:\\Windows'
  return `${root}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
}

/** UTF-8 text from Base64, as the viewer writes what Copiar took; empty for what is not Base64. */
export function fromBase64Utf8 (base64: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const clean = base64.replace(/=+$/, '')
  if (!/^[A-Za-z0-9+/]*$/.test(clean)) return ''
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const char of clean) {
    buffer = (buffer << 6) | alphabet.indexOf(char)
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
}

/**
 * Puts text into the prompt where the cursor is, as typed there: `separator` first when the text before
 * the cursor does not already end apart (a space, or a new line for text brought from a popup).
 */
async function insertInPrompt ($: EngineInterface, text: string, separator: ' ' | '\n') {
  const box = await $.prompt.read().catch(() => ({ text: '', cursor: 0 }))
  const before = box.text.slice(0, box.cursor ?? box.text.length)
  const lead = before === '' || /\s$/.test(before) ? '' : separator
  await $.prompt.fill({ text: `${lead}${text}${separator === ' ' ? ' ' : ''}`, mode: 'insert' }).catch(() => undefined)
}

/** What a popup's Copiar puts into the prompt: a line break, the text without its own trailing ones, a line break. */
export function popupPaste (text: string) {
  return `\n${text.replace(/\n+$/, '')}\n`
}

/** A file as Claude Code mentions it in a prompt: `@path`, quoted when it holds a space. */
export function fileMention (path: string) {
  return /\s/.test(path) ? `@"${path}"` : `@${path}`
}

/** Shows a pasted image in a popup in the middle of the screen, in its own proportions; another closes it. */
const openView = ($: EngineInterface, image: PastedImage) => runViewer($, 'view.ps1', image.path)

/**
 * Runs a popup in the middle of the screen: `script` on Windows, Quick Look on macOS, for the file at `path`.
 * One popup at a time: another closes it.
 */
/** The popup a narration kept sounds in, while it does: `stop` closes it. */
let popupPlay: AbortController | undefined

/**
 * Shows a file in the viewer's popup. With `control`, it is a narration sounding there: the popup obeys
 * that file's `pause` and `play`, and the speech state follows what the popup says of its sound.
 */
async function runViewer ($: EngineInterface, script: 'view.ps1' | 'view_file.ps1', path: string, control = '', onShown?: () => void) {
  // Windows PowerShell by its path: `powershell` on the PATH can be a shim to PowerShell 7, whose popup
  // never shows, and only Windows PowerShell reads a PDF through Windows' own reader.
  viewing?.abort()
  const controller = new AbortController()
  viewing = controller
  if (control) popupPlay = controller
  try {
    const isWindows = (await osNow($)) === 'windows'
    // On macOS view.py and view_file.py draw the popups view.ps1 and view_file.ps1 draw on Windows.
    const macPopup = isWindows ? '' : `${$.plugin.root}/hooks/${script === 'view.ps1' ? 'view.py' : 'view_file.py'}`
    // The narrator's voice, for a narration's Resumen read aloud there (Escuchar), at the speed narrations take.
    const chosen = await read($, picks)
    const voice = chosen[chosen.active ?? DEFAULT_LANG] ?? DEFAULT_PICKS[DEFAULT_LANG] ?? ''
    const viewer = $.process.spawn({
      argv: isWindows
        ? [await windowsPowerShell($), '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/hooks/${script}`]
        : MAC.popup,
      // view.ps1 and Quick Look read SPEEDY_IMAGE, view_file.ps1 SPEEDY_FILE.
      // view_file.ps1 reads a PDF's text with this mod's Python, SPEEDY_PYTHON.
      env: { SPEEDY_IMAGE: await nativePath($, path), SPEEDY_FILE: await nativePath($, path), SPEEDY_PYTHON: await nativePath($, await python($)), SPEEDY_VOICE: voice, SPEEDY_SPEED: String(SPEED), ...(control ? { SPEEDY_CONTROL: await nativePath($, control) } : {}), ...(macPopup ? { SPEEDY_POPUP: macPopup } : {}) }
    })
    // It says "." ten times a second: leaving the loop ends it, and its window with it. Copiar in the
    // file viewer says `copied <base64>` too: the text goes into the prompt, on a line of its own.
    let pending = ''
    for await (const { stream, text } of viewer) {
      if (controller.signal.aborted) break
      if (stream !== 'stdout') continue
      pending += text
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() ?? ''
      for (const line of lines) {
        // `shown`: the popup is up.
        if (line.trim() === 'shown') onShown?.()
        // `media playing`, `media paused`, `media ended`: the popup's own button, or its sound's end. The
        // control file is set to match, so the next pause or play asked from here is a change the popup sees.
        if (control && popupPlay === controller && line.startsWith('media ')) {
          const said = line.slice('media '.length).trim()
          if (said === 'playing' || said === 'paused') {
            await $.fs.write(control, said === 'playing' ? 'play' : 'pause').catch(() => undefined)
            await update($, speech, () => said)
          } else if (said === 'ended') {
            await $.fs.write(control, 'pause').catch(() => undefined)
            await update($, speech, () => 'paused')
          }
          continue
        }
        // `attach <base64 path>`: a picture Copiar took (an SVG drawn, an image), attached to the prompt.
        if (line.startsWith('attach ')) {
          const file = fromBase64Utf8(line.slice('attach '.length).trim())
          if (file) await insertInPrompt($, fileMention(file), ' ')
          continue
        }
        if (!line.startsWith('copied ')) continue
        const copied = fromBase64Utf8(line.slice('copied '.length).trim())
        // Between two line breaks, always: what came from a popup stands apart in the prompt.
        if (copied) await $.prompt.fill({ text: popupPaste(copied), mode: 'insert' }).catch(() => undefined)
      }
    }
  } catch (error) {
    $.ui.log(`speedy: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
  } finally {
    if (viewing === controller) viewing = undefined
    // The popup closed: its narration is over.
    if (popupPlay === controller) {
      popupPlay = undefined
      if (controlFile === control) controlFile = ''
      await update($, clipNow, () => '')
      await update($, speech, () => 'idle')
    }
  }
}

/** The 👁 menu: the images kept, newest first, each with 👁️ to see it and 🖼️ to paste it again. */
async function imagesMenu ($: EngineInterface, e: Drawn) {
  const { Box, Client, Text } = glyphed($.ui.resolve(e))
  const list = await read($, pastedImages)
  if (list.length === 0) return <Text dimColor>{'  Todavía no hay imágenes en el historial.'}</Text>
  const clear = ' 🗑️ limpiar historial '
  const control = (key: string, label: string) => (
    <Client key={key} module="./control.tsx" width={cells(label)} props={{ label, color: IMAGE_COLOR, bold: true }} />
  )
  return (
    <Box flexDirection="column">
      {list.map((image, index) => {
        const label = `[Image #${image.id}]`
        return (
          <Box key={`image:${image.path}`} flexDirection="row">
            {control(`speedy:image-view:${index}`, ' 👁️ ')}
            {control(`speedy:image-paste:${index}`, ' 🖼️ ')}
            <Text bold color={IMAGE_COLOR}>{` ${label.padEnd(12)}`}</Text>
            <Text dimColor>{` ${image.stamp ?? ''}`}</Text>
          </Box>
        )
      })}
      <Box marginTop={1} flexDirection="row">
        <Client key="speedy:images-clear" module="./control.tsx" width={cells(clear)} props={{ label: clear, color: '#ff6b6b', bold: true }} />
      </Box>
    </Box>
  )
}

/** The stop file of the dictation under way. */
let listenFile = ''

/** The microphone button: listens, and appends each phrase said to the prompt as it is written. */
async function listen ($: EngineInterface) {
  // The voice would be heard by a microphone near the speakers: it pauses.
  if ((await read($, speech)) === 'playing') await control($, 'pause')
  const lang = (await read($, picks)).active ?? DEFAULT_LANG
  const file = await homeFile($, `${CONTROL_DIR}/listen-${crypto.randomUUID()}.txt`)
  listenFile = file
  await $.fs.write(file, 'listen')
  await update($, listening, () => 'loading')
  let pending = ''
  try {
    const listener = $.process.spawn({
      argv: [await python($), '-u', `${$.plugin.root}/hooks/listen.py`, lang, file, await read($, mic)],
      env: { PYTHONIOENCODING: 'utf-8' }
    })
    for await (const { stream, text } of listener) {
      if (stream !== 'stdout') continue
      // Lines may come split or several at once: only whole ones are read.
      pending += text
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() ?? ''
      for (const line of lines) {
        const said = /^(partial|text) (\d+) ?(.*)$/.exec(line)
        if (line === 'ready') {
          if ((await read($, listening)) === 'loading') await update($, listening, () => 'on')
        } else if (said?.[1] === 'partial') {
          // The quick preview, shown above the prompt while the phrase is said.
          const number = Number(said[2])
          const text = said[3] ?? ''
          await update($, heard, list => [...list.filter(one => one.number !== number), { number, text }].sort((a, b) => a.number - b.number))
        } else if (said?.[1] === 'text') {
          // Words the model committed replace the preview: they go into the prompt as they come.
          // listen.py sets the spaces (a piece with none goes on the word before); only a space
          // at the prompt's start, or after one already there, is dropped.
          const number = Number(said[2])
          const text = said[3] ?? ''
          await update($, heard, list => list.filter(one => one.number !== number))
          if (text.trim()) {
            const draft = (await $.prompt.read()).text
            const piece = draft === '' || /\s$/.test(draft) ? text.trimStart() : text
            await $.prompt.fill({ text: piece, mode: 'append' })
          }
        } else if (line.startsWith('error ')) {
          $.ui.toast(`speedy-code: el micrófono falló: ${line.slice(6)}`)
        }
      }
    }
  } catch (error) {
    $.ui.toast(`speedy-code: no pude abrir el micrófono: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    if (listenFile === file) {
      listenFile = ''
      await update($, listening, () => 'off')
      await update($, heard, () => [])
    }
  }
}

/** Ends the dictation: what is being said is still written out. */
async function stopListening ($: EngineInterface) {
  // No dictation under way here, yet the footer shows one: a reload of the plugin ended it, and its end was
  // never written. The click puts the footer back in step instead of doing nothing.
  if (!listenFile) {
    await update($, listening, () => 'off')
    await update($, heard, () => [])
    return
  }
  await $.fs.write(listenFile, 'stop')
  // Blue again while the last phrases are written: it ends, and turns gray, once they are in the prompt.
  await update($, listening, () => 'loading')
}

/**
 * Sets the terminal's font to `family` at `size` points. A program in a terminal has no font
 * of its own, so terminal_font.py changes the terminal's settings: the whole of it follows.
 */
async function setTerminalFont ($: EngineInterface, family: FontFamily, size: number) {
  const name = FONT_FAMILIES.find(([id]) => id === family)?.[1] ?? family
  $.ui.toast(`speedy-code: poniendo ${name} a ${size} pt en tu terminal…`)
  const result = await $.process.run([await python($), `${$.plugin.root}/setup/terminal_font.py`, '--family', family, '--size', `${size}`], { env: { PYTHONIOENCODING: 'utf-8' } }).catch(() => undefined)
  const said = result?.stdout.trim() ?? ''
  if (result?.exitCode !== 0) {
    $.ui.toast(`speedy-code: ${said || 'no pude cambiar la fuente: falta instalar'}`)
    return
  }
  await update($, fontSize, () => size)
  await update($, fontFamily, () => family)
  await $.store.set('fontSize', size)
  await $.store.set('fontFamily', family)
  $.ui.toast(`speedy-code: ${said}`)
  $.ui.invalidate('ui.render')
}

/**
 * The icons a session starts with: Nerd Fonts glyphs when a Nerd Font is installed, else as last chosen in
 * ⚙ (glyphs too, for a terminal whose own font is a Nerd Font).
 */
export function startIcons (stored: unknown, hasFont: boolean): IconSet {
  return hasFont || stored === 'nerd' ? 'nerd' : 'emoji'
}

/**
 * Whether a Nerd Font is installed, for this user or for all: the icons alone the setup puts
 * (SymbolsNerdFontMono) or a text family with them (JetBrainsMonoNerdFont, MesloLGSNerdFont...).
 */
async function hasNerdFont ($: EngineInterface) {
  const folders = (await osNow($)) === 'mac'
    ? [await homeFile($, 'Library/Fonts'), '/Library/Fonts']
    : [await appDataDir($, 'Microsoft/Windows/Fonts'), 'C:/Windows/Fonts']
  for (const folder of folders) {
    const found = await $.fs.list(folder).catch(() => [])
    if (found.some(entry => /NerdFont/i.test(entry.name))) return true
  }
  return false
}

/** Changes the icon set, kept for the next sessions, and draws the footer again with it. */
async function switchIcons ($: EngineInterface) {
  const next: IconSet = (await read($, icons)) === 'nerd' ? 'emoji' : 'nerd'
  await update($, icons, () => next)
  isGlyphs = next === 'nerd'
  await $.store.set('icons', next)
  await writeBarFile($)
  $.ui.invalidate('ui.render')
}

/** Shows or hides the controls' names above them, kept for the next sessions, and draws the footer again. */
async function switchLabels ($: EngineInterface) {
  const next = !(await read($, hasLabels))
  await update($, hasLabels, () => next)
  await $.store.set('labels', next)
  $.ui.invalidate('ui.render')
}

/** The microphone dictation listens to, kept for the next sessions. */
async function pickMic ($: EngineInterface, name: string) {
  await update($, mic, () => name)
  await $.store.set('mic', name)
  $.ui.toast(`speedy-code: dicto con ${name ? micName(name) : `el micrófono predeterminado de ${systemName(await osNow($))}`}`)
  await closeMenu($, 'mic')
}

/** `text` with every character past ASCII escaped as JSON reads it: nothing on the way can break it. */
export function ascii (text: string) {
  return text.replace(/[\u0080-\uffff]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

/**
 * The image button: pastes the clipboard's image into the prompt, as Claude Code's own Alt+V does.
 * No mod can attach an image to the draft nor run Claude Code's key actions, so Windows presses
 * Alt+V: the terminal, just clicked, has the focus, and Claude Code takes it as the person's key.
 */
async function pasteImage ($: EngineInterface) {
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    "if ([System.Windows.Forms.Clipboard]::ContainsImage()) { [System.Windows.Forms.SendKeys]::SendWait('%v'); 'pasted' } else { 'none' }"
  ].join('; ')
  const argv = (await osNow($)) === 'windows' ? ['powershell', '-NoProfile', '-NonInteractive', '-STA', '-Command', script] : MAC.pasteImage
  const result = await $.process.run(argv).catch(() => undefined)
  const said = result?.stdout.trim() ?? ''
  if (said === 'none') $.ui.toast('speedy-code: el portapapeles no tiene una imagen.')
  else if (said !== 'pasted') $.ui.toast('speedy-code: no pude pegar la imagen.')
}

/**
 * The send button: Windows presses Enter, so the prompt goes as when the person presses it. A
 * prompt the mod submitted would not bring its pasted images nor its @ mentions along.
 */
async function sendPrompt ($: EngineInterface) {
  if (!(await $.prompt.read()).text.trim()) {
    $.ui.toast('speedy-code: el prompt está vacío.')
    return
  }
  const script = "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); 'sent'"
  const argv = (await osNow($)) === 'windows' ? ['powershell', '-NoProfile', '-NonInteractive', '-STA', '-Command', script] : MAC.sendEnter
  const result = await $.process.run(argv).catch(() => undefined)
  if (result?.stdout.trim() !== 'sent') $.ui.toast('speedy-code: no pude enviar; apretá Enter.')
}

/**
 * A pasted image or text is held in the draft by its chip, `[Image #1]` or `[Pasted text #2 +40 lines]`:
 * a draft written back without it drops the attachment. So the chips go to Groq as `[[1]]` markers it
 * is told to keep, and come back as they were.
 */
const CHIP = /\[(?:Image|Pasted text|Pasted image)[^\]]*?#\d+[^\]]*\]/g

/** The draft with each chip swapped for a `[[n]]` marker, and the chips, in order. */
export function shieldChips (draft: string) {
  const chips: string[] = []
  const text = draft.replace(CHIP, chip => `[[${chips.push(chip)}]]`)
  return { text, chips }
}

/** The chips back in place of their markers; one the model dropped is put back at the end. */
export function restoreChips (polished: string, chips: readonly string[]) {
  let text = polished
  const lost: string[] = []
  chips.forEach((chip, index) => {
    const marker = `[[${index + 1}]]`
    if (text.includes(marker)) text = text.split(marker).join(chip)
    else lost.push(chip)
  })
  return lost.length ? `${text} ${lost.join(' ')}` : text
}

/** The wand: sends the whole prompt to Groq and puts back what it returns, cleaned up. */
async function polish ($: EngineInterface) {
  if (await read($, isPolishing)) return
  const draft = (await $.prompt.read()).text
  if (!draft.trim()) {
    $.ui.toast('speedy-code: el prompt está vacío.')
    return
  }
  await update($, isPolishing, () => true)
  const shielded = shieldChips(draft)
  try {
    // Groq is asked by polish.py, in ASCII both ways: the HTTP client here decoded Groq's UTF-8 as
    // another encoding and broke every accent.
    const polisher = $.process.spawn({
      argv: [await python($), '-X', 'utf8', `${$.plugin.root}/hooks/polish.py`],
      input: ascii(JSON.stringify({ model: POLISH_MODEL, system: POLISH_SYSTEM, text: shielded.text }))
    })
    let out = ''
    for await (const { stream, text } of polisher) if (stream === 'stdout') out += text
    const answer = JSON.parse(out.trim() || '{}') as { text?: string; error?: string }
    const polished = restoreChips(answer.text?.trim() ?? '', shielded.chips).trim()
    if (!polished) {
      $.ui.toast(`speedy-code: ${answer.error ?? 'Groq no devolvió texto.'}`)
      return
    }
    // Typed into while Groq answered: nothing is overwritten.
    if ((await $.prompt.read()).text !== draft) {
      $.ui.toast('speedy-code: cambiaste el prompt mientras lo corregía; no lo toqué.')
      return
    }
    await $.prompt.fill({ text: polished, mode: 'replace' })
  } catch (error) {
    $.ui.toast(`speedy-code: no pude hablar con Groq: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await update($, isPolishing, () => false)
  }
}

/** `claude --resume <id>` to the clipboard, by Windows' own Set-Clipboard: the UI is closing, so no $.ui.copy. */
async function copyResume ($: EngineInterface, id: string) {
  // A session id is letters, digits and dashes alone: nothing to quote in a PowerShell string.
  if (!/^[\w-]+$/.test(id)) return
  const argv = (await osNow($)) === 'windows'
    ? ['powershell', '-NoProfile', '-NonInteractive', '-Command', `Set-Clipboard -Value 'claude --resume ${id}'`]
    : MAC.clipboardWrite(`claude --resume ${id}`)
  await $.process.run(argv).catch(() => undefined)
}

/** The profile link of a network for a user name; empty when the name holds what no user name does. */
export function socialLink (id: string, user: string) {
  const name = user.trim().replace(/^@/, '').replace(/@gmail\.com$/i, '')
  const template = SOCIALS.find(([one]) => one === id)?.[4]
  if (!template || !/^[\w.-]{1,100}$/.test(name)) return ''
  return template.replace('{u}', name)
}

/** Opens a link in the default browser. The link is built by socialLink: letters, digits, `.`, `-`, `_` alone. */
async function openLink ($: EngineInterface, link: string) {
  const argv = (await osNow($)) === 'windows' ? ['powershell', '-NoProfile', '-NonInteractive', '-Command', `Start-Process '${link}'`] : MAC.open(link)
  await $.process.run(argv).catch(() => undefined)
}

/** Keeps a network's user name, for the next sessions too. */
async function saveSocial ($: EngineInterface, id: string, user: string) {
  const next: Socials = { ...(await read($, socials)), [id]: user.trim() }
  await update($, socials, () => next)
  await $.store.set('socials', next)
}

/**
 * A network's accounts, by key: the first under the network's id, each one added after it under
 * `id#2`, `id#3`..., in that order.
 */
export function accountsOf (users: Socials, id: string) {
  const more = Object.keys(users).filter(key => key.startsWith(`${id}#`)).sort((a, b) => Number(a.split('#')[1]) - Number(b.split('#')[1]))
  return [id, ...more]
}

/** The network an account key belongs to: `github#2` → `github`. */
const networkOf = (key: string) => key.split('#')[0] ?? key

/** The label of an account's button: the network's, numbered past the first (`GH`, `GH2`). */
const accountLabel = (label: string, key: string) => label + (key.split('#')[1] ?? '')

/** The + button: another account of a network, empty, its field open to type in. One already empty is opened instead. */
async function addAccount ($: EngineInterface, id: string) {
  const users = await read($, socials)
  const empty = accountsOf(users, id).slice(1).find(key => !(users[key] ?? '').trim())
  if (empty) {
    await update($, editing, () => empty)
    return
  }
  const numbers = accountsOf(users, id).slice(1).map(key => Number(key.split('#')[1]))
  const key = `${id}#${Math.max(1, ...numbers) + 1}`
  await saveSocial($, key, '')
  await update($, editing, () => key)
}

/** The − button: an added account goes, whatever it holds. A network's first account has none: it always stays. */
async function removeAccount ($: EngineInterface, key: string) {
  if (!key.includes('#')) return
  const { [key]: _gone, ...rest } = await read($, socials)
  await update($, socials, () => rest)
  await $.store.set('socials', rest)
  if ((await read($, editing)) === key) await update($, editing, () => '')
}

/** Every added account still empty: they go, as when the settings close with nothing typed in them. */
async function dropEmptyAccounts ($: EngineInterface) {
  const users = await read($, socials)
  const rest = Object.fromEntries(Object.entries(users).filter(([key, user]) => !key.includes('#') || (user ?? '').trim()))
  if (Object.keys(rest).length === Object.keys(users).length) return
  await update($, socials, () => rest)
  await $.store.set('socials', rest)
}

/** An added account left empty when its field is done with: it goes. */
async function dropIfEmpty ($: EngineInterface, key: string) {
  const users = await read($, socials)
  if (!key.includes('#') || (users[key] ?? '').trim()) return
  const { [key]: _gone, ...rest } = users
  await update($, socials, () => rest)
  await $.store.set('socials', rest)
}

/** One setup step's state. */
async function setCheck ($: EngineInterface, name: string, check: SetupCheck) {
  await update($, setupChecks, all => ({ ...all, [name]: check }))
}

/**
 * Checks what is in place without the network and without installing: the Python environment, its
 * packages, the dictation model, the microphones and the Groq key. uv and the Edge voices are
 * checked by the setup itself.
 */
async function checkSetup ($: EngineInterface) {
  const pythonFile = await python($)
  const hasPython = await $.fs.exists(pythonFile).catch(() => false)
  await setCheck($, 'python', hasPython ? { state: 'ok', detail: 'listo' } : { state: 'fail', detail: 'falta' })
  let hasPackages = false
  if (hasPython) {
    const probe = await $.process.run([pythonFile, '-c', 'import edge_tts, transcribe_cpp, sounddevice, numpy']).catch(() => undefined)
    hasPackages = probe?.exitCode === 0
  }
  await setCheck($, 'packages', hasPackages ? { state: 'ok', detail: 'listos' } : { state: 'fail', detail: 'faltan' })
  // The model loaded as a dictation loads it: "ok es-US", or "fail" and why.
  const lang = (await read($, picks)).active ?? DEFAULT_LANG
  const loaded = hasPackages ? await $.process.run([pythonFile, `${$.plugin.root}/hooks/listen.py`, '--check', lang], { env: { PYTHONIOENCODING: 'utf-8' } }).catch(() => undefined) : undefined
  const answer = loaded?.stdout.trim() ?? ''
  await setCheck($, 'model', answer.startsWith('ok ') ? { state: 'ok', detail: answer.slice(3) } : { state: 'fail', detail: answer.startsWith('fail ') ? answer.slice(5) : 'faltan los paquetes' })
  if (hasPackages) await loadMics($)
  const found = (await read($, mics)).length
  await setCheck($, 'mics', found ? { state: 'ok', detail: `${found} conectado(s)` } : { state: 'fail', detail: hasPython ? 'ninguno conectado' : 'se buscan al instalar' })
  const fonts = (await osNow($)) === 'mac' ? await homeFile($, 'Library/Fonts') : await appDataDir($, 'Microsoft/Windows/Fonts')
  await setCheck($, 'font', (await $.fs.exists(`${fonts}/SymbolsNerdFontMono-Regular.ttf`).catch(() => false)) ? { state: 'ok', detail: 'instalada' } : { state: 'fail', detail: 'falta' })
  // The fonts for the text: each family whole, its four styles.
  const missing: string[] = []
  for (const [, name, file] of FONT_FAMILIES) {
    for (const style of ['Regular', 'Bold', 'Italic', 'BoldItalic']) {
      if (await $.fs.exists(`${fonts}/${file}-${style}.ttf`).catch(() => false)) continue
      missing.push(name)
      break
    }
  }
  await setCheck($, 'fonts', missing.length ? { state: 'fail', detail: `falta ${missing.join(' y ')}` } : { state: 'ok', detail: 'instaladas' })
  // What the mod uses beside its own Python, as extras.py finds it. The other machines are tried by the setup alone: that goes over the network.
  for (const name of ['ffmpeg', 'git', 'access']) {
    const said = hasPython ? (await $.process.run([pythonFile, `${$.plugin.root}/setup/extras.py`, name], { env: { PYTHONIOENCODING: 'utf-8' } }).catch(() => undefined))?.stdout.trim() ?? '' : ''
    await setCheck($, name, said.startsWith('ok ') ? { state: 'ok', detail: said.slice(3) } : { state: 'fail', detail: said.startsWith('fail ') ? said.slice(5) : 'sin revisar' })
  }
  await setCheck($, 'groq', (await $.env.get('GROQ_API_KEY')) ? { state: 'ok', detail: 'presente' } : { state: 'fail', detail: 'falta GROQ_API_KEY' })
}

/**
 * speedy-code's status line, in color, switched on or off in the user's settings by switch.py: the
 * status line set before is kept and comes back when it is switched off.
 */
async function switchStatusLine ($: EngineInterface, action: 'on' | 'off' | 'status') {
  const result = await $.process.run([await python($), `${$.plugin.root}/statusline/switch.py`, action]).catch(() => undefined)
  const said = result?.stdout.trim() ?? ''
  if (said === 'on' || said === 'off') await update($, statusLine, () => said)
  else if (action !== 'status') $.ui.toast(`speedy-code: no pude cambiar la barra de estado: ${said.replace(/^error /, '') || 'falta instalar'}`)
  if (action !== 'status' && (said === 'on' || said === 'off')) $.ui.toast(said === 'on' ? 'speedy-code: barra de estado a colores activada; aparece en un segundo.' : 'speedy-code: volvió tu barra de estado anterior.')
}

/**
 * Claude Code's experimental Code Mode, switched on or off in the user's settings by code_mode.py: it sets
 * or removes `env.CLAUDE_CODE_EXPERIMENTAL_CODE_MODE`. Claude Code reads it when it starts, so it applies
 * from the next session, which asks once whether to turn it on. Off unless turned on here.
 */
async function switchCodeMode ($: EngineInterface, action: 'on' | 'off' | 'status') {
  const result = await $.process.run([await python($), `${$.plugin.root}/hooks/code_mode.py`, action]).catch(() => undefined)
  const said = result?.stdout.trim() ?? ''
  if (said === 'on' || said === 'off') await update($, codeMode, () => said)
  if (action === 'status') return
  if (said === 'on') $.ui.toast('speedy-code: Code Mode encendido; se aplica la próxima vez que abras Claude Code.')
  else if (said === 'off') $.ui.toast('speedy-code: Code Mode apagado; se aplica la próxima vez que abras Claude Code.')
  else $.ui.toast(`speedy-code: no pude cambiar Code Mode: ${said.replace(/^error /, '') || 'falta instalar'}`)
}

/**
 * The model in use. `/model` typed in the terminal changes it without the mod seeing it, and the
 * footer is not drawn again by itself: so the footer asks now and then, and redraws when it changed.
 */
async function followModel ($: EngineInterface) {
  const now = await $.session.model().catch(() => '')
  if (now && now !== (await read($, modelNow))) {
    await update($, modelNow, () => now)
    $.ui.invalidate('ui.render')
  }
}

/**
 * A footer group's rank when the width is short: 0 is always drawn; then 1 first, 2 next, and so on.
 * The tools, the model, the voice and ✕ always stay; the networks go first.
 */
const FOOTER_RANKS: Record<string, number> = {
  copy: 0, paste: 0, image: 0, polish: 0, send: 0, clear: 0, model: 0, voice: 0, compact: 0, exit: 0,
  mode: 1, settings: 1, reload: 2, mic: 3, narrator: 4, socials: 5
}
/**
 * The groups always drawn that give way, in this order, when even their short forms do not fit: they
 * go to the ⋯ panel, so ⋯ and ✕ are always on screen. Paste, send and the model never go.
 */
const FOOTER_SHED = ['voice', 'compact', 'clear', 'image', 'copy', 'polish']
/** The ⋯ button's width, drawn when something does not fit. */
const MORE_WIDTH = 4
/** The groups the footer last left out for want of room: the ⋯ panel draws them. */
let hiddenGroups: readonly string[] = []
/** The share of the context used, as the last session.measure said it: the footer's 🗜️ shows from the red level. */
let contextUsed = 0

/** The cells a label takes on a terminal: an emoji two, a variation selector or joiner none, the rest one. */
export function cells (text: string) {
  const points = [...text]
  return points.reduce((total, point, index) => {
    const code = point.codePointAt(0) ?? 0
    if (code === 0xfe0e || code === 0xfe0f || code === 0x200d) return total
    return total + (code >= 0x1f000 || points[index + 1] === '\ufe0f' ? 2 : 1)
  }, 0)
}

/** What footerFit decided: the groups drawn, and those drawn in their short form. */
/** Which icons the footer is drawn with. */
export type IconSet = 'emoji' | 'nerd'

/**
 * Each emoji the footer writes, with the Nerd Fonts glyph that stands for it: Font Awesome's code
 * points in Nerd Fonts 3 (`glyphnames.json`), all in the basic private use area. A glyph is one
 * color, takes the color of its control and is as wide as any other; it needs a Nerd Font in the terminal.
 */
export const NERD_ICONS: Readonly<Record<string, string>> = {
  '📋': '\uf0c5', // fa-copy
  '📥': '\uf0ea', // fa-paste
  '🖼': '\uf03e', // fa-image
  '👁': '\uf06e', // fa-eye
  '🗑': '\uf1f8', // fa-trash
  '🗣': '\uf075', // fa-comment
  '🗜': '\ued4d', // fa-down_left_and_up_right_to_center
  '🔊': '\uf028', // fa-volume_high
  '🔇': '\uf026', // fa-volume_off
  '📎': '\uf0c6', // fa-paperclip
  '🎙': '\uf130', // fa-microphone
  '🔵': '\uf130', // the microphone loading: its color says so
  '🔴': '\uf130', // the microphone open: its color says so
  '🖋': '\uf040', // fa-pencil
  '⏳': '\uf252', // fa-hourglass_half
  '🔄': '\uf021', // fa-refresh
  '⚙': '\uf013', // fa-gear
  '×': '\uea76', // cod-close: thin, and no wider than its cell
  // Signs a terminal may draw as emojis, in a color and a width of their own.
  '✔': '\uf00c', // fa-check
  '⏎': '\uf1d8', // fa-paper_plane: the prompt, sent
  '☰': '\uf1da', // fa-clock_rotate_left: the conversations before
  '✘': '\uf00d', // fa-xmark
  '⚠': '\uf071', // fa-triangle_exclamation
  '▶': '\uf04b', // fa-play
  '⏵': '\uf04b', // fa-play
  '⏸': '\uf04c', // fa-pause
  '⧗': '\uf252', // fa-hourglass_half
  '♀': '\uf221', // fa-venus
  '♂': '\uf222', // fa-mars
  '✦': '\uf005', // fa-star
  '✎': '\uf044', // fa-edit
  '▤': '\uf1de', // fa-sliders
  '◈': '\uefcc', // fa-palette
  'ⓘ': '\uf05a' // fa-info_circle
}

const EMOJI = new RegExp(`(${Object.keys(NERD_ICONS).join('|')})[\ufe0e\ufe0f]?`, 'gu')

/**
 * `text` with every emoji and sign replaced by its Nerd Fonts glyph. A terminal draws a glyph wider
 * than its cell, so each one is followed by a cell of its own to spill over: a text with a two-cell
 * emoji keeps its width, one with a one-cell sign grows by a cell. That cell is a no-break space:
 * a terminal paints what a glyph spills in the next cell's color, and Claude Code leaves a plain
 * blank uncolored, which showed the glyph in two colors. On macOS it is a plain blank, `gap`: Ghostty
 * draws a glyph whole only before a space, shrinks it into its cell before anything else, and paints
 * what it spills in the glyph's own color.
 */
export function nerdText (text: string, gap = glyphGap) {
  // The close mark is thin and stays in its cell: it takes no cell more, only its color on the blank after it.
  return text
    .replace(EMOJI, (_found, emoji: string) => emoji === '×' ? NERD_ICONS[emoji] : `${NERD_ICONS[emoji]}${gap}`)
    .replace(/\uea76 /g, `\uea76${gap}`)
}

/** The cell after a glyph, for it to spill over: a no-break space, or a plain one on macOS. See nerdText. */
let glyphGap = '\u00a0'

/** Whether everything is drawn with Nerd Fonts glyphs now: the `icons` atom, at hand where nothing is awaited. */
let isGlyphs = false

/** The props an element is drawn with, their texts in glyphs: its label, its children, a Client's label. */
function glyphProps (props: Record<string, unknown> | null | undefined) {
  if (!props) return props
  const next = { ...props }
  for (const key of ['label', 'submitLabel', 'title']) {
    const value = next[key]
    if (typeof value === 'string') next[key] = nerdText(value)
  }
  const { children, props: inner } = next
  if (typeof children === 'string') next.children = nerdText(children)
  else if (Array.isArray(children)) next.children = children.map(child => typeof child === 'string' ? nerdText(child) : child)
  if (inner && typeof inner === 'object' && typeof (inner as { label?: unknown }).label === 'string') {
    // A Client is as wide as it was told: a label that grew takes its width along.
    const before = (inner as { label: string }).label
    const label = nerdText(before)
    next.props = { ...inner, label }
    if (typeof next.width === 'number') next.width += cells(label) - cells(before)
  }
  return next
}

/**
 * The host's elements, drawing every text with the icon set in use: with Nerd Fonts each one turns
 * the emojis of its own texts into glyphs, so a menu writes its labels once, in emojis.
 */
function glyphed<T extends object> (elements: T): T {
  if (!isGlyphs) return elements
  const drawn: Record<string, unknown> = {}
  for (const [name, element] of Object.entries(elements)) {
    drawn[name] = typeof element === 'function'
      ? (props: Record<string, unknown>) => (element as (props: unknown) => unknown)(glyphProps(props))
      : element
  }
  return drawn as T
}

/** The colors the footer's tools take with Nerd Fonts glyphs: with emojis they are gray, since an emoji takes none. */
const NERD_COLORS: Readonly<Record<string, string>> = {
  'speedy:copy': '#74c0fc',
  'speedy:paste': '#63e6be',
  'speedy:image': '#b197fc',
  'speedy:clear': '#ff8787',
  'speedy:reload': '#4dabf7',
  'speedy:settings': '#ced4da'
}

export type FooterFit = { shown: Set<string>, compact: Set<string> }

/** The colors of the folder and the branch, after the ✕: the status line's own. */
const FOLDER_COLOR = '#5fd7ff'
const BRANCH_COLOR = '#d787ff'
/** The most cells the folder takes in the footer: a longer one keeps its end, after a …. */
const FOLDER_CELLS = 40

/**
 * The folder as the footer shows it: home as ~, with the system's own separators, and its end alone
 * after a … when it is longer than `most` cells.
 */
export function folderLabel (cwd: string, home: string, os: 'windows' | 'mac', most = FOLDER_CELLS) {
  if (!cwd) return ''
  const plain = cwd.replace(/\\/g, '/')
  const homePlain = home.replace(/\\/g, '/').replace(/\/$/, '')
  const inHome = homePlain && (plain === homePlain || plain.toLowerCase().startsWith(`${homePlain.toLowerCase()}/`))
  const shown = inHome ? `~${plain.slice(homePlain.length)}` : plain
  const native = os === 'windows' ? shown.replace(/\//g, '\\') : shown
  return native.length > most ? `…${native.slice(native.length - most + 1)}` : native
}

/** Where the session works, after the ✕: its folder and git branch, followed outside any draw. */
let place = { folder: '', branch: '', cwd: '' }
/** The session's folder as last seen: a change of it opens the explorer on the new one. */
let rootSeen = ''

async function followPlace ($: EngineInterface) {
  const cwd = await $.session.cwd().catch(() => '')
  // The session moved to another folder, however it did: the explorer goes with it.
  const root = await $.session.root().catch(() => '')
  const caseless = (await osNow($)) === 'windows'
  const isMoved = root && rootSeen && pathKey(root, caseless) !== pathKey(rootSeen, caseless)
  if (root) rootSeen = root
  if (isMoved && isInteractive) void showExplorer($, root).catch(() => undefined)
  const home = (await $.env.get('USERPROFILE')) || (await $.env.get('HOME')) || ''
  const folder = folderLabel(cwd, home, await osNow($))
  const asked = cwd ? await $.process.run(['git', '-C', cwd.replace(/\\/g, '/'), 'branch', '--show-current']).catch(() => undefined) : undefined
  const branch = asked?.exitCode === 0 ? asked.stdout.trim() : ''
  if (folder === place.folder && branch === place.branch) return
  place = { folder, branch, cwd }
  $.ui.invalidate('ui.render')
}

/** When the folder was last opened, and how long a click after it opens nothing. */
let folderOpened = 0
const FOLDER_PAUSE_MS = 3000

/** Opens the session's folder in the system's file manager: Explorer, or Finder. */
async function openFolder ($: EngineInterface) {
  // One window for a run of clicks: each call starts another, and a dozen of them slow the system down.
  if (!place.cwd || Date.now() - folderOpened < FOLDER_PAUSE_MS) return
  folderOpened = Date.now()
  if ((await osNow($)) !== 'windows') {
    await $.process.run(MAC.open(place.cwd)).catch(() => undefined)
    return
  }
  // open_folder.ps1 finds the folder's window, or opens one, and puts it in front: `start` only flashes
  // a window the folder already has, and explorer.exe leaves a new one behind the terminal.
  await $.process.run(
    ['powershell', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/hooks/open_folder.ps1`],
    { env: { SPEEDY_FOLDER: place.cwd.replace(/\//g, '\\') } }
  ).catch(() => undefined)
}

/** The explorer pane the footer's folder opens beside the chat, in place of the system's file manager. */
const EXPLORER_PANE = 'speedy-code-explorer'
/** The cells the explorer asks for while docked beside a fullscreen transcript. */
const EXPLORER_COLUMNS = 44
/** The share of the terminal the explorer asks for: under a third. */
const EXPLORER_SHARE = 0.3
/** The terminal's width, as the footer last drew in it; 0 before it did. */
let terminalColumns = 0
/** The columns the explorer takes while docked beside the transcript, its border with them; 0 when it is not. */
let explorerDock = 0

/** Keeps the explorer's docked width, and draws the footer again when it changed. */
function followDock ($: EngineInterface, width: number) {
  if (width === explorerDock) return
  explorerDock = width
  $.ui.invalidate('ui.render')
}
/** The cells each row's seven tools take at its right: each on its own two, a gap of two between them and one before the first. */
const EXPLORER_TOOLS_WIDTH = 27
/** Each file's tools: what a press does, its emoji, its Nerd Fonts glyph (as the footer's, with ⚙ → Usar Nerd
 * Fonts) and its color. 📁, the first, makes a folder there; 📍, the last, is a folder's alone: the session
 * goes to work there. Both are for this machine's folders alone. */
const EXPLORER_TOOLS: ReadonlyArray<readonly [string, string, string, string]> = [
  ['mkdir', '📁', '\uea80', '#ffd43b'],
  ['copy', '📋', '\uf0c5', '#74c0fc'],
  ['path', '🔗', '\uf0c1', '#63e6be'],
  ['rename', '✏', '\uf044', '#b197fc'],
  ['trash', '🗑', '\uf1f8', '#ff8787'],
  ['paste', '📥', '\uf0ea', '#ffa94d'],
  ['work', '📍', '\uf041', '#51cf66']
]
/**
 * What a tool of a row does, as the pointer on it says, dark on yellow at its left as the footer's controls do
 * (⚙ → Ver labels): for a file or a folder, and 📥 for what 📋 took. A tool grey on a disk's root says why.
 */
export function toolTip (kind: string, isFolder: boolean, clipKind?: 'dir' | 'file', isDisk = false) {
  const what = isFolder ? 'carpeta' : 'archivo'
  if (isDisk && DISK_IDLE_TOOLS.includes(kind)) return 'no se hace con un disco'
  switch (kind) {
    case 'mkdir': return 'Crear carpeta'
    case 'copy': return `Copiar ${what}`
    case 'path': return 'Copiar path'
    case 'rename': return `Renombrar ${what}`
    case 'trash': return `Borrar ${what}`
    case 'paste': return clipKind ? `Pegar ${clipKind === 'dir' ? 'carpeta' : 'archivo'}` : 'Pegar: copiá algo con 📋 antes'
    case 'work': return 'Cambiar espacio de trabajo'
    default: return ''
  }
}

/**
 * The hover group a tool of a row joins, which lights its label in the explorer's ribbon: one per tool and,
 * for those whose words change with it, the row's kind (a folder, a file, a disk's root).
 */
export function tipScope (kind: string, isFolder: boolean, isDisk = false) {
  if (isDisk && DISK_IDLE_TOOLS.includes(kind)) return `explorer-tip:${kind}:disk`
  return ['copy', 'rename', 'trash'].includes(kind) ? `explorer-tip:${kind}:${isFolder ? 'dir' : 'file'}` : `explorer-tip:${kind}`
}

/**
 * Every label the ribbon holds, hidden until its tool is under the pointer: its hover group, its words, the
 * tool's color as its fill, and the column the tool's icon starts at among the row's tools.
 */
export function toolTips (clipKind?: 'dir' | 'file') {
  return EXPLORER_TOOLS.flatMap(([kind, , , color], index) => {
    const column = 1 + 4 * index
    const kinds = ['copy', 'rename', 'trash'].includes(kind)
      ? [[true, false], [false, false], [true, true]] as const
      : [[true, false]] as const
    return kinds.map(([isFolder, isDisk]) => ({ scope: tipScope(kind, isFolder, isDisk), text: toolTip(kind, isFolder, clipKind, isDisk), color, column }))
  })
}

/** 📥 while 📋 took nothing: grey, and with emoji a plain mark, as an emoji keeps its own colors. */
const PASTE_IDLE_MARK = '↧'
const PASTE_IDLE_COLOR = '#495057'
/** The tools that are grey on a disk's root, and do nothing there: a disk is not copied, renamed or trashed. */
const DISK_IDLE_TOOLS = ['copy', 'rename', 'trash']

/** The file tool just pressed, green for a second as a sign the press was taken; empty: none. */
const explorerFlash = atom({ plugin: 'speedy-code', key: 'explorerFlash' } as const, '')
const FLASH_MS = 1000
const FLASH_COLOR = '#51cf66'

/** Turns a pressed tool green, with no fill, and back to its color a second later. */
async function flashTool ($: EngineInterface, key: string) {
  try {
    await update($, explorerFlash, () => key)
    await $.clock.sleep(FLASH_MS)
    await update($, explorerFlash, now => now === key ? '' : now)
  } catch {
    // The mod unloaded meanwhile: nothing is left to turn back.
  }
}


/** The columns the explorer asks for: a little more than a third of the terminal, never less than it needs. */
export function explorerColumns (terminal: number) {
  return terminal > 0 ? Math.max(EXPLORER_COLUMNS, Math.round(terminal * EXPLORER_SHARE)) : EXPLORER_COLUMNS
}

/** A text cut to `most` cells, ending in … when it is longer: a name on one row, whatever its length. */
export function cutCells (text: string, most: number) {
  if (cells(text) <= most) return text
  let out = ''
  for (const char of Array.from(text)) {
    if (cells(out + char) > most - 1) break
    out += char
  }
  return `${out}…`
}
/** The most entries a folder shows: a folder with thousands would bury the tree. */
const EXPLORER_MOST = 500
const EXPLORER_DIR_COLOR = '#74c0fc'
/** A file the viewer opens: yellow, so it reads as one that does something when pressed. */
const EXPLORER_VIEWABLE_COLOR = '#ffd43b'
/** The filter's ×: red while a filter is on, grey while there is none to clear. */
const UNFILTER_COLOR = '#ff6b6b'
const UNFILTER_IDLE_COLOR = '#868e96'
const EMPTY_EXPLORER: Explorer = { drives: [], drive: '', open: [], listed: {}, here: '', caseless: false, top: 0 }
const explorer = atom({ plugin: 'speedy-code', key: 'explorer' } as const, EMPTY_EXPLORER, { shape: 'explorer-2' })
/** The rows above the tree: the disks, the field a path is pasted in, the filter's, and a rule. They stay while the tree scrolls. */
const EXPLORER_HEADER_ROWS = 4
/** The scroll bar's cells: an empty one that parts it from the tree's tools, and the bar. */
const EXPLORER_BAR_WIDTH = 2
/** The bar's track: dark, under a thumb in the folders' color. */
const EXPLORER_TRACK_COLOR = '#3a3a3a'
/** The tree's first row the bar asked for last, while an earlier one is still being set: only the last is set. */
let barAsked: number | undefined
/** The least time between two moves of the tree by its bar. */
const BAR_PACE_MS = 50
let isBarMoving = false
/** The most files a filter shows: more would bury the tree, and the pattern can be made narrower. */
const FILTER_MOST = 50000

/** A path with `/` alone, as the explorer keeps every path. */
const slashed = (path: string) => path.replace(/\\/g, '/')

/** A folder's entry under it: a disk's root ends in `/` already. */
const joinPath = (parent: string, name: string) => parent.endsWith('/') ? `${parent}${name}` : `${parent}/${name}`

/** How the explorer knows a path again: on Windows `C:/Users` and `c:/users` are one folder. */
const pathKey = (path: string, caseless: boolean) => caseless ? slashed(path).toLowerCase() : slashed(path)

/** Whether `path` is `folder` or lies under it, both keys. */
const isUnder = (path: string, folder: string) => path === folder || path.startsWith(folder.endsWith('/') ? folder : `${folder}/`)

/**
 * A path on another machine's disk, reached by ssh: `mac:/Users/ana` is the machine, as ssh knows it, and its
 * own path. A disk of Windows has one letter before its `:`, a machine two at least.
 */
export function remoteOf (path: string) {
  const found = /^([A-Za-z][\w.-]+):(\/.*)$/.exec(slashed(path))
  return found ? { host: found[1] as string, path: found[2] as string } : undefined
}

/**
 * A path of another machine as that machine writes it: a Mac's as it is; one of Windows, under the machine's
 * root as `/C:/Users/ana`, is `C:\Users\ana`.
 */
export const thereOf = (path: string) => /^\/[A-Za-z]:/.test(path) ? (path.length === 3 ? `${path.slice(1)}\\` : path.slice(1).replace(/\//g, '\\')) : path

/** The disk a path is on: the longest of `drives` it lies under, or the first disk when none holds it. */
export function driveOf (path: string, drives: readonly string[], caseless: boolean) {
  const key = pathKey(path, caseless)
  const holding = drives.filter(drive => isUnder(key, pathKey(drive, caseless)))
  return holding.sort((a, b) => b.length - a.length)[0] ?? drives[0] ?? ''
}

/** Each folder from the disk down to `path`, both included; the disk alone for a path not on it. */
export function chainOf (path: string, drive: string) {
  const plain = slashed(path)
  if (!isUnder(plain.toLowerCase(), drive.toLowerCase())) return [drive]
  const chain = [drive]
  for (const name of plain.slice(drive.length).split('/').filter(Boolean)) chain.push(joinPath(chain[chain.length - 1] ?? drive, name))
  return chain
}

/** A disk as its button names it: `C:` on Windows, `/` for the Mac's own and its name for another volume. */
export function driveLabel (drive: string) {
  if (/^[A-Za-z]:\/?$/.test(drive)) return drive.slice(0, 2).toUpperCase()
  // Another machine's disk is named as the machine.
  const remote = remoteOf(drive)
  if (remote?.path === '/') return remote.host
  return drive === '/' ? '/' : drive.split('/').filter(Boolean).pop() ?? drive
}

/** A folder's entries as the tree lists them: folders and links first, then files, each by name whatever its case. */
export function listingOf (entries: readonly FsEntry[], most = EXPLORER_MOST): ExplorerListing {
  const kindOf = (entry: FsEntry): ExplorerEntry['kind'] => entry.isLink ? 'link' : entry.kind === 'dir' ? 'dir' : 'file'
  const sorted = entries
    .map(entry => ({ name: entry.name, kind: kindOf(entry) }))
    .sort((a, b) => Number(a.kind === 'file') - Number(b.kind === 'file') || a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))
  return { entries: sorted.slice(0, most), left: Math.max(0, sorted.length - most) }
}

/** A row of the tree: an entry, or a note under a folder (not read yet, unreadable, empty, entries left). */
export type TreeRow = { path: string; name: string; depth: number; kind: ExplorerEntry['kind'] | 'note'; isOpen: boolean; isHere: boolean; isFound?: boolean }

/**
 * The tree of a filter, flat: the disk, then only the folders that hold a file found, down to each one, all
 * open but those closed by hand. Folders first, then files, each by name, as the whole tree lists them.
 */
export function filterRows (state: Explorer, filter: ExplorerFilter): TreeRow[] {
  type Folder = { path: string; folders: Map<string, Folder>; files: string[] }
  const root: Folder = { path: state.drive, folders: new Map(), files: [] }
  const disk = pathKey(state.drive, state.caseless)
  for (const path of filter.paths) {
    if (!isUnder(pathKey(path, state.caseless), disk)) continue
    const names = path.slice(state.drive.length).split('/').filter(Boolean)
    const file = names.pop()
    if (!file) continue
    let folder = root
    for (const name of names) {
      const key = pathKey(name, state.caseless)
      let next = folder.folders.get(key)
      if (!next) folder.folders.set(key, next = { path: joinPath(folder.path, name), folders: new Map(), files: [] })
      folder = next
    }
    folder.files.push(file)
  }
  const here = pathKey(state.here, state.caseless)
  const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
  const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1)
  const rows: TreeRow[] = []
  const walk = (folder: Folder, name: string, depth: number) => {
    const key = pathKey(folder.path, state.caseless)
    const isOpen = !filter.closed.includes(key)
    rows.push({ path: folder.path, name, depth, kind: 'dir', isOpen, isHere: key === here })
    if (!isOpen) return
    for (const next of [...folder.folders.values()].sort((a, b) => byName(nameOf(a.path), nameOf(b.path)))) walk(next, nameOf(next.path), depth + 1)
    for (const file of [...folder.files].sort(byName)) rows.push({ path: joinPath(folder.path, file), name: file, depth: depth + 1, kind: 'file', isOpen: false, isHere: false })
  }
  const label = /^[A-Za-z]:\/$/.test(state.drive) ? `${driveLabel(state.drive)}\\` : state.drive
  walk(root, label, 0)
  const note = (name: string) => rows.push({ path: `${state.drive}#${name}`, name, depth: 1, kind: 'note', isOpen: false, isHere: false })
  if (rows.length === 1) note(filter.isBusy ? 'buscando…' : '(ningún archivo coincide)')
  else if (filter.isCut) note(`… hay más: son los primeros ${filter.paths.length}`)
  return rows
}

/** What the rule under the filter says of it: the pattern, the files found, and the entries seen while it searches. */
export function filterNote (filter: ExplorerFilter) {
  const count = filter.paths.length
  const found = `${count} ${count === 1 ? 'archivo' : 'archivos'}`
  if (filter.isBusy) return ` ${filter.pattern}: ${found}, buscando… (${filter.seen.toLocaleString('es-AR')} vistos) `
  return filter.isPaused ? ` ${filter.pattern}: ${found}, en pausa ` : ` ${filter.pattern}: ${found} `
}

/** A pattern as typed in the filter's field: its spaces and quotes off. Empty: no filter. */
export function filterPattern (text: string) {
  return text.trim().replace(/^["']+|["']+$/g, '').trim()
}

/** The explorer after a file or a folder was renamed (`to`) or sent to the trash: a filter's files follow it. */
export function filterMoved (state: Explorer, from: string, to?: string): Explorer {
  if (!state.filter) return state
  const key = pathKey(from, state.caseless)
  const paths = state.filter.paths.flatMap(path => !isUnder(pathKey(path, state.caseless), key) ? [path] : to ? [`${to}${path.slice(from.length)}`] : [])
  return { ...state, filter: { ...state.filter, paths } }
}

/** The tree of the disk shown, flat: the disk, then what each open folder holds under it; with a filter on, its tree. */
export function treeRows (state: Explorer): TreeRow[] {
  if (!state.drive) return []
  if (state.filter) return filterRows(state, state.filter)
  const here = pathKey(state.here, state.caseless)
  const found = state.found ?? ''
  const rows: TreeRow[] = []
  const note = (path: string, name: string, depth: number) => rows.push({ path: `${path}#${name}`, name, depth, kind: 'note', isOpen: false, isHere: false })
  const walk = (path: string, name: string, kind: ExplorerEntry['kind'], depth: number) => {
    const key = pathKey(path, state.caseless)
    const isOpen = kind === 'dir' && state.open.includes(key)
    rows.push({ path, name, depth, kind, isOpen, isHere: kind === 'dir' && key === here, isFound: key === found })
    if (!isOpen) return
    const listed = state.listed[key]
    if (listed === undefined) return note(path, 'leyendo…', depth + 1)
    // Another machine's disk that does not answer was not reached by ssh.
    if (listed === 'denied') return note(path, depth === 0 && remoteOf(path) ? '(sin conexión por ssh)' : '(sin acceso)', depth + 1)
    if (listed.entries.length === 0) return note(path, '(vacía)', depth + 1)
    for (const entry of listed.entries) walk(joinPath(path, entry.name), entry.name, entry.kind, depth + 1)
    if (listed.left > 0) note(path, `… y ${listed.left} más`, depth + 1)
  }
  const label = /^[A-Za-z]:\/$/.test(state.drive) ? `${driveLabel(state.drive)}\\` : state.drive
  walk(state.drive, label, 'dir', 0)
  return rows
}

/** The tree rows the explorer shows under its header, in a body of `bodyRows`. */
const explorerRoom = (bodyRows: number) => Math.max(1, bodyRows - EXPLORER_HEADER_ROWS)

/**
 * The first tree row the explorer shows: `top` kept within the tree, so its last row stays at the bottom;
 * -1 puts in the middle the path pasted in the field and found, or else the session's folder.
 */
export function windowTop (rows: readonly TreeRow[], top: number, room: number) {
  const last = Math.max(0, rows.length - room)
  if (top >= 0) return Math.min(last, top)
  const found = rows.findIndex(row => row.isFound)
  const here = found >= 0 ? found : rows.findIndex(row => row.isHere)
  return Math.min(last, Math.max(0, here - Math.floor(room / 2)))
}

/**
 * The tree's scroll bar, at its right when the tree is taller than its room: the rows of the room its thumb
 * takes, as `start` and `size`. The thumb is as tall as the share of the tree shown, a row at least, and
 * stands at the top with the first row and at the bottom with the last. No bar (size 0) when all rows fit.
 */
export function scrollThumb (total: number, top: number, room: number) {
  if (room < 1 || total <= room) return { start: 0, size: 0 }
  const size = Math.max(1, Math.min(room, Math.round(room * room / total)))
  const start = Math.round(Math.min(1, Math.max(0, top / (total - room))) * (room - size))
  return { start, size }
}

/** The wheel or the keys over the explorer: its tree moves under the disks, which stay. */
async function scrollExplorer ($: EngineInterface, by: number, bodyRows: number) {
  const state = await read($, explorer)
  const rows = treeRows(state)
  const room = explorerRoom(bodyRows)
  const top = windowTop(rows, windowTop(rows, state.top, room) + by, room)
  if (top !== state.top) await update($, explorer, now => ({ ...now, top }))
}

/** The files the explorer opens in the viewer when pressed: text, PDF and pictures. */
const VIEWABLE_EXTENSIONS = new Set([
  // Text and code, shown selectable.
  'txt', 'sh', 'bat', 'ps1', 'ts', 'tsx', 'js', 'jsx', 'cjs', 'mjs', 'json', 'lock', 'ini', 'po', 'poe', 'd', 'css', 'scss', 'less',
  // Drawn, with a switch to their source.
  'md', 'markdown', 'html', 'htm', 'svg',
  // Pictures and documents.
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'tif', 'tiff', 'xls', 'xlsx', 'xlsm', 'doc', 'docx',
  // Sound and video, played.
  'mp3', 'mpa', 'mp2', 'wav', 'm4a', 'aac', 'wma', 'ogg', 'oga', 'opus', 'flac', 'aif', 'aiff', 'mid', 'midi',
  'mp4', 'm4v', 'mov', 'avi', 'wmv', 'mkv', 'webm', 'mpg', 'mpeg', '3gp',
  // More text: settings, data, logs and leftovers.
  'yaml', 'yml', 'toml', 'xml', 'csv', 'tsv', 'cfg', 'conf', 'env', 'jsonl', 'log', 'tmp', 'bak',
  // Databases, shortcuts and binaries, described.
  'sqlite', 'sqlite3', 'db', 'db3', 'lnk', 'url', 'sys', 'crx'
])
const VIEWABLE_NAMES = new Set(['.gitignore', '.ds_store'])

/** Whether the explorer opens a file of this name in the viewer. */
export function isViewable (name: string) {
  // Every file: the kinds it knows it draws (VIEWABLE_EXTENSIONS, VIEWABLE_NAMES), any other it reads as
  // text when it is text (.py, .pem) and describes when it is not (an .exe, a zip's entries).
  return name.length > 0
}

/** A file of the tree to the clipboard as a file, to paste in Explorer or Finder; it says whether it went. */
async function copyFileToClipboard ($: EngineInterface, path: string) {
  // A file of another machine: its copy here goes to the clipboard, and its path there into the prompt.
  const remote = remoteOf(path)
  // A folder of another machine is not brought here to be taken: 📥 brings it where it is pasted.
  if (remote && (await kindAt($, path)) === 'dir') {
    await update($, explorer, now => ({ ...now, clip: path, clipKind: 'dir' }))
    $.ui.toast(`speedy-code: la carpeta ${path.split('/').pop() || remote.host} de ${remote.host} está lista para pegar con 📥.`)
    return
  }
  const file = await localFile($, path)
  if (!file) return
  const native = await nativePath($, file)
  const isWindows = (await osNow($)) === 'windows'
  const argv = isWindows
    ? [await windowsPowerShell($), '-NoProfile', '-NonInteractive', '-STA', '-Command', "Add-Type -AssemblyName System.Windows.Forms; $files = New-Object System.Collections.Specialized.StringCollection; [void]$files.Add($env:SPEEDY_FILE); [System.Windows.Forms.Clipboard]::SetFileDropList($files); 'copied'"]
    : MAC.copyFile(native)
  const result = await $.process.run(argv, { env: { SPEEDY_FILE: native } }).catch(() => undefined)
  const name = path.split('/').pop() ?? path
  // 📥 pastes what was taken last: a file or a folder of this machine, or a file of another one.
  if (result?.stdout.trim() === 'copied') {
    const clipKind = remote ? 'file' : (await kindAt($, path)) === 'dir' ? 'dir' : 'file'
    await update($, explorer, now => ({ ...now, clip: path, clipKind }))
  }
  if (remote) {
    await insertInPrompt($, path, ' ')
    $.ui.toast(result?.stdout.trim() === 'copied' ? `speedy-code: la ruta de ${name} en ${remote.host} está en el prompt y una copia suya en el portapapeles; pegala en una carpeta.` : `speedy-code: la ruta de ${name} en ${remote.host} está en el prompt; no pude copiar el archivo al portapapeles.`)
    return
  }
  // The file is attached to the prompt too, as Claude Code mentions one: @path.
  await insertInPrompt($, fileMention(native), ' ')
  $.ui.toast(result?.stdout.trim() === 'copied' ? `speedy-code: ${name} está adjunto en el prompt y en el portapapeles; pegalo en una carpeta.` : `speedy-code: ${name} está adjunto en el prompt; no pude copiarlo al portapapeles.`)
}

/** A file's path to the clipboard, as the system writes it. */
async function copyPathToClipboard ($: EngineInterface, path: string, surface: Parameters<EngineInterface['ui']['copy']>[0]['surface']) {
  // A path of another machine is copied as that machine writes it.
  const remote = remoteOf(path)
  const native = remote ? thereOf(remote.path) : await nativePath($, path)
  const copied = await $.ui.copy({ text: native, surface }).catch(() => ({ isCopied: false }))
  // The path goes into the prompt as well, so it need not be pasted; the clipboard keeps it for elsewhere.
  await insertInPrompt($, native, ' ')
  $.ui.toast(copied.isCopied ? `speedy-code: la ruta ${native} está en el prompt y en el portapapeles` : `speedy-code: la ruta ${native} está en el prompt; no pude copiarla al portapapeles.`)
}


/**
 * Sends a file of the tree to the Recycle Bin, or the Mac's Trash, where it can be got back; then reads its folder again.
 * Said gone only once it is: one another program holds (its working folder, a file open in it) stays, and says so.
 */
async function trashFile ($: EngineInterface, path: string) {
  const name = path.split('/').pop() ?? path
  let said = ''
  if (remoteOf(path)) {
    // Another machine's file goes to that machine's Recycle Bin or Trash, by ssh.
    said = (await remoteSaid($, 'trash', path)) === 'trashed' ? 'deleted' : ''
  } else {
    const native = await nativePath($, path)
    const argv = (await osNow($)) === 'windows'
      ? [await windowsPowerShell($), '-NoProfile', '-NonInteractive', '-Command', "Add-Type -AssemblyName Microsoft.VisualBasic; try { if (Test-Path -LiteralPath $env:SPEEDY_FILE -PathType Container) { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($env:SPEEDY_FILE, 'OnlyErrorDialogs', 'SendToRecycleBin') } else { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($env:SPEEDY_FILE, 'OnlyErrorDialogs', 'SendToRecycleBin') } } catch { }; if (Test-Path -LiteralPath $env:SPEEDY_FILE) { 'kept' } else { 'deleted' }"]
      : MAC.trash(native)
    const result = await $.process.run(argv, { env: { SPEEDY_FILE: native } }).catch(() => undefined)
    said = result?.stdout.trim() ?? ''
  }
  if (said !== 'deleted') {
    $.ui.toast(`speedy-code: no pude mandar ${name} a la papelera.`)
    return
  }
  $.ui.toast(`speedy-code: ${name} fue a la papelera.`)
  const parent = path.slice(0, path.lastIndexOf('/')) || path
  const folder = parent.endsWith(':') ? `${parent}/` : parent
  const state = await read($, explorer)
  const key = pathKey(folder, state.caseless)
  const listed = await readFolder($, folder)
  await update($, explorer, now => filterMoved({ ...now, listed: { ...now.listed, [key]: listed } }, path))
}


/** Why a new file name cannot be used, or empty when it can: not empty, no folder separators, none of Windows' forbidden characters. */
export function badFileName (name: string) {
  const trimmed = name.trim()
  if (!trimmed) return 'el nombre está vacío'
  if (trimmed === '.' || trimmed === '..') return 'ese nombre no es válido'
  if (/[\\/:*?"<>|]/.test(trimmed) || /\p{Cc}/u.test(trimmed)) return 'el nombre no puede tener \\ / : * ? " < > |'
  return ''
}

/**
 * Asks in a dialog in the middle of the screen, as the viewer's popups stand: dialog.ps1 on Windows (the
 * rename with a field for the name and one for the extension), dialog.py's popup on macOS, drawn the same
 * (a dialog of macOS's own where pywebview is not installed). It answers `rename <base64 name>` (macOS's
 * own dialog: `name <name>`), `delete` or `cancel`. 📥's (`paste`) asks whether the file is copied or moved
 * into the folder `into`, then whether for sure, and answers `copy`, `move` or `cancel`. 📁's (`mkdir`) asks
 * the name of a folder to make in the folder `path`, and answers `mkdir <base64 name>` (macOS's own dialog:
 * `name <name>`) or `cancel`.
 */
async function askDialog ($: EngineInterface, mode: 'rename' | 'delete' | 'paste' | 'mkdir', path: string, into = '') {
  // A path of another machine is shown as the explorer writes it, `mac:/Users/ana`.
  const shown = async (one: string) => remoteOf(one) ? one : await nativePath($, one)
  const native = await shown(path)
  // A folder is renamed whole, with no extension, and goes to the trash with what it holds.
  const kind = mode === 'mkdir' || (await kindAt($, path)) === 'dir' ? 'dir' : 'file'
  const isWindows = (await osNow($)) === 'windows'
  const env = { SPEEDY_FILE: native, SPEEDY_MODE: mode, SPEEDY_KIND: kind, SPEEDY_TARGET: into ? await shown(into) : '' }
  const said = (stdout: string | undefined) => (stdout ?? '').split(/\r?\n/).map(line => line.trim()).find(Boolean)
  // macOS: dialog.py's popup, drawn as dialog.ps1's. With no pywebview it says nothing, and macOS's own dialog asks.
  if (!isWindows) {
    const popup = await $.process.run([await python($), `${$.plugin.root}/hooks/dialog.py`], { env }).catch(() => undefined)
    const answer = said(popup?.stdout)
    if (answer) return answer
  }
  const argv = isWindows
    ? [await windowsPowerShell($), '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/hooks/dialog.ps1`]
    : mode === 'paste' ? MAC.pasteDialog(path.split('/').pop() ?? path, into) : MAC.dialog(mode, path.split('/').pop() ?? path)
  const result = await $.process.run(argv, { env }).catch(() => undefined)
  return said(result?.stdout) ?? 'cancel'
}

/** The folder a file of the tree is in: a disk's root keeps its `/`. */
const folderOf = (path: string) => {
  const parent = path.slice(0, path.lastIndexOf('/'))
  if (parent === '') return '/'
  return parent.endsWith(':') ? `${parent}/` : parent
}

/**
 * 📥: what 📋 took last is copied or moved into a row's folder (a file's row: the folder it is in), once the
 * dialog asked which, and whether for sure. Nothing is written over and a folder does not go into itself.
 * Moved, nothing is taken any more. It goes across machines too, by remote.py: from another machine here,
 * from here to it, or within it; not from one machine to another one.
 */
async function pasteInto ($: EngineInterface, path: string) {
  const state = await read($, explorer)
  const clip = state.clip
  if (!clip) {
    $.ui.toast('speedy-code: primero copiá un archivo o una carpeta con 📋.')
    return
  }
  const name = clip.split('/').pop() ?? clip
  const kind = await kindAt($, clip)
  if (!kind) {
    $.ui.toast(`speedy-code: ${name} ya no está donde se copió.`)
    await update($, explorer, now => ({ ...now, clip: undefined, clipKind: undefined }))
    return
  }
  const folder = (await kindAt($, path)) === 'dir' ? path : folderOf(path)
  const from = remoteOf(clip)
  const to = remoteOf(folder)
  if (from && to && from.host !== to.host) {
    $.ui.toast(`speedy-code: de ${from.host} a ${to.host} no se pega: traelo primero a esta máquina.`)
    return
  }
  const target = joinPath(folder, name)
  const key = (one: string) => pathKey(one, state.caseless)
  if (key(folderOf(clip)) === key(folder)) {
    $.ui.toast(`speedy-code: ${name} ya está en esa carpeta.`)
    return
  }
  if (kind === 'dir' && isUnder(key(folder), key(clip))) {
    $.ui.toast(`speedy-code: ${name} no puede ir dentro de sí misma.`)
    return
  }
  if (await kindAt($, target)) {
    $.ui.toast(`speedy-code: ya hay un ${name} en esa carpeta.`)
    return
  }
  const verb = await askDialog($, 'paste', clip, folder)
  if (verb !== 'copy' && verb !== 'move') return
  const isMove = verb === 'move'
  const there = remoteOf(target)
  // Across machines it takes a while: it says it started.
  if (from || there) $.ui.toast(`speedy-code: ${isMove ? 'moviendo' : 'copiando'} ${name}…`)
  const remote = `${$.plugin.root}/hooks/remote.py`
  const run = from && there
    ? { argv: [await python($), remote, 'paste'], env: { SPEEDY_HOST: from.host, SPEEDY_PATH: from.path, SPEEDY_TARGET: there.path, SPEEDY_VERB: verb } }
    : from
      ? { argv: [await python($), remote, 'pull'], env: { SPEEDY_HOST: from.host, SPEEDY_PATH: from.path, SPEEDY_TARGET: await nativePath($, target), SPEEDY_VERB: verb } }
      : there
        ? { argv: [await python($), remote, 'push'], env: { SPEEDY_HOST: there.host, SPEEDY_FILE: await nativePath($, clip), SPEEDY_PATH: there.path, SPEEDY_VERB: verb } }
        : { argv: [await python($), `${$.plugin.root}/hooks/paste.py`], env: { SPEEDY_FILE: await nativePath($, clip), SPEEDY_TARGET: await nativePath($, target), SPEEDY_VERB: verb } }
  const result = await $.process.run(run.argv, { env: { ...run.env, PYTHONIOENCODING: 'utf-8' } }).catch(() => undefined)
  const last = (result?.stdout ?? '').trim().split(/\r?\n/).pop() ?? ''
  // paste.py says the word itself; remote.py says it in JSON.
  let said = last
  try {
    said = String(saidField(JSON.parse(last), 'said') ?? last)
  } catch {
    // The word itself.
  }
  if (said !== 'done' && said !== 'kept') {
    $.ui.toast(`speedy-code: no pude ${isMove ? 'mover' : 'copiar'} ${name}.`)
    return
  }
  // Copied, but what was to move could not be removed where it was.
  const isMoved = isMove && said === 'done'
  $.ui.toast(said === 'kept'
    ? `speedy-code: ${name} se copió a ${driveLabel(folder)}, pero no pude quitarlo de donde estaba.`
    : `speedy-code: ${name} se ${isMove ? 'movió' : 'copió'} a ${driveLabel(folder)}.`)
  // The folder it went into is read again, and opened to show it; moved, the one it left too.
  const folders = isMoved ? [folder, folderOf(clip)] : [folder]
  const reread = await Promise.all(folders.map(async one => [key(one), await readFolder($, one)] as const))
  await update($, explorer, now => {
    const next = { ...now, listed: { ...now.listed, ...Object.fromEntries(reread) }, open: now.open.includes(key(folder)) ? now.open : [...now.open, key(folder)] }
    return isMoved ? filterMoved({ ...next, clip: undefined, clipKind: undefined }, clip, target) : next
  })
}

/** What remote.py said it did (`said`) to a path on another machine, by ssh: `rename`, `trash` or `mkdir`. */
async function remoteSaid ($: EngineInterface, mode: 'rename' | 'trash' | 'mkdir', path: string, more: Record<string, string> = {}) {
  const remote = remoteOf(path)
  if (!remote) return ''
  const result = await $.process.run([await python($), `${$.plugin.root}/hooks/remote.py`, mode], { env: { SPEEDY_HOST: remote.host, SPEEDY_PATH: remote.path, PYTHONIOENCODING: 'utf-8', ...more } }).catch(() => undefined)
  try {
    return String(saidField(JSON.parse((result?.stdout ?? '').trim().split(/\r?\n/).pop() ?? ''), 'said') ?? '')
  } catch {
    return ''
  }
}

/** ✏: the rename dialog, then the rename it asked for. */
async function askRename ($: EngineInterface, path: string) {
  const answer = await askDialog($, 'rename', path)
  const name = answer.startsWith('rename ') ? fromBase64Utf8(answer.slice('rename '.length)) : answer.startsWith('name ') ? answer.slice('name '.length) : ''
  if (name) await renameFile($, path, name)
}

/**
 * 📁: the dialog asks the new folder's name, then the folder is made where the row is: in a folder, inside it;
 * on a file, in the folder it is in; on another machine too, by remote.py. The folder it went into is read
 * again and opened, to show it.
 */
async function askNewFolder ($: EngineInterface, path: string) {
  const folder = (await kindAt($, path)) === 'dir' ? path : folderOf(path)
  const answer = await askDialog($, 'mkdir', folder)
  const name = (answer.startsWith('mkdir ') ? fromBase64Utf8(answer.slice('mkdir '.length)) : answer.startsWith('name ') ? answer.slice('name '.length) : '').trim()
  if (name) await makeFolder($, folder, name)
}

/** Makes the folder `name` in `folder`; nothing there is written over. Then reads `folder` again, opened. */
async function makeFolder ($: EngineInterface, folder: string, name: string) {
  const why = badFileName(name)
  if (why) {
    $.ui.toast(`speedy-code: no creé la carpeta: ${why}.`)
    return
  }
  const target = joinPath(folder, name)
  if (await kindAt($, target)) {
    $.ui.toast(`speedy-code: ya hay un ${name} en esa carpeta.`)
    return
  }
  let said = ''
  if (remoteOf(target)) {
    // Another machine's folder is made there, by ssh.
    said = await remoteSaid($, 'mkdir', target)
  } else {
    const argv = (await osNow($)) === 'windows'
      ? [await windowsPowerShell($), '-NoProfile', '-NonInteractive', '-Command', "if (Test-Path -LiteralPath $env:SPEEDY_TARGET) { 'exists' } else { [void][IO.Directory]::CreateDirectory($env:SPEEDY_TARGET); 'made' }"]
      : ['/bin/sh', '-c', 'mkdir -- "$SPEEDY_TARGET" && echo made']
    const result = await $.process.run(argv, { env: { SPEEDY_TARGET: await nativePath($, target) } }).catch(() => undefined)
    said = result?.stdout.trim() ?? ''
  }
  if (said === 'exists') {
    $.ui.toast(`speedy-code: ya hay un ${name} en esa carpeta.`)
    return
  }
  if (said !== 'made') {
    $.ui.toast(`speedy-code: no pude crear la carpeta ${name}.`)
    return
  }
  $.ui.toast(`speedy-code: se creó la carpeta ${name} en ${driveLabel(folder)}.`)
  const state = await read($, explorer)
  const key = pathKey(folder, state.caseless)
  const listed = await readFolder($, folder)
  await update($, explorer, now => ({ ...now, listed: { ...now.listed, [key]: listed }, open: now.open.includes(key) ? now.open : [...now.open, key] }))
}

/** 🗑: the dialog that asks, then the trash when it said yes. */
async function askTrash ($: EngineInterface, path: string) {
  if ((await askDialog($, 'delete', path)) === 'delete') await trashFile($, path)
}

/** Renames a file of the tree in its folder, then reads the folder again. The same name, or none, leaves it as it was. */
async function renameFile ($: EngineInterface, path: string, wanted: string) {
  const name = wanted.trim()
  const old = path.split('/').pop() ?? path
  if (name === old) return
  const why = badFileName(name)
  if (why) {
    $.ui.toast(`speedy-code: no renombré ${old}: ${why}.`)
    return
  }
  const folder = path.slice(0, path.lastIndexOf('/'))
  const target = joinPath(folder.endsWith(':') ? `${folder}/` : folder, name)
  // A different name that is the same file whatever its case (Windows) is a rename too; another file is not overwritten.
  if (name.toLowerCase() !== old.toLowerCase() && await kindAt($, target)) {
    $.ui.toast(`speedy-code: ya hay un archivo ${name} en esa carpeta.`)
    return
  }
  let said = ''
  if (remoteOf(path)) {
    // Another machine's file is renamed there, by ssh.
    said = await remoteSaid($, 'rename', path, { SPEEDY_NAME: name })
  } else {
    const argv = (await osNow($)) === 'windows'
      ? [await windowsPowerShell($), '-NoProfile', '-NonInteractive', '-Command', "Rename-Item -LiteralPath $env:SPEEDY_FILE -NewName $env:SPEEDY_NAME -ErrorAction Stop; 'renamed'"]
      : ['/bin/sh', '-c', 'mv -n -- "$SPEEDY_FILE" "$SPEEDY_TARGET" && echo renamed']
    const result = await $.process.run(argv, { env: { SPEEDY_FILE: await nativePath($, path), SPEEDY_NAME: name, SPEEDY_TARGET: await nativePath($, target) } }).catch(() => undefined)
    said = result?.stdout.trim() ?? ''
  }
  if (said === 'exists') {
    $.ui.toast(`speedy-code: ya hay un archivo ${name} en esa carpeta.`)
    return
  }
  if (said !== 'renamed') {
    $.ui.toast(`speedy-code: no pude renombrar ${old}.`)
    return
  }
  $.ui.toast(`speedy-code: ${old} ahora se llama ${name}.`)
  const parent = folder.endsWith(':') ? `${folder}/` : folder
  const state = await read($, explorer)
  const key = pathKey(parent, state.caseless)
  const listed = await readFolder($, parent)
  await update($, explorer, now => filterMoved({ ...now, listed: { ...now.listed, [key]: listed } }, path, target))
}

/**
 * What remote.py answers about a path on another machine: its folder's entries (`list`), what it is (`stat`),
 * its copy here (`fetch`), or the machines there are (`hosts`). Nothing when the machine was not reached.
 */
async function askRemote ($: EngineInterface, mode: 'hosts' | 'mounts' | 'list' | 'stat' | 'fetch' | 'home', path = ''): Promise<unknown> {
  const remote = remoteOf(path)
  const result = await $.process.run([await python($), `${$.plugin.root}/hooks/remote.py`, mode], { env: { SPEEDY_HOST: remote?.host ?? '', SPEEDY_PATH: remote?.path ?? '' } }).catch(() => undefined)
  try {
    return JSON.parse((result?.stdout ?? '').trim().split(/\r?\n/).pop() ?? '') as unknown
  } catch {
    return undefined
  }
}

/** One field of what remote.py answered, when it is there. */
const saidField = (said: unknown, field: string): unknown => said && typeof said === 'object' && !Array.isArray(said) ? (said as Record<string, unknown>)[field] : undefined

/** The disks of the other machines, `mac:/`: those remote.py names. */
async function remoteDrives ($: EngineInterface) {
  const said = await askRemote($, 'hosts')
  return Array.isArray(said) ? said.filter((one): one is string => typeof one === 'string' && /^[A-Za-z][\w.-]+$/.test(one)).map(host => `${host}:/`) : []
}

/** Where each other machine's disk opens, once it said: its person's folder; `/` for one with Windows. */
const remoteHomes = new Map<string, string>()

/** Where another machine's disk opens; empty when the machine did not say, and it is asked again the next time. */
async function remoteHome ($: EngineInterface, drive: string) {
  const remote = remoteOf(drive)
  if (!remote) return ''
  const known = remoteHomes.get(remote.host)
  if (known !== undefined) return known
  const home = saidField(await askRemote($, 'home', drive), 'home')
  if (typeof home !== 'string' || !home.startsWith('/')) return ''
  remoteHomes.set(remote.host, home)
  return home
}

/** What is at a path, here or on another machine: a folder, a file, or nothing. */
async function kindAt ($: EngineInterface, path: string): Promise<'dir' | 'file' | undefined> {
  if (remoteOf(path)) {
    const kind = saidField(await askRemote($, 'stat', path), 'kind')
    return kind === 'dir' || kind === 'file' ? kind : undefined
  }
  const stat = await $.fs.stat(path).catch(() => undefined)
  return stat ? (stat.kind === 'dir' ? 'dir' : 'file') : undefined
}

/**
 * A file as the viewer and the clipboard read it: itself, or the copy of one on another machine, fetched
 * into the temporary folder. Empty when it could not be fetched, and a toast says so.
 */
async function localFile ($: EngineInterface, path: string) {
  const remote = remoteOf(path)
  if (!remote) return path
  const name = path.split('/').pop() ?? path
  $.ui.toast(`speedy-code: trayendo ${name} de ${remote.host}…`)
  const file = saidField(await askRemote($, 'fetch', path), 'file')
  if (typeof file === 'string' && file) return file
  $.ui.toast(`speedy-code: no pude traer ${name} de ${remote.host}.`)
  return ''
}

/** How long a file pressed stays green when its popup never says it is up. */
const OPENING_MOST_MS = 20000

/**
 * A file of the tree pressed: the viewer shows it, a file of another machine once its copy is here. Its name
 * is green from the press until the popup is up, however long that takes; then the file stays marked yellow,
 * as the one being looked at, until another press.
 */
async function viewTreeFile ($: EngineInterface, path: string) {
  const key = `speedy:explorer-view:${path}`
  await update($, explorerFlash, () => key)
  const isOver = async (isShown: boolean) => {
    if ((await read($, explorerFlash)) !== key) return
    await update($, explorerFlash, () => '')
    if (isShown) await update($, explorer, now => ({ ...now, viewed: pathKey(path, now.caseless) }))
  }
  void $.clock.sleep(OPENING_MOST_MS).then(() => isOver(false), () => undefined)
  try {
    const file = await localFile($, path)
    if (file) await runViewer($, 'view_file.ps1', file, '', () => { void isOver(true) })
  } finally {
    await isOver(false).catch(() => undefined)
  }
}

/** A folder read for the tree; `denied` when it cannot be read. */
async function readFolder ($: EngineInterface, path: string): Promise<ExplorerListing | 'denied'> {
  if (remoteOf(path)) {
    const entries = saidField(await askRemote($, 'list', path), 'entries')
    return Array.isArray(entries) ? listingOf(entries as FsEntry[]) : 'denied'
  }
  try {
    return listingOf(await $.fs.list(path))
  } catch {
    return 'denied'
  }
}

/** A Mac's disks without those that are another machine's disk mounted over the network (`mounted`, as remote.py names them). */
export const withoutMounted = (own: readonly string[], mounted: unknown) => {
  const left = new Set(Array.isArray(mounted) ? mounted.filter((one): one is string => typeof one === 'string').map(one => one.replace(/\/+$/, '')) : [])
  return own.filter(drive => drive === '/' || !left.has(drive.replace(/\/+$/, '')))
}

/**
 * The disks there are: this machine's, then those of the other machines reached by ssh. Where there is one of
 * those, a Mac's folders that are another machine's disk mounted over the network are left out: that disk is
 * shown once, under its machine.
 */
async function readDrives ($: EngineInterface, os: Os) {
  const [own, remote] = await Promise.all([ownDrives($, os), remoteDrives($)])
  if (os === 'windows' || remote.length === 0) return [...own, ...remote]
  return [...withoutMounted(own, await askRemote($, 'mounts')), ...remote]
}

/** This machine's disks: each lettered root that answers on Windows; `/` and each volume mounted on a Mac. */
async function ownDrives ($: EngineInterface, os: Os) {
  if (os === 'windows') {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    const found = await Promise.all(letters.map(letter => $.fs.stat(`${letter}:/`).then(stat => stat.kind === 'dir' ? `${letter}:/` : '', () => '')))
    return found.filter(Boolean)
  }
  // The Mac's own disk is under /Volumes too, as a link to /: it is / already.
  const volumes = await $.fs.list('/Volumes').catch(() => [] as FsEntry[])
  return ['/', ...volumes.filter(volume => volume.kind === 'dir' && !volume.isLink).map(volume => `/Volumes/${volume.name}`)]
}

/**
 * The footer's folder: opens the explorer beside the chat, open down to the session's folder and read
 * afresh; clicked while it is open, it closes it.
 */
async function toggleExplorer ($: EngineInterface) {
  const panes = await $.ui.panes().catch(() => [])
  if (panes.some(pane => pane.id === EXPLORER_PANE)) {
    filtering?.abort()
    await $.ui.close({ id: EXPLORER_PANE }).catch(() => undefined)
    return
  }
  await showExplorer($)
}

/**
 * Opens the explorer beside the chat, open down to `folder` (the session's, when none is given) and read
 * afresh, its filter off; open already, it is drawn again for that folder. A session opens it as it starts,
 * and a new conversation or a move (/clear, /cd) shows it on the session's folder.
 */
async function showExplorer ($: EngineInterface, folder = '') {
  filtering?.abort()
  const os = await osNow($)
  const caseless = os === 'windows'
  const here = slashed(folder || place.cwd || (await $.session.cwd().catch(() => '')))
  const drives = await readDrives($, os)
  const drive = driveOf(here, drives, caseless)
  const chain = drive ? chainOf(here, drive) : []
  const chainRead = await Promise.all(chain.map(async path => [pathKey(path, caseless), await readFolder($, path)] as const))
  // What 📋 took stays taken while the explorer is closed.
  await update($, explorer, now => ({ drives, drive, open: chainRead.map(([key]) => key), listed: Object.fromEntries(chainRead), here, caseless, top: -1, clip: now.clip, clipKind: now.clipKind }))
  await $.ui.open({ id: EXPLORER_PANE, title: 'Explorador', columns: explorerColumns(terminalColumns), closeOnEscape: true }).catch(() => undefined)
}

/** What the filter's field says while empty. */
export const FILTER_HINT = 'filtro: *.pdf, a*.docx'

/** The search a filter runs, while it does: aborted, it ends at its next line. */
let filtering: AbortController | undefined
/** What that search is held by: a file here, or a token on another machine. */
let filterHold: { file?: string; host?: string; token?: string } | undefined

/**
 * The filter's field, Enter: the disk shown is searched for the files whose names match (find_files.py, the
 * session's folder first), and the tree is drawn with those alone as they are found. An empty field clears it.
 */
async function filterExplorer ($: EngineInterface, text: string) {
  const pattern = filterPattern(text)
  if (!pattern) return clearFilter($)
  filtering?.abort()
  const controller = new AbortController()
  filtering = controller
  const { drive, here } = await read($, explorer)
  if (!drive) return
  await update($, explorer, now => ({ ...now, top: 0, found: undefined, filter: { pattern, paths: [], seen: 0, isBusy: true, isCut: false, closed: [] } }))
  // What a line of the search adds, unless another filter took its place meanwhile.
  // A search held says nothing new, only that it is still there: it stays held until let go, or until it ends.
  const add = (paths: string[], seen: number, isBusy: boolean, isCut: boolean) => update($, explorer, now => now.filter && filtering === controller
    ? { ...now, filter: { ...now.filter, paths: paths.length > 0 ? [...now.filter.paths, ...paths] : now.filter.paths, seen: Math.max(seen, now.filter.seen), isBusy: isBusy && !now.filter.isPaused, isPaused: isBusy && now.filter.isPaused === true, isCut } }
    : now)
  try {
    // Another machine's disk is searched there: remote.py runs find_files.py on it, by ssh.
    const remote = remoteOf(drive)
    const token = crypto.randomUUID()
    const hold = remote ? { host: remote.host, token } : { file: await homeFile($, `${CONTROL_DIR}/find-${token}.txt`) }
    filterHold = hold
    const search = $.process.spawn(remote
      ? { argv: [await python($), `${$.plugin.root}/hooks/remote.py`, 'find'], env: { SPEEDY_HOST: remote.host, SPEEDY_PATTERN: pattern, SPEEDY_MOST: String(FILTER_MOST), SPEEDY_TOKEN: token } }
      : {
          argv: [await python($), `${$.plugin.root}/hooks/find_files.py`],
          env: { SPEEDY_ROOT: await nativePath($, drive), SPEEDY_FIRST: await nativePath($, here), SPEEDY_PATTERN: pattern, SPEEDY_MOST: String(FILTER_MOST), SPEEDY_PAUSE: await nativePath($, hold.file ?? '') }
        })
    let pending = ''
    for await (const { stream, text: piece } of search) {
      if (controller.signal.aborted) break
      if (stream !== 'stdout') continue
      pending += piece
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() ?? ''
      for (const line of lines) {
        const said = filterLine(line)
        if (said) await add(said.paths, said.seen, !said.isDone, said.isCut)
      }
    }
  } catch (error) {
    $.ui.log(`speedy: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
  } finally {
    if (filtering === controller) {
      await update($, explorer, now => now.filter?.isBusy || now.filter?.isPaused ? { ...now, filter: { ...now.filter, isBusy: false, isPaused: false } } : now)
      filtering = undefined
      filterHold = undefined
    }
  }
}

/** A line find_files.py said: the files found since the one before, the entries seen, whether it ended and whether cut short. */
export function filterLine (line: string) {
  try {
    const said = JSON.parse(line) as { paths?: unknown; seen?: unknown; done?: unknown; cut?: unknown } | null
    if (!said || typeof said !== 'object') return undefined
    const paths = Array.isArray(said.paths) ? said.paths.filter((one): one is string => typeof one === 'string') : []
    return { paths, seen: typeof said.seen === 'number' ? said.seen : 0, isDone: said.done === true, isCut: said.cut === true }
  } catch {
    return undefined
  }
}

/** The filter's ×: the search ends, the field empties and the whole tree is back as it was. */
async function clearFilter ($: EngineInterface) {
  filtering?.abort()
  filtering = undefined
  await update($, explorer, now => ({ ...now, filter: undefined, cleared: (now.cleared ?? 0) + 1, top: -1 }))
}

/**
 * ‖ pausar, beside the filter's ×: the search waits where it is, and the tree keeps the files found so far.
 * Pressed again, as ▶ seguir, the search goes on from there. It is held by the file it was started with, or,
 * on another machine, by remote.py.
 */
async function pauseFilter ($: EngineInterface) {
  const { filter } = await read($, explorer)
  const hold = filterHold
  if (!filter || !hold || !filtering || !(filter.isBusy || filter.isPaused)) return
  const isHeld = !filter.isPaused
  await update($, explorer, now => now.filter ? { ...now, filter: { ...now.filter, isBusy: !isHeld, isPaused: isHeld } } : now)
  if (hold.file) await $.fs.write(hold.file, isHeld ? '1' : '0').catch(() => undefined)
  else await $.process.run([await python($), `${$.plugin.root}/hooks/remote.py`, 'pause'], { env: { SPEEDY_HOST: hold.host ?? '', SPEEDY_TOKEN: hold.token ?? '', SPEEDY_PAUSED: isHeld ? '1' : '0' } }).catch(() => undefined)
}

/** What the explorer's field says while empty: a path as the system writes one. */
export function gotoHint (isWindows: boolean) {
  return `pegá una ruta y Enter: ${isWindows ? 'D:\\carpeta\\archivo' : '/Users/carpeta/archivo'}`
}

/** A tool's icon on exactly two cells: an emoji, or a Nerd Fonts glyph with the cell it spills over. */
export function toolLabel (icon: string, isGlyph: boolean) {
  const text = isGlyph ? `${icon}\u00a0` : icon
  return text + ' '.repeat(Math.max(0, 2 - cells(text)))
}

/** A file row's hover group: its name and tools light together. A path may be long; a group name is 64 at most. */
export function hoverScope (path: string) {
  let hash = 5381
  for (const char of path) hash = ((hash * 33) ^ char.codePointAt(0)!) >>> 0
  return `explorer:${hash.toString(36)}:${path.length}`
}

/**
 * Any press in the explorer takes the mark off the path the field found: from then on the yellow fill is
 * the pointer's alone, and follows it.
 */
async function forgetFound ($: EngineInterface) {
  const { found, viewed } = await read($, explorer)
  if (found !== undefined || viewed !== undefined) await update($, explorer, now => ({ ...now, found: undefined, viewed: undefined }))
}

/** A folder of the tree pressed: open, it closes; closed, it opens and is read afresh. */
async function toggleTreeFolder ($: EngineInterface, path: string) {
  await forgetFound($)
  const state = await read($, explorer)
  const key = pathKey(path, state.caseless)
  // In a filter's tree every folder is open: a press closes it, and another opens it again.
  if (state.filter) {
    await update($, explorer, now => now.filter
      ? { ...now, filter: { ...now.filter, closed: now.filter.closed.includes(key) ? now.filter.closed.filter(one => one !== key) : [...now.filter.closed, key] } }
      : now)
    return
  }
  if (state.open.includes(key)) {
    await update($, explorer, now => ({ ...now, open: now.open.filter(one => one !== key) }))
    return
  }
  await update($, explorer, now => ({ ...now, open: [...now.open, key] }))
  const fresh = await readOpenTree($, path, await read($, explorer))
  await update($, explorer, now => ({ ...now, listed: { ...now.listed, ...fresh } }))
}

/**
 * A folder read afresh with every folder still open under it, all at once, here or on another machine: what
 * came and went on the disk while it was closed shows when it opens again.
 */
async function readOpenTree ($: EngineInterface, path: string, state: Explorer) {
  const fresh: Explorer['listed'] = {}
  const walk = async (folder: string): Promise<void> => {
    const listed = await readFolder($, folder)
    fresh[pathKey(folder, state.caseless)] = listed
    if (listed === 'denied') return
    const open = listed.entries
      .filter(entry => entry.kind === 'dir' && state.open.includes(pathKey(joinPath(folder, entry.name), state.caseless)))
    await Promise.all(open.map(entry => walk(joinPath(folder, entry.name))))
  }
  await walk(path)
  return fresh
}

/**
 * Collapses every disk: on the session's, every folder closes but those down to the session's folder; on the
 * others, all close but the disk's root, so each shows its first level. The disk shown stays shown: the
 * session's puts its folder in the middle again, another goes to its top.
 */
async function collapseExplorer ($: EngineInterface) {
  await update($, explorer, now => {
    const home = driveOf(now.here, now.drives, now.caseless)
    const chain = home ? chainOf(now.here, home).map(path => pathKey(path, now.caseless)) : []
    const drive = now.drive || home
    const root = pathKey(drive, now.caseless)
    const open = chain.includes(root) || !drive ? chain : [...chain, root]
    return { ...now, drive, open, top: drive === home ? -1 : 0, found: undefined }
  })
}

/**
 * A path as pasted in the explorer's field, `D:\Excel\rand.xlsx` or `"C:/a b/c"`: its quotes, its spaces and
 * a mention's `@` off, `/` for `\`, a disk's root ending in `/` and any other folder without one.
 */
export function pastedPath (text: string) {
  const path = slashed(text.trim().replace(/^@/, '').replace(/^["']+|["']+$/g, '').trim())
  if (/^[A-Za-z]:\/?$/.test(path)) return `${path.slice(0, 2)}/`
  // Another machine's disk, `mac:` or `mac:/`: its root too ends in `/`.
  if (/^[A-Za-z][\w.-]+:\/*$/.test(path)) return `${path.slice(0, path.indexOf(':'))}:/`
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

/**
 * A path pasted in the field: the tree opens down to it, on its disk, and puts it in the middle, marked; for
 * a file its folder opens and the file is the row marked. A path not absolute is taken from the session's folder.
 */
async function goToPath ($: EngineInterface, text: string) {
  const state = await read($, explorer)
  const pasted = pastedPath(text)
  if (!pasted) return
  const isAbsolute = /^[A-Za-z]:\//.test(pasted) || pasted.startsWith('/') || remoteOf(pasted) !== undefined
  const path = isAbsolute ? pasted : joinPath(state.here, pasted)
  const kind = await kindAt($, path)
  if (!kind) {
    $.ui.toast(`speedy-code: no existe ${pasted}.`)
    return
  }
  const key = pathKey(path, state.caseless)
  const drive = state.drives
    .filter(one => isUnder(key, pathKey(one, state.caseless)))
    .sort((a, b) => b.length - a.length)[0]
  if (!drive) {
    $.ui.toast(`speedy-code: ${pasted} no está en ninguno de los discos del explorador.`)
    return
  }
  const isFolder = kind === 'dir' || key === pathKey(drive, state.caseless)
  const folder = isFolder ? path : path.slice(0, path.lastIndexOf('/')) || drive
  const chain = chainOf(folder, drive)
  // Each folder down to it read afresh: what was pasted may be new.
  const chainRead = await Promise.all(chain.map(async one => [pathKey(one, state.caseless), await readFolder($, one)] as const))
  const listed: Explorer['listed'] = Object.fromEntries(chainRead)
  // A file past the entries a big folder shows is shown all the same: it is the one asked for.
  const folderKey = pathKey(folder, state.caseless)
  const name = path.slice(path.lastIndexOf('/') + 1)
  const holding = listed[folderKey]
  if (!isFolder && holding && holding !== 'denied' && !holding.entries.some(entry => pathKey(entry.name, state.caseless) === pathKey(name, state.caseless))) {
    listed[folderKey] = { entries: [...holding.entries, { name, kind: 'file' }], left: Math.max(0, holding.left - 1) }
  }
  const opened = chainRead.map(([one]) => one)
  // A path gone to is shown in the whole tree: a filter is cleared.
  filtering?.abort()
  await update($, explorer, now => ({
    ...now,
    filter: undefined,
    cleared: now.filter ? (now.cleared ?? 0) + 1 : now.cleared,
    drive,
    open: [...now.open.filter(one => !opened.includes(one)), ...opened],
    listed: { ...now.listed, ...listed },
    found: key,
    top: -1
  }))
}

/** A disk pressed: its tree is shown, its root open; each disk keeps what was open in it. The session's disk
 * shows the session's folder in the middle again; another, its top. Another machine's opens down to its
 * person's folder, in the middle and marked; one with Windows at its root, where its disks are. */
async function pickDrive ($: EngineInterface, drive: string) {
  await forgetFound($)
  const state = await read($, explorer)
  const key = pathKey(drive, state.caseless)
  const top = driveOf(state.here, state.drives, state.caseless) === drive ? -1 : 0
  await update($, explorer, now => ({ ...now, drive, top, open: now.open.includes(key) ? now.open : [...now.open, key] }))
  // A filter follows the disk: it is searched as the one before was.
  if (state.filter && drive !== state.drive) void filterExplorer($, state.filter.pattern)
  const home = remoteOf(drive) && !state.filter ? remoteHome($, drive) : undefined
  if (state.listed[key] === undefined) {
    const listed = await readFolder($, drive)
    await update($, explorer, now => ({ ...now, listed: { ...now.listed, [key]: listed } }))
  }
  const where = await home
  // Unless another disk was pressed meanwhile.
  if (where && where !== '/' && (await read($, explorer)).drive === drive) await goToPath($, `${drive.slice(0, -1)}${where}`)
}

/** The explorer pane: the disks above, the one shown underlined; under them its tree, the session's folder marked ●.
 * A file the viewer shows is drawn yellow and opens it when pressed; the others are dim. */
async function explorerPane ($: EngineInterface, e: Drawn, columns: number, bodyRows: number) {
  const state = await read($, explorer)
  const flashed = await read($, explorerFlash)
  const elements = $.ui.resolve(e)
  const { Box, Button, Text } = elements
  // The file tools are Clients where the surface draws one; elsewhere, their labels alone.
  const Client = 'Client' in elements ? elements.Client : undefined
  const Input = 'Input' in elements ? elements.Input : undefined
  const width = Math.max(12, columns || EXPLORER_COLUMNS)
  // Beside the disks: collapse every disk; the session's stays open down to its folder.
  const collapseLabel = ` ${isGlyphs ? '\uf066' : '⊟'} `
  const unfilterLabel = ' × limpiar '
  // Beside it: stops a search that still runs. Lit only while one does.
  // Held, it is the one that lets it go on from where it was.
  const pauseLabel = state.filter?.isPaused ? ' ▸ seguir ' : ' ‖ pausar '
  const pauseColor = state.filter?.isPaused ? FLASH_COLOR : state.filter?.isBusy ? EXPLORER_VIEWABLE_COLOR : UNFILTER_IDLE_COLOR
  // The tree draws only the rows in its window, so the body never scrolls and the disks stay on top.
  const rows = treeRows(state)
  const room = explorerRoom(bodyRows)
  const top = windowTop(rows, state.top, room)
  // A tree taller than its room has a scroll bar in its last column, and its rows are a cell narrower.
  const thumb = scrollThumb(rows.length, top, room)
  // ⚙ → Ver labels: what each tool does, when the pointer is on it.
  const isLabeled = await read($, hasLabels)
  const treeWidth = width - (thumb.size > 0 ? EXPLORER_BAR_WIDTH : 0)
  return (
    <Box flexDirection="column" width={width}>
      <Box flexDirection="row" columnGap={1}>
        {state.drives.map(drive => {
          const isShown = drive === state.drive
          return (
            <Button key={`explorer-drive:${drive}`} plain onPress={() => { void pickDrive($, drive) }}>
              <Text bold={isShown} underline={isShown} color={isShown ? FOLDER_COLOR : undefined} dimColor={!isShown}>{` ${driveLabel(drive)} `}</Text>
            </Button>
          )
        })}
        {Client
          ? <Client key="speedy:explorer-collapse:" module="./control.tsx" width={cells(collapseLabel)} props={{ label: collapseLabel, color: flashed === 'speedy:explorer-collapse:' ? FLASH_COLOR : EXPLORER_DIR_COLOR, bold: true }} />
          : <Button key="explorer-collapse" plain onPress={() => { void collapseExplorer($) }}><Text color={EXPLORER_DIR_COLOR}>{collapseLabel}</Text></Button>}
        <Box flexGrow={1} />
        <Button key="explorer-system" plain onPress={() => { void openFolder($) }}>
          <Text dimColor>{' ↗ abrir en el sistema '}</Text>
        </Button>
      </Box>
      {/* A path pasted here, Enter, and the tree opens down to it: a folder, or a file in its folder. */}
      {Input
        ? (
          <Box width={width}>
            <Input key="explorer-goto" placeholder={gotoHint(state.caseless)} submitLabel="ir" onSubmit={value => { void goToPath($, value) }} />
          </Box>
          )
        : null}
      {/* The filter: a pattern, Enter, and the tree holds only the disk's files that match; × brings the whole tree back. */}
      {Input
        ? (
          <Box flexDirection="row" width={width}>
            <Box width={Math.max(4, width - cells(unfilterLabel) - cells(pauseLabel))}>
              <Input key={`explorer-filter:${state.cleared ?? 0}`} placeholder={FILTER_HINT} value={state.filter?.pattern ?? ''} submitLabel="filtrar" onSubmit={value => { void filterExplorer($, value) }} />
            </Box>
            {Client
              ? <Client key="speedy:explorer-unfilter:" module="./control.tsx" width={cells(unfilterLabel)} props={{ label: unfilterLabel, color: state.filter ? UNFILTER_COLOR : UNFILTER_IDLE_COLOR, bold: Boolean(state.filter) }} />
              : <Button key="explorer-unfilter" plain onPress={() => { void clearFilter($) }}><Text color={state.filter ? UNFILTER_COLOR : UNFILTER_IDLE_COLOR}>{unfilterLabel}</Text></Button>}
            {Client
              ? <Client key="speedy:explorer-pause:" module="./control.tsx" width={cells(pauseLabel)} props={{ label: pauseLabel, color: pauseColor, bold: Boolean(state.filter?.isBusy || state.filter?.isPaused) }} />
              : <Button key="explorer-pause" plain onPress={() => { void pauseFilter($) }}><Text color={pauseColor}>{pauseLabel}</Text></Button>}
          </Box>
          )
        : null}
      {/* The ribbon above the tree: the rule, and over it the label of the tool under the pointer, in its color,
          above that tool's column; every label is there hidden, and the tool's hover group shows its own. */}
      <Box width={width}>
        {state.filter
          ? <Text color={EXPLORER_VIEWABLE_COLOR} wrap="truncate-end">{`─${cutCells(filterNote(state.filter), Math.max(1, width - 2))}`.padEnd(width, '─')}</Text>
          : <Text dimColor>{'─'.repeat(width)}</Text>}
        {isLabeled && Client
          ? toolTips(state.clipKind).map(one => {
            const text = ` ${one.text} `
            const left = Math.max(0, Math.min(width - cells(text), treeWidth - EXPLORER_TOOLS_WIDTH + one.column + 1 - Math.floor(cells(text) / 2)))
            return (
              <Box key={`explorer-ribbon:${one.scope}`} position="absolute" top={0} left={left} display="none" hover={{ scope: one.scope, display: 'flex' }}>
                <Text color={LABEL_TEXT} backgroundColor={one.color} bold>{text}</Text>
              </Box>
            )
          })
          : null}
      </Box>
      <Box flexDirection="row" width={width}>
      <Box flexDirection="column" width={treeWidth}>
      {rows.slice(top, top + room).map(row => {
        const indent = '  '.repeat(row.depth)
        if (row.kind === 'note') return <Text key={`explorer-note:${row.path}`} dimColor italic wrap="truncate-end">{`${indent}${row.name}`}</Text>
        // A file or a folder: its name, and at its right 📋 copies it, 🔗 its path, ✏ renames it, 🗑 sends
        // it to the trash and 📥 pastes here what 📋 took, each of the last three after a dialog. A file's name
        // is yellow and opens the viewer; a folder's is blue and opens or closes it. A disk's root has them too,
        // to paste into it and to copy its path: 📋, ✏ and 🗑 are grey there, as a disk is not copied, renamed or trashed.
        const isFolder = row.kind === 'dir'
        const isDisk = isFolder && row.depth === 0
        if (row.kind === 'file' || isFolder) {
          const toolsWidth = EXPLORER_TOOLS_WIDTH
          // The name is cut to its room, then filled with spaces up to the tools: the fill under the pointer
          // runs to them, so it is plain which tools are the row's, and a long name keeps to its row.
          const nameRoom = Math.max(4, treeWidth - toolsWidth)
          const text = isFolder ? `${indent}${row.isOpen ? '▾' : '▸'} ${row.name}${row.isHere ? ' ●' : ''}` : `${indent}  ${row.name}`
          const cut = cutCells(text, nameRoom)
          const label = cut + ' '.repeat(Math.max(0, nameRoom - cells(cut)))
          // The row's hover group: its name and its tools. While the pointer is anywhere on them the name
          // takes the fill, yellow for a file and blue for a folder; the tools take none.
          const scope = hoverScope(row.path)
          const tint = isFolder ? (row.isHere ? FOLDER_COLOR : EXPLORER_DIR_COLOR) : EXPLORER_VIEWABLE_COLOR
          const fill = isFolder ? EXPLORER_DIR_COLOR : EXPLORER_VIEWABLE_COLOR
          // The name is a Client, as the tools are: a Button under the pointer inverts its cells, a grey bar
          // over the color. A press reaches the ui.message hook by its key.
          const name = Client
            ? (
              <Client
                key={`speedy:explorer-${isFolder ? 'folder' : 'view'}:${row.path}`}
                module="./control.tsx"
                width={cells(label)}
                // A file just pressed is green for a second, in place of the pointer's yellow: the press was taken.
                props={flashed === `speedy:explorer-view:${row.path}`
                  ? { label, color: '#1a1a1a', bold: true, backgroundColor: FLASH_COLOR }
                  : row.isFound || (state.viewed !== undefined && state.viewed === pathKey(row.path, state.caseless))
                  ? { label, color: '#1a1a1a', bold: true, backgroundColor: EXPLORER_VIEWABLE_COLOR }
                  : { label, color: tint, bold: isFolder && row.isHere, hover: { scope, backgroundColor: fill, color: '#1a1a1a' } }}
              />
              )
            : (
              <Button
                key={`${isFolder ? 'explorer' : 'explorer-file'}:${row.path}`}
                plain
                onPress={() => { if (isFolder) void toggleTreeFolder($, row.path); else { void forgetFound($); void viewTreeFile($, row.path) } }}
              >
                <Text color={tint} wrap="truncate-end">{label}</Text>
              </Button>
              )
          // Each tool is a Client of its own two cells, as the footer's are: a Button fills its cell under the
          // pointer. Between them a plain gap takes no press, so a press a little off one does nothing instead
          // of its neighbour's work. A tool is in its row's hover group, and keeps its own color in it.
          // With ⚙ → Ver labels, the pointer on a tool lights its label in the ribbon above the tree (the rule
          // under the filter): the tool joins that label's hover group, and stays in its row's group too.
          const tool = (kind: string, label: string, color: string) => {
            if (!Client) return <Text key={kind} color={color}>{label}</Text>
            const client = <Client key={`speedy:explorer-${kind}:${row.path}`} module="./control.tsx" width={cells(label)} props={{ label, color, bold: true, hover: { scope, color } }} />
            if (!isLabeled) return client
            return <Box key={`explorer-tip:${kind}:${row.path}`} flexShrink={0} hover={{ scope: tipScope(kind, isFolder, isDisk) }}>{client}</Box>
          }
          const gap = (key: string, size: number) => <Text key={key} hover={{ scope, color: tint }}>{' '.repeat(size)}</Text>
          // 📥 is lit only while 📋 has taken a file or a folder to paste.
          const isIdle = (kind: string) => (kind === 'paste' && !state.clip) || (isDisk && DISK_IDLE_TOOLS.includes(kind))
          // 📍 is on a folder of this machine alone: the session works on no file, nor on another machine.
          const isWorkable = isFolder && !remoteOf(row.path)
          const tools = EXPLORER_TOOLS.flatMap(([kind, emoji, glyph, color], index) => [
            gap(`gap:${kind}`, index === 0 ? 1 : 2),
            kind === 'work' && !isWorkable
              ? gap(`none:${kind}`, 2)
              : tool(kind, toolLabel(isGlyphs ? glyph : kind === 'paste' && isIdle(kind) ? PASTE_IDLE_MARK : emoji, isGlyphs), flashed === `speedy:explorer-${kind}:${row.path}` ? FLASH_COLOR : isIdle(kind) ? PASTE_IDLE_COLOR : color)
          ])
          return (
            <Box key={`explorer-row:${row.path}`} flexDirection="row" width={treeWidth}>
              <Box flexGrow={1} flexShrink={1} overflow="hidden">{name}</Box>
              <Box flexDirection="row" flexShrink={0} width={toolsWidth}>{tools}</Box>
            </Box>
          )
        }
        if (row.kind !== 'dir') {
          const mark = row.kind === 'link' ? '↪ ' : '  '
          // A link, found by the field, is marked as any row found.
          return row.isFound
            ? <Text key={`explorer-entry:${row.path}`} bold color="#1a1a1a" backgroundColor={EXPLORER_VIEWABLE_COLOR} wrap="truncate-end">{`${indent}${mark}${row.name}`}</Text>
            : <Text key={`explorer-entry:${row.path}`} dimColor wrap="truncate-end">{`${indent}${mark}${row.name}`}</Text>
        }
        return null
      })}
      </Box>
      {/* The scroll bar, an empty cell away from the tools: its track dark, its thumb in the folders' color, a
          row each. Where the surface draws a Client it is one, scrollbar.tsx: held down, its thumb follows the
          pointer and the tree with it. */}
      {thumb.size > 0 && Client
        ? <Client key="speedy:explorer-bar" module="./scrollbar.tsx" width={EXPLORER_BAR_WIDTH} height={room} props={{ total: rows.length, top, room, color: EXPLORER_DIR_COLOR }} />
        : thumb.size > 0
        ? (
          <Box flexDirection="column" width={EXPLORER_BAR_WIDTH}>
            {Array.from({ length: room }, (_, index) => {
              const isThumb = index >= thumb.start && index < thumb.start + thumb.size
              return <Text key={`explorer-bar:${index}`} color={isThumb ? EXPLORER_DIR_COLOR : EXPLORER_TRACK_COLOR}>{' █'}</Text>
            })}
          </Box>
          )
        : null}
      </Box>
    </Box>
  )
}

/** The version the status line shows at its end, once git has told it. */
let appVersion = ''
/** How often the version is asked of git again. */
const VERSION_FOLLOW_MS = 60000

/**
 * The version the footer shows: the moment of the clone's last commit, in Buenos Aires (UTC-3, which
 * has no summer time), as `vyy.mmdd(hhmm)`. It changes with every push, and needs no file kept.
 */
export function versionLabel (epochSeconds: number) {
  if (!Number.isFinite(epochSeconds) || epochSeconds <= 0) return ''
  const local = new Date((epochSeconds - 3 * 3600) * 1000)
  const two = (value: number) => String(value).padStart(2, '0')
  const day = `${two(local.getUTCFullYear() % 100)}.${two(local.getUTCMonth() + 1)}${two(local.getUTCDate())}`
  return `v${day}(${two(local.getUTCHours())}${two(local.getUTCMinutes())})`
}

/** The version, asked of git once: the mod is read from its clone, so its last commit is what runs. */
let versionKnown: Promise<string> | undefined
/** The runs of git that failed this session: a few are asked again, a git that is missing is not. */
let versionFails = 0

async function versionNow ($: EngineInterface) {
  // A run belongs to the draw that started it, and a newer draw cuts it off, as happens several times
  // over while the plugin reloads: the draw still waiting then asks git again itself, a few times at most.
  for (let tries = 0; tries < 3 && versionFails < 6; tries++) {
    // Forward slashes: a git reached through a shell wrapper loses the backslashes of a Windows path.
    const asked = versionKnown ??= $.process.run(['git', '-C', $.plugin.root.replace(/\\/g, '/'), 'log', '-1', '--format=%ct'])
      .then(result => result.exitCode === 0 ? versionLabel(Number(result.stdout.trim())) : '')
    const label = await asked.catch(() => undefined)
    if (label !== undefined) return label
    if (versionKnown === asked) {
      versionKnown = undefined
      versionFails += 1
    }
  }
  return ''
}

/** Asks git for the version again and, when it changed, writes it for the status line. */
async function followVersion ($: EngineInterface) {
  versionKnown = undefined
  versionFails = 0
  const label = await versionNow($).catch(() => '')
  if (!label || label === appVersion) return
  appVersion = label
  await writeBarFile($)
}

/** The commits GitHub has on main that this clone lacks: more than none puts ↓ after the version. */
let updateBehind = 0
/** How often GitHub is asked whether there is a newer version. */
const UPDATE_CHECK_MS = 3600000

/** The clone's folder, as git takes it: forward slashes, which a shell wrapper keeps. */
function cloneRoot ($: EngineInterface) {
  return $.plugin.root.replace(/\\/g, '/')
}

/**
 * Asks GitHub whether main has commits this clone lacks: a fetch, which changes no file, then a count.
 * When the answer changed, the status line file says so and the footer is drawn again.
 */
async function checkUpdate ($: EngineInterface) {
  const fetched = await $.process.run(['git', '-C', cloneRoot($), 'fetch', '-q', 'origin', 'main']).catch(() => undefined)
  if (fetched?.exitCode !== 0) return
  const counted = await $.process.run(['git', '-C', cloneRoot($), 'rev-list', '--count', 'HEAD..origin/main']).catch(() => undefined)
  const behind = counted?.exitCode === 0 ? Number(counted.stdout.trim()) || 0 : 0
  if (behind === updateBehind) return
  updateBehind = behind
  await writeBarFile($)
  $.ui.invalidate('ui.render')
}

/**
 * The 🔄 button: with a newer version on GitHub it is taken first (a fast-forward of main, which never
 * overwrites a change of the person's own), then every plugin is reloaded, this one too.
 */
async function updateAndReload ($: EngineInterface) {
  if (updateBehind > 0) {
    $.ui.toast('speedy-code: actualizando desde GitHub…')
    const merged = await $.process.run(['git', '-C', cloneRoot($), 'merge', '--ff-only', 'origin/main']).catch(() => undefined)
    if (merged?.exitCode !== 0) {
      const why = (merged?.stderr || merged?.stdout || '').trim().split(/\r?\n/)[0] || 'git no respondió'
      $.ui.toast(`speedy-code: no pude actualizar: ${why}`)
      return
    }
    updateBehind = 0
    await followVersion($)
    await writeBarFile($)
    $.ui.toast(`speedy-code: actualizado${appVersion ? ` a ${appVersion}` : ''}; recargando.`)
  }
  // Reloads every plugin, this one too: an edit to the mod takes effect at once.
  await $.command.run({ command: 'reload-plugins' }).catch(() => { $.ui.toast('speedy-code: no pude recargar; escribí /reload-plugins.') })
}

/**
 * The blank after the footer that puts it in the middle: Claude Code draws the footer against the
 * right edge, so as many cells after it as are left before it center it. None without a width.
 */
export function footerBlank (columns: number | undefined, used: number) {
  return columns === undefined ? 0 : Math.max(0, Math.floor((columns - used) / 2))
}

/**
 * The footer groups drawn in `room` cells: all of them, whole, when they fit. If not, those ranked 0
 * and the ⋯, the model and then the voice in their short form while that is still too wide, then the
 * rest in rank order until one does not fit: a lower rank never takes a higher one's place.
 */
export function footerFit (groups: ReadonlyArray<{ name: string, width: number, compactWidth?: number }>, room: number): FooterFit {
  const rank = (name: string) => FOOTER_RANKS[name] ?? 9
  const compact = new Set<string>()
  if (groups.reduce((sum, group) => sum + group.width, 0) <= room) return { shown: new Set(groups.map(group => group.name)), compact }
  const always = groups.filter(group => rank(group.name) === 0)
  const shown = new Set(always.map(group => group.name))
  let used = always.reduce((sum, group) => sum + group.width, MORE_WIDTH)
  for (const name of ['model', 'voice']) {
    const group = always.find(one => one.name === name)
    if (used > room && group?.compactWidth !== undefined) {
      used -= group.width - group.compactWidth
      compact.add(name)
    }
  }
  for (const name of FOOTER_SHED) {
    const group = always.find(one => one.name === name)
    if (used > room && group) {
      used -= compact.has(name) && group.compactWidth !== undefined ? group.compactWidth : group.width
      shown.delete(name)
      compact.delete(name)
    }
  }
  for (const group of groups.filter(one => !shown.has(one.name)).sort((x, y) => rank(x.name) - rank(y.name))) {
    if (used + group.width > room) break
    shown.add(group.name)
    used += group.width
  }
  return { shown, compact }
}

/**
 * The footer's controls, in groups that come and go together, in the order they are drawn, each with
 * the cells it takes. The footer draws those that fit (`node`, or `compactNode` when short of room);
 * the ⋯ panel draws the rest (`panel`), named. The same Client keys in both places, so a click does
 * the same thing wherever it comes from. Every Client is given its width: a terminal draws an emoji in
 * two cells where the layout may count one, and the next control would be drawn over it.
 */
async function footerGroups ($: EngineInterface, e: Drawn) {
  const elements = glyphed($.ui.resolve(e))
  // Only the terminal and the desktop draw a Client.
  if (!('Client' in elements)) return []
  const { Box, Client, Text } = elements
  const chosen = await read($, picks)
  const active = chosen.active ?? DEFAULT_LANG
  const voice = chosen[active] ?? DEFAULT_PICKS[DEFAULT_LANG] ?? ''
  const [enabled, now, listen, polishing] = [await read($, isEnabled), await read($, speech), await read($, listening), await read($, isPolishing)]
  // The networks with a user name set, in SOCIALS' order.
  const users = await read($, socials)
  const linked = linkedAccounts(users)
  const current = (await read($, modelNow)) || (await $.session.model().catch(() => ''))
  const model = modelLabel(current)
  const modelColor = modelOf(current)?.[3] ?? MODEL_COLOR
  const level = await read($, effort)
  // Text glyphs, never emojis: an emoji's width differs from one to the next, a text glyph's does not,
  // so play and pause take the same room. U+FE0E asks for the text form.
  const play = ({ idle: ['⏵', '#51cf66'], thinking: ['⧗', '#748ffc'], playing: ['⏸︎', '#ffd43b'], paused: ['⏵', '#51cf66'] } as const)[now]
  // Always drawn, so nothing in the footer moves: in gray before the first answer, when there is nothing to
  // read again. The narrator off does not gray it: off only keeps the answers from being read on their own.
  const canPlay = isPlayable(now)
  // A Client drawing `label` in `color`, as wide as the label is on a terminal.
  // With Nerd Fonts every emoji is its glyph, as wide as the emoji was, in the color a glyph can take.
  const isNerd = (await read($, icons)) === 'nerd'
  isGlyphs = isNerd
  // How wide a label is as it is drawn: a sign's glyph takes a cell more than the sign.
  const wide = (label: string) => cells(isNerd ? nerdText(label) : label)
  // With ⚙ → Ver labels on, a control of the footer's row given a name (`tip`) carries it hidden above it, and
  // the pointer on the control reveals it: the two share a hover group, so nothing runs and nothing moves.
  const isLabeled = await read($, hasLabels)
  const control = (key: string, label: string, color: string, bold = false, tip = '') => {
    const tint = isNerd ? NERD_COLORS[key] ?? color : color
    const scope = `tip:${key}`
    const hasTip = isLabeled && tip !== ''
    const client = <Client key={key} module="./control.tsx" width={wide(label)} props={{ label: isNerd ? nerdText(label) : label, color: tint, bold, ...(hasTip ? { hover: { scope, color: tint } } : {}) }} />
    if (!hasTip) return client
    // Centered over the control, as much to its left as to its right.
    const left = Math.floor((wide(label) - cells(` ${tip} `)) / 2)
    return (
      <Box key={`tipped:${key}`} flexShrink={0}>
        {client}
        <Box key={scope} position="absolute" top={-1} left={left} display="none" hover={{ scope, display: 'flex' }}>
          <Text color={LABEL_TEXT} backgroundColor={LABEL_FILL} bold>{` ${tip} `}</Text>
        </Box>
      </Box>
    )
  }
  const modelText = level ? ` ${model} ` : ` ${model} ▾ `
  const effortText = `· ${level} ▾ `
  // Short: the model's family alone (`Opus`), no effort; the status line still shows both.
  const modelShort = ` ${model.split(' ')[0] ?? model} ▾ `
  // No trailing space: the 🗜️ beside it brings its own, so the gap is one cell like the others.
  const voiceText = ` 🗣  ${nameOf(voice).name} · ${active.toUpperCase()} ▾`
  // The permission mode in force, as the line under the prompt says it; a click opens its menu.
  const modeNow = modeOf(await read($, permissionMode))
  const modeName = modeNow?.[2] ?? 'Modo'
  const modeColor = modeNow?.[3] ?? '#adb5bd'
  const modeText = ` ${modeName} ▾ `
  const voiceShort = ` 🗣  ${active.toUpperCase()} ▾`
  // The bar between the tools and the model, as the networks have theirs.
  const bar = <Text dimColor>│</Text>
  const named = [
    { group: 'copy', key: 'speedy:copy', footer: ' 📋 ', panel: ' 📋 copiar ', color: '#adb5bd', tip: 'copiar' },
    { group: 'paste', key: 'speedy:paste', footer: ' 📥 ', panel: ' 📥 pegar ', color: '#adb5bd', tip: 'pegar' },
    { group: 'image', key: 'speedy:image', footer: ' 🖼️ ', panel: ' 🖼️ imagen ', color: '#adb5bd', tip: 'pegar imagen' },
    { group: 'image', key: 'speedy:images', footer: ' 👁️ ', panel: ' 👁️ ver imágenes ', color: '#74c0fc', tip: 'ver imágenes' },
    // An emoji takes no color: the glyph tells it is at work.
    { group: 'polish', key: 'speedy:polish', footer: polishing ? ' ⏳ ' : ' 🖋️ ', panel: polishing ? ' ⏳ corrigiendo ' : ' 🖋️ corregir ', color: '#da77f2', tip: polishing ? 'corrigiendo…' : 'corregir el texto' },
    { group: 'send', key: 'speedy:send', footer: ' ⏎ ', panel: ' ⏎ enviar ', color: '#51cf66', tip: 'enviar' },
    { group: 'send', key: 'speedy:new', footer: ' + ', panel: ' + conversación nueva ', color: '#51cf66', tip: 'conversación nueva' },
    { group: 'send', key: 'speedy:sessions', footer: ' ☰ ', panel: ' ☰ conversaciones ', color: SESSIONS_COLOR, tip: 'conversaciones' },
    { group: 'clear', key: 'speedy:clear', footer: ' 🗑️ ', panel: ' 🗑️ borrar ', color: '#adb5bd', tip: 'borrar el prompt' },
    { group: 'narrator', key: 'speedy:switch', footer: ` ${enabled ? '🔊' : '🔇'} `, panel: enabled ? ' 🔊 narrador ' : ' 🔇 narrador apagado ', color: enabled ? '#51cf66' : '#868e96', tip: enabled ? 'apagar el narrador' : 'encender el narrador' },
    { group: 'narrator', key: 'speedy:play', footer: ` ${play[0]} `, panel: ` ${play[0]} leer de nuevo `, color: canPlay ? play[1] : DISABLED, tip: now === 'playing' ? 'pausar' : 'leer de nuevo' },
    { group: 'narrator', key: 'speedy:clip', footer: ' 📎 ', panel: ' 📎 audios y selección ', color: '#ffd43b', tip: 'audios y selección' },
    { group: 'mic', key: 'speedy:mic', footer: ` ${MIC_GLYPHS[listen]} `, panel: listen === 'off' ? ` ${MIC_GLYPHS.off} dictar ` : ` ${MIC_GLYPHS[listen]} dictando `, color: MIC_COLORS[listen], tip: listen === 'off' ? 'dictar' : 'dejar de dictar' },
    { group: 'mic', key: 'speedy:mics', footer: '▾ ', panel: ' ▾ micrófono ', color: MIC_COLORS.off, tip: 'micrófono' },
    { group: 'reload', key: 'speedy:reload', footer: ' 🔄 ', panel: ' 🔄 recargar ', color: '#adb5bd', tip: 'recargar' },
    { group: 'compact', key: 'speedy:compact', footer: ' 🗜️ ', panel: ' 🗜️ compactar ', color: '#ff6b6b', tip: 'compactar' },
    { group: 'settings', key: 'speedy:settings', footer: ' ⚙️ ', panel: ' ⚙️ configuración ', color: '#adb5bd', tip: 'configuración' }
  ]
  const namedGroup = (name: string) => {
    const members = named.filter(one => one.group === name)
    return {
      name,
      width: members.reduce((sum, one) => sum + wide(one.footer), 0),
      node: <Box key={`group:${name}`} flexDirection="row" flexShrink={0}>{members.map(one => control(one.key, one.footer, one.color, false, one.tip))}</Box>,
      labels: members.map(one => cells(one.panel)),
      panel: members.map(one => control(one.key, one.panel, one.color))
    }
  }
  return [
    {
      name: 'socials',
      // The bar with no space after it: 📋 brings its own.
      // One control for them all: their menu lists each account, so the footer keeps its room.
      width: linked.length > 0 ? cells(SOCIALS_LABEL) + 1 : 0,
      node: (
        <Box key="group:socials" flexDirection="row" flexShrink={0}>
          {linked.length > 0 ? control('speedy:socials', SOCIALS_LABEL, SOCIALS_COLOR, true, 'redes sociales') : null}
          {bar}
        </Box>
      ),
      panel: linked.length > 0 ? [control('speedy:socials', SOCIALS_LABEL, SOCIALS_COLOR, true)] : [],
      labels: linked.length > 0 ? [cells(SOCIALS_LABEL)] : []
    },
    ...['copy', 'paste', 'image', 'clear'].map(namedGroup),
    {
      name: 'model',
      width: 1 + cells(modelText) + (level ? cells(effortText) : 0),
      compactWidth: 1 + cells(modelShort),
      node: (
        <Box key="group:model" flexDirection="row" flexShrink={0}>
          {bar}
          {control('speedy:model', modelText, modelColor, true, 'modelo')}
          {/* The effort in force beside the model, in its traffic-light color; a click opens the same menu. */}
          {level ? control('speedy:effort', effortText, effortColor(level), true, 'esfuerzo') : null}
        </Box>
      ),
      compactNode: <Box key="group:model" flexDirection="row" flexShrink={0}>{bar}{control('speedy:model', modelShort, modelColor, true, 'modelo y esfuerzo')}</Box>,
      panel: [],
      labels: []
    },
    {
      name: 'voice',
      width: cells(voiceText),
      compactWidth: cells(voiceShort),
      node: <Box key="group:voice" flexShrink={0}>{control('speedy:voice', voiceText, languageColor(active), false, 'voz del narrador')}</Box>,
      compactNode: <Box key="group:voice" flexShrink={0}>{control('speedy:voice', voiceShort, languageColor(active), false, 'voz del narrador')}</Box>,
      panel: [control('speedy:voice', ` 🗣  ${nameOf(voice).name} · ${active.toUpperCase()} `, languageColor(active))],
      labels: [cells(` 🗣  ${nameOf(voice).name} · ${active.toUpperCase()} `)]
    },
    {
      name: 'mode',
      width: cells(modeText),
      node: <Box key="group:mode" flexShrink={0}>{control('speedy:mode', modeText, modeColor, true, 'modo de permisos')}</Box>,
      panel: [control('speedy:mode', ` modo: ${modeName} `, modeColor, true)],
      labels: [cells(` modo: ${modeName} `)]
    },
    // /compact, always in the footer: at hand whatever the context, as the ⋯ panel has it beside the context.
    namedGroup('compact'),
    namedGroup('narrator'),
    // Dictate, clean up, send: the three in the order they are used, before reload.
    namedGroup('mic'),
    namedGroup('polish'),
    namedGroup('send'),
    namedGroup('reload'),
    namedGroup('settings'),
    { name: 'exit', width: wide(' × '), node: <Box key="group:exit" flexShrink={0}>{control('speedy:exit', ' × ', '#ff6b6b', true, 'salir')}</Box>, panel: [], labels: [] }
  ]
}

/** Tokens said short: 172.4k, 1M. */
function shortTokens (n: number) {
  if (n >= 999950) return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(Math.round(n))
}

/** A span of time in days, hours and minutes, as the status line says it. */
function shortDuration (ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60000))
  const [days, hours, mins] = [Math.floor(minutes / 1440), Math.floor((minutes % 1440) / 60), minutes % 60]
  return days > 0 ? `${days}d ${hours}h ${mins}m` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

/** When a limit resets: `hoy 13:40`, `mañana 09:00`, or the day's short name. */
function resetWhen (iso: string | undefined) {
  if (!iso) return ''
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  const today = new Date()
  const day = (one: Date) => one.toDateString()
  if (day(at) === day(today)) return `hoy ${time}`
  if (day(at) === day(new Date(today.getTime() + 86400000))) return `mañana ${time}`
  return `${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][at.getDay()]} ${time}`
}

/**
 * The ⋯ panel: the session's figures, whole, in two sections (side by side where the width holds
 * them), then the networks and the controls the footer left out, each named. They are the footer's own
 * Clients: a control that opens something replaces the panel; one that switches keeps it open.
 */
async function moreMenu ($: EngineInterface, e: Drawn, width = 90) {
  const elements = glyphed($.ui.resolve(e))
  const { Box, Text } = elements
  const usage = await $.session.usage().catch(() => undefined)
  const levels = await read($, barLevels)
  const hidden = (await footerGroups($, e)).filter(group => group.width > 0 && hiddenGroups.includes(group.name))
  const tone = (value: number, yellow: number, red: number) => value >= red ? '#ff6b6b' : value >= yellow ? '#ffd43b' : '#51cf66'
  const meter = (value: number) => {
    const full = Math.round(Math.min(100, Math.max(0, value)) / 25)
    return '▰'.repeat(full) + '▱'.repeat(4 - full)
  }
  const percent = Math.round(usage?.context.percent ?? 0)
  const limitNames: Record<string, string> = { five_hour: '5 horas', seven_day: 'semana' }
  const LABEL = 11
  const heading = (text: string) => <Text bold dimColor>{text}</Text>
  const row = (key: string, label: string, value: ReturnType<typeof Text> | ReturnType<typeof Box>) => (
    <Box key={key} flexDirection="row">
      <Box width={LABEL}><Text dimColor>{`  ${label}`}</Text></Box>
      {value}
    </Box>
  )
  const figures = usage
    ? [
        row('ctx', 'contexto', (
          <Box flexDirection="row">
            <Text bold color={tone(percent, levels.contextYellow, levels.contextRed)}>{`${meter(percent)} ${String(percent).padStart(3)}%   ${shortTokens(usage.context.tokens ?? 0)} / ${shortTokens(usage.context.window)} `}</Text>
            {/* /compact, at hand beside what it frees. */}
            {'Client' in elements ? <elements.Client key="speedy:compact" module="./control.tsx" width={cells(' 🗜️ ')} props={{ label: ' 🗜️ ', color: '#ff6b6b', bold: true }} /> : null}
          </Box>
        )),
        row('time', 'tiempo', <Text color="#74c0fc">{shortDuration(Date.now() - usage.startedAt)}</Text>),
        row('cost', 'costo', <Text bold color="#ffd43b">{usage.cost ? `$${usage.cost.usd.toFixed(2)}` : '—'}</Text>)
      ]
    : []
  const limitRows = (usage?.rateLimits ?? []).map(limit => row(`limit:${limit.kind}`, limitNames[limit.kind] ?? limit.kind, (
    <Text>
      <Text bold color={tone(limit.percentUsed, levels.limitYellow, levels.limitRed)}>{`${meter(limit.percentUsed)} ${String(Math.round(limit.percentUsed)).padStart(3)}%`}</Text>
      <Text dimColor>{limit.resetsAt ? `   ↻ ${resetWhen(limit.resetsAt)}` : ''}</Text>
    </Text>
  )))
  // Wide: the session and the limits side by side, each under its heading. Narrow: one section, so
  // the panel stays short enough to be seen whole.
  const isWide = width >= 84
  const top = isWide
    ? (
      <Box flexDirection="row" columnGap={4}>
        <Box flexDirection="column" width={38} flexShrink={0}>{heading('SESIÓN')}{figures}</Box>
        <Box flexDirection="column" flexShrink={0}>{heading('LÍMITES')}{limitRows}</Box>
      </Box>
      )
    : <Box flexDirection="column">{heading('SESIÓN')}{figures}{limitRows}</Box>
  // The networks and the controls in a grid: every cell as wide as the widest, so the rows line up.
  const grid = (key: string, title: string, items: ReadonlyArray<ReturnType<typeof Text>>, cell: number) => (
    <Box key={key} flexDirection="column" marginTop={1}>
      {heading(title)}
      <Box flexDirection="row" flexWrap="wrap" paddingLeft={1}>
        {items.map((item, index) => <Box key={`${key}:${index}`} width={cell} flexShrink={0}>{item}</Box>)}
      </Box>
    </Box>
  )
  const networks = hidden.find(group => group.name === 'socials')?.panel ?? []
  const networkCell = Math.max(0, ...(hidden.find(group => group.name === 'socials')?.labels ?? [])) + 1
  // The controls in columns by what they are for, each under its heading, one control to a row: the
  // controls of one group stay together (dictar beside its micrófono), whatever the width.
  const columnsOf = MORE_COLUMNS
    .map(([title, names]) => {
      const groups = names.map(name => hidden.find(group => group.name === name)).filter(group => group !== undefined)
      return { title, items: groups.flatMap(group => group.panel), width: Math.max(cells(title), ...groups.flatMap(group => group.labels)) + 2 }
    })
    .filter(column => column.items.length > 0)
  const controls = columnsOf.length > 0
    ? (
      <Box key="controls" flexDirection="row" flexWrap="wrap" columnGap={3} marginTop={1}>
        {columnsOf.map(column => (
          <Box key={`column:${column.title}`} flexDirection="column" width={column.width} flexShrink={0} marginBottom={1}>
            {heading(column.title)}
            {column.items.map((item, index) => <Box key={`${column.title}:${index}`} paddingLeft={1}>{item}</Box>)}
          </Box>
        ))}
      </Box>
      )
    : null
  return (
    <Box flexDirection="column">
      {top}
      {networks.length > 0 ? grid('networks', 'REDES', networks, networkCell) : null}
      {controls}
    </Box>
  )
}

/** The ⋯ panel's columns of controls: a heading and the footer groups it gathers, in their order. */
const MORE_COLUMNS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['VOZ', ['voice', 'narrator']],
  ['DICTADO', ['mic', 'polish']],
  ['PROMPT', ['copy', 'paste', 'image', 'clear', 'send']],
  ['SESIÓN', ['model', 'mode', 'reload', 'settings']]
]

/** The color of an effort level: its traffic-light color in EFFORTS, gray for one it does not list. */
export function effortColor (level: string): string {
  return EFFORTS.find(([name]) => name === level)?.[1] ?? '#adb5bd'
}

/**
 * A priority list as saved, made whole: the parts it knows in its order, once each, then any it lacks in
 * the default order. An old or hand-edited list never drops a part from the status line.
 */
export function barOrderOf (saved: unknown): BarPart[] {
  // An order saved when the session's cost was a part: the model's own limit takes its place.
  const named = Array.isArray(saved) ? saved.map(key => key === 'cost' ? 'scoped' : key) : []
  const known = named.filter((key): key is BarPart => DEFAULT_ORDER.includes(key as BarPart))
  const order = [...new Set(known)]
  return [...order, ...DEFAULT_ORDER.filter(key => !order.includes(key))]
}

/** Writes the file the status line reads: the levels, the parts by priority and the icon set. */
async function writeBarFile ($: EngineInterface) {
  const content = { ...(await read($, barLevels)), priority: await read($, barOrder), icons: await read($, icons), ...(appVersion ? { version: appVersion } : {}), ...(updateBehind > 0 ? { update: true } : {}) }
  await $.fs.write(await homeFile($, LEVELS_FILE), `${JSON.stringify(content, null, 2)}\n`)
}

/** Keeps the status line's levels: in the plugin's store, and in the file the status line reads. */
async function saveLevels ($: EngineInterface, next: BarLevels) {
  await update($, barLevels, () => next)
  await $.store.set('barLevels', next)
  await writeBarFile($)
}

/** Keeps the status line's priority: in the plugin's store, and in the file the status line reads. */
async function saveOrder ($: EngineInterface, next: BarPart[]) {
  await update($, barOrder, () => next)
  await $.store.set('barOrder', next)
  await writeBarFile($)
}

/** One part a place up (-1) or down (+1) in the priority, swapping with the one there. */
async function movePart ($: EngineInterface, key: BarPart, delta: -1 | 1) {
  const order = [...(await read($, barOrder))]
  const at = order.indexOf(key)
  const to = at + delta
  if (at < 0 || to < 0 || to >= order.length) return
  ;[order[at], order[to]] = [order[to] as BarPart, key]
  await saveOrder($, order)
}

/** One level up or down, by 5, within its bounds: yellow 5 under its red, red 5 over its yellow, at most 100. */
async function adjustLevel ($: EngineInterface, key: LevelKey, delta: number) {
  const levels = await read($, barLevels)
  const isYellow = key.endsWith('Yellow')
  const other = levels[PAIR[key]]
  const low = isYellow ? 5 : other + 5
  const high = isYellow ? other - 5 : 100
  await saveLevels($, { ...levels, [key]: Math.min(high, Math.max(low, levels[key] + delta)) })
}

/** The status line's levels and priority back to the defaults. */
async function resetLevels ($: EngineInterface) {
  await update($, barOrder, () => DEFAULT_ORDER)
  await $.store.set('barOrder', DEFAULT_ORDER)
  await saveLevels($, DEFAULT_LEVELS)
}

/** When Desinstalar was pressed a first time: a second press within these seconds is what removes. */
let removeAskedAt = 0
const REMOVE_ASK_MS = 10000

/**
 * Runs the setup, each line it prints shown as it comes; then checks again. `all` is install.ps1; `lean` the
 * same without the dictation's model (750 MB less); `remove` is uninstall.ps1, which takes away what the
 * setup put in the mod's own folder: it is asked twice, the second press within ten seconds.
 */
async function runSetup ($: EngineInterface, what: 'all' | 'lean' | 'remove' = 'all') {
  if (await read($, isInstalling)) return
  if (what === 'remove' && Date.now() - removeAskedAt > REMOVE_ASK_MS) {
    removeAskedAt = Date.now()
    await update($, setupLog, () => ['¿Seguro? Se borran el entorno de Python, el modelo de dictado y el ffmpeg propio (vuelven con Instalar).', 'Tus audios, imágenes, historial y ajustes se quedan. Pulsá Desinstalar otra vez en 10 s para borrar.'])
    return
  }
  removeAskedAt = 0
  await update($, isInstalling, () => true)
  await update($, setupLog, () => [])
  const script = what === 'remove' ? 'uninstall' : 'install'
  let pending = ''
  try {
    const setup = $.process.spawn({
      argv: (await osNow($)) === 'windows'
        ? ['powershell', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/setup/${script}.ps1`]
        : ['/bin/bash', `${$.plugin.root}/setup/${script}.sh`],
      ...(what === 'lean' ? { env: { SPEEDY_NO_DICTATION: '1' } } : {})
    })
    for await (const { stream, text } of setup) {
      if (stream !== 'stdout') continue
      pending += text
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() ?? ''
      for (const line of lines) {
        const [word, name = '', ...rest] = line.split(' ')
        const detail = rest.join(' ')
        if (word === 'step') await setCheck($, name, { state: 'working', detail })
        else if (word === 'ok' || word === 'fail') await setCheck($, name, { state: word, detail })
        else if (word === 'info' && line.length > 5) await update($, setupLog, log => [...log, line.slice(5)].slice(-SETUP_LOG_LINES))
      }
    }
  } catch (error) {
    $.ui.toast(`speedy-code: no pude correr el instalador: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await update($, isInstalling, () => false)
    void loadVoices($)
    await checkSetup($)
  }
}

/**
 * Whether the play button acts: something under way or to read again. The narrator off only keeps the
 * answers from being read on their own: reading again and reading a selection work all the same.
 */
function isPlayable (now: Speech) {
  return now !== 'idle' || lastAnswer !== ''
}

/** The play button: reads the last answer again, cancels Haiku, pauses, or goes on. */
async function pressPlay ($: EngineInterface) {
  const now = await read($, speech)
  if (now === 'idle' && lastAnswer) {
    // The answer already read and kept plays in the popup, where it can be sought; otherwise it is read again.
    const lang = (await read($, picks)).active ?? DEFAULT_LANG
    const isKept = lastNarration.answer === lastAnswer && lastNarration.lang === lang
    if (isKept && await playInViewer($, lastNarration.file)) return
    void narrate($, lastAnswer, '', true)
  }
  else if (now === 'thinking') await stop($)
  else if (now === 'playing') await control($, 'pause')
  else if (now === 'paused') await control($, 'play')
}

/** The settings menu: a tab per kind of setting. Social networks: a user name each, its link shown as it is built. */
async function settingsMenu ($: EngineInterface, e: Drawn, width = 90, height = 24) {
  const open = await read($, settingsTab)
  const users = await read($, socials)
  const generation = await read($, settingsOpened)
  const edited = await read($, editing)
  const elements = glyphed($.ui.resolve(e))
  const { Box, Button, Text } = elements
  // A field to type in: every surface but the mobile app draws one.
  const Input = 'Input' in elements ? elements.Input : undefined

  // Fit the band: Claude Code caps it at half the terminal. Where the width holds two tables of
  // the networks side by side, half as many rows; the link column takes what is left, cut with …
  // The room inside the frame's border and padding: never more, or rows spill past the border.
  const inside = Math.max(20, width - 4)
  const fixed = SOCIAL_PLUS_WIDTH + SOCIAL_BADGE_WIDTH + SOCIAL_NAME_WIDTH + SOCIAL_FIELD_WIDTH
  const halfLink = Math.floor((inside - TABLE_GAP) / 2) - fixed
  const tableCount = halfLink >= MIN_LINK_WIDTH ? 2 : 1
  const linkWidth = tableCount === 2 ? halfLink : Math.max(MIN_LINK_WIDTH, inside - fixed)
  // Narrow: a table of the whole would not fit, so the network's name and the link go; the badge
  // already names the network, and the field takes the room. The other tabs stack their rows too.
  const narrow = inside < fixed + MIN_LINK_WIDTH
  const fieldWidth = narrow ? Math.max(12, inside - SOCIAL_PLUS_WIDTH - SOCIAL_BADGE_WIDTH) : SOCIAL_FIELD_WIDTH

  const rows = SOCIALS.flatMap(([id, name, label, color, , hint]) => accountsOf(users, id).map((key, index) => {
    const link = socialLink(id, users[key] ?? '')
    const isFirst = index === 0
    const done = (value: string) => saveSocial($, key, value).then(() => update($, editing, () => '')).then(() => dropIfEmpty($, key))
    return (
      <Box key={`social-row:${key}`} flexDirection="row">
        {/* The + adds another account of the network, on its first row; − removes an added one.
            The first account has no −: a network keeps one. */}
        <Box width={SOCIAL_PLUS_WIDTH}>
          {isFirst
            ? (
              <Button key={`add:${id}`} plain onPress={() => { void addAccount($, id) }}>
                <Text bold color={color}>{' + '}</Text>
              </Button>
              )
            : (
              <Button key={`remove:${key}`} plain onPress={() => { void removeAccount($, key) }}>
                <Text bold color="#ff6b6b">{' − '}</Text>
              </Button>
              )}
        </Box>
        <Box width={SOCIAL_BADGE_WIDTH}><Text bold color={color} dimColor={!isFirst}>{accountLabel(label, key)}</Text></Box>
        {narrow ? null : <Box width={SOCIAL_NAME_WIDTH}><Text bold={isFirst} color={color} dimColor={!isFirst}>{isFirst ? name : `  cuenta ${index + 1}`}</Text></Box>}
        <Box width={fieldWidth} paddingRight={2}>
          {/* At rest the user name is text, always whole; a click makes it a field, focused,
              and Enter keeps it and makes it text again. A field shown at rest did not
              always draw the name it was given, and its Enter label took a second line. */}
          {Input && edited === key
            ? (
              <Input
                key={`social:${key}:${generation}`}
                value={users[key] ?? ''}
                placeholder={hint ?? 'usuario'}
                submitLabel="↵"
                autoFocus
                onInput={value => { void saveSocial($, key, value) }}
                onSubmit={value => { void done(value) }}
              />
              )
            : (
              <Button key={`edit:${key}`} plain onPress={() => { void update($, editing, () => key) }}>
                <Text color={users[key] ? undefined : '#868e96'}>{users[key] || 'usuario ✎'}</Text>
              </Button>
              )}
        </Box>
        {narrow ? null : <Text color={link ? color : undefined} dimColor={!link}>{fit(link || '—', linkWidth).trimEnd()}</Text>}
      </Box>
    )
  }))
  const checks = await read($, setupChecks)
  const log = await read($, setupLog)
  const installing = await read($, isInstalling)
  const bar = await read($, statusLine)
  const iconSet = await read($, icons)
  const isLabeled = await read($, hasLabels)
  const sizeNow = await read($, fontSize)
  const familyNow = await read($, fontFamily)
  const mark = { '': ['·', '#868e96'], working: ['…', '#ffd43b'], ok: ['✔', '#51cf66'], fail: ['✘', '#ff6b6b'] } as const
  // Wide, the steps go in two columns: Claude Code caps the band at half the terminal, and a row saved is a row seen.
  const STEP_WIDTH = 50
  const isTwoColumns = !narrow && inside >= 2 * (STEP_WIDTH + 20) + 2
  const stepColumn = isTwoColumns ? Math.floor((inside - 2) / 2) : inside
  const stepRow = ([name, label]: readonly [string, string]) => {
    const check = checks[name] ?? { state: '', detail: '' }
    const [glyph, tint] = mark[check.state]
    return (
      <Box key={`setup-row:${name}`} flexDirection={narrow ? 'column' : 'row'} marginBottom={narrow ? 1 : 0}>
        <Box flexDirection="row">
          {/* A column of its own: ✔ is drawn two cells wide where it is counted as one. */}
          <Box width={4} flexShrink={0}><Text bold color={tint}>{` ${glyph}`}</Text></Box>
          <Box width={narrow ? inside - 4 : STEP_WIDTH - 4}><Text bold color={check.state === 'fail' ? tint : '#74c0fc'}>{label}</Text></Box>
        </Box>
        <Box paddingLeft={narrow ? 4 : 0}><Text color={tint} dimColor={check.state === ''}>{isTwoColumns ? fit(check.detail, stepColumn - STEP_WIDTH).trimEnd() : check.detail}</Text></Box>
      </Box>
    )
  }
  const stepHalf = Math.ceil(SETUP_STEPS.length / 2)
  const setupTab = (
    <Box flexDirection="column">
      {isTwoColumns
        ? (
          <Box flexDirection="row" columnGap={2}>
            <Box flexDirection="column" width={stepColumn} flexShrink={0}>{SETUP_STEPS.slice(0, stepHalf).map(stepRow)}</Box>
            <Box flexDirection="column" width={stepColumn} flexShrink={0}>{SETUP_STEPS.slice(stepHalf).map(stepRow)}</Box>
          </Box>
          )
        : SETUP_STEPS.map(stepRow)}
      <Box flexDirection="row" marginTop={1}>
        <Button key="setup:run" plain onPress={() => { void runSetup($) }}>
          <Text bold color="black" backgroundColor={installing ? '#ffd43b' : '#51cf66'}>{installing ? ' Instalando… ' : ' Instalar / reparar todo '}</Text>
        </Button>
        <Text> </Text>
        <Button key="setup:lean" plain onPress={() => { void runSetup($, 'lean') }}>
          <Text bold color="black" backgroundColor="#74c0fc">{' Instalar sin dictado (750 MB menos) '}</Text>
        </Button>
        <Text> </Text>
        <Button key="setup:remove" plain onPress={() => { void runSetup($, 'remove') }}>
          <Text bold color="black" backgroundColor="#ff6b6b">{' Desinstalar '}</Text>
        </Button>
      </Box>
      {log.map((line, index) => <Text key={`setup-log:${index}`} dimColor>{`   ${line}`}</Text>)}
    </Box>
  )
  // The status line's tab: its switch, and the levels where its colors change.
  const levels = await read($, barLevels)
  const level = (label: string, key: LevelKey, note: string) => (
    <Box key={`level-row:${key}`} flexDirection="row">
      <Box width={narrow ? 22 : 38}><Text bold color={LEVEL_COLORS[key]}>{narrow ? label.replace(' usado', '').replace(' desde', '') : label}</Text></Box>
      <Button key={`lvl-down:${key}`} plain onPress={() => { void adjustLevel($, key, -5) }}>
        <Text bold color="black" backgroundColor={LEVEL_COLORS[key]}>{' − '}</Text>
      </Button>
      <Box width={6} justifyContent="center"><Text bold color={LEVEL_COLORS[key]}>{`${levels[key]}%`}</Text></Box>
      <Button key={`lvl-up:${key}`} plain onPress={() => { void adjustLevel($, key, 5) }}>
        <Text bold color="black" backgroundColor={LEVEL_COLORS[key]}>{' + '}</Text>
      </Button>
      {narrow || isSideBySide || !note ? null : <Text color={LEVEL_COLORS[key]}>{`  ${note}`}</Text>}
    </Box>
  )
  // The priority: a row per part, its number, its name and the arrows that move it.
  const order = await read($, barOrder)
  const nameWidth = Math.min(26, Math.max(10, inside - 12))
  const arrow = (key: BarPart, glyph: string, delta: -1 | 1, isOn: boolean) => (isOn
    ? (
      <Button key={`order-${delta < 0 ? 'up' : 'down'}:${key}`} plain onPress={() => { void movePart($, key, delta) }}>
        <Text bold color="black" backgroundColor={PRIORITY_COLOR}>{` ${glyph} `}</Text>
      </Button>
      )
    : <Text key={`order-${delta < 0 ? 'up' : 'down'}-off:${key}`} color={DISABLED}>{` ${glyph} `}</Text>)
  const priorityRow = (key: BarPart, index: number) => (
    <Box key={`order-row:${key}`} flexDirection="row">
      <Box width={3} flexShrink={0}><Text bold color={PRIORITY_COLOR}>{`${index + 1}`.padStart(2)}</Text></Box>
      <Box width={nameWidth + 1} flexShrink={0}><Text>{fit(BAR_PARTS.find(([part]) => part === key)?.[1] ?? key, nameWidth)}</Text></Box>
      {arrow(key, '▲', -1, index > 0)}
      <Text> </Text>
      {arrow(key, '▼', 1, index < order.length - 1)}
    </Box>
  )
  // The levels row takes 22 or 38 cells, then 3 + 6 + 3 for its stepper; the priority row 3 + name + 7.
  const isSideBySide = !narrow && inside >= 38 + 12 + 4 + 3 + nameWidth + 1 + 7
  // The settings above the tables are a table too: a name, what is in use, and what changes it.
  const NAME_WIDTH = 28
  const STATE_WIDTH = 27
  const setting = (key: string, name: string, tint: string, state: string, isOn: boolean, actions: unknown, isLast = false) => (
    <Box key={`bar-row:${key}`} flexDirection={narrow ? 'column' : 'row'} marginBottom={narrow || isLast ? 1 : 0}>
      <Box flexDirection="row" flexShrink={0}>
        <Box width={NAME_WIDTH} flexShrink={0}><Text bold color={tint}>{name}</Text></Box>
        <Box width={narrow ? undefined : STATE_WIDTH} flexShrink={0}><Text bold color={isOn ? '#51cf66' : '#868e96'}>{state}</Text></Box>
      </Box>
      <Box flexDirection="row" columnGap={1} paddingLeft={narrow ? 1 : 0} flexShrink={0}>{actions}</Box>
    </Box>
  )
  // Claude Code caps the band at half the terminal, so the tables take as few rows as the width lets them:
  // side by side, the button that resets them goes on the titles' row, and wider still the priorities are two columns.
  const resetButton = (
    <Button key="bar:reset" plain onPress={() => { void resetLevels($) }}>
      <Text bold color="black" backgroundColor="#4dabf7">{' Restaurar los valores por defecto '}</Text>
    </Button>
  )
  const priorityWidth = 3 + nameWidth + 1 + 7
  const isTwoPriorities = isSideBySide && inside >= 38 + 12 + 4 + 2 * priorityWidth + 3
  const priorityHalf = Math.ceil(order.length / 2)
  const familyName = FONT_FAMILIES.find(([id]) => id === familyNow)?.[1] ?? familyNow
  const barTab = (
    <Box flexDirection="column">
      {setting('statusline', ' ▤  Barra speedy-code ', '#4dabf7', bar === 'on' ? '● activa' : '○ inactiva', bar === 'on', (
        <Button key="bar:statusline" plain onPress={() => { void switchStatusLine($, bar === 'on' ? 'off' : 'on') }}>
          <Text bold color="black" backgroundColor={bar === 'on' ? '#868e96' : '#4dabf7'}>{bar === 'on' ? ' Restaurar mi barra ' : ' Usar barra speedy-code '}</Text>
        </Button>
      ))}
      {setting('icons', ' ◈  Iconos ', '#b197fc', iconSet === 'nerd' ? '● Nerd Fonts' : '○ emojis', iconSet === 'nerd', [
        <Button key="bar:icons" plain onPress={() => { void switchIcons($) }}>
          <Text bold color="black" backgroundColor={iconSet === 'nerd' ? '#868e96' : '#b197fc'}>{iconSet === 'nerd' ? ' Volver a los emojis ' : ' Usar Nerd Fonts '}</Text>
        </Button>,
        // The glyphs themselves, whatever the set: they tell whether the terminal's font has them.
        <Text key="bar:icons:proof" color="#b197fc">{' prueba: \uf0c5 \uf0ea \uf03e \uf130 \uf013 '}</Text>,
        narrow ? null : <Text key="bar:icons:hint" dimColor>(¿cuadrados? falta una Nerd Font)</Text>
      ])}
      {setting('labels', ' ⓘ  Ver labels ', LABEL_FILL, isLabeled ? '● al pasar el mouse' : '○ ocultas', isLabeled, (
        <Button key="bar:labels" plain onPress={() => { void switchLabels($) }}>
          <Text bold color="black" backgroundColor={isLabeled ? '#868e96' : LABEL_FILL}>{isLabeled ? ' Ocultar labels ' : ' Mostrar labels '}</Text>
        </Button>
      ))}
      {/* The terminal's own font: a program in a terminal has none, so the terminal's settings are changed. */}
      {setting('font', ' Aa  Fuente de la terminal ', '#ffa94d', sizeNow ? `● ${familyName} · ${sizeNow} pt` : '○ la de tu terminal', sizeNow > 0, FONT_FAMILIES.map(([id, name]) => (
        <Button key={`bar:family:${id}`} plain onPress={() => { void setTerminalFont($, id, sizeNow || DEFAULT_FONT_SIZE) }}>
          <Text bold color="black" backgroundColor={sizeNow && familyNow === id ? '#51cf66' : '#ffa94d'}>{` ${name} `}</Text>
        </Button>
      )))}
      {setting('size', '     Tamaño en puntos ', '#ffa94d', '', false, FONT_SIZES.map(size => (
        <Button key={`bar:font:${size}`} plain onPress={() => { void setTerminalFont($, familyNow, size) }}>
          <Text bold color="black" backgroundColor={sizeNow === size ? '#51cf66' : '#ffa94d'}>{` ${`${size}`.padStart(2)} `}</Text>
        </Button>
      )), true)}
      <Box flexDirection={isSideBySide ? 'row' : 'column'}>
        <Box flexDirection="column" flexShrink={0} marginRight={isSideBySide ? 4 : 0}>
          <Box flexDirection="row" columnGap={2}>
            <Text bold dimColor>COLORES</Text>
            {isSideBySide ? resetButton : null}
          </Box>
          {level('Contexto usado · amarillo desde', 'contextYellow', '')}
          {level('Contexto usado · rojo desde', 'contextRed', '⚠  compactar, y el aviso')}
          {level('Límite usado · amarillo desde', 'limitYellow', '')}
          {level('Límite usado · rojo desde', 'limitRed', '⚠  y el aviso')}
        </Box>
        <Box flexDirection="column" flexShrink={0} marginTop={isSideBySide ? 0 : 1}>
          <Text bold dimColor>PRIORIDAD AL ACHICARSE</Text>
          {isTwoPriorities
            ? (
              <Box flexDirection="row" columnGap={3}>
                <Box flexDirection="column" flexShrink={0}>{order.slice(0, priorityHalf).map((key, index) => priorityRow(key, index))}</Box>
                <Box flexDirection="column" flexShrink={0}>{order.slice(priorityHalf).map((key, index) => priorityRow(key, index + priorityHalf))}</Box>
              </Box>
              )
            : order.map((key, index) => priorityRow(key, index))}
        </Box>
      </Box>
      {isSideBySide ? null : <Box flexDirection="row" marginTop={1}>{resetButton}</Box>}
    </Box>
  )
  // The column titles on a band of the tab's color, as wide as the table.
  const header = (
    <Text bold color="black" backgroundColor="#f783ac">
      {fit(' Red', SOCIAL_PLUS_WIDTH + SOCIAL_BADGE_WIDTH + (narrow ? 0 : SOCIAL_NAME_WIDTH)) + (narrow ? fit('Usuario', fieldWidth) : fit('Usuario', fieldWidth) + fit('Link', linkWidth))}
    </Text>
  )
  // The rows a table holds: the band's height less the frame's three, the tabs line and the header.
  // More than that, and the accounts go in pages; the page with the field being edited is shown.
  const fits = Math.max(3, height - 5)
  const perPage = fits * tableCount
  const pages = Math.max(1, Math.ceil(rows.length / perPage))
  const editedAt = SOCIALS.flatMap(([id]) => accountsOf(users, id)).indexOf(edited)
  const at = editedAt >= 0 ? Math.floor(editedAt / perPage) : Math.min(await read($, socialPage), pages - 1)
  const shownRows = rows.slice(at * perPage, (at + 1) * perPage)
  const perTable = Math.ceil(shownRows.length / tableCount)
  const turn = (to: number) => { void update($, editing, () => '').then(() => update($, socialPage, () => Math.min(Math.max(to, 0), pages - 1))) }
  const tables = (
    <Box flexDirection="row" columnGap={TABLE_GAP}>
      {Array.from({ length: tableCount }, (_, index) => (
        <Box key={`social-table:${index}`} flexDirection="column" width={narrow ? inside : fixed + linkWidth}>
          {header}
          {shownRows.slice(index * perTable, (index + 1) * perTable)}
        </Box>
      ))}
    </Box>
  )
  const pager = pages > 1
    ? (
      <Box flexDirection="row" marginLeft={2}>
        <Button key="social-page:previous" plain onPress={() => turn(at - 1)}>
          <Text bold color={at > 0 ? '#adb5bd' : DISABLED}>{' ◀ '}</Text>
        </Button>
        <Text color="#adb5bd">{` ${at + 1}/${pages} `}</Text>
        <Button key="social-page:next" plain onPress={() => turn(at + 1)}>
          <Text bold color={at < pages - 1 ? '#adb5bd' : DISABLED}>{' ▶ '}</Text>
        </Button>
      </Box>
      )
    : null

  return (
    <Box flexDirection="column">
      {/* The tabs and the pager on one line, short names where narrow, set off from what follows. */}
      <Box flexDirection="row" marginBottom={1}>
        {SETTINGS_TABS.map(([id, label, tint, short]) => (
          <Box key={`settings-cell:${id}`} marginRight={narrow ? 1 : 2} flexShrink={0}>
            {id === open && 'Client' in elements
              ? <elements.Client key={`speedy:chosen:settings:${id}`} module="./control.tsx" width={cells(` ▸ ${narrow ? short : label} `)} props={{ label: ` ▸ ${narrow ? short : label} `, color: 'black', bold: true, backgroundColor: tint }} />
              : (
                <Button key={`settings:${id}`} plain onPress={() => { void dropEmptyAccounts($).then(() => update($, settingsTab, () => id)) }}>
                  <Text bold color={id === open ? 'black' : tint} backgroundColor={id === open ? tint : undefined}>{` ${id === open ? '▸ ' : ''}${narrow ? short : label} `}</Text>
                </Button>
                )}
          </Box>
        ))}
        {open === 'socials' ? pager : null}
      </Box>
      {open === 'setup' ? setupTab : null}
      {open === 'bar' ? barTab : null}
      {open === 'claude' ? await claudeTab($, e) : null}
      {open === 'socials'
        ? (
          <Box flexDirection="column">
            {tables}
          </Box>
          )
        : null}
    </Box>
  )
}

/** ⚙ → Claude Code: the switch of the experimental Code Mode, off unless turned on, and what it changes. */
async function claudeTab ($: EngineInterface, e: Drawn) {
  const { Box, Button, Text } = $.ui.resolve(e)
  const mode = await read($, codeMode)
  const isOn = mode === 'on'
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={2}>
        <Text bold color="#ffa94d">Code Mode (experimental)</Text>
        <Text bold color={isOn ? '#51cf66' : '#868e96'}>{mode === '' ? 'leyendo…' : isOn ? 'Encendido' : 'Apagado'}</Text>
        <Button key="claude:code-mode" plain onPress={() => { void switchCodeMode($, isOn ? 'off' : 'on') }}>
          <Text bold color="black" backgroundColor={isOn ? '#ff8787' : '#51cf66'}>{isOn ? ' Apagar ' : ' Encender '}</Text>
        </Button>
      </Box>
      <Text dimColor>{'  Claude escribe JavaScript que llama a sus herramientas en vez de llamarlas de a una: menos idas y vueltas.'}</Text>
      <Text dimColor>{'  Apaga Claude in Chrome, computer use y Remote Control. Una sesión empezada con él solo se retoma con él.'}</Text>
      <Text dimColor>{'  Se aplica la próxima vez que abras Claude Code, que pregunta una vez si lo activás.'}</Text>
    </Box>
  )
}

/** The microphone menu: the system's default, then each microphone connected; the one in use marked. */
async function micMenu ($: EngineInterface, e: Drawn) {
  const connected = await read($, mics)
  // The microphone picked; none picked, or not connected now: the system's default (empty).
  const picked = await read($, mic)
  const chosenMic = connected.includes(picked) ? picked : ''
  const systemDefault = `Predeterminado de ${systemName(await osNow($))}`
  const elements = glyphed($.ui.resolve(e))
  const { Box, Button, Text } = elements
  return (
    <Box flexDirection="column">
      {connected.length === 0 ? <Text dimColor>Buscando micrófonos…</Text> : null}
      {(connected.length === 0 ? [] : ['', ...connected]).map(name => {
        const isChosen = name === chosenMic
        const label = ` ${isChosen ? '●' : '○'} ${name ? micName(name) : systemDefault} `
        if (isChosen && 'Client' in elements) {
          return <elements.Client key={`speedy:chosen:mic:${name}`} module="./control.tsx" width={cells(label)} props={{ label, color: 'black', bold: true, backgroundColor: '#ff8787' }} />
        }
        return (
          <Button key={`mic:${name}`} plain onPress={() => { void pickMic($, name) }}>
            <Text bold={isChosen} color={isChosen ? 'black' : '#ff8787'} backgroundColor={isChosen ? '#ff8787' : undefined}>
              {label}
            </Text>
          </Button>
        )
      })}
    </Box>
  )
}

/**
 * The model menu's entry for what the session runs: `claude-opus-5-5`, `claude-opus-5-5[1m]` and the
 * alias `opus` all name Opus 5.5. Undefined for a model the menu does not offer.
 */
export function modelOf (current: string) {
  const name = current.toLowerCase().replace(/\[.*\]$/, '').trim()
  return MODELS.find(([id]) => name === id || name.startsWith(`${id}-`)) ??
    MODELS.find(([id]) => id.split('-')[1] === name)
}

/** The footer's label for the model in use: its short name, or the id itself if the menu lacks it. */
export function modelLabel (current: string) {
  return modelOf(current)?.[1] ?? (current.replace(/^claude-/, '') || 'modelo')
}

/**
 * Applies what the model menu has picked, as the person typing `/model <id>` and then
 * `/effort <level>` would: the model first, since a new model starts from its own effort.
 */
async function applyModel ($: EngineInterface) {
  const [id, level] = [await read($, modelPick), await read($, effortPick)]
  const current = modelOf(await $.session.model().catch(() => ''))?.[0] ?? ''
  await closeMenu($, 'models')
  const done: string[] = []
  if (id && id !== current) {
    const ran = await $.command.run({ command: 'model', args: id }).then(() => true, () => false)
    if (!ran) {
      $.ui.toast(`speedy-code: no pude cambiar el modelo; escribí /model ${id}.`)
      return
    }
    done.push(modelOf(id)?.[1] ?? id)
    // A new model starts from its own effort: unknown here until its first request says it.
    await update($, effort, () => '')
  }
  if (level) {
    const ran = await $.command.run({ command: 'effort', args: level }).then(() => true, () => false)
    if (!ran) {
      $.ui.toast(`speedy-code: no pude cambiar el esfuerzo; escribí /effort ${level}.`)
      return
    }
    await update($, effort, () => level)
    done.push(`esfuerzo ${level}`)
  }
  $.ui.toast(done.length ? `speedy-code: ahora con ${done.join(' · ')}` : 'speedy-code: sin cambios.')
}

/**
 * The model menu: each model with what it is for, then the effort levels, then Aplicar. A click
 * only picks; Aplicar runs `/model` and `/effort`. The model in use and the effort last applied
 * are marked with a dot; what is picked, filled with its color.
 */
async function modelMenu ($: EngineInterface, e: Drawn, room = 90) {
  const current = modelOf(await $.session.model().catch(() => ''))?.[0] ?? ''
  const [picked, level, applied] = [await read($, modelPick), await read($, effortPick), await read($, effort)]
  const chosenModel = picked || current
  // The one chosen is a Client: a Button inverts under the pointer, and its fill would go.
  const elements = glyphed($.ui.resolve(e))
  const { Box, Button, Text } = elements
  const width = Math.max(...MODELS.map(([, name]) => name.length)) + 4
  // Narrow: the use goes on the line below its model, so neither is cut.
  const isNarrow = room - 4 < width + Math.max(...MODELS.map(([, , use]) => use.length)) + 2
  return (
    <Box flexDirection="column">
      <Text bold dimColor>MODELO</Text>
      {MODELS.map(([id, name, use, color]) => {
        const isChosen = id === chosenModel
        const label = ` ${id === current ? '●' : '○'} ${name.padEnd(width - 4)} `
        return (
          // A Button holds text alone: the row is a Box, and the name and its use each pick the model.
          <Box key={`model-row:${id}`} flexDirection={isNarrow ? 'column' : 'row'}>
            {isChosen && 'Client' in elements
              ? <elements.Client key={`speedy:chosen:model:${id}`} module="./control.tsx" width={cells(label)} props={{ label, color: 'black', bold: true, backgroundColor: color }} />
              : (
                <Button key={`model:${id}`} plain onPress={() => { void update($, modelPick, () => id) }}>
                  <Text bold color={isChosen ? 'black' : color} backgroundColor={isChosen ? color : undefined}>{label}</Text>
                </Button>
                )}
            {/* Narrow, the use goes below, indented on every line it wraps to. */}
            <Box paddingLeft={isNarrow ? 4 : 2} flexShrink={1}>
              <Button key={`model-use:${id}`} plain onPress={() => { void update($, modelPick, () => id) }}>
                <Text dimColor={!isChosen} color={isChosen ? color : undefined}>{use}</Text>
              </Button>
            </Box>
          </Box>
        )
      })}
      <Text> </Text>
      <Text bold dimColor>ESFUERZO</Text>
      <Box flexDirection="row">
        {EFFORTS.map(([name, color]) => {
          // Filled like the model: the level picked, or the one in force while nothing is picked.
          const isChosen = name === (level || applied)
          return (
            // A cell between levels, so two filled ones (the one in force and the one picked) never touch.
            <Box key={`effort-cell:${name}`} marginRight={1} flexShrink={0}>
              {isChosen && 'Client' in elements
                ? <elements.Client key={`speedy:chosen:effort:${name}`} module="./control.tsx" width={cells(`${name === applied ? '●' : '○'} ${name} `)} props={{ label: `${name === applied ? '●' : '○'} ${name} `, color: 'black', bold: true, backgroundColor: color }} />
                : (
                  <Button key={`effort:${name}`} plain onPress={() => { void update($, effortPick, now => now === name ? '' : name) }}>
                    <Text bold color={isChosen ? 'black' : color} backgroundColor={isChosen ? color : undefined}>
                      {`${name === applied ? '●' : '○'} ${name} `}
                    </Text>
                  </Button>
                  )}
            </Box>
          )
        })}
      </Box>
      <Box flexDirection="row" justifyContent="center" marginTop={1}>
        <Button key="models:apply" plain onPress={() => { void applyModel($) }}>
          <Text bold color="black" backgroundColor={MODEL_COLOR}>{'  Aplicar  '}</Text>
        </Button>
      </Box>
    </Box>
  )
}

/** The voice menu: a tab per language, then its women and men side by side, the current voice marked. */
/**
 * The voice menu, laid out for `width` cells and `rows` rows: as many language tabs and voice
 * columns (up to four) as the width holds, and the voices paged so the menu never grows past the
 * rows. A band taller than its rows scrolls whole, title and tabs too: fitting it keeps them in place.
 */
async function voiceMenu ($: EngineInterface, e: Drawn, width = 90, rows = 40) {
  const lang = await read($, tab)
  const chosen = await read($, picks)
  const active = chosen.active ?? DEFAULT_LANG
  const current = chosen[lang] ?? ''
  const all = await read($, voices)
  const known = distinctVoices(all.filter(v => v.lang === lang), current)
  const accent = languageColor(lang)
  const elements = glyphed($.ui.resolve(e))
  const { Box, Button, Text } = elements

  const pick = async (picked: Voice) => {
    // The language picked is the one narrated in from now on: `active`.
    await savePicks($, { ...(await read($, picks)), [picked.lang]: picked.value, active: picked.lang })
    $.ui.toast(`El narrador ahora habla en ${languageName(picked.lang)}, con ${picked.name} · ${picked.country}`)
    await closeMenu($, 'voices')
  }

  // One gender at a time, picked with the switch.
  const shown = await read($, gender)
  const color = shown === 'Female' ? FEMALE : MALE
  const list = known.filter(v => v.gender === shown)

  // The cells: inside the frame's border and padding, as many tabs and voice columns as fit.
  const inside = Math.max(20, width - 4)
  const tabsPerRow = Math.max(1, Math.floor(inside / TAB_WIDTH))
  const tabRows = Math.ceil(LANGUAGES.length / tabsPerRow)
  const columns = Math.min(4, Math.max(1, Math.floor((inside + COLUMN_GAP) / (VOICE_WIDTH + COLUMN_GAP))))
  // The rows left for voices: the frame's three, the tabs, a blank, the switch and a blank.
  const voiceRows = Math.max(3, rows - 3 - tabRows - 3)
  const perPage = voiceRows * columns
  const pages = Math.max(1, Math.ceil(list.length / perPage))
  const at = Math.min(await read($, page), pages - 1)
  const shownVoices = list.slice(at * perPage, (at + 1) * perPage)
  // Filled down the first column, then the next: the order reads top to bottom.
  const perColumn = Math.ceil(shownVoices.length / columns)
  const columnsOf = Array.from({ length: columns }, (_, index) => shownVoices.slice(index * perColumn, (index + 1) * perColumn))

  const turn = (to: number) => { void update($, page, () => Math.min(Math.max(to, 0), pages - 1)) }

  const genderSwitch = (
    <Box flexDirection="row" flexWrap="wrap" marginTop={1} marginBottom={1}>
      {([['Female', '♀ Mujeres', FEMALE], ['Male', '♂ Hombres', MALE]] as const).map(([value, label, tint]) => {
        const isOn = value === shown
        const count = known.filter(v => v.gender === value).length
        return (
          <Box key={`gender-cell:${value}`} marginRight={2} flexShrink={0}>
            {/* A Client, not a Button: a Button inverts under the pointer, and the fill of the one
                chosen would go while the pointer is on it. */}
            {'Client' in elements
              ? <elements.Client key={`speedy:gender:${value}`} module="./control.tsx" width={cells(` ${label}  ${count} `)} props={{ label: ` ${label}  ${count} `, color: isOn ? 'black' : tint, bold: true, ...(isOn ? { backgroundColor: tint } : {}) }} />
              : (
                <Button key={`gender:${value}`} plain onPress={() => { void update($, gender, () => value).then(() => update($, page, () => 0)) }}>
                  <Text bold color={isOn ? 'black' : tint} backgroundColor={isOn ? tint : undefined}>{` ${label}  ${count} `}</Text>
                </Button>
                )}
          </Box>
        )
      })}
      {pages > 1
        ? (
          <Box flexDirection="row" flexShrink={0} marginRight={2}>
            <Button key="page:previous" plain onPress={() => turn(at - 1)}>
              <Text bold color={at > 0 ? color : DISABLED}>{' ◀ '}</Text>
            </Button>
            <Text color={color}>{` ${at + 1}/${pages} `}</Text>
            <Button key="page:next" plain onPress={() => turn(at + 1)}>
              <Text bold color={at < pages - 1 ? color : DISABLED}>{' ▶ '}</Text>
            </Button>
          </Box>
          )
        : null}
    </Box>
  )

  const column = (part: Voice[], side: string) => {
    return (
      <Box key={`column:${side}`} flexDirection="column" width={VOICE_WIDTH}>
        {part.map(v => {
          const isCurrent = v.value === current
          if (isCurrent && 'Client' in elements) {
            const label = ` ● ${fit(v.name, NAME_WIDTH)} ${fit(v.country, COUNTRY_WIDTH)}`
            return <elements.Client key={`speedy:chosen:voice:${v.value}`} module="./control.tsx" width={cells(label)} props={{ label, color: 'white', bold: true, backgroundColor: '#2b8a3e' }} />
          }
          return (
            <Button key={v.value} plain onPress={() => { void pick(v) }}>
              <Text backgroundColor={isCurrent ? '#2b8a3e' : undefined}>
                <Text color={isCurrent ? 'white' : color}>{isCurrent ? ' ● ' : ' ♪ '}</Text>
                <Text bold color={isCurrent ? 'white' : undefined}>{fit(v.name, NAME_WIDTH)}</Text>{' '}
                <Text color={isCurrent ? 'white' : accent}>{fit(v.country, COUNTRY_WIDTH)}</Text>
              </Text>
            </Button>
          )
        })}
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" flexWrap="wrap">
        {LANGUAGES.map(([code, label, , tint]) => {
          const isOpen = code === lang
          const mark = active === code ? '▶' : ''
          return (
            <Box key={`cell:${code}`} width={TAB_WIDTH}>
              {isOpen && 'Client' in elements
                ? <elements.Client key={`speedy:chosen:lang:${code}`} module="./control.tsx" width={TAB_WIDTH - 1} props={{ label: fit(` ${label} ${mark}`, TAB_WIDTH - 1), color: 'black', bold: true, backgroundColor: tint }} />
                : (
                  <Button key={`tab:${code}`} plain onPress={() => { void update($, tab, () => code).then(() => update($, page, () => 0)) }}>
                    <Text bold color={isOpen ? 'black' : tint} backgroundColor={isOpen ? tint : undefined}>
                      {fit(` ${label} ${mark}`, TAB_WIDTH - 1)}
                    </Text>
                  </Button>
                  )}
            </Box>
          )
        })}
      </Box>
      {all.length === 0
        ? <Text dimColor>Cargando voces…</Text>
        : (
          <Box flexDirection="column">
            {genderSwitch}
            <Box flexDirection="row" columnGap={COLUMN_GAP}>
              {columnsOf.map((part, index) => column(part, String(index)))}
            </Box>
          </Box>
          )}
    </Box>
  )
}

export const register: Register = on => {
  isInteractive = true
  current = undefined
  lastAnswer = ''
  takenSelection = ''
  lastRead = { selection: '', clipboard: '', source: '' }
  clearedClipboard = undefined
  clearedSelection = undefined

  // The warnings: once each, when the context or a limit crosses its line, and again only after it falls back.
  // The context line is where Claude Code compacts (about 80% used); a limit warns at 90% used.
  let warnedContext = false
  const warnedLimits = new Set<string>()
  on('session.measure', async ($, e, next) => {
    const levels = await read($, barLevels)
    const used = e.context.percent ?? 0
    if ((used >= levels.contextRed) !== (contextUsed >= levels.contextRed)) $.ui.invalidate('ui.render')
    contextUsed = used
    if (used >= levels.contextRed && !warnedContext) {
      warnedContext = true
      $.ui.toast(`speedy-code: el contexto va al ${used}%. Claude Code compacta cerca de ahí: /compact ahora, o empezá una sesión nueva.`)
    } else if (used < levels.contextRed) {
      warnedContext = false
    }
    for (const limit of e.rateLimits) {
      if (limit.percentUsed >= levels.limitRed && !warnedLimits.has(limit.kind)) {
        warnedLimits.add(limit.kind)
        $.ui.toast(`speedy-code: el límite ${limit.kind} va al ${Math.round(limit.percentUsed)}%${limit.resetsAt ? ` y se reinicia ${limit.resetsAt}` : ''}.`)
      } else if (limit.percentUsed < levels.limitRed) {
        warnedLimits.delete(limit.kind)
      }
    }
    return next(e)
  })

  on('session.start', async ($, e, next) => {
    isInteractive = e.isInteractive
    // A reload starts the session again: the version is asked of git again, so a pull shows at once.
    versionKnown = undefined
    versionFails = 0
    // The folder and the branch after the ✕: the branch changes with a checkout, so it is asked again.
    void followPlace($)
    $.clock.every(5000, () => followPlace($))
    // A session starts with no dictation under way: a state left from before a reload is cleared here.
    if (!listenFile) {
      await update($, listening, () => 'off')
      await update($, heard, () => [])
    }
    // The model in use, followed as it changes: see followModel.
    $.clock.every(1500, () => followModel($))
    // The images menu, kept in step with what is pasted while it is open: see followImages.
    $.clock.every(1500, () => followImages($))
    // The draft's [Image #N], painted and with a chip each above the prompt: see followDraft.
    if (e.isInteractive) $.clock.every(500, () => followDraft($))
    // The mode known before a reload stands; a new session starts where the settings say.
    modeKnown = { ...modeKnown, now: modeKnown.now || (await read($, permissionMode)), start: await settingsMode($) }
    // The permission mode as it is put together, handed to the footer: see followMode.
    $.clock.every(MODE_FOLLOW_MS, () => followMode($))
    await $.command.register({
      name: 'speedy',
      description: 'Lee en voz alta las respuestas · sin argumento: prende o apaga',
      argumentHint: '[on | off | stop | leer | voces]',
      immediate: true
    })
    // On until the person turns it off.
    const stored = await $.store.get('isEnabled')
    await update($, isEnabled, () => stored !== false)
    const saved = await loadPicks($)
    await update($, picks, () => saved)
    void loadVoices($)
    const savedSize = await $.store.get('fontSize')
    if (typeof savedSize === 'number') await update($, fontSize, () => savedSize)
    const savedFamily = await $.store.get('fontFamily')
    if (FONT_FAMILIES.some(([id]) => id === savedFamily)) await update($, fontFamily, () => savedFamily as FontFamily)
    if ((await osNow($)) === 'mac') glyphGap = ' '
    // Nerd Fonts glyphs whenever a Nerd Font is installed; emojis only where none is.
    const iconSet = startIcons(await $.store.get('icons'), await hasNerdFont($))
    isGlyphs = iconSet === 'nerd'
    if (isGlyphs) await update($, icons, () => iconSet)
    if ((await $.store.get('labels')) === false) await update($, hasLabels, () => false)
    const savedMic = await $.store.get('mic')
    if (typeof savedMic === 'string') await update($, mic, () => savedMic)
    void loadMics($)
    // A first start, with nothing installed beside the code: the settings open on the setup tab.
    if (!(await $.fs.exists(await python($)).catch(() => false))) {
      await update($, settingsTab, () => 'setup')
      if (isInteractive) $.ui.toast('speedy-code: falta instalar las voces y el dictado. Abrí ⚙️ → Instalación.')
    }
    const savedSocials = await $.store.get('socials')
    // The names saved, whole; the defaults only where nothing was ever saved.
    if (savedSocials && typeof savedSocials === 'object') await update($, socials, () => savedSocials as Socials)
    // The levels: the saved ones, else the defaults; the file the status line reads follows them.
    const savedLevels = await $.store.get('barLevels')
    const savedOrder = await $.store.get('barOrder')
    if (savedLevels && typeof savedLevels === 'object') await update($, barLevels, () => savedLevels as BarLevels)
    await update($, barOrder, () => barOrderOf(savedOrder))
    await writeBarFile($)
    // The version goes to the status line, at its end: asked here, outside any draw, whose runs the next
    // draw cuts off, and written beside the levels once git has told it.
    void followVersion($)
    // And again every minute: a pull, or a reload that reads no file again, shows without a new session.
    $.clock.every(VERSION_FOLLOW_MS, () => followVersion($))
    // A newer version on GitHub, asked now and every hour: ↓ after the version, and 🔄 takes it.
    void checkUpdate($)
    $.clock.every(UPDATE_CHECK_MS, () => checkUpdate($))
    // The status line in use is a copy of this mod's: switched on, it is copied again, so an update
    // of the mod reaches it without switching it off and on.
    void switchStatusLine($, 'status').then(async () => {
      if ((await read($, statusLine)) === 'on') await switchStatusLine($, 'on')
    })
    // Code Mode's switch says where it stands from the start, a reload included: not "leyendo…".
    void switchCodeMode($, 'status')
    // The explorer is open from the start, on the session's folder.
    if (e.isInteractive) void showExplorer($).catch(() => undefined)
    return next(e)
  })

  // A new conversation, or the session moved to another folder (typed, or by the + menu): the explorer
  // shows the session's folder, opened again if it was closed.
  for (const command of ['clear', 'cd']) {
    on('command.run', { command }, async ($, e, next) => {
      // A command run with no arguments has none to hand on: next() takes it with empty ones.
      const result = await next({ ...e, args: e.args ?? '' })
      if (isInteractive) {
        const root = await $.session.root().catch(() => '')
        if (root) rootSeen = root
        void followPlace($)
        await showExplorer($, root).catch(() => undefined)
      }
      return result
    })
  }

  on('session.end', async ($, e, next) => {
    await stop($)
    await stopListening($)
    // Leaving (not a /clear, nor a resume that goes on in this process): the command that comes
    // back to this session goes to the clipboard, to paste in the terminal Claude Code leaves.
    if (e.reason !== 'clear' && e.reason !== 'resume' && e.resume?.id) await copyResume($, e.resume.id)
    return next(e)
  })

  // A new prompt means the person has moved on: stop talking.
  on('prompt.submit', async ($, e, next) => {
    await stop($)
    await stopListening($)
    return next(e)
  })

  // The effort in force rides on each model request: /effort typed in the terminal is seen here,
  // and the footer redraws when it changed. A subagent's requests carry its own effort, not the
  // session's, so they are left out; a request with none (a model without effort) clears it.
  // turn.step streams, so its hook is an async generator that forwards the stream unchanged.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined && typeof e.effort !== 'number') {
      const now = e.effort ?? ''
      if (now !== (await read($, effort))) {
        await update($, effort, () => now)
        $.ui.invalidate('ui.render')
      }
    }
    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.reason === 'answer' && e.answer.trim()) {
      lastAnswer = e.answer
      if (isInteractive && (await read($, isEnabled))) void narrate($, e.answer, '', true)
    }
    return result
  })

  on('command.run', { command: 'speedy' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stop') { await stop($); return { text: 'speedy-code: callado.' } }
    if (arg === 'leer') {
      if (!lastAnswer) return { text: 'speedy-code: todavía no hay respuesta para leer.' }
      void narrate($, lastAnswer, '', true)
      return { text: 'speedy-code: leyendo la última respuesta.' }
    }
    if (arg === 'voces') { await openPicker($); return { text: 'speedy-code: elegí la voz en el panel.' } }
    if (arg !== '' && arg !== 'on' && arg !== 'off') return { text: 'Uso: /speedy [on | off | stop | leer | voces]' }
    const now = await setEnabled($, arg === '' ? !(await read($, isEnabled)) : arg === 'on')
    return { text: now ? 'speedy-code: narrador prendido, leo cada respuesta en voz alta.' : 'speedy-code: narrador apagado.' }
  })

  // The footer: the voice (a click opens the picker), the speaker that switches it on and off, and,
  // while it is on, one play button: it reads the last answer again, pauses, or goes on. Each is a
  // Client: underlined under the pointer, never inverted.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    // Only the terminal and the desktop draw a Client.
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e)
    const groups = (await footerGroups($, e)).filter(group => group.width > 0)
    const beneath = await next(e)
    const { Box, Client, Text } = glyphed($.ui.resolve(e))
    // The room the controls have: the terminal's width less the mode labels, the ` · ` and a margin.
    const modes = e.props.modes.join(' & ')
    // A pane docked beside the transcript narrows the width the footer is told, but the footer runs under
    // it the whole width: the dock's columns are given back, so its controls stay out of ⋯.
    const columns = e.viewport?.columns === undefined ? undefined : e.viewport.columns + explorerDock
    const room = (columns ?? Number.MAX_SAFE_INTEGER) - (modes ? cells(modes) + 3 : 0) - 4
    // The folder and the branch keep their room: the controls ranked lowest go to ⋯ first. Only when even
    // those always drawn would give way are they left out.
    const branchSign = isGlyphs ? `\uf126${glyphGap}` : '⎇ '
    const folderText = place.folder ? ` ${place.folder}${place.branch ? '' : ' '}` : ''
    const branchText = place.folder && place.branch ? ` ${branchSign}${place.branch} ` : ''
    const placeWidth = cells(folderText) + cells(branchText)
    const kept = placeWidth ? footerFit(groups, room - placeWidth) : undefined
    const keepsAll = kept !== undefined && groups.every(group => (FOOTER_RANKS[group.name] ?? 9) !== 0 || kept.shown.has(group.name))
    const { shown, compact } = keepsAll && kept ? kept : footerFit(groups, room)
    hiddenGroups = groups.filter(group => !shown.has(group.name)).map(group => group.name)
    const drawn = (group: (typeof groups)[number]) => compact.has(group.name) && 'compactNode' in group ? group.compactNode : group.node
    // The cells the controls take as drawn, and the place after them while it still fits.
    const taken = groups.filter(group => shown.has(group.name)).reduce((sum, group) => sum + (compact.has(group.name) && 'compactWidth' in group ? group.compactWidth : group.width), hiddenGroups.length > 0 ? MORE_WIDTH : 0)
    const isPlaced = placeWidth > 0 && taken + placeWidth <= room
    terminalColumns = columns ?? terminalColumns
    const blank = footerBlank(columns, taken + (isPlaced ? placeWidth : 0) + (modes ? cells(modes) + 3 : 0))
    return (
      <Box flexDirection="row" flexWrap="nowrap">
        {beneath}
        {/* The dot sets the controls off the mode labels: with none, there is nothing to set off. */}
        {e.props.modes.length > 0 ? <Text dimColor> · </Text> : null}
        {groups.filter(group => shown.has(group.name) && group.name !== 'exit').map(drawn)}
        {/* What did not fit waits behind ⋯, in a panel above the prompt. */}
        {hiddenGroups.length > 0 ? <Client key="speedy:more" module="./control.tsx" width={MORE_WIDTH} props={{ label: ' ⋯ ', color: '#adb5bd', bold: true }} /> : null}
        {groups.find(group => group.name === 'exit')?.node}
        {isPlaced
          ? (
            <Box key="speedy:placed" flexShrink={0}>
              {/* A click opens the folder in the system's file manager. */}
              <Client key="speedy:place" module="./control.tsx" width={cells(folderText)} props={{ label: folderText, color: FOLDER_COLOR, bold: true }} />
              {branchText ? <Text color={BRANCH_COLOR}>{branchText}</Text> : null}
            </Box>
            )
          : null}
        {/* Claude Code sets the footer against the right edge: this blank brings it to the middle. */}
        {blank > 0 ? <Box key="speedy:blank" width={blank} flexShrink={0} /> : null}
      </Box>
    )
  })

  // A prompt sent and an answer ended say the permission mode outright.
  on('classic.UserPromptSubmit', async (_, e, next) => { modeSaid(e.permission_mode); return next(e) })
  on('classic.Stop', async (_, e, next) => { modeSaid(e.permission_mode); return next(e) })

  // The line under the prompt names the permission mode as it is left: read there, and left as it is.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    // Drawing writes no state: what is known is kept here, and followMode hands it to the footer.
    modeKnown = modeAfterHint(modeKnown, e.props.hint)
    return next(e)
  })

  // A footer control was clicked.
  on('ui.message', async ($, e, next) => {
    const result = await next(e)
    const data = e.data as { isClicked?: unknown, scrollTo?: unknown } | null
    // The explorer's scroll bar, held and moved: the tree's first row it asks for.
    if (e.element === 'speedy:explorer-bar') {
      const to = data?.scrollTo
      if (typeof to !== 'number' || !Number.isFinite(to)) return result
      // The rows asked for while the tree was being moved are passed over: it goes to the last one.
      barAsked = Math.max(0, Math.round(to))
      if (isBarMoving) return result
      isBarMoving = true
      try {
        while (barAsked !== undefined) {
          const top = barAsked
          barAsked = undefined
          await update($, explorer, now => now.top === top ? now : { ...now, top })
          // A terminal that reports pixels asks for a row at each one: the tree is drawn so many times a second, no more.
          await $.clock.sleep(BAR_PACE_MS)
        }
      } finally {
        isBarMoving = false
      }
      return result
    }
    if (!e.element.startsWith('speedy:') || data?.isClicked !== true) return result
    if (e.element === 'speedy:voice') {
      const active = (await read($, picks)).active ?? DEFAULT_LANG
      await update($, tab, () => active)
      await openPicker($)
    } else if (e.element === 'speedy:switch') {
      await setEnabled($, !(await read($, isEnabled)))
    } else if (e.element === 'speedy:mode') {
      await closeMenu($, 'more')
      await openMenu($, 'mode')
    } else if (e.element === 'speedy:sessions') {
      await closeMenu($, 'more')
      await openMenu($, 'sessions')
    } else if (e.element.startsWith('speedy:explorer-')) {
      // A file tool of the explorer: what it does, then the file's path, which may hold `:` itself.
      const rest = e.element.slice('speedy:explorer-'.length)
      const kind = rest.slice(0, rest.indexOf(':'))
      const path = rest.slice(rest.indexOf(':') + 1)
      await forgetFound($)
      // A disk is not copied, renamed or trashed: those three do nothing on its root but say so.
      if (DISK_IDLE_TOOLS.includes(kind)) {
        const { drives, caseless } = await read($, explorer)
        if (drives.some(drive => pathKey(drive, caseless) === pathKey(path, caseless))) {
          $.ui.toast('speedy-code: un disco no se copia, no se renombra ni se borra.')
          return result
        }
      }
      if (kind === 'view') void viewTreeFile($, path)
      if (kind === 'folder') await toggleTreeFolder($, path)
      if (kind === 'copy' || kind === 'path') void flashTool($, e.element)
      if (kind === 'copy') await copyFileToClipboard($, path)
      else if (kind === 'path') await copyPathToClipboard($, path, e.surface)
      else if (kind === 'trash') void askTrash($, path)
      else if (kind === 'rename') void askRename($, path)
      else if (kind === 'paste') void pasteInto($, path)
      else if (kind === 'mkdir') {
        void flashTool($, e.element)
        void askNewFolder($, path)
      }
      else if (kind === 'work') {
        void flashTool($, e.element)
        await openNewIn($, path)
      }
      else if (kind === 'unfilter') await clearFilter($)
      else if (kind === 'pause') await pauseFilter($)
      else if (kind === 'collapse') {
        void flashTool($, e.element)
        await collapseExplorer($)
      }
    } else if (e.element === 'speedy:place') {
      await toggleExplorer($)
    } else if (e.element === 'speedy:socials') {
      await closeMenu($, 'more')
      await openMenu($, 'socials')
    } else if (e.element === 'speedy:compact') {
      await closeMenu($, 'more')
      await $.command.run({ command: 'compact' }).catch(() => { $.ui.toast('speedy-code: no pude compactar; escribí /compact.') })
    } else if (e.element.startsWith('speedy:chosen:')) {
      // A chosen option, drawn as a Client so its fill stays under the pointer: what its Button did.
      const [kind, ...rest] = e.element.slice('speedy:chosen:'.length).split(':')
      const value = rest.join(':')
      if (kind === 'effort') await update($, effortPick, now => now === value ? '' : value)
      else if (kind === 'mic') await pickMic($, value)
      else if (kind === 'lang') await update($, page, () => 0)
      else if (kind === 'voice') {
        const chosenVoice = (await read($, voices)).find(v => v.value === value)
        if (chosenVoice) {
          await savePicks($, { ...(await read($, picks)), [chosenVoice.lang]: chosenVoice.value, active: chosenVoice.lang })
          $.ui.toast(`El narrador ahora habla en ${languageName(chosenVoice.lang)}, con ${chosenVoice.name} · ${chosenVoice.country}`)
          await closeMenu($, 'voices')
        }
      }
    } else if (e.element.startsWith('speedy:gender:')) {
      const chosenGender = e.element.slice('speedy:gender:'.length) === 'Male' ? 'Male' : 'Female'
      await update($, gender, () => chosenGender)
      await update($, page, () => 0)
    } else if (e.element === 'speedy:images') {
      await openMenu($, 'images')
    } else if (e.element === 'speedy:images-clear') {
      await clearImages($)
    } else if (e.element.startsWith('speedy:image-view:')) {
      const image = (await read($, pastedImages))[Number(e.element.slice('speedy:image-view:'.length))]
      if (image) void openView($, image)
    } else if (e.element.startsWith('speedy:image-paste:')) {
      const image = (await read($, pastedImages))[Number(e.element.slice('speedy:image-paste:'.length))]
      if (image) await repasteImage($, image)
    } else if (e.element.startsWith('speedy:draft-image:')) {
      // A chip above the prompt: its image opens straight in the popup, with no menu.
      const image = await draftImage($, Number(e.element.slice('speedy:draft-image:'.length)))
      if (image) void openView($, image)
      else $.ui.toast('speedy-code: esa imagen ya no está guardada.')
    } else if (e.element === 'speedy:clip-read') {
      await readPending($)
    } else if (e.element === 'speedy:clip-clear') {
      await clearClips($)
    } else if (e.element.startsWith('speedy:clip-play:')) {
      const clip = (await read($, clips))[Number(e.element.slice('speedy:clip-play:'.length))]
      if (clip) void clipPress($, clip)
    } else if (e.element === 'speedy:more') {
      await openMenu($, 'more')
    } else if (e.element === 'speedy:settings') {
      await openMenu($, 'settings')
    } else if (e.element === 'speedy:model' || e.element === 'speedy:effort') {
      await openMenu($, 'models')
    } else if (e.element === 'speedy:reload') {
      await updateAndReload($)
    } else if (e.element === 'speedy:exit') {
      // As the person typing /exit: the session ends, and session.end copies how to come back.
      await $.command.run({ command: 'exit' }).catch(() => { $.ui.toast('speedy-code: no pude salir; escribí /exit.') })
    } else if (e.element === 'speedy:menu-close') {
      const shown = await read($, menu)
      if (shown) await closeMenu($, shown)
    } else if (e.element === 'speedy:copy') {
      const draft = (await $.prompt.read()).text
      if (!draft) $.ui.toast('speedy-code: el prompt está vacío.')
      else {
        const copied = await $.ui.copy({ text: draft, surface: e.surface })
        $.ui.toast(copied.isCopied ? `speedy-code: copié ${draft.length} caracteres del prompt.` : 'speedy-code: no pude copiar al portapapeles.')
      }
    } else if (e.element === 'speedy:paste') {
      const text = await clipboardText($)
      if (!text) $.ui.toast('speedy-code: el portapapeles está vacío.')
      else await $.prompt.fill({ text, mode: 'insert' })
    } else if (e.element === 'speedy:polish') {
      void polish($)
    } else if (e.element === 'speedy:send') {
      await sendPrompt($)
    } else if (e.element === 'speedy:new') {
      // Its name is asked first, where there is a field to type it in; with none it starts at once.
      // In a menu above the prompt, as the others: the band takes the keyboard on a click, so the
      // field is clicked before the name is typed. A pane takes it as it opens, but docks at the side.
      await closeMenu($, 'more')
      newFolder = ''
      if (e.surface === 'terminal' || e.surface === 'desktop') await openMenu($, 'new')
      else await startConversation($, '')
    } else if (e.element === 'speedy:image') {
      await pasteImage($)
    } else if (e.element === 'speedy:clear') {
      await $.prompt.fill({ text: '', mode: 'replace' })
    } else if (e.element === 'speedy:mics') {
      void loadMics($)
      await openMenu($, 'mic')
    } else if (e.element === 'speedy:mic') {
      if ((await read($, listening)) === 'off') void listen($)
      else await stopListening($)
    } else if (e.element === 'speedy:clip') {
      // The selection is taken as 📎 is pressed, before the menu opens, so it is not lost to the menu.
      if ((await read($, menu)) !== 'history') await takeSelection($)
      await openMenu($, 'history')
    } else if (e.element === 'speedy:play' && isPlayable(await read($, speech))) {
      await pressPlay($)
    }
    return result
  })

  // While dictating, above the prompt: what the quick model heard of each phrase not yet written.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const shown = await read($, menu)
    if (shown && !e.props.hasSurvey) {
      if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e)
      const { Box, Client, Text } = glyphed($.ui.resolve(e))
      const chosen = await read($, picks)
      // The model menu's title says what is in use now: the model, and the effort when it is known.
      const inUse = shown === 'models'
        ? [modelLabel((await read($, modelNow)) || (await $.session.model().catch(() => ''))), await read($, effort)].filter(Boolean).join(' · ')
        : ''
      const title = ` ${shown === 'voices' ? voiceTitle(chosen) : shown === 'mic' ? 'Micrófono para dictar' : shown === 'models' ? `Modelo de Claude (${inUse})` : shown === 'more' ? 'Más' : shown === 'history' ? '📎 Audios' : shown === 'images' ? 'Imágenes' : shown === 'socials' ? 'Redes sociales' : shown === 'new' ? '+ Conversación nueva' : shown === 'sessions' ? 'Conversaciones' : shown === 'mode' ? 'Modo de permisos' : 'Configuración'} `
      const color = shown === 'voices' ? languageColor(chosen.active ?? DEFAULT_LANG) : shown === 'mic' ? MIC_COLORS.on : shown === 'models' ? MODEL_COLOR : shown === 'history' ? '#ffd43b' : shown === 'images' ? '#74c0fc' : shown === 'socials' ? SOCIALS_COLOR : shown === 'new' ? NEW_COLOR : shown === 'sessions' ? SESSIONS_COLOR : shown === 'mode' ? MODE_COLOR : '#adb5bd'
      // A frame around the menu, its title in the middle of the top border and the close button at
      // its right end. Absolute positions are clipped, so the title row comes after the frame in the
      // tree (drawn over it) and column-reverse puts it on top, pulled one row down onto the border:
      // it paints its own letters alone, the rest of the border stays.
      const width = e.props.bodyColumns || 90
      return (
        <Box flexDirection="column-reverse" width={width}>
          <Box flexDirection="column" width={width} borderStyle="single" borderColor={color} paddingX={1} paddingTop={1}>
            {shown === 'voices' ? await voiceMenu($, e, width, e.props.maxRows) : shown === 'mic' ? await micMenu($, e) : shown === 'models' ? await modelMenu($, e, width) : shown === 'more' ? await moreMenu($, e, width) : shown === 'history' ? await historyMenu($, e, width) : shown === 'images' ? await imagesMenu($, e) : shown === 'socials' ? await socialsMenu($, e, width) : shown === 'new' ? await newMenu($, e) : shown === 'sessions' ? await sessionsMenu($, e, width) : shown === 'mode' ? await modeMenu($, e) : await settingsMenu($, e, width, e.props.maxRows)}
          </Box>
          <Box flexDirection="row" width={width} marginBottom={-1}>
            <Box flexGrow={1} justifyContent="center">
              <Text bold color={color}>{title}</Text>
            </Box>
            {/* A Client, not a Button: no background under the pointer. Two empty cells after it
                leave the border's last line and its corner showing. */}
            <Client key="speedy:menu-close" module="./control.tsx" width={3} props={{ label: ' × ', color: '#ff6b6b', bold: true }} />
            <Box width={2} />
          </Box>
        </Box>
      )
    }
    const [now, list] = [await read($, listening), await read($, heard)]
    // The draft's images, a chip each: only where a Client is drawn.
    const ids = e.surface === 'terminal' || e.surface === 'desktop' ? await read($, draftIds) : []
    if (e.props.hasSurvey || (now === 'off' && list.length === 0 && ids.length === 0)) return next(e)
    const elements = glyphed($.ui.resolve(e))
    const { Box, Text } = elements
    const chips = ids.length > 0 && 'Client' in elements
      ? (
        <Box key="draft-images" flexDirection="row" columnGap={1}>
          {ids.map(id => {
            const label = `[Image #${id}]`
            return <elements.Client key={`speedy:draft-image:${id}`} module="./control.tsx" width={cells(label)} props={{ label, color: IMAGE_COLOR, bold: true }} />
          })}
          <Text dimColor>clic para ver</Text>
        </Box>
        )
      : null
    // No dictation: what the others draw here, then the chips.
    if (now === 'off' && list.length === 0) return <Box flexDirection="column">{await next(e)}{chips}</Box>
    const state = now === 'on' ? '🔴 escuchando' : now === 'loading' && list.length === 0 ? '🔵 preparando…' : '🔵 escribiendo…'
    return (
      <Box flexDirection="column">
        <Text>
          <Text bold color={MIC_COLORS[now === 'off' ? 'loading' : now]}>{state}</Text>
        </Text>
        {list.map(one => <Text key={`heard:${one.number}`} italic dimColor>{`  ${one.text}`}</Text>)}
        {chips}
      </Box>
    )
  })

  // The menus, in their panes.
  on('ui.render', { component: 'Pane', requestId: MIC_PANE }, ($, e) => micMenu($, e))
  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e) => voiceMenu($, e))
  on('ui.render', { component: 'Pane', requestId: EXPLORER_PANE }, ($, e) => {
    // Docked, it takes its body and the border beside the transcript from the footer's width.
    followDock($, e.props.placement === 'dock' ? e.props.bodyColumns + 1 : 0)
    return explorerPane($, e, e.props.bodyColumns, e.props.scroll.bodyRows)
  })
  // Closed, by the footer's folder, its × or Esc: the footer has the whole width again.
  on('ui.close', async ($, e, next) => {
    const result = await next(e)
    if (e.id === EXPLORER_PANE) followDock($, 0)
    return result
  })
  on('ui.scroll', { requestId: EXPLORER_PANE }, async ($, e) => {
    await scrollExplorer($, e.by, e.bodyRows)
    return {}
  })
}
