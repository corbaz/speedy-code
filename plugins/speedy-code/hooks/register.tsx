import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

/** What a render hook hands `$.ui.resolve`: a pane's or the band's. */
type Drawn = Parameters<EngineInterface['ui']['resolve']>[0]

import type { BarLevels, BarPart, Heard, HistoryClip, LevelKey, Listening, Menu, Picks, SetupCheck, Socials, Speech, Voice } from '../types'

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
  ['setup', 'Instalación', '#51cf66', 'Instalar'], ['bar', 'Barra de estado', '#4dabf7', 'Barra'], ['socials', 'Redes sociales', '#f783ac', 'Redes']
]

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
const PRIORITY_COLOR = '#74c0fc'
const LEVEL_COLORS: Record<LevelKey, string> = { contextYellow: '#ffd43b', contextRed: '#ff6b6b', limitYellow: '#ffd43b', limitRed: '#ff6b6b' }
/** The level that goes with each, in the other direction: yellow stays under its red, red over its yellow. */
const PAIR: Record<LevelKey, LevelKey> = { contextYellow: 'contextRed', contextRed: 'contextYellow', limitYellow: 'limitRed', limitRed: 'limitYellow' }
/**
 * The status line's parts in their default priority, and how the settings name them: where the width is
 * short, the first ones go in. Each keeps its place on the line whatever its priority.
 */
