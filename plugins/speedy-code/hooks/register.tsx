import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

/** What a render hook hands `$.ui.resolve`: a pane's or the band's. */
type Drawn = Parameters<EngineInterface['ui']['resolve']>[0]

import type { BarLevels, Heard, LevelKey, Listening, Menu, Picks, SetupCheck, Socials, Speech, Voice } from '../types'

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
/**
 * The Python environment every script runs in: the voice (edge-tts), the dictation (transcribe-cpp
 * with a local streaming model) and the pen. One environment of the mod's own, so a machine
 * needs no Python package installed by hand.
 */
const PYTHON = '.claude/speedy-code/venv/Scripts/python.exe'
/** The wand: Groq's model that cleans the prompt up, and where it is asked. The key is the system's
 * GROQ_API_KEY: it never leaves the request's header. */
const POLISH_MODEL = 'openai/gpt-oss-120b'
const POLISH_SYSTEM = `You clean up a message a developer is about to send to an AI coding assistant. It was dictated to a microphone and transcribed, typed by hand, or both.

Return the same message, improved:
- Fix grammar, spelling, punctuation and syntax.
- Fix words the transcription most likely misheard, using the context: technical terms above all (pitest -> pytest, empoint -> endpoint, log de React -> hook de React, use effect -> useEffect).
- Put spoken thoughts in a clear, logical order; drop fillers, repetitions and false starts.
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
const SETTINGS_TABS: ReadonlyArray<readonly [string, string]> = [['setup', 'Instalación'], ['bar', 'Barra de estado'], ['socials', 'Redes sociales']]

/** The setup steps, by the name install.ps1 prints, and what each is for. */
const SETUP_STEPS: ReadonlyArray<readonly [string, string]> = [
  ['uv', 'uv, el administrador de Python'],
  ['python', 'Entorno de Python 3.12'],
  ['packages', 'Voces y dictado (edge-tts, transcribe-cpp)'],
  ['model', 'Modelo de dictado Nemotron (~750 MB, local)'],
  ['mics', 'Micrófonos'],
  ['voices', 'Voces de Edge (internet)'],
  ['groq', 'Clave de Groq (la pluma, opcional)']
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
  ['claude-fable-5-1', 'Fable 5.1', 'el más capaz: razonamiento difícil y tareas largas', '#e599f7'],
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
const LEVEL_COLORS: Record<LevelKey, string> = { contextYellow: '#ffd43b', contextRed: '#ff6b6b', limitYellow: '#ffd43b', limitRed: '#ff6b6b' }
/** The level that goes with each, in the other direction: yellow stays under its red, red over its yellow. */
const PAIR: Record<LevelKey, LevelKey> = { contextYellow: 'contextRed', contextRed: 'contextYellow', limitYellow: 'limitRed', limitRed: 'limitYellow' }
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
const speech = atom({ plugin: 'speedy-code', key: 'speech' } as const, 'idle' as Speech)
const listening = atom({ plugin: 'speedy-code', key: 'listening' } as const, 'off' as Listening)
const mics = atom({ plugin: 'speedy-code', key: 'mics' } as const, [] as string[])
const heard = atom({ plugin: 'speedy-code', key: 'heard' } as const, [] as Heard[])
const isPolishing = atom({ plugin: 'speedy-code', key: 'isPolishing' } as const, false)
const menu = atom({ plugin: 'speedy-code', key: 'menu' } as const, '' as Menu)
const socials = atom({ plugin: 'speedy-code', key: 'socials' } as const, {} as Socials)
const settingsTab = atom({ plugin: 'speedy-code', key: 'settingsTab' } as const, 'socials')
const settingsOpened = atom({ plugin: 'speedy-code', key: 'settingsOpened' } as const, 0)
const editing = atom({ plugin: 'speedy-code', key: 'editing' } as const, '')
const setupChecks = atom({ plugin: 'speedy-code', key: 'setupChecks' } as const, {} as Record<string, SetupCheck>)
const setupLog = atom({ plugin: 'speedy-code', key: 'setupLog' } as const, [] as string[])
const isInstalling = atom({ plugin: 'speedy-code', key: 'isInstalling' } as const, false)
const modelNow = atom({ plugin: 'speedy-code', key: 'modelNow' } as const, '')
const statusLine = atom({ plugin: 'speedy-code', key: 'statusLine' } as const, '' as '' | 'on' | 'off')
const barLevels = atom({ plugin: 'speedy-code', key: 'barLevels' } as const, DEFAULT_LEVELS, { shape: 'bar-1' })
const mic = atom({ plugin: 'speedy-code', key: 'mic' } as const, '')
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
  const result = await $.process.run([await homeFile($, PYTHON), '-m', 'edge_tts', '--list-voices']).catch(() => undefined)
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
  const result = await $.process.run([await homeFile($, PYTHON), `${$.plugin.root}/hooks/listen.py`, '--list'], { env: { PYTHONIOENCODING: 'utf-8' } }).catch(() => undefined)
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
  }
  await update($, menu, () => which)
}

/** The voice menu's title: `Voz: Natasha (Inglés - Australia)`, the voice narrating now. */
function voiceTitle (chosen: Picks) {
  const active = chosen.active ?? DEFAULT_LANG
  const id = chosen[active] ?? DEFAULT_PICKS[DEFAULT_LANG] ?? ''
  return `Voz: ${nameOf(id).name} (${languageName(active)} - ${countryOf(id)})`
}

/** Closes a menu, wherever it shows. */
async function closeMenu ($: EngineInterface, which: Exclude<Menu, ''>) {
  if ((await read($, menu)) === which) await update($, menu, () => '')
}

const openPicker = ($: EngineInterface) => openMenu($, 'voices')

/** Whether someone is at the session: `claude -p` is not narrated. */
let isInteractive = true
/** The narration under way: ending it stops Haiku and the voice. */
let current: AbortController | undefined
let lastAnswer = ''
/** The last narration written, so saying it again calls no model: the answer, its language, the text. */
let lastNarration = { answer: '', lang: '', text: '' }
/** Whether switching the narrator off paused the voice: switching it on goes on. */
let isPausedByOff = false
/** The pause file of the narration under way. */
let controlFile = ''

async function stop ($: EngineInterface) {
  isPausedByOff = false
  current?.abort()
  current = undefined
  await update($, speech, () => 'idle')
}

/** Writes the narration of `answer` in the language narrated in: as it is, or by Haiku. */
async function narrationOf ($: EngineInterface, answer: string, lang: string, signal: AbortSignal) {
  const text = plain(answer)
  if (!text) return ''
  if (text.length <= SHORT_ANSWER && guessLanguage(text) === lang) return text
  const target = language(lang)?.[2] ?? 'Spanish'
  const prompt = text.length <= SHORT_ANSWER
    ? `Translate this reply into ${target}, faithfully and completely:\n\n${text}`
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

/** Reads `answer` aloud: ends any narration under way first. */
async function narrate ($: EngineInterface, answer: string) {
  await stop($)
  const controller = new AbortController()
  current = controller
  const chosen = await read($, picks)
  const lang = chosen.active ?? DEFAULT_LANG
  const voice = chosen[lang] ?? DEFAULT_PICKS[DEFAULT_LANG] ?? ''
  try {
    const isSame = lastNarration.answer === answer && lastNarration.lang === lang
    // Said again, nothing is written nor made: it shows as playing at once.
    await update($, speech, () => (isSame ? 'playing' : 'thinking'))
    const text = isSame ? lastNarration.text : await narrationOf($, answer, lang, controller.signal)
    if (text) lastNarration = { answer, lang, text }
    if (!text || controller.signal.aborted) return
    const control = await homeFile($, `${CONTROL_DIR}/control-${crypto.randomUUID()}.txt`)
    controlFile = control
    await $.fs.write(control, 'play')
    const speaker = $.process.spawn({
      argv: ['powershell', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/hooks/speak.ps1`],
      env: { NARRATOR_TEXT: text, NARRATOR_VOICE: voice, NARRATOR_SPEED: String(SPEED), NARRATOR_CONTROL: control, NARRATOR_PYTHON: await homeFile($, PYTHON) }
    })
    for await (const { text: said } of speaker) {
      // Leaving the loop ends the process, and its sound with it.
      if (controller.signal.aborted) break
      if (/^voice /m.test(said) && (await read($, speech)) === 'thinking') await update($, speech, () => 'playing')
      if (/^error /m.test(said)) $.ui.log(`speedy: ${said.trim()}`, { to: 'debug' })
    }
  } catch (error) {
    $.ui.log(`speedy: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
  } finally {
    if (current === controller) {
      current = undefined
      await update($, speech, () => 'idle')
    }
  }
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

/** What to read from the clip button: the text selected with the mouse, else the clipboard's. */
async function selectedText ($: EngineInterface) {
  const selection = await $.ui.selection().catch(() => undefined)
  if (selection?.text.trim()) return selection.text.trim()
  return clipboardText($)
}

/** The clipboard's text, as Windows holds it: the clip reads it, the paste button puts it in the prompt. */
async function clipboardText ($: EngineInterface) {
  const clipboard = await $.process.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', 'Get-Clipboard -Raw']).catch(() => undefined)
  return clipboard?.exitCode === 0 ? clipboard.stdout.replace(/\r\n/g, '\n').replace(/\n+$/, '') : ''
}

/** The clip button: reads the selection or the clipboard aloud, and play reads it again after. */
async function readSelection ($: EngineInterface) {
  const text = await selectedText($)
  if (!text) {
    $.ui.toast('speedy-code: seleccioná o copiá un texto primero.')
    return
  }
  lastAnswer = text
  void narrate($, text)
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
      argv: [await homeFile($, PYTHON), '-u', `${$.plugin.root}/hooks/listen.py`, lang, file, await read($, mic)],
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
  if (!listenFile) return
  await $.fs.write(listenFile, 'stop')
  // Blue again while the last phrases are written: it ends, and turns gray, once they are in the prompt.
  await update($, listening, () => 'loading')
}

/** The microphone dictation listens to, kept for the next sessions. */
async function pickMic ($: EngineInterface, name: string) {
  await update($, mic, () => name)
  await $.store.set('mic', name)
  $.ui.toast(`speedy-code: dicto con ${name ? micName(name) : 'el micrófono predeterminado de Windows'}`)
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
  const result = await $.process.run(['powershell', '-NoProfile', '-NonInteractive', '-STA', '-Command', script]).catch(() => undefined)
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
  const result = await $.process.run(['powershell', '-NoProfile', '-NonInteractive', '-STA', '-Command', script]).catch(() => undefined)
  if (result?.stdout.trim() !== 'sent') $.ui.toast('speedy-code: no pude enviar; apretá Enter.')
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
  try {
    // Groq is asked by polish.py, in ASCII both ways: the HTTP client here decoded Groq's UTF-8 as
    // another encoding and broke every accent.
    const polisher = $.process.spawn({
      argv: [await homeFile($, PYTHON), '-X', 'utf8', `${$.plugin.root}/hooks/polish.py`],
      input: ascii(JSON.stringify({ model: POLISH_MODEL, system: POLISH_SYSTEM, text: draft }))
    })
    let out = ''
    for await (const { stream, text } of polisher) if (stream === 'stdout') out += text
    const answer = JSON.parse(out.trim() || '{}') as { text?: string; error?: string }
    const polished = answer.text?.trim() ?? ''
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
  await $.process.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', `Set-Clipboard -Value 'claude --resume ${id}'`]).catch(() => undefined)
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
  await $.process.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', `Start-Process '${link}'`]).catch(() => undefined)
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

/** The + button: another account of a network, empty, its field open to type in. */
async function addAccount ($: EngineInterface, id: string) {
  const users = await read($, socials)
  const numbers = accountsOf(users, id).slice(1).map(key => Number(key.split('#')[1]))
  const key = `${id}#${Math.max(1, ...numbers) + 1}`
  await saveSocial($, key, '')
  await update($, editing, () => key)
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
  const python = await homeFile($, PYTHON)
  const hasPython = await $.fs.exists(python).catch(() => false)
  await setCheck($, 'python', hasPython ? { state: 'ok', detail: 'listo' } : { state: 'fail', detail: 'falta' })
  let hasPackages = false
  if (hasPython) {
    const probe = await $.process.run([python, '-c', 'import edge_tts, transcribe_cpp, sounddevice, numpy']).catch(() => undefined)
    hasPackages = probe?.exitCode === 0
  }
  await setCheck($, 'packages', hasPackages ? { state: 'ok', detail: 'listos' } : { state: 'fail', detail: 'faltan' })
  // The model loaded as a dictation loads it: "ok es-US", or "fail" and why.
  const lang = (await read($, picks)).active ?? DEFAULT_LANG
  const loaded = hasPackages ? await $.process.run([python, `${$.plugin.root}/hooks/listen.py`, '--check', lang], { env: { PYTHONIOENCODING: 'utf-8' } }).catch(() => undefined) : undefined
  const answer = loaded?.stdout.trim() ?? ''
  await setCheck($, 'model', answer.startsWith('ok ') ? { state: 'ok', detail: answer.slice(3) } : { state: 'fail', detail: answer.startsWith('fail ') ? answer.slice(5) : 'faltan los paquetes' })
  if (hasPackages) await loadMics($)
  const found = (await read($, mics)).length
  await setCheck($, 'mics', found ? { state: 'ok', detail: `${found} conectado(s)` } : { state: 'fail', detail: hasPython ? 'ninguno conectado' : 'se buscan al instalar' })
  await setCheck($, 'groq', (await $.env.get('GROQ_API_KEY')) ? { state: 'ok', detail: 'presente' } : { state: 'fail', detail: 'falta GROQ_API_KEY' })
}

/**
 * speedy-code's status line, in color, switched on or off in the user's settings by switch.py: the
 * status line set before is kept and comes back when it is switched off.
 */
async function switchStatusLine ($: EngineInterface, action: 'on' | 'off' | 'status') {
  const result = await $.process.run([await homeFile($, PYTHON), `${$.plugin.root}/statusline/switch.py`, action]).catch(() => undefined)
  const said = result?.stdout.trim() ?? ''
  if (said === 'on' || said === 'off') await update($, statusLine, () => said)
  else if (action !== 'status') $.ui.toast(`speedy-code: no pude cambiar la barra de estado: ${said.replace(/^error /, '') || 'falta instalar'}`)
  if (action !== 'status' && (said === 'on' || said === 'off')) $.ui.toast(said === 'on' ? 'speedy-code: barra de estado a colores activada; aparece en un segundo.' : 'speedy-code: volvió tu barra de estado anterior.')
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

/** The color of an effort level: its traffic-light color in EFFORTS, gray for one it does not list. */
export function effortColor (level: string): string {
  return EFFORTS.find(([name]) => name === level)?.[1] ?? '#adb5bd'
}

/** Keeps the status line's levels: in the plugin's store, and in the file the status line reads. */
async function saveLevels ($: EngineInterface, next: BarLevels) {
  await update($, barLevels, () => next)
  await $.store.set('barLevels', next)
  await $.fs.write(await homeFile($, LEVELS_FILE), `${JSON.stringify(next, null, 2)}\n`)
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

/** The status line's levels back to the defaults. */
async function resetLevels ($: EngineInterface) {
  await saveLevels($, DEFAULT_LEVELS)
}

/** Runs install.ps1, each line it prints shown as it comes; then checks again. */
async function runSetup ($: EngineInterface) {
  if (await read($, isInstalling)) return
  await update($, isInstalling, () => true)
  await update($, setupLog, () => [])
  let pending = ''
  try {
    const setup = $.process.spawn({
      argv: ['powershell', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/setup/install.ps1`]
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

/** Whether the play button acts: the narrator on, and something under way or to read again. */
function isPlayable (enabled: boolean, now: Speech) {
  return enabled && (now !== 'idle' || lastAnswer !== '')
}

/** The play button: reads the last answer again, cancels Haiku, pauses, or goes on. */
async function pressPlay ($: EngineInterface) {
  const now = await read($, speech)
  if (now === 'idle' && lastAnswer) void narrate($, lastAnswer)
  else if (now === 'thinking') await stop($)
  else if (now === 'playing') await control($, 'pause')
  else if (now === 'paused') await control($, 'play')
}

/** The settings menu: a tab per kind of setting. Social networks: a user name each, its link shown as it is built. */
async function settingsMenu ($: EngineInterface, e: Drawn, width = 90) {
  const open = await read($, settingsTab)
  const users = await read($, socials)
  const generation = await read($, settingsOpened)
  const edited = await read($, editing)
  const elements = $.ui.resolve(e)
  const { Box, Button, Text } = elements
  // A field to type in: every surface but the mobile app draws one.
  const Input = 'Input' in elements ? elements.Input : undefined

  // Fit the band: Claude Code caps it at half the terminal. Where the width holds two tables of
  // the networks side by side, half as many rows; the link column takes what is left, cut with …
  const inside = Math.max(60, width - 4)
  const fixed = SOCIAL_PLUS_WIDTH + SOCIAL_BADGE_WIDTH + SOCIAL_NAME_WIDTH + SOCIAL_FIELD_WIDTH
  const halfLink = Math.floor((inside - TABLE_GAP) / 2) - fixed
  const tableCount = halfLink >= MIN_LINK_WIDTH ? 2 : 1
  const linkWidth = tableCount === 2 ? halfLink : Math.max(MIN_LINK_WIDTH, inside - fixed)

  const rows = SOCIALS.flatMap(([id, name, label, color, , hint]) => accountsOf(users, id).map((key, index) => {
    const link = socialLink(id, users[key] ?? '')
    const isFirst = index === 0
    const done = (value: string) => saveSocial($, key, value).then(() => update($, editing, () => '')).then(() => dropIfEmpty($, key))
    return (
      <Box key={`social-row:${key}`} flexDirection="row">
        {/* The + adds another account of the network: on its first row alone. */}
        <Box width={SOCIAL_PLUS_WIDTH}>
          {isFirst
            ? (
              <Button key={`add:${id}`} plain onPress={() => { void addAccount($, id) }}>
                <Text bold color={color}>{' + '}</Text>
              </Button>
              )
            : null}
        </Box>
        <Box width={SOCIAL_BADGE_WIDTH}><Text bold color={color} dimColor={!isFirst}>{accountLabel(label, key)}</Text></Box>
        <Box width={SOCIAL_NAME_WIDTH}><Text bold={isFirst} color={color} dimColor={!isFirst}>{isFirst ? name : `  cuenta ${index + 1}`}</Text></Box>
        <Box width={SOCIAL_FIELD_WIDTH} paddingRight={2}>
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
        <Text color={link ? color : undefined} dimColor={!link}>{fit(link || '—', linkWidth).trimEnd()}</Text>
      </Box>
    )
  }))
  const checks = await read($, setupChecks)
  const log = await read($, setupLog)
  const installing = await read($, isInstalling)
  const bar = await read($, statusLine)
  const mark = { '': ['·', '#868e96'], working: ['…', '#ffd43b'], ok: ['✔', '#51cf66'], fail: ['✘', '#ff6b6b'] } as const
  const setupTab = (
    <Box flexDirection="column" marginTop={1}>
      {SETUP_STEPS.map(([name, label]) => {
        const check = checks[name] ?? { state: '', detail: '' }
        const [glyph, tint] = mark[check.state]
        return (
          <Box key={`setup-row:${name}`} flexDirection="row">
            <Text bold color={tint}>{` ${glyph} `}</Text>
            <Box width={46}><Text>{label}</Text></Box>
            <Text color={tint} dimColor={check.state === ''}>{check.detail}</Text>
          </Box>
        )
      })}
      <Box flexDirection="row" marginTop={1}>
        <Button key="setup:run" plain onPress={() => { void runSetup($) }}>
          <Text bold color="black" backgroundColor={installing ? '#ffd43b' : '#51cf66'}>{installing ? ' Instalando… ' : ' Instalar / reparar todo '}</Text>
        </Button>
        <Text dimColor>{'  instala lo que falta y deja como está lo que ya funciona'}</Text>
      </Box>
      {log.map((line, index) => <Text key={`setup-log:${index}`} dimColor>{`   ${line}`}</Text>)}
    </Box>
  )
  // The status line's tab: its switch, and the levels where its colors change.
  const levels = await read($, barLevels)
  const level = (label: string, key: LevelKey, note: string) => (
    <Box key={`level-row:${key}`} flexDirection="row">
      <Box width={38}><Text bold>{label}</Text></Box>
      <Button key={`lvl-down:${key}`} plain onPress={() => { void adjustLevel($, key, -5) }}>
        <Text bold color="black" backgroundColor="#adb5bd">{' ‹ '}</Text>
      </Button>
      <Text bold color={LEVEL_COLORS[key]}>{` ${levels[key]}% `}</Text>
      <Button key={`lvl-up:${key}`} plain onPress={() => { void adjustLevel($, key, 5) }}>
        <Text bold color="black" backgroundColor="#adb5bd">{' › '}</Text>
      </Button>
      <Text dimColor>{`  ${note}`}</Text>
    </Box>
  )
  const barTab = (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="row" marginBottom={1}>
        <Box width={49}><Text>{' ▤  Barra de estado a colores de speedy-code'}</Text></Box>
        <Button key="bar:statusline" plain onPress={() => { void switchStatusLine($, bar === 'on' ? 'off' : 'on') }}>
          <Text bold color="black" backgroundColor={bar === 'on' ? '#868e96' : '#4dabf7'}>{bar === 'on' ? ' Volver a mi barra anterior ' : ' Usar la de speedy-code '}</Text>
        </Button>
        <Text dimColor>{bar === 'on' ? '  en uso' : '  la tuya queda guardada'}</Text>
      </Box>
      <Text dimColor>{'Verde por debajo del amarillo. ‹ › mueven de 5 en 5.'}</Text>
      {level('Contexto usado · amarillo desde', 'contextYellow', 'empieza a pesar')}
      {level('Contexto usado · rojo desde', 'contextRed', '⚠ compactar, y el aviso')}
      {level('Límite usado · amarillo desde', 'limitYellow', 'empieza a pesar')}
      {level('Límite usado · rojo desde', 'limitRed', '⚠ y el aviso')}
      <Box flexDirection="row" marginTop={1}>
        <Button key="bar:reset" plain onPress={() => { void resetLevels($) }}>
          <Text bold color="black" backgroundColor="#adb5bd">{' Restaurar los valores por defecto '}</Text>
        </Button>
      </Box>
    </Box>
  )
  const header = (
    <Box flexDirection="row">
      <Box width={SOCIAL_PLUS_WIDTH + SOCIAL_BADGE_WIDTH} />
      <Box width={SOCIAL_NAME_WIDTH}><Text dimColor bold>Red</Text></Box>
      <Box width={SOCIAL_FIELD_WIDTH}><Text dimColor bold>Usuario</Text></Box>
      <Text dimColor bold>Link</Text>
    </Box>
  )
  const perTable = Math.ceil(rows.length / tableCount)
  const tables = (
    <Box flexDirection="row" columnGap={TABLE_GAP}>
      {Array.from({ length: tableCount }, (_, index) => (
        <Box key={`social-table:${index}`} flexDirection="column" width={fixed + linkWidth}>
          {header}
          {rows.slice(index * perTable, (index + 1) * perTable)}
        </Box>
      ))}
    </Box>
  )

  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        {SETTINGS_TABS.map(([id, label]) => (
          <Box key={`settings-cell:${id}`} marginRight={2}>
            <Button key={`settings:${id}`} plain onPress={() => { void update($, settingsTab, () => id) }}>
              <Text bold color={id === open ? 'black' : '#adb5bd'} backgroundColor={id === open ? '#adb5bd' : undefined}>{` ${label} `}</Text>
            </Button>
          </Box>
        ))}
        {open === 'socials' ? <Text dimColor>click en un usuario para editarlo · Enter guarda · + suma otra cuenta</Text> : null}
      </Box>
      {open === 'setup' ? setupTab : null}
      {open === 'bar' ? barTab : null}
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

/** The microphone menu: the system's default, then each microphone connected; the one in use marked. */
async function micMenu ($: EngineInterface, e: Drawn) {
  const connected = await read($, mics)
  // The microphone picked; none picked, or not connected now: the system's default (empty).
  const picked = await read($, mic)
  const chosenMic = connected.includes(picked) ? picked : ''
  const { Box, Button, Text } = $.ui.resolve(e)
  return (
    <Box flexDirection="column">
      {connected.length === 0 ? <Text dimColor>Buscando micrófonos…</Text> : null}
      {(connected.length === 0 ? [] : ['', ...connected]).map(name => {
        const isChosen = name === chosenMic
        return (
          <Button key={`mic:${name}`} plain onPress={() => { void pickMic($, name) }}>
            <Text bold={isChosen} color={isChosen ? 'black' : '#ff8787'} backgroundColor={isChosen ? '#ff8787' : undefined}>
              {` ${isChosen ? '●' : '○'} ${name ? micName(name) : 'Predeterminado de Windows'} `}
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
  }
  if (level) {
    const ran = await $.command.run({ command: 'effort', args: level }).then(() => true, () => false)
    if (!ran) {
      $.ui.toast(`speedy-code: no pude cambiar el esfuerzo; escribí /effort ${level}.`)
      return
    }
    await update($, effort, () => level)
    await $.store.set('effort', level)
    done.push(`esfuerzo ${level}`)
  }
  $.ui.toast(done.length ? `speedy-code: ahora con ${done.join(' · ')}` : 'speedy-code: sin cambios.')
}

/**
 * The model menu: each model with what it is for, then the effort levels, then Aplicar. A click
 * only picks; Aplicar runs `/model` and `/effort`. The model in use and the effort last applied
 * are marked with a dot; what is picked, filled with its color.
 */
async function modelMenu ($: EngineInterface, e: Drawn) {
  const current = modelOf(await $.session.model().catch(() => ''))?.[0] ?? ''
  const [picked, level, applied] = [await read($, modelPick), await read($, effortPick), await read($, effort)]
  const chosenModel = picked || current
  const { Box, Button, Text } = $.ui.resolve(e)
  const width = Math.max(...MODELS.map(([, name]) => name.length)) + 4
  return (
    <Box flexDirection="column">
      <Text bold dimColor>MODELO</Text>
      {MODELS.map(([id, name, use, color]) => {
        const isChosen = id === chosenModel
        return (
          <Button key={`model:${id}`} plain onPress={() => { void update($, modelPick, () => id) }}>
            <Text>
              <Text bold color={isChosen ? 'black' : color} backgroundColor={isChosen ? color : undefined}>
                {` ${id === current ? '●' : '○'} ${name.padEnd(width - 4)} `}
              </Text>
              <Text dimColor={!isChosen} color={isChosen ? color : undefined}>{`  ${use}`}</Text>
            </Text>
          </Button>
        )
      })}
      <Text> </Text>
      <Text bold dimColor>ESFUERZO</Text>
      <Box flexDirection="row">
        {EFFORTS.map(([name, color]) => {
          const isChosen = name === level
          return (
            <Button key={`effort:${name}`} plain onPress={() => { void update($, effortPick, now => now === name ? '' : name) }}>
              <Text bold color={isChosen ? 'black' : color} backgroundColor={isChosen ? color : undefined}>
                {` ${name === applied ? '●' : '○'} ${name} `}
              </Text>
            </Button>
          )
        })}
      </Box>
      <Text dimColor>{level ? '' : '  sin elegir: el esfuerzo queda como está'}</Text>
      <Box flexDirection="row" justifyContent="center">
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
  const known = all.filter(v => v.lang === lang)
  const accent = languageColor(lang)
  const { Box, Button, Text } = $.ui.resolve(e)

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
  const inside = Math.max(VOICE_WIDTH, width - 4)
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
    <Box flexDirection="row" marginTop={1} marginBottom={1}>
      {([['Female', '♀ Mujeres', FEMALE], ['Male', '♂ Hombres', MALE]] as const).map(([value, label, tint]) => {
        const isOn = value === shown
        const count = known.filter(v => v.gender === value).length
        return (
          <Box key={`gender-cell:${value}`} marginRight={2}>
            <Button key={`gender:${value}`} plain onPress={() => { void update($, gender, () => value).then(() => update($, page, () => 0)) }}>
              <Text bold color={isOn ? 'black' : tint} backgroundColor={isOn ? tint : undefined}>{` ${label}  ${count} `}</Text>
            </Button>
          </Box>
        )
      })}
      {pages > 1
        ? (
          <Box flexDirection="row">
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
      <Text color="#ffd43b">{'   ✦ multilingüe'}</Text>
    </Box>
  )

  const column = (part: Voice[], side: string) => {
    return (
      <Box key={`column:${side}`} flexDirection="column" width={VOICE_WIDTH}>
        {part.map(v => {
          const isCurrent = v.value === current
          return (
            <Button key={v.value} plain onPress={() => { void pick(v) }}>
              <Text backgroundColor={isCurrent ? '#2b8a3e' : undefined}>
                <Text color={isCurrent ? 'white' : color}>{isCurrent ? ' ● ' : ' ♪ '}</Text>
                <Text bold color={isCurrent ? 'white' : undefined}>{fit(v.name, NAME_WIDTH)}</Text>{' '}
                <Text color={isCurrent ? 'white' : accent}>{fit(v.country, COUNTRY_WIDTH)}</Text>
                <Text color={isCurrent ? 'white' : '#ffd43b'}>{v.tag.includes('✦') ? ' ✦' : '  '}</Text>
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
          const mark = active === code ? '▶' : chosen[code] ? '●' : ''
          return (
            <Box key={`cell:${code}`} width={TAB_WIDTH}>
              <Button key={`tab:${code}`} plain onPress={() => { void update($, tab, () => code).then(() => update($, page, () => 0)) }}>
                <Text bold color={isOpen ? 'black' : tint} backgroundColor={isOpen ? tint : undefined}>
                  {fit(` ${label} ${mark}`, TAB_WIDTH - 1)}
                </Text>
              </Button>
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

  // The warnings: once each, when the context or a limit crosses its line, and again only after it falls back.
  // The context line is where Claude Code compacts (about 80% used); a limit warns at 90% used.
  let warnedContext = false
  const warnedLimits = new Set<string>()
  on('session.measure', async ($, e, next) => {
    const levels = await read($, barLevels)
    const used = e.context.percent ?? 0
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
    // The model in use, followed as it changes: see followModel.
    $.clock.every(1500, () => followModel($))
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
    const savedMic = await $.store.get('mic')
    if (typeof savedMic === 'string') await update($, mic, () => savedMic)
    const savedEffort = await $.store.get('effort')
    if (typeof savedEffort === 'string') await update($, effort, () => savedEffort)
    void loadMics($)
    // A first start, with nothing installed beside the code: the settings open on the setup tab.
    if (!(await $.fs.exists(await homeFile($, PYTHON)).catch(() => false))) {
      await update($, settingsTab, () => 'setup')
      if (isInteractive) $.ui.toast('speedy-code: falta instalar las voces y el dictado. Abrí ⚙️ → Instalación.')
    }
    const savedSocials = await $.store.get('socials')
    if (savedSocials && typeof savedSocials === 'object') await update($, socials, () => savedSocials as Socials)
    // The levels: the saved ones, else the defaults; the file the status line reads follows them.
    const savedLevels = await $.store.get('barLevels')
    if (savedLevels && typeof savedLevels === 'object') await update($, barLevels, () => savedLevels as BarLevels)
    await $.fs.write(await homeFile($, LEVELS_FILE), `${JSON.stringify(await read($, barLevels), null, 2)}\n`)
    // The status line in use is a copy of this mod's: switched on, it is copied again, so an update
    // of the mod reaches it without switching it off and on.
    void switchStatusLine($, 'status').then(async () => {
      if ((await read($, statusLine)) === 'on') await switchStatusLine($, 'on')
    })
    return next(e)
  })

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
  // and the footer redraws when it changed.
  // turn.step streams, so its hook is an async generator that forwards the stream unchanged.
  on('turn.step', async function* ($, e, next) {
    if (typeof e.effort === 'string' && e.effort !== (await read($, effort))) {
      await update($, effort, () => e.effort as string)
      await $.store.set('effort', e.effort)
      $.ui.invalidate('ui.render')
    }
    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.reason === 'answer' && e.answer.trim()) {
      lastAnswer = e.answer
      if (isInteractive && (await read($, isEnabled))) void narrate($, e.answer)
    }
    return result
  })

  on('command.run', { command: 'speedy' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stop') { await stop($); return { text: 'speedy-code: callado.' } }
    if (arg === 'leer') {
      if (!lastAnswer) return { text: 'speedy-code: todavía no hay respuesta para leer.' }
      void narrate($, lastAnswer)
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
    const chosen = await read($, picks)
    const active = chosen.active ?? DEFAULT_LANG
    const voice = chosen[active] ?? DEFAULT_PICKS[DEFAULT_LANG] ?? ''
    const [enabled, now, listen, polishing] = [await read($, isEnabled), await read($, speech), await read($, listening), await read($, isPolishing)]
    // The networks with a user name set, in SOCIALS' order.
    const users = await read($, socials)
    const linked = SOCIALS.flatMap(([id, , label, color]) => accountsOf(users, id)
      .filter(key => socialLink(id, users[key] ?? ''))
      .map(key => ({ key, label: accountLabel(label, key), color })))
    const current = (await read($, modelNow)) || (await $.session.model().catch(() => ''))
    const model = modelLabel(current)
    const level = await read($, effort)
    const beneath = await next(e)
    const { Box, Client, Text } = $.ui.resolve(e)
    // Text glyphs, never emojis: an emoji's width differs from one to the next, a text glyph's does not,
    // so play and pause take the same room. U+FE0E asks for the text form.
    const play = { idle: ['⏵', '#51cf66'], thinking: ['⧗', '#748ffc'], playing: ['⏸︎', '#ffd43b'], paused: ['⏵', '#51cf66'] }[now]
    // Always drawn, so nothing in the footer moves: disabled, in gray, while the narrator is off and
    // before the first answer, when there is nothing to read again.
    const canPlay = isPlayable(enabled, now)
    return (
      <Box flexDirection="row">
        {beneath}
        <Text dimColor> · </Text>
        {linked.map(({ key, label, color }) => (
          <Client key={`speedy:social:${key}`} module="./control.tsx" width={label.length + 2} props={{ label: ` ${label} `, color, bold: true }} />
        ))}
        {linked.length > 0 ? <Text dimColor>│ </Text> : null}
        <Client key="speedy:copy" module="./control.tsx" width={CONTROL_WIDTH} props={{ label: ' 📋 ', color: '#adb5bd' }} />
        <Client key="speedy:paste" module="./control.tsx" width={CONTROL_WIDTH} props={{ label: ' 📥 ', color: '#adb5bd' }} />
        <Client key="speedy:image" module="./control.tsx" width={CONTROL_WIDTH} props={{ label: ' 🖼️ ', color: '#adb5bd' }} />
        {/* An emoji takes no color: the glyph tells it is at work. */}
        <Client key="speedy:polish" module="./control.tsx" width={CONTROL_WIDTH} props={{ label: polishing ? ' ⏳ ' : ' 🖋️ ', color: '#da77f2' }} />
        <Client key="speedy:send" module="./control.tsx" width={3} props={{ label: ' ⏎ ', color: '#51cf66', bold: true }} />
        <Client key="speedy:clear" module="./control.tsx" width={CONTROL_WIDTH} props={{ label: ' 🗑️ ', color: '#adb5bd' }} />
        <Text> </Text>
        <Client key="speedy:model" module="./control.tsx" props={{ label: level ? `◆ ${model} ` : `◆ ${model} ▾ `, color: modelOf(current)?.[3] ?? MODEL_COLOR, bold: true }} />
        {/* The effort in force beside the model, in its traffic-light color; a click opens the same menu. */}
        {level ? <Client key="speedy:effort" module="./control.tsx" props={{ label: `· ${level} ▾ `, color: effortColor(level), bold: true }} /> : null}
        <Client key="speedy:voice" module="./control.tsx" props={{ label: `🗣  ${nameOf(voice).name} · ${active.toUpperCase()} ▾`, color: languageColor(active) }} />
        {/* Each control's region is a column wider than its glyph on either side: easier to hit. */}
        <Client key="speedy:switch" module="./control.tsx" width={CONTROL_WIDTH} props={{ label: ` ${enabled ? '🔊' : '🔇'} `, color: enabled ? '#51cf66' : '#868e96' }} />
        <Client key="speedy:play" module="./control.tsx" width={PLAY_WIDTH} props={{ label: ` ${play[0]} `, color: canPlay ? play[1] : DISABLED, bold: canPlay }} />
        <Client key="speedy:clip" module="./control.tsx" width={CONTROL_WIDTH} props={{ label: ' 📎 ', color: enabled ? '#ffd43b' : DISABLED }} />
        <Client key="speedy:mic" module="./control.tsx" width={CONTROL_WIDTH} props={{ label: ` ${MIC_GLYPHS[listen]}`, color: MIC_COLORS[listen], bold: listen !== 'off' }} />
        <Client key="speedy:mics" module="./control.tsx" width={2} props={{ label: '▾ ', color: MIC_COLORS.off }} />
        <Client key="speedy:reload" module="./control.tsx" width={CONTROL_WIDTH} props={{ label: ' 🔄 ', color: '#adb5bd' }} />
        <Client key="speedy:settings" module="./control.tsx" width={CONTROL_WIDTH} props={{ label: ' ⚙️ ', color: '#adb5bd' }} />
        <Client key="speedy:exit" module="./control.tsx" width={3} props={{ label: ' ✕ ', color: '#ff6b6b', bold: true }} />
      </Box>
    )
  })

  // A footer control was clicked.
  on('ui.message', async ($, e, next) => {
    const result = await next(e)
    const data = e.data as { isClicked?: unknown } | null
    if (!e.element.startsWith('speedy:') || data?.isClicked !== true) return result
    if (e.element === 'speedy:voice') {
      const active = (await read($, picks)).active ?? DEFAULT_LANG
      await update($, tab, () => active)
      await openPicker($)
    } else if (e.element === 'speedy:switch') {
      await setEnabled($, !(await read($, isEnabled)))
    } else if (e.element.startsWith('speedy:social:')) {
      const key = e.element.slice('speedy:social:'.length)
      const link = socialLink(networkOf(key), (await read($, socials))[key] ?? '')
      if (link) await openLink($, link)
    } else if (e.element === 'speedy:settings') {
      await openMenu($, 'settings')
    } else if (e.element === 'speedy:model' || e.element === 'speedy:effort') {
      await openMenu($, 'models')
    } else if (e.element === 'speedy:reload') {
      // Reloads every plugin, this one too: an edit to the mod takes effect at once.
      await $.command.run({ command: 'reload-plugins' }).catch(() => { $.ui.toast('speedy-code: no pude recargar; escribí /reload-plugins.') })
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
    } else if (e.element === 'speedy:clip' && (await read($, isEnabled))) {
      await readSelection($)
    } else if (e.element === 'speedy:play' && isPlayable(await read($, isEnabled), await read($, speech))) {
      await pressPlay($)
    }
    return result
  })

  // While dictating, above the prompt: what the quick model heard of each phrase not yet written.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const shown = await read($, menu)
    if (shown && !e.props.hasSurvey) {
      if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e)
      const { Box, Client, Text } = $.ui.resolve(e)
      const chosen = await read($, picks)
      // The model menu's title says what is in use now: the model, and the effort when it is known.
      const inUse = shown === 'models'
        ? [modelLabel((await read($, modelNow)) || (await $.session.model().catch(() => ''))), await read($, effort)].filter(Boolean).join(' · ')
        : ''
      const title = ` ${shown === 'voices' ? voiceTitle(chosen) : shown === 'mic' ? 'Micrófono para dictar' : shown === 'models' ? `Modelo de Claude (${inUse})` : 'Configuración'} `
      const color = shown === 'voices' ? languageColor(chosen.active ?? DEFAULT_LANG) : shown === 'mic' ? MIC_COLORS.on : shown === 'models' ? MODEL_COLOR : '#adb5bd'
      // A frame around the menu, its title in the middle of the top border and the close button at
      // its right end. Absolute positions are clipped, so the title row comes after the frame in the
      // tree (drawn over it) and column-reverse puts it on top, pulled one row down onto the border:
      // it paints its own letters alone, the rest of the border stays.
      const width = e.props.bodyColumns || 90
      return (
        <Box flexDirection="column-reverse" width={width}>
          <Box flexDirection="column" width={width} borderStyle="single" borderColor={color} paddingX={1} paddingTop={1}>
            {shown === 'voices' ? await voiceMenu($, e, width, e.props.maxRows) : shown === 'mic' ? await micMenu($, e) : shown === 'models' ? await modelMenu($, e) : await settingsMenu($, e, width)}
          </Box>
          <Box flexDirection="row" width={width} marginBottom={-1}>
            <Box flexGrow={1} justifyContent="center">
              <Text bold color={color}>{title}</Text>
            </Box>
            {/* A Client, not a Button: no background under the pointer. Two empty cells after it
                leave the border's last line and its corner showing. */}
            <Client key="speedy:menu-close" module="./control.tsx" width={3} props={{ label: ' ✕ ', color: '#ff6b6b', bold: true }} />
            <Box width={2} />
          </Box>
        </Box>
      )
    }
    const [now, list] = [await read($, listening), await read($, heard)]
    if (e.props.hasSurvey || (now === 'off' && list.length === 0)) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const state = now === 'on' ? '🔴 escuchando' : now === 'loading' && list.length === 0 ? '🔵 preparando…' : '🔵 escribiendo…'
    return (
      <Box flexDirection="column">
        <Text>
          <Text bold color={MIC_COLORS[now === 'off' ? 'loading' : now]}>{state}</Text>
          {list.length === 0 && now === 'on' ? <Text dimColor>  hablá, lo que diga aparece acá</Text> : null}
        </Text>
        {list.map(one => <Text key={`heard:${one.number}`} italic dimColor>{`  ${one.text}`}</Text>)}
      </Box>
    )
  })

  // The menus, in their panes.
  on('ui.render', { component: 'Pane', requestId: MIC_PANE }, ($, e) => micMenu($, e))
  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e) => voiceMenu($, e))
}
