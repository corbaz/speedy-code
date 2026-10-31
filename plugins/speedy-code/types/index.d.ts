/** `tag`: what sets a voice apart beside its name (`✦ multi`, a province), or empty. */
export type Voice = { value: string; lang: string; name: string; tag: string; country: string; gender: 'Female' | 'Male' }

/** The voice picked per language code (`es`, `en`, ...), and `active`: the language narrated in. */
export type Picks = Record<string, string>

/** What the narrator is doing: nothing, writing the narration with Haiku, speaking, or paused. */
export type Speech = 'idle' | 'thinking' | 'playing' | 'paused'

/** What the microphone is doing: off; loading the model (it records already) or writing the last phrases after a stop; or listening. */
export type Listening = 'off' | 'loading' | 'on'

/** A phrase heard and not yet written into the prompt: its number and the quick model's preview. */
export type Heard = { number: number; text: string }

/** A menu shown above the prompt, where its pane has no room: none, the voices, or the microphones. */
export type Menu = '' | 'voices' | 'mic' | 'settings'

/** The person's user name on each social network, by the network's id (`github`, `x`, ...). */
export type Socials = Record<string, string>

/** One step of the setup: not checked yet, under way, in place, or missing, with what it found. */
export type SetupCheck = { state: '' | 'working' | 'ok' | 'fail'; detail: string }

declare module 'claude-code' {
  interface PluginState {
    'speedy-code': {
      /** Whether answers are read aloud. */
      isEnabled: boolean
      /** The voices picked, one per language, and the language narrated in. */
      picks: Shaped<Picks>
      /** The neural voices edge-tts offers in the tabs' languages. */
      voices: Shaped<Voice[]>
      /** The language tab open in the picker. */
      tab: string
      /** Whose voices the picker lists: women's or men's. */
      gender: Voice['gender']
      /** The page of voices shown, from 0, when they do not all fit. */
      page: number
      /** What the narrator is doing now. */
      speech: Speech
      /** What the microphone is doing now. */
      listening: Listening
      /** The phrases heard and not yet written, shown above the prompt while they are. */
      heard: Heard[]
      /** The menu shown above the prompt. */
      menu: Menu
      /** The user names the social buttons link to. */
      socials: Socials
      /** The settings tab open. */
      settingsTab: string
      /** How many times the settings were opened: their fields start afresh each time. */
      settingsOpened: number
      /** The network whose user name is being edited; empty: none. */
      editing: string
      /** Each setup step's state, by the name install.ps1 gives it. */
      setupChecks: Record<string, SetupCheck>
      /** The last lines install.ps1 printed along the way. */
      setupLog: string[]
      /** Whether install.ps1 is running. */
      isInstalling: boolean
      /** Whether the wand is cleaning the prompt up with Groq. */
      isPolishing: boolean
      /** The microphones connected, as the system names them. */
      mics: string[]
      /** The microphone dictation listens to; empty: the system's default. */
      mic: string
    }
  }
}