const BAR_PARTS: ReadonlyArray<readonly [BarPart, string]> = [
  ['core', 'Versión, modelo y esfuerzo'], ['five_hour', 'Límite de 5 horas'], ['seven_day', 'Límite semanal'],
  ['context', 'Contexto'], ['time', 'Tiempo de sesión'], ['cost', 'Costo de sesión'],
  ['tokens', 'Tokens in, out y caché'], ['folder', 'Carpeta y rama']
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
const barOrder = atom({ plugin: 'speedy-code', key: 'barOrder' } as const, DEFAULT_ORDER, { shape: 'order-1' })
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
  }
  // The narrations kept are read when the menu opens, so it lists what is on disk now.
  if (which === 'history') {
    const found = await listClips($)
    await update($, clips, () => found)
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
  await dropEmptyAccounts($)
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
    // A new narration is kept in the history; saying the same one again is not, it is already there.
    const saveAs = isSame ? '' : `${await historyDir($)}/${historyName(text, new Date())}`
    const speaker = $.process.spawn({
      argv: ['powershell', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/hooks/speak.ps1`],
      env: { NARRATOR_TEXT: text, NARRATOR_VOICE: voice, NARRATOR_SPEED: String(SPEED), NARRATOR_CONTROL: control, NARRATOR_PYTHON: await homeFile($, PYTHON), NARRATOR_SAVE_AS: saveAs.replace(/\//g, '\\') }
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

/**
 * A narration's file name: the start of its text, safe in a file name, then when it was written, as
 * `<description>-yy-mm-dd_hh-mm-ss.mp3`.
 */
export function historyName (text: string, now: Date) {
  const start = Array.from(text.replace(/\p{Cc}/gu, ' ').replace(/[<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').trim())
    .slice(0, HISTORY_NAME_LENGTH).join('').trim()
  const description = start.replace(/ /g, '-') || 'audio'
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp = [
    pad(now.getFullYear() % 100), pad(now.getMonth() + 1), pad(now.getDate())
  ].join('-') + '_' + [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('-')
  return `${description}-${stamp}.mp3`
}

/** The folder the narrations are kept in: `%LOCALAPPDATA%/speedy-code/audio`. */
async function historyDir ($: EngineInterface) {
  const local = (await $.env.get('LOCALAPPDATA')) || ''
  return local ? `${local.replace(/\\/g, '/')}/${HISTORY_DIR}` : homeFile($, `AppData/Local/${HISTORY_DIR}`)
}

/** The newest narrations kept, newest first, as the folder holds them now. */
async function listClips ($: EngineInterface): Promise<HistoryClip[]> {
  const result = await $.process.run(
    ['powershell', '-NoProfile', '-NonInteractive', '-Command', `Get-ChildItem -LiteralPath $env:SPEEDY_HISTORY -Filter *.mp3 -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First ${HISTORY_LENGTH} -ExpandProperty FullName`],
    { env: { SPEEDY_HISTORY: await historyDir($) } }
  ).catch(() => undefined)
  if (!result || result.exitCode !== 0) return []
  return result.stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    .map(path => ({ path, name: path.split(/[\\/]/).pop()?.replace(/\.mp3$/i, '') ?? path }))
}

/** Deletes every narration kept, from the disk, and empties the menu's list. */
async function clearClips ($: EngineInterface) {
  await $.process.run(
    ['powershell', '-NoProfile', '-NonInteractive', '-Command', 'Get-ChildItem -LiteralPath $env:SPEEDY_HISTORY -Filter *.mp3 -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue'],
    { env: { SPEEDY_HISTORY: await historyDir($) } }
  ).catch(() => undefined)
  await update($, clips, () => [])
  $.ui.toast('speedy-code: historial borrado.')
}

/** Plays one narration kept, ending the narration under way. Playing another ends this one. */
async function playClip ($: EngineInterface, clip: HistoryClip) {
  await stop($)
  const controller = new AbortController()
  historyPlay = controller
  const player = $.process.spawn({
    argv: ['powershell', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/hooks/play.ps1`, '-Clip', clip.path]
  })
  try {
    // Leaving the loop ends the process, and its sound with it.
    for await (const _line of player) {
      if (controller.signal.aborted) break
    }
  } catch (error) {
    $.ui.log(`speedy: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
  } finally {
    if (historyPlay === controller) historyPlay = undefined
  }
}

/** The first row of the 📎 menu: reads the selection taken when 📎 was pressed, else says there is none. */
async function readPending ($: EngineInterface) {
  if (!pendingSelection) {
    $.ui.toast('speedy-code: seleccioná o copiá un texto primero.')
    return
  }
  lastAnswer = pendingSelection
  void narrate($, pendingSelection)
}

/** The 📎 menu: the selection, the narrations kept newest first, each with its play button, and clear. */
async function historyMenu ($: EngineInterface, e: Drawn, width = 90) {
  const elements = $.ui.resolve(e)
  const { Box, Button, Text } = elements
  const list = await read($, clips)
  const nameWidth = Math.max(10, width - 12)
  return (
    <Box flexDirection="column">
      <Button key="clip:read" plain onPress={() => { void readPending($) }}>
        <Text bold color="#ffd43b">{' 📎 leer selección '}</Text>
      </Button>
      {list.length === 0
        ? <Text dimColor>{'  Todavía no hay audios. Se guardan cada vez que se lee una respuesta o una selección.'}</Text>
        : list.map((clip, index) => (
          <Box key={`clip:${clip.path}`} flexDirection="row">
            <Button key={`clip-play:${index}`} plain onPress={() => { void playClip($, clip) }}>
              <Text bold color="#63e6be">{' ▶ '}</Text>
            </Button>
            <Text>{` ${fit(clip.name, nameWidth)}`}</Text>
          </Box>
        ))}
      <Box marginTop={1}>
        <Button key="clip:clear" plain onPress={() => { void clearClips($) }}>
          <Text bold color="#ff6b6b">{' 🗑️ limpiar historial '}</Text>
        </Button>
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
      argv: [await homeFile($, PYTHON), '-X', 'utf8', `${$.plugin.root}/hooks/polish.py`],
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

/**
 * A footer group's rank when the width is short: 0 is always drawn; then 1 first, 2 next, and so on.
 * The tools, the model, the voice and ✕ always stay; the networks go first.
 */
const FOOTER_RANKS: Record<string, number> = {
  copy: 0, paste: 0, image: 0, polish: 0, send: 0, clear: 0, model: 0, voice: 0, compact: 0, exit: 0,
  settings: 1, reload: 2, mic: 3, narrator: 4, socials: 5
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
export type FooterFit = { shown: Set<string>, compact: Set<string> }

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
  const elements = $.ui.resolve(e)
  // Only the terminal and the desktop draw a Client.
  if (!('Client' in elements)) return []
  const { Box, Client, Text } = elements
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
  const modelColor = modelOf(current)?.[3] ?? MODEL_COLOR
  const level = await read($, effort)
  // Text glyphs, never emojis: an emoji's width differs from one to the next, a text glyph's does not,
  // so play and pause take the same room. U+FE0E asks for the text form.
  const play = ({ idle: ['⏵', '#51cf66'], thinking: ['⧗', '#748ffc'], playing: ['⏸︎', '#ffd43b'], paused: ['⏵', '#51cf66'] } as const)[now]
  // Always drawn, so nothing in the footer moves: disabled, in gray, while the narrator is off and
  // before the first answer, when there is nothing to read again.
  const canPlay = isPlayable(enabled, now)
  // A Client drawing `label` in `color`, as wide as the label is on a terminal.
  const control = (key: string, label: string, color: string, bold = false) => (
    <Client key={key} module="./control.tsx" width={cells(label)} props={{ label, color, bold }} />
  )
  const modelText = level ? ` ◆ ${model} ` : ` ◆ ${model} ▾ `
  const effortText = `· ${level} ▾ `
  // Short: the model's family alone (`Opus`), no effort; the status line still shows both.
  const modelShort = ` ◆ ${model.split(' ')[0] ?? model} ▾ `
  const voiceText = ` 🗣  ${nameOf(voice).name} · ${active.toUpperCase()} ▾ `
  const voiceShort = ` 🗣  ${active.toUpperCase()} ▾ `
  const named = [
    { group: 'copy', key: 'speedy:copy', footer: ' 📋 ', panel: ' 📋 copiar ', color: '#adb5bd' },
    { group: 'paste', key: 'speedy:paste', footer: ' 📥 ', panel: ' 📥 pegar ', color: '#adb5bd' },
    { group: 'image', key: 'speedy:image', footer: ' 🖼️ ', panel: ' 🖼️ imagen ', color: '#adb5bd' },
    // An emoji takes no color: the glyph tells it is at work.
    { group: 'polish', key: 'speedy:polish', footer: polishing ? ' ⏳ ' : ' 🖋️ ', panel: polishing ? ' ⏳ corrigiendo ' : ' 🖋️ corregir ', color: '#da77f2' },
    { group: 'send', key: 'speedy:send', footer: ' ⏎ ', panel: ' ⏎ enviar ', color: '#51cf66' },
    { group: 'clear', key: 'speedy:clear', footer: ' 🗑️ ', panel: ' 🗑️ borrar ', color: '#adb5bd' },
    { group: 'narrator', key: 'speedy:switch', footer: ` ${enabled ? '🔊' : '🔇'} `, panel: enabled ? ' 🔊 narrador ' : ' 🔇 narrador apagado ', color: enabled ? '#51cf66' : '#868e96' },
    { group: 'narrator', key: 'speedy:play', footer: ` ${play[0]} `, panel: ` ${play[0]} leer de nuevo `, color: canPlay ? play[1] : DISABLED },
    { group: 'narrator', key: 'speedy:clip', footer: ' 📎 ', panel: ' 📎 audios y selección ', color: enabled ? '#ffd43b' : DISABLED },
    { group: 'mic', key: 'speedy:mic', footer: ` ${MIC_GLYPHS[listen]} `, panel: listen === 'off' ? ` ${MIC_GLYPHS.off} dictar ` : ` ${MIC_GLYPHS[listen]} dictando `, color: MIC_COLORS[listen] },
    { group: 'mic', key: 'speedy:mics', footer: '▾ ', panel: ' ▾ micrófono ', color: MIC_COLORS.off },
    { group: 'reload', key: 'speedy:reload', footer: ' 🔄 ', panel: ' 🔄 recargar ', color: '#adb5bd' },
    { group: 'compact', key: 'speedy:compact', footer: ' 🗜️ ', panel: ' 🗜️ compactar ', color: '#ff6b6b' },
    { group: 'settings', key: 'speedy:settings', footer: ' ⚙️ ', panel: ' ⚙️ configuración ', color: '#adb5bd' }
  ]
  const namedGroup = (name: string) => {
    const members = named.filter(one => one.group === name)
    return {
      name,
      width: members.reduce((sum, one) => sum + cells(one.footer), 0),
      node: <Box key={`group:${name}`} flexDirection="row" flexShrink={0}>{members.map(one => control(one.key, one.footer, one.color))}</Box>,
      labels: members.map(one => cells(one.panel)),
      panel: members.map(one => control(one.key, one.panel, one.color))
    }
  }
  return [
    {
      name: 'socials',
      width: linked.length > 0 ? linked.reduce((sum, one) => sum + one.label.length + 2, 2) : 0,
      node: (
        <Box key="group:socials" flexDirection="row" flexShrink={0}>
          {linked.map(({ key, label, color }) => control(`speedy:social:${key}`, ` ${label} `, color, true))}
          <Text dimColor>│ </Text>
        </Box>
      ),
      panel: linked.map(({ key, label, color }) => control(`speedy:social:${key}`, ` ${label} `, color, true)),
      labels: linked.map(({ label }) => label.length + 2)
    },
    ...['copy', 'paste', 'image', 'polish', 'send', 'clear'].map(namedGroup),
    {
      name: 'model',
      width: cells(modelText) + (level ? cells(effortText) : 0),
      compactWidth: cells(modelShort),
      node: (
        <Box key="group:model" flexDirection="row" flexShrink={0}>
          {control('speedy:model', modelText, modelColor, true)}
          {/* The effort in force beside the model, in its traffic-light color; a click opens the same menu. */}
          {level ? control('speedy:effort', effortText, effortColor(level), true) : null}
        </Box>
      ),
      compactNode: <Box key="group:model" flexDirection="row" flexShrink={0}>{control('speedy:model', modelShort, modelColor, true)}</Box>,
      panel: [],
      labels: []
    },
    {
      name: 'voice',
      width: cells(voiceText),
      compactWidth: cells(voiceShort),
      node: <Box key="group:voice" flexShrink={0}>{control('speedy:voice', voiceText, languageColor(active))}</Box>,
      compactNode: <Box key="group:voice" flexShrink={0}>{control('speedy:voice', voiceShort, languageColor(active))}</Box>,
      panel: [control('speedy:voice', ` 🗣  ${nameOf(voice).name} · ${active.toUpperCase()} `, languageColor(active))],
      labels: [cells(` 🗣  ${nameOf(voice).name} · ${active.toUpperCase()} `)]
    },
    // /compact, in the footer only once the context is red; the ⋯ panel always has it beside the context.
    { ...namedGroup('compact'), width: contextUsed > 0 && contextUsed >= (await read($, barLevels)).contextRed ? cells(' 🗜️ ') : 0 },
    namedGroup('narrator'),
    namedGroup('mic'),
    namedGroup('reload'),
    namedGroup('settings'),
    { name: 'exit', width: 3, node: <Box key="group:exit" flexShrink={0}>{control('speedy:exit', ' ✕ ', '#ff6b6b', true)}</Box>, panel: [], labels: [] }
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
  const elements = $.ui.resolve(e)
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
  const gridded = hidden.filter(group => group.name !== 'socials' && group.name !== 'compact')
  const controls = gridded.flatMap(group => group.panel)
  const controlCell = Math.max(0, ...gridded.flatMap(group => group.labels)) + 2
  const networkCell = Math.max(0, ...(hidden.find(group => group.name === 'socials')?.labels ?? [])) + 1
  return (
    <Box flexDirection="column">
      {top}
      {networks.length > 0 ? grid('networks', 'REDES', networks, networkCell) : null}
      {controls.length > 0 ? grid('controls', 'CONTROLES', controls, controlCell) : null}
    </Box>
  )
}

/** The color of an effort level: its traffic-light color in EFFORTS, gray for one it does not list. */
export function effortColor (level: string): string {
  return EFFORTS.find(([name]) => name === level)?.[1] ?? '#adb5bd'
}

/**
 * A priority list as saved, made whole: the parts it knows in its order, once each, then any it lacks in
 * the default order. An old or hand-edited list never drops a part from the status line.
 */
export function barOrderOf (saved: unknown): BarPart[] {
  const known = Array.isArray(saved) ? saved.filter((key): key is BarPart => DEFAULT_ORDER.includes(key as BarPart)) : []
  const order = [...new Set(known)]
  return [...order, ...DEFAULT_ORDER.filter(key => !order.includes(key))]
}

/** Writes the file the status line reads: the levels, and the parts by priority. */
async function writeBarFile ($: EngineInterface) {
  const content = { ...(await read($, barLevels)), priority: await read($, barOrder) }
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
async function settingsMenu ($: EngineInterface, e: Drawn, width = 90, height = 24) {
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
  const mark = { '': ['·', '#868e96'], working: ['…', '#ffd43b'], ok: ['✔', '#51cf66'], fail: ['✘', '#ff6b6b'] } as const
  const setupTab = (
    <Box flexDirection="column">
      {SETUP_STEPS.map(([name, label]) => {
        const check = checks[name] ?? { state: '', detail: '' }
        const [glyph, tint] = mark[check.state]
        return (
          <Box key={`setup-row:${name}`} flexDirection={narrow ? 'column' : 'row'} marginBottom={narrow ? 1 : 0}>
            <Box flexDirection="row">
              {/* A column of its own: ✔ is drawn two cells wide where it is counted as one. */}
              <Box width={4} flexShrink={0}><Text bold color={tint}>{` ${glyph}`}</Text></Box>
              <Box width={narrow ? inside - 4 : 46}><Text bold color={check.state === 'fail' ? tint : '#74c0fc'}>{label}</Text></Box>
            </Box>
            <Box paddingLeft={narrow ? 4 : 0}><Text color={tint} dimColor={check.state === ''}>{check.detail}</Text></Box>
          </Box>
        )
      })}
      <Box flexDirection="row" marginTop={1}>
        <Button key="setup:run" plain onPress={() => { void runSetup($) }}>
          <Text bold color="black" backgroundColor={installing ? '#ffd43b' : '#51cf66'}>{installing ? ' Instalando… ' : ' Instalar / reparar todo '}</Text>
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
  const barTab = (
    <Box flexDirection="column">
      <Box flexDirection={narrow ? 'column' : 'row'} marginBottom={1}>
        <Box width={narrow ? inside : 34} flexShrink={0}>
          <Text>
            <Text bold color="#4dabf7">{' ▤  Barra speedy-code '}</Text>
            <Text bold color={bar === 'on' ? '#51cf66' : '#868e96'}>{bar === 'on' ? '● activa' : '○ inactiva'}</Text>
          </Text>
        </Box>
        <Box marginTop={narrow ? 1 : 0} flexShrink={0}>
          <Button key="bar:statusline" plain onPress={() => { void switchStatusLine($, bar === 'on' ? 'off' : 'on') }}>
            <Text bold color="black" backgroundColor={bar === 'on' ? '#868e96' : '#4dabf7'}>{bar === 'on' ? ' Restaurar mi barra ' : ' Usar barra speedy-code '}</Text>
          </Button>
        </Box>
      </Box>
      <Box flexDirection={isSideBySide ? 'row' : 'column'}>
        <Box flexDirection="column" flexShrink={0} marginRight={isSideBySide ? 4 : 0}>
          <Text bold dimColor>COLORES</Text>
          {level('Contexto usado · amarillo desde', 'contextYellow', '')}
          {level('Contexto usado · rojo desde', 'contextRed', '⚠  compactar, y el aviso')}
          {level('Límite usado · amarillo desde', 'limitYellow', '')}
          {level('Límite usado · rojo desde', 'limitRed', '⚠  y el aviso')}
        </Box>
        <Box flexDirection="column" flexShrink={0} marginTop={isSideBySide ? 0 : 1}>
          <Text bold dimColor>PRIORIDAD AL ACHICARSE</Text>
          {order.map((key, index) => priorityRow(key, index))}
        </Box>
      </Box>
      <Box flexDirection="row" marginTop={1}>
        <Button key="bar:reset" plain onPress={() => { void resetLevels($) }}>
          <Text bold color="black" backgroundColor="#4dabf7">{' Restaurar los valores por defecto '}</Text>
        </Button>
      </Box>
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
  const elements = $.ui.resolve(e)
  const { Box, Button, Text } = elements
  return (
    <Box flexDirection="column">
      {connected.length === 0 ? <Text dimColor>Buscando micrófonos…</Text> : null}
      {(connected.length === 0 ? [] : ['', ...connected]).map(name => {
        const isChosen = name === chosenMic
        const label = ` ${isChosen ? '●' : '○'} ${name ? micName(name) : 'Predeterminado de Windows'} `
        if (isChosen && 'Client' in elements) {
          return <elements.Client key={`speedy:chosen:mic:${name}`} module="./control.tsx" width={cells(label)} props={{ label, color: 'black', bold: true, backgroundColor: '#ff8787' }} />
        }
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
  const elements = $.ui.resolve(e)
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
  const elements = $.ui.resolve(e)
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
    const savedOrder = await $.store.get('barOrder')
    if (savedLevels && typeof savedLevels === 'object') await update($, barLevels, () => savedLevels as BarLevels)
    await update($, barOrder, () => barOrderOf(savedOrder))
    await writeBarFile($)
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
    const groups = (await footerGroups($, e)).filter(group => group.width > 0)
    const beneath = await next(e)
    const { Box, Client, Text } = $.ui.resolve(e)
    // The room the controls have: the terminal's width less the mode labels, the ` · ` and a margin.
    const modes = e.props.modes.join(' & ')
    const room = (e.viewport?.columns ?? Number.MAX_SAFE_INTEGER) - (modes ? cells(modes) + 3 : 0) - 4
    const { shown, compact } = footerFit(groups, room)
    hiddenGroups = groups.filter(group => !shown.has(group.name)).map(group => group.name)
    const drawn = (group: (typeof groups)[number]) => compact.has(group.name) && 'compactNode' in group ? group.compactNode : group.node
    return (
      <Box flexDirection="row" flexWrap="nowrap">
        {beneath}
        {/* The dot sets the controls off the mode labels: with none, there is nothing to set off. */}
        {e.props.modes.length > 0 ? <Text dimColor> · </Text> : null}
        {groups.filter(group => shown.has(group.name) && group.name !== 'exit').map(drawn)}
        {/* What did not fit waits behind ⋯, in a panel above the prompt. */}
        {hiddenGroups.length > 0 ? <Client key="speedy:more" module="./control.tsx" width={MORE_WIDTH} props={{ label: ' ⋯ ', color: '#adb5bd', bold: true }} /> : null}
        {groups.find(group => group.name === 'exit')?.node}
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
      await closeMenu($, 'more')
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
    } else if (e.element === 'speedy:more') {
      await openMenu($, 'more')
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
      // The selection is taken as 📎 is pressed, before the menu opens, so it is not lost to the menu.
      if ((await read($, menu)) !== 'history') pendingSelection = await selectedText($)
      await openMenu($, 'history')
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
      const title = ` ${shown === 'voices' ? voiceTitle(chosen) : shown === 'mic' ? 'Micrófono para dictar' : shown === 'models' ? `Modelo de Claude (${inUse})` : shown === 'more' ? 'Más' : shown === 'history' ? 'Audios' : 'Configuración'} `
      const color = shown === 'voices' ? languageColor(chosen.active ?? DEFAULT_LANG) : shown === 'mic' ? MIC_COLORS.on : shown === 'models' ? MODEL_COLOR : shown === 'history' ? '#ffd43b' : '#adb5bd'
      // A frame around the menu, its title in the middle of the top border and the close button at
      // its right end. Absolute positions are clipped, so the title row comes after the frame in the
      // tree (drawn over it) and column-reverse puts it on top, pulled one row down onto the border:
      // it paints its own letters alone, the rest of the border stays.
      const width = e.props.bodyColumns || 90
      return (
        <Box flexDirection="column-reverse" width={width}>
          <Box flexDirection="column" width={width} borderStyle="single" borderColor={color} paddingX={1} paddingTop={1}>
            {shown === 'voices' ? await voiceMenu($, e, width, e.props.maxRows) : shown === 'mic' ? await micMenu($, e) : shown === 'models' ? await modelMenu($, e, width) : shown === 'more' ? await moreMenu($, e, width) : shown === 'history' ? await historyMenu($, e, width) : await settingsMenu($, e, width, e.props.maxRows)}
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
        </Text>
        {list.map(one => <Text key={`heard:${one.number}`} italic dimColor>{`  ${one.text}`}</Text>)}
      </Box>
    )
  })

  // The menus, in their panes.
  on('ui.render', { component: 'Pane', requestId: MIC_PANE }, ($, e) => micMenu($, e))
  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e) => voiceMenu($, e))
}
