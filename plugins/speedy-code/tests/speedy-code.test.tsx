import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { accountsOf, ascii, effortColor, guessLanguage, micName, modelLabel, modelOf, plain, socialLink } from '../hooks/register'

const PANE = {
  plugin: 'speedy-code',
  component: 'Pane',
  requestId: 'speedy-code',
  props: { title: 'Voz del narrador', isFocused: true, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

const FOOTER = { plugin: 'speedy-code', component: 'SessionMode', requestId: 'footer', props: { modes: [] }, surface: 'terminal' } as const

const JBL = 'Auriculares con micrófono (2- JBL Tune 520BT)'
const G432 = 'Micrófono (G432 Gaming Headset)'

const VOICES = [
  { value: 'es-AR-ElenaNeural', lang: 'es', name: 'Elena', tag: '', country: 'Argentina', gender: 'Female' },
  { value: 'es-CO-GonzaloNeural', lang: 'es', name: 'Gonzalo', tag: '', country: 'Colombia', gender: 'Male' },
  { value: 'es-ES-XimenaMultilingualNeural', lang: 'es', name: 'Ximena', tag: '✦ multi', country: 'España', gender: 'Female' },
]

/** The session's state as the engine would hold it, `state.get` and `state.set` answered from it. */
function holdState (on: Parameters<Parameters<typeof test>[1]>[1], seed: Record<string, unknown>) {
  const held: Record<string, unknown> = { ...seed }
  held.listening ??= { value: 'off', version: 1 }
  held.isPolishing ??= { value: false, version: 1 }
  held.menu ??= { value: '', version: 1 }
  held.gender ??= { value: 'Female', version: 1 }
  held.page ??= { value: 0, version: 1 }
  held.socialPage ??= { value: 0, version: 1 }
  held.socials ??= { value: {}, version: 1 }
  held.settingsTab ??= { value: 'socials', version: 1 }
  held.settingsOpened ??= { value: 0, version: 1 }
  held.editing ??= { value: '', version: 1 }
  held.setupChecks ??= { value: {}, version: 1 }
  held.setupLog ??= { value: [], version: 1 }
  held.isInstalling ??= { value: false, version: 1 }
  held.statusLine ??= { value: '', version: 1 }
  held.modelNow ??= { value: '', version: 1 }
  held.effort ??= { value: '', version: 1 }
  held.picks ??= { value: { shape: 'picks-1', value: { es: 'es-AR-ElenaNeural', active: 'es' } }, version: 1 }
  on('state.get', (_, e) => ({ value: held[e.key] }))
  on('state.set', (_, e) => { held[e.key] = { value: e.value, version: 2 }; return { value: { isSet: true, version: 2 } } })
  on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text>modes</Text> })
  return held
}

test('plain drops what a voice cannot say', () => {
  expect(plain('# Title\n\n**Bold** and `code` [link](https://x.y)\n\n```ts\nconst a = 1\n```\n- item')).toBe('Title\n\nBold and code link\nitem')
})

test('guessLanguage tells the language by its common words', () => {
  expect(guessLanguage('El narrador lee la respuesta que te di en voz alta, con la voz de Elena.')).toBe('es')
  expect(guessLanguage('The narrator reads the answer that you asked for, and it is short.')).toBe('en')
  expect(guessLanguage('ok')).toBe('')
})

test('the pane draws the tabs and the voices of the open language', async ($, on) => {
  holdState(on, {
    voices: { value: { shape: 'voices-1', value: VOICES }, version: 1 },
    picks: { value: { shape: 'picks-1', value: { es: 'es-CO-GonzaloNeural', active: 'es' } }, version: 1 },
    tab: { value: 'es', version: 1 },
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /Español/ }))?.text).toContain('▶')
  expect((await ui.find({ type: 'Text', text: /Mujeres/ }))?.text).toContain('2')
  // A multilingual voice carries the star alone: the cell stays narrow.
  expect((await ui.find({ type: 'Text', text: /^ ✦$/ }))?.text).toBe(' ✦')
  await ui.unmount()
})

test('picking a voice makes its language the one narrated in, and keeps it', async ($, on) => {
  const held = holdState(on, {
    voices: { value: { shape: 'voices-1', value: VOICES }, version: 1 },
    picks: { value: { shape: 'picks-1', value: { es: 'es-CO-GonzaloNeural', active: 'es' } }, version: 1 },
    tab: { value: 'es', version: 1 },
  })
  const stored: Record<string, unknown> = {}
  on('store.set', (_, e) => { stored[e.key] = e.value; return { value: undefined } })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.close', () => ({ value: undefined }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'es-AR-ElenaNeural' })
  expect(stored.picks).toEqual({ es: 'es-AR-ElenaNeural', active: 'es' })
  expect(held.picks).toEqual({ value: { shape: 'picks-1', value: { es: 'es-AR-ElenaNeural', active: 'es' } }, version: 2 })
  await ui.unmount()
})

test('idle, the footer switches the narrator off and on', async ($, on) => {
  const held = holdState(on, { isEnabled: { value: true, version: 1 }, speech: { value: 'idle', version: 1 } })
  const stored: Record<string, unknown> = {}
  on('store.set', (_, e) => { stored[e.key] = e.value; return { value: undefined } })
  const ui = await $.ui.mount(FOOTER)
  expect((await ui.find({ type: 'Text', in: 'speedy:switch' }))?.text).toBe(' 🔊 ')
  // The left button going down on the edge of the speaker's region is enough.
  await ui.pointer({ type: 'down', x: 3, y: 0, button: 'left', in: 'speedy:switch' })
  expect(stored.isEnabled).toBe(false)
  expect(held.isEnabled).toEqual({ value: false, version: 2 })
  await ui.unmount()
})

function world (on: Parameters<Parameters<typeof test>[1]>[1], store: Record<string, unknown>, reply = '', talks = { on: false }, clipboard = '', mic = { on: false }, polish = { reply: '', sent: [] as string[] }, installed = true, line = { on: false }) {
  const clock = mock.clock(on, { now: 0 })
  const kept: Record<string, unknown> = { ...store }
  const prompts: string[] = []
  const spoken: Array<Record<string, string>> = []
  on('store.get', (_, e) => ({ value: kept[e.key] }))
  on('store.set', (_, e) => { kept[e.key] = e.value; return { value: undefined } })
  on('env.get', () => ({ value: 'C:/Users/test' }))
  on('fs.read', () => { throw new Error('missing') })
  // What is installed beside the code: all of it, unless the test says nothing is.
  on('fs.exists', () => ({ value: installed }))
  const written: Array<{ path: string; text: string }> = []
  const files: string[] = []
  on('fs.write', (_, e) => {
    if (e.path.endsWith('levels.json')) files.push(e.text)
    else written.push({ path: e.path.split('\\').join('/'), text: e.text })
    return { value: undefined }
  })
  on('ui.log', () => ({ value: undefined }))
  // edge-tts lists the voices of VOICES; PowerShell answers the clipboard.
  on('process.run', (_, e) => {
    if (e.argv.includes('edge_tts')) return { value: { exitCode: 0, stdout: VOICES.map(v => `${v.value}  ${v.gender}  General  Friendly`).join('\n'), stderr: '' } }
    if (e.argv.includes('Get-Clipboard -Raw')) return { value: { exitCode: 0, stdout: clipboard, stderr: '' } }
    // A social button: PowerShell opens the link in the browser.
    if (e.argv.some(arg => arg.startsWith('Start-Process'))) {
      opened.push(e.argv.at(-1) ?? '')
      return { value: { exitCode: 0, stdout: '', stderr: '' } }
    }
    // The send button: PowerShell presses Enter.
    if (e.argv.some(arg => arg.includes("SendWait('{ENTER}')"))) {
      pressed.push(e.argv.join(' '))
      return { value: { exitCode: 0, stdout: 'sent\r\n', stderr: '' } }
    }
    // The image button: PowerShell presses Alt+V when the clipboard holds an image.
    if (e.argv.some(arg => arg.includes('ContainsImage'))) {
      pressed.push(e.argv.join(' '))
      return { value: { exitCode: 0, stdout: clipboard === 'image' ? 'pasted\r\n' : 'none\r\n', stderr: '' } }
    }
    // Leaving: the resume command goes to the clipboard by PowerShell.
    if (e.argv.some(arg => arg.startsWith('Set-Clipboard'))) {
      copied.push(e.argv.at(-1) ?? '')
      return { value: { exitCode: 0, stdout: '', stderr: '' } }
    }
    // The status line switch answers what is in use.
    if (e.argv.some(arg => arg.endsWith('switch.py'))) {
      switched.push(e.argv.at(-1) ?? '')
      if (e.argv.at(-1) === 'on') line.on = true
      if (e.argv.at(-1) === 'off') line.on = false
      return { value: { exitCode: 0, stdout: `${line.on ? 'on' : 'off'}\r\n`, stderr: '' } }
    }
    if (e.argv.includes('--list')) return { value: { exitCode: 0, stdout: `mic ${JBL}\r\nmic ${G432}\r\n`, stderr: '' } }
    return { value: { exitCode: 1, stdout: '', stderr: '' } }
  })
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('turn.complete', (_, e) => ({ text: e.reason === 'answer' ? e.answer : '' }))
  on('model.complete', (_, e) => {
    prompts.push(String(e.prompt))
    return { value: { isAnswered: true, text: reply, usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }
  })
  const listened: string[][] = []
  const pressed: string[] = []
  const copied: string[] = []
  const opened: string[] = []
  const switched: string[] = []
  on('process.spawn', async function * (_, e) {
    // The setup: install.ps1 says each step as it starts and ends.
    if (e.argv.some(arg => arg.endsWith('install.ps1'))) {
      yield { stream: 'stdout' as const, text: 'step python Creando el entorno\ninfo Using Python 3.12\nok python Python 3.12.16\n' }
      yield { stream: 'stdout' as const, text: 'step groq Buscando la clave\nfail groq falta GROQ_API_KEY (opcional: solo la usa la pluma)\ndone con avisos\n' }
      return { value: { code: 0, signal: null } }
    }
    // The wand: polish.py reads the ask on stdin and answers JSON, in ASCII, as Python's json.dumps writes it.
    if (e.argv.some(arg => arg.endsWith('polish.py'))) {
      polish.sent.push(e.input ?? '')
      yield { stream: 'stdout' as const, text: `${polish.reply}\n` }
      return { value: { code: 0, signal: null } }
    }
    // The microphone: listen.py says it is ready, then two phrases, as their words are committed;
    // a phrase's first piece starts with a space, and a word can come in two pieces ("end", "point.").
    if (e.argv.some(arg => arg.endsWith('listen.py'))) {
      listened.push([...e.argv])
      yield { stream: 'stdout' as const, text: 'ready\npartial 1 Hola quiero\ntext 1  Hola, quiero hacer un\n' }
      yield { stream: 'stdout' as const, text: 'partial 2 refactor del en\n' }
      // A microphone left on stops between the preview of phrase 2 and its text.
      while (mic.on) await clock.sleep(100)
      yield { stream: 'stdout' as const, text: 'text 2  refactor del end\ntext 2 point.\n' }
      return { value: { code: 0, signal: null } }
    }
    spoken.push(e.env ?? {})
    yield { stream: 'stdout' as const, text: 'voice x\n' }
    // A voice that talks on until the test lets it end.
    while (talks.on) {
      await clock.sleep(100)
      yield { stream: 'stdout' as const, text: '.\n' }
    }
    return { value: { code: 0, signal: null } }
  })
  return { clock, kept, prompts, spoken, written, listened, pressed, copied, opened, switched, files }
}

const answer = ($: Engine, text: string) =>
  $.turn.complete({ reason: 'answer', answer: text, durationMs: 1, isAborted: false, turnId: 't1' })

test('a short answer in the language narrated in is spoken as it is, with no model call', async ($, on) => {
  const w = world(on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await answer($, 'Listo, ya funciona la voz de Elena en el pie de la pantalla.')
  await w.clock.settle()
  expect(w.prompts).toEqual([])
  expect(w.spoken[0]?.NARRATOR_TEXT).toBe('Listo, ya funciona la voz de Elena en el pie de la pantalla.')
  expect(w.spoken[0]?.NARRATOR_VOICE).toBe('es-AR-ElenaNeural')
})

test('an answer in another language than the one narrated in goes through Haiku', async ($, on) => {
  const w = world(on, { picks: { es: 'es-AR-ElenaNeural', pt: 'pt-BR-AntonioNeural', active: 'pt' } }, 'Pronto, a voz já funciona.')
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await answer($, 'Listo, ya funciona la voz de Elena en el pie de la pantalla.')
  await w.clock.settle()
  expect(w.prompts[0]).toContain('Translate this reply into Portuguese')
  expect(w.spoken[0]?.NARRATOR_TEXT).toBe('Pronto, a voz já funciona.')
  expect(w.spoken[0]?.NARRATOR_VOICE).toBe('pt-BR-AntonioNeural')
})

test('switched off, it says nothing', async ($, on) => {
  const w = world(on, { isEnabled: false })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await answer($, 'Hola, esto es una prueba de la voz.')
  await w.clock.settle()
  expect(w.spoken).toEqual([])
})

test('a session nobody is at is not narrated', async ($, on) => {
  const w = world(on, {})
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: false })
  await answer($, 'Hola, esto es una prueba de la voz.')
  await w.clock.settle()
  expect(w.spoken).toEqual([])
})

test('switched off, the play button stays, in gray', async ($, on) => {
  holdState(on, { isEnabled: { value: false, version: 1 }, speech: { value: 'idle', version: 1 } })
  const ui = await $.ui.mount(FOOTER)
  expect((await ui.find({ type: 'Text', in: 'speedy:switch' }))?.text).toBe(' 🔇 ')
  expect((await ui.find({ type: 'Text', in: 'speedy:play' }))?.props.color).toBe('#495057')
  await ui.unmount()
})

test('once it has read, the play button reads the last answer again', async ($, on) => {
  const w = world(on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text>modes</Text> })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await answer($, 'Listo, ya funciona la voz de Elena en el pie de la pantalla.')
  await w.clock.settle()
  const ui = await $.ui.mount(FOOTER)
  expect((await ui.find({ type: 'Text', in: 'speedy:play' }))?.text).toBe(' ⏵ ')
  await ui.post({ isClicked: true }, { in: 'speedy:play' })
  await w.clock.settle()
  expect(w.spoken.map(env => env.NARRATOR_TEXT)).toEqual([
    'Listo, ya funciona la voz de Elena en el pie de la pantalla.',
    'Listo, ya funciona la voz de Elena en el pie de la pantalla.',
  ])
  await ui.unmount()
})

test('reading the last answer again calls Haiku no more', async ($, on) => {
  const w = world(on, { picks: { es: 'es-AR-ElenaNeural', pt: 'pt-BR-AntonioNeural', active: 'pt' } }, 'Pronto, a voz já funciona.')
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await answer($, 'Listo, ya funciona la voz de Elena en el pie de la pantalla.')
  await w.clock.settle()
  await $.command.run({ command: 'speedy', args: 'leer', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })
  await w.clock.settle()
  expect(w.prompts.length).toBe(1)
  expect(w.spoken.map(env => env.NARRATOR_TEXT)).toEqual(['Pronto, a voz já funciona.', 'Pronto, a voz já funciona.'])
})

test('while it speaks, the footer pauses its own narration and goes on', { timeoutMs: 30000 }, async ($, on) => {
  const talks = { on: true }
  const w = world(on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } }, '', talks)
  on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text>modes</Text> })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await answer($, 'Listo, ya funciona la voz de Elena en el pie de la pantalla.')
  await w.clock.advance(200)
  const control = w.written[0]?.path ?? ''
  // A pause file of its own, under ~/.claude/speedy-code, that speak.ps1 is told of.
  expect(control).toMatch(/^C:\/Users\/test\/\.claude\/speedy-code\/control-[0-9a-f-]+\.txt$/)
  expect(w.spoken[0]?.NARRATOR_CONTROL?.split('\\').join('/')).toBe(control)
  const ui = await $.ui.mount(FOOTER)
  expect((await ui.find({ type: 'Text', in: 'speedy:play' }))?.text).toBe(' ⏸︎ ')
  await ui.post({ isClicked: true }, { in: 'speedy:play' })
  await ui.post({ isClicked: true }, { in: 'speedy:play' })
  expect(w.written.map(one => `${one.path === control ? 'own' : one.path}=${one.text}`)).toEqual(['own=play', 'own=pause', 'own=play'])
  talks.on = false
  await w.clock.advance(200)
  await ui.unmount()
})

test('switched off while it speaks, it pauses; switched on, it goes on', { timeoutMs: 30000 }, async ($, on) => {
  const talks = { on: true }
  const w = world(on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } }, '', talks)
  on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text>modes</Text> })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await answer($, 'Listo, ya funciona la voz de Elena en el pie de la pantalla.')
  await w.clock.advance(200)
  const ui = await $.ui.mount(FOOTER)
  await ui.post({ isClicked: true }, { in: 'speedy:switch' })
  await ui.post({ isClicked: true }, { in: 'speedy:switch' })
  expect(w.written.map(one => one.text)).toEqual(['play', 'pause', 'play'])
  expect(w.spoken.length).toBe(1)
  talks.on = false
  await w.clock.advance(200)
  await ui.unmount()
})


/**
 * Every button in every state: starting from a narration under way, each row clicks the footer's
 * controls in order and states what reaches speak.ps1 (the words in its pause file, after the
 * `play` it starts with), how many times the voice was started, and what the footer shows last.
 * `end` lets the voice finish first, so the row starts from a narration read to its end.
 */
const BUTTONS: ReadonlyArray<{ name: string; steps: ReadonlyArray<'play' | 'switch' | 'end'>; words: string[]; starts: number; last: string; speaker: string }> = [
  { name: 'reading: play pauses', steps: ['play'], words: ['pause'], starts: 1, last: ' ⏵ ', speaker: ' 🔊 ' },
  { name: 'reading: play twice pauses and goes on', steps: ['play', 'play'], words: ['pause', 'play'], starts: 1, last: ' ⏸︎ ', speaker: ' 🔊 ' },
  { name: 'reading: the speaker pauses, play stays and does nothing', steps: ['switch', 'play'], words: ['pause'], starts: 1, last: ' ⏵ ', speaker: ' 🔇 ' },
  { name: 'reading: the speaker off and on goes on', steps: ['switch', 'switch'], words: ['pause', 'play'], starts: 1, last: ' ⏸︎ ', speaker: ' 🔊 ' },
  { name: 'paused: the speaker off and on stays paused', steps: ['play', 'switch', 'switch'], words: ['pause'], starts: 1, last: ' ⏵ ', speaker: ' 🔊 ' },
  { name: 'paused: the speaker off and on, then play goes on', steps: ['play', 'switch', 'switch', 'play'], words: ['pause', 'play'], starts: 1, last: ' ⏸︎ ', speaker: ' 🔊 ' },
  { name: 'read to its end: play reads it again', steps: ['end', 'play'], words: [], starts: 2, last: ' ⏸︎ ', speaker: ' 🔊 ' },
  { name: 'read to its end: the speaker off, play stays and does nothing', steps: ['end', 'switch', 'play'], words: [], starts: 1, last: ' ⏵ ', speaker: ' 🔇 ' },
  { name: 'read to its end: the speaker off and on, play shows', steps: ['end', 'switch', 'switch'], words: [], starts: 1, last: ' ⏵ ', speaker: ' 🔊 ' },
  { name: 'read to its end: off, on, play reads it again', steps: ['end', 'switch', 'switch', 'play'], words: [], starts: 2, last: ' ⏸︎ ', speaker: ' 🔊 ' },
]

for (const row of BUTTONS) {
  test(`buttons, ${row.name}`, { timeoutMs: 30000 }, async ($, on) => {
    const talks = { on: true }
    const w = world(on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } }, '', talks)
    on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text>modes</Text> })
    await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
    await answer($, 'Listo, ya funciona la voz de Elena en el pie de la pantalla.')
    await w.clock.advance(200)
    const ui = await $.ui.mount(FOOTER)
    for (const step of row.steps) {
      if (step === 'end') {
        talks.on = false
        await w.clock.advance(200)
        talks.on = true
      } else {
        await ui.post({ isClicked: true }, { in: `speedy:${step}` })
        await w.clock.advance(200)
      }
    }
    // Each narration starts by writing `play` to a pause file of its own: those are left out.
    const words = w.written.filter((one, index) => !(one.text === 'play' && w.written.findIndex(first => first.path === one.path) === index)).map(one => one.text)
    expect(words).toEqual(row.words)
    expect(w.spoken.length).toBe(row.starts)
    const play = await ui.find({ type: 'Text', in: 'speedy:play' })
    expect(play?.text).toBe(row.last)
    // Off, play stays where it was, in gray.
    expect(play?.props.color === '#495057').toBe(row.speaker === ' 🔇 ')
    expect((await ui.find({ type: 'Text', in: 'speedy:switch' }))?.text).toBe(row.speaker)
    talks.on = false
    await w.clock.advance(200)
    await ui.unmount()
  })
}

/** A session with the footer drawn, the voice done talking at once. */
async function footerSession ($: Engine, on: Parameters<Parameters<typeof test>[1]>[1], store: Record<string, unknown>, clipboard = '', mic = { on: false }, polish = { reply: '', sent: [] as string[] }) {
  const w = world(on, store, '', { on: false }, clipboard, mic, polish)
  on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text>modes</Text> })
  on('ui.toast', () => ({ value: undefined }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  return { w, ui: await $.ui.mount(FOOTER) }
}

test('the clip reads the text selected with the mouse, and play reads it again', { timeoutMs: 30000 }, async ($, on) => {
  on('ui.selection', () => ({ value: { text: 'Hola, este es el texto que seleccioné en la terminal.' } }))
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await ui.post({ isClicked: true }, { in: 'speedy:clip' })
  await w.clock.advance(200)
  await ui.post({ isClicked: true }, { in: 'speedy:play' })
  await w.clock.advance(200)
  expect(w.spoken.map(env => env.NARRATOR_TEXT)).toEqual([
    'Hola, este es el texto que seleccioné en la terminal.',
    'Hola, este es el texto que seleccioné en la terminal.',
  ])
  await ui.unmount()
})

test('with nothing selected, the clip reads the clipboard', { timeoutMs: 30000 }, async ($, on) => {
  on('ui.selection', () => ({ value: undefined }))
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } }, 'Texto que copié de otro lado, en el portapapeles.\r\n')
  await ui.post({ isClicked: true }, { in: 'speedy:clip' })
  await w.clock.advance(200)
  expect(w.spoken.map(env => env.NARRATOR_TEXT)).toEqual(['Texto que copié de otro lado, en el portapapeles.'])
  await ui.unmount()
})

test('switched off, the clip stays, in gray, and reads nothing', { timeoutMs: 30000 }, async ($, on) => {
  on('ui.selection', () => ({ value: { text: 'Hola, este es el texto que seleccioné en la terminal.' } }))
  const { w, ui } = await footerSession($, on, { isEnabled: false })
  expect((await ui.find({ type: 'Text', in: 'speedy:clip' }))?.props.color).toBe('#495057')
  await ui.post({ isClicked: true }, { in: 'speedy:clip' })
  await w.clock.advance(200)
  expect(w.spoken).toEqual([])
  await ui.unmount()
})

test('after another voice is picked, play reads the last answer with it', { timeoutMs: 30000 }, async ($, on) => {
  const w = world(on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text>modes</Text> })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.close', () => ({ value: undefined }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await answer($, 'Listo, ya funciona la voz de Elena en el pie de la pantalla.')
  await w.clock.advance(200)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pane.press({ key: 'gender:Male' })
  await pane.press({ key: 'es-CO-GonzaloNeural' })
  await pane.unmount()
  const ui = await $.ui.mount(FOOTER)
  await ui.post({ isClicked: true }, { in: 'speedy:play' })
  await w.clock.advance(200)
  expect(w.spoken.map(env => env.NARRATOR_VOICE)).toEqual(['es-AR-ElenaNeural', 'es-CO-GonzaloNeural'])
  expect(w.prompts).toEqual([])
  await ui.unmount()
})

test('the microphone appends each phrase said to the prompt', { timeoutMs: 30000 }, async ($, on) => {
  const filled: Array<{ text: string; mode?: string }> = []
  let draft = 'Tengo una duda:'
  on('prompt.read', () => ({ value: { text: draft } }))
  on('prompt.fill', (_, e) => { filled.push({ text: e.text, mode: e.mode }); draft += e.text; return { isFilled: true } })
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await ui.post({ isClicked: true }, { in: 'speedy:mic' })
  await w.clock.advance(200)
  // listen.py LANGUAGE CONTROL_FILE MICROPHONE: the model is fixed, so it is no argument.
  expect(w.listened[0]?.slice(-4, -2).map(arg => arg.split(/[\\/]/).pop())).toEqual(['listen.py', 'es'])
  expect(filled).toEqual([{ text: ' Hola, quiero hacer un', mode: 'append' }, { text: ' refactor del end', mode: 'append' }, { text: 'point.', mode: 'append' }])
  expect(draft).toBe('Tengo una duda: Hola, quiero hacer un refactor del endpoint.')
  await ui.unmount()
})

test('clicked again, the microphone is asked to stop, and it goes back to gray', { timeoutMs: 30000 }, async ($, on) => {
  const mic = { on: true }
  on('prompt.read', () => ({ value: { text: '' } }))
  on('prompt.fill', () => ({ isFilled: true }))
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } }, '', mic)
  expect((await ui.find({ type: 'Text', in: 'speedy:mic' }))?.props.color).toBe('#adb5bd')
  await ui.post({ isClicked: true }, { in: 'speedy:mic' })
  await w.clock.advance(200)
  expect((await ui.find({ type: 'Text', in: 'speedy:mic' }))?.props.color).toBe('#ff6b6b')
  // An emoji takes no color: the glyph itself is red while it records.
  expect((await ui.find({ type: 'Text', in: 'speedy:mic' }))?.text).toBe(' 🔴')
  await ui.post({ isClicked: true }, { in: 'speedy:mic' })
  const file = w.listened[0]?.at(-2)?.split('\\').join('/') ?? ''
  expect(w.written.filter(one => one.path === file).map(one => one.text)).toEqual(['listen', 'stop'])
  // Blue while the last phrases are written.
  expect((await ui.find({ type: 'Text', in: 'speedy:mic' }))?.props.color).toBe('#748ffc')
  expect((await ui.find({ type: 'Text', in: 'speedy:mic' }))?.text).toBe(' 🔵')
  mic.on = false
  await w.clock.advance(200)
  expect((await ui.find({ type: 'Text', in: 'speedy:mic' }))?.props.color).toBe('#adb5bd')
  await ui.unmount()
})

test('micName keeps the device, not its kind', () => {
  expect(micName(JBL)).toBe('JBL Tune 520BT')
  expect(micName(G432)).toBe('G432 Gaming Headset')
  expect(micName('USB Mic')).toBe('USB Mic')
})

test('the microphone menu lists the default and every microphone; the one picked is kept and listened to', { timeoutMs: 30000 }, async ($, on) => {
  const mic = { on: false }
  on('prompt.read', () => ({ value: { text: '' } }))
  on('prompt.fill', () => ({ isFilled: true }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } }, '', mic)
  await w.clock.advance(200)
  const menu = await $.ui.mount({ ...PANE, requestId: 'speedy-code-mic', surface: 'terminal' })
  expect((await menu.findAll({ type: 'Text' })).map(text => text.text)).toEqual([
    ' ● Predeterminado de Windows ',
    ' ○ JBL Tune 520BT ',
    ' ○ G432 Gaming Headset ',
  ])
  await menu.press({ key: `mic:${JBL}` })
  await menu.unmount()
  expect(w.kept.mic).toBe(JBL)
  await ui.post({ isClicked: true }, { in: 'speedy:mic' })
  await w.clock.advance(200)
  expect(w.listened[0]?.at(-1)).toBe(JBL)
  await ui.unmount()
})

const BAND = { plugin: 'speedy-code', component: 'AbovePrompt', requestId: 'band', props: { hasSurvey: false, isWorking: false, maxRows: 30, bodyColumns: 130, scroll: { offset: 0, bodyRows: 30 } }, surface: 'terminal' } as const

test('above the prompt, what is heard shows while it is said, and leaves once it is written', { timeoutMs: 30000 }, async ($, on) => {
  const mic = { on: true }
  let draft = ''
  on('prompt.read', () => ({ value: { text: draft } }))
  on('prompt.fill', (_, e) => { draft += e.text; return { isFilled: true } })
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } }, '', mic)
  await ui.post({ isClicked: true }, { in: 'speedy:mic' })
  await w.clock.advance(200)
  const band = await $.ui.mount(BAND)
  expect((await band.find({ type: 'Text', text: /^🔴 escuchando$/ }))?.text).toBe('🔴 escuchando')
  expect((await band.find({ type: 'Text', text: /refactor/ }))?.text).toBe('  refactor del en')
  expect(draft).toBe('Hola, quiero hacer un')
  await band.unmount()
  mic.on = false
  await w.clock.advance(200)
  expect(draft).toBe('Hola, quiero hacer un refactor del endpoint.')
  const after = await $.ui.mount(BAND)
  expect(await after.find({ type: 'Text', text: /escuchando|refactor/ })).toBeUndefined()
  await after.unmount()
  await ui.unmount()
})

test('the prompt buttons copy the draft, paste the clipboard and clear it all', { timeoutMs: 30000 }, async ($, on) => {
  const fills: Array<{ text: string; mode?: string }> = []
  const copies: string[] = []
  on('prompt.read', () => ({ value: { text: 'Mi pregunta sobre React' } }))
  on('prompt.fill', (_, e) => { fills.push({ text: e.text, mode: e.mode }); return { isFilled: true } })
  on('ui.copy', (_, e) => { copies.push(e.text); return { value: { isCopied: true } } })
  const { ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } }, 'useEffect(() => {})\r\n')
  await ui.post({ isClicked: true }, { in: 'speedy:copy' })
  await ui.post({ isClicked: true }, { in: 'speedy:paste' })
  await ui.post({ isClicked: true }, { in: 'speedy:clear' })
  expect(copies).toEqual(['Mi pregunta sobre React'])
  expect(fills).toEqual([{ text: 'useEffect(() => {})', mode: 'insert' }, { text: '', mode: 'replace' }])
  await ui.unmount()
})

test('ascii escapes every character past ASCII, as JSON reads it back', () => {
  expect(ascii('¿Mágica? ñandú')).toBe('\\u00bfM\\u00e1gica? \\u00f1and\\u00fa')
  expect(JSON.parse(`"${ascii('¿Mágica? ñandú')}"`)).toBe('¿Mágica? ñandú')
})

test('the wand sends the prompt to Groq and puts back the text it cleaned up, accents whole', { timeoutMs: 30000 }, async ($, on) => {
  const fills: Array<{ text: string; mode?: string }> = []
  const polish = { reply: '{"text": "\\u00bfUna varita m\\u00e1gica? Tom\\u00e1s el texto."}', sent: [] as string[] }
  on('prompt.read', () => ({ value: { text: 'eh una varita mágica tomás el texto' } }))
  on('prompt.fill', (_, e) => { fills.push({ text: e.text, mode: e.mode }); return { isFilled: true } })
  const { ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } }, '', { on: false }, polish)
  await ui.post({ isClicked: true }, { in: 'speedy:polish' })
  // What polish.py is sent is ASCII alone, and reads back as the draft.
  expect(/^[\x00-\x7f]*$/.test(polish.sent[0] ?? '')).toBe(true)
  const ask = JSON.parse(polish.sent[0] ?? '{}') as { model: string; text: string; system: string }
  expect(ask.model).toBe('openai/gpt-oss-120b')
  expect(ask.text).toBe('eh una varita mágica tomás el texto')
  expect(fills).toEqual([{ text: '¿Una varita mágica? Tomás el texto.', mode: 'replace' }])
  await ui.unmount()
})

test('typed into while Groq answers, the wand overwrites nothing', { timeoutMs: 30000 }, async ($, on) => {
  let reads = 0
  const fills: string[] = []
  // The draft reads one way when the wand starts and another once Groq has answered.
  on('prompt.read', () => ({ value: { text: reads++ === 0 ? 'eh necesito un refactor' : 'eh necesito un refactor y algo más' } }))
  on('prompt.fill', (_, e) => { fills.push(e.text); return { isFilled: true } })
  const { ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } }, '', { on: false }, { reply: '{"text": "Necesito un refactor."}', sent: [] })
  await ui.post({ isClicked: true }, { in: 'speedy:polish' })
  expect(fills).toEqual([])
  await ui.unmount()
})

test('where its pane has no room, the voice menu shows above the prompt, and its button closes it', { timeoutMs: 30000 }, async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'the terminal is narrower than 110 columns' } }))
  on('ui.close', () => ({ value: undefined }))
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await w.clock.advance(200)
  await ui.post({ isClicked: true }, { in: 'speedy:voice' })
  const band = await $.ui.mount(BAND)
  expect((await band.find({ type: 'Text', text: /Voz:/ }))?.text).toMatch(/^ Voz: Elena \(Español - (Argentina|AR)\) $/)
  expect((await band.find({ type: 'Text', text: /Mujeres/ }))?.text).toContain('2')
  // No hotkeys: a tab is its label alone, no "1: " drawn before it.
  expect((await band.find({ type: 'Text', text: /Español/ }))?.text?.trim()).toBe('Español ▶')
  // The close control has no background under the pointer: a Client, clicked as the terminal reports it.
  await band.pointer({ type: 'down', x: 1, y: 0, button: 'left', in: 'speedy:menu-close' })
  await band.unmount()
  const after = await $.ui.mount(BAND)
  expect(await after.find({ type: 'Text', text: /Voz:/ })).toBeUndefined()
  await after.unmount()
  await ui.unmount()
})

test('picked above the prompt, a voice closes the menu', { timeoutMs: 30000 }, async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'narrow' } }))
  on('ui.close', () => ({ value: undefined }))
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await w.clock.advance(200)
  await ui.post({ isClicked: true }, { in: 'speedy:voice' })
  const band = await $.ui.mount(BAND)
  await band.press({ key: 'gender:Male' })
  await band.press({ key: 'es-CO-GonzaloNeural' })
  await band.unmount()
  expect(w.kept.picks).toEqual({ es: 'es-CO-GonzaloNeural', active: 'es' })
  const after = await $.ui.mount(BAND)
  expect(await after.find({ type: 'Text', text: /Voz:/ })).toBeUndefined()
  await after.unmount()
  await ui.unmount()
})

test('the image button asks Windows to press Alt+V, only when the clipboard holds an image', { timeoutMs: 30000 }, async ($, on) => {
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } }, 'image')
  await ui.post({ isClicked: true }, { in: 'speedy:image' })
  expect(w.pressed.length).toBe(1)
  expect(w.pressed[0]).toContain('ContainsImage()')
  expect(w.pressed[0]).toContain("SendWait('%v')")
  await ui.unmount()
})

test('the exit button runs /exit', { timeoutMs: 30000 }, async ($, on) => {
  const commands: string[] = []
  on('command.run', (_, e) => { commands.push(e.command); return { text: '' } })
  const { ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await ui.post({ isClicked: true }, { in: 'speedy:exit' })
  expect(commands).toEqual(['exit'])
  await ui.unmount()
})

test('leaving, the command that resumes the session goes to the clipboard; a /clear copies nothing', { timeoutMs: 30000 }, async ($, on) => {
  const w = world(on, {})
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.session.end({ reason: 'clear', sessionId: 'a1b2-c3', resume: { id: 'a1b2-c3' } })
  expect(w.copied).toEqual([])
  await $.session.end({ reason: 'prompt_input_exit', sessionId: 'a1b2-c3', resume: { id: 'a1b2-c3' } })
  expect(w.copied).toEqual(["Set-Clipboard -Value 'claude --resume a1b2-c3'"])
})

test('however wide the terminal, the menus show framed above the prompt, never in a pane', { timeoutMs: 30000 }, async ($, on) => {
  const opened: string[] = []
  on('ui.open', (_, e) => { opened.push(e.id); return { value: { isPlaced: true } } })
  on('ui.close', () => ({ value: undefined }))
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await w.clock.advance(200)
  await ui.post({ isClicked: true }, { in: 'speedy:voice' })
  const band = await $.ui.mount(BAND)
  expect((await band.find({ type: 'Text', text: /Voz:/ }))?.text).toContain('Elena')
  await band.unmount()
  await ui.post({ isClicked: true }, { in: 'speedy:mics' })
  const micBand = await $.ui.mount(BAND)
  expect((await micBand.find({ type: 'Text', text: /Micrófono para dictar/ }))?.text).toBe(' Micrófono para dictar ')
  await micBand.unmount()
  expect(opened).toEqual([])
  await ui.unmount()
})

test('the switch lists one gender at a time: women first, men once picked', { timeoutMs: 30000 }, async ($, on) => {
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await w.clock.advance(200)
  await ui.post({ isClicked: true }, { in: 'speedy:voice' })
  const band = await $.ui.mount(BAND)
  expect((await band.find({ type: 'Text', text: /Mujeres/ }))?.text).toBe(' ♀ Mujeres  2 ')
  expect((await band.find({ type: 'Text', text: /Hombres/ }))?.text).toBe(' ♂ Hombres  1 ')
  expect(await band.find({ type: 'Text', text: /^Elena +$/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /^Gonzalo +$/ })).toBeUndefined()
  await band.press({ key: 'gender:Male' })
  await band.unmount()
  const men = await $.ui.mount(BAND)
  expect(await men.find({ type: 'Text', text: /^Gonzalo +$/ })).toBeDefined()
  expect(await men.find({ type: 'Text', text: /^Elena +$/ })).toBeUndefined()
  await men.unmount()
  await ui.unmount()
})

test('the reload button runs /reload-plugins', { timeoutMs: 30000 }, async ($, on) => {
  const commands: string[] = []
  on('command.run', (_, e) => { commands.push(e.command); return { text: '' } })
  const { ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await ui.post({ isClicked: true }, { in: 'speedy:reload' })
  expect(commands).toEqual(['reload-plugins'])
  await ui.unmount()
})

test('modelOf knows a model by its id, a dated or [1m] id, and its alias', () => {
  expect(modelOf('claude-opus-5-5')?.[1]).toBe('Opus 5.5')
  expect(modelOf('claude-opus-5-5[1m]')?.[1]).toBe('Opus 5.5')
  expect(modelOf('sonnet')?.[1]).toBe('Sonnet 5.5')
  expect(modelOf('claude-fable-5-1')?.[1]).toBe('Fable 5.1')
  expect(modelOf('claude-opus-4-8')).toBeUndefined()
  expect(modelLabel('claude-opus-4-8')).toBe('opus-4-8')
  expect(modelLabel('')).toBe('modelo')
})

test('the model menu picks a model and an effort, and Aplicar runs /model then /effort', { timeoutMs: 30000 }, async ($, on) => {
  const commands: Array<[string, string]> = []
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('command.run', (_, e) => { commands.push([e.command, e.args]); return { text: '' } })
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  expect((await ui.find({ type: 'Text', in: 'speedy:model' }))?.text).toBe('◆ Opus 5.5 ▾ ')
  await ui.post({ isClicked: true }, { in: 'speedy:model' })
  const band = await $.ui.mount(BAND)
  expect((await band.find({ type: 'Text', text: /Modelo de Claude/ }))?.text).toBe(' Modelo de Claude (Opus 5.5) ')
  const names = (await band.findAll({ type: 'Text', text: /^ [●○] \S+ [\d.]+ +$/ })).map(text => text.text.trim())
  expect(names).toEqual(['○ Fable 5.1', '● Opus 5.5', '○ Sonnet 5.5', '○ Haiku 5.5'])
  // A click only picks: nothing runs until Aplicar.
  await band.press({ key: 'model:claude-sonnet-5-5' })
  await band.press({ key: 'effort:high' })
  expect(commands).toEqual([])
  await band.press({ key: 'models:apply' })
  expect(commands).toEqual([['model', 'claude-sonnet-5-5'], ['effort', 'high']])
  await band.unmount()
  // Applied, the menu closes.
  const after = await $.ui.mount(BAND)
  expect(await after.find({ type: 'Text', text: /Modelo de Claude/ })).toBeUndefined()
  await after.unmount()
  await ui.unmount()
})

test('Aplicar with nothing picked runs no command', { timeoutMs: 30000 }, async ($, on) => {
  const commands: string[] = []
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('command.run', (_, e) => { commands.push(e.command); return { text: '' } })
  const { ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await ui.post({ isClicked: true }, { in: 'speedy:model' })
  const band = await $.ui.mount(BAND)
  await band.press({ key: 'models:apply' })
  expect(commands).toEqual([])
  await band.unmount()
  await ui.unmount()
})

test('Italian has a tab of its own', { timeoutMs: 30000 }, async ($, on) => {
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await w.clock.advance(200)
  await ui.post({ isClicked: true }, { in: 'speedy:voice' })
  const band = await $.ui.mount(BAND)
  expect((await band.find({ type: 'Text', text: /Italiano/ }))?.text?.trim()).toBe('Italiano')
  await band.unmount()
  await ui.unmount()
})

test('the language tabs come in the order asked for', { timeoutMs: 30000 }, async ($, on) => {
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await w.clock.advance(200)
  await ui.post({ isClicked: true }, { in: 'speedy:voice' })
  const band = await $.ui.mount(BAND)
  const names = ['Español', 'Inglés', 'Francés', 'Italiano', 'Portugués', 'Ruso', 'Chino', 'Árabe', 'Hindi', 'Bengalí', 'Urdu']
  const drawn = (await band.findAll({ type: 'Text' }))
    .map(text => text.text?.trim().replace(/ [▶●]$/, '') ?? '')
    .filter(text => names.includes(text))
  expect(drawn).toEqual(names)
  await band.unmount()
  await ui.unmount()
})

test('the voices take as many columns as the width holds, up to four', { timeoutMs: 30000 }, async ($, on) => {
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await w.clock.advance(200)
  await ui.post({ isClicked: true }, { in: 'speedy:voice' })
  const columnsAt = async (bodyColumns: number) => {
    const band = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns } })
    const keys = (await band.findAll({ type: 'Box' })).map(box => String(box.key ?? '')).filter(key => key.startsWith('column:'))
    await band.unmount()
    return keys.length
  }
  expect(await columnsAt(200)).toBe(4)
  expect(await columnsAt(130)).toBe(4)
  expect(await columnsAt(100)).toBe(3)
  expect(await columnsAt(70)).toBe(2)
  await ui.unmount()
})

test('the send button presses Enter, and with an empty prompt presses nothing', { timeoutMs: 30000 }, async ($, on) => {
  let draft = ''
  on('prompt.read', () => ({ value: { text: draft } }))
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await ui.post({ isClicked: true }, { in: 'speedy:send' })
  expect(w.pressed).toEqual([])
  draft = 'Revisá el endpoint'
  await ui.post({ isClicked: true }, { in: 'speedy:send' })
  expect(w.pressed.length).toBe(1)
  expect(w.pressed[0]).toContain("SendWait('{ENTER}')")
  await ui.unmount()
})

test('socialLink builds the profile link of each network, and refuses a name no network takes', () => {
  expect(socialLink('github', 'octocat')).toBe('https://github.com/octocat')
  expect(socialLink('youtube', '@octocat')).toBe('https://www.youtube.com/@octocat')
  expect(socialLink('linkedin', ' ada-lovelace ')).toBe('https://www.linkedin.com/in/ada-lovelace')
  expect(socialLink('x', "a'; rm -rf")).toBe('')
  expect(socialLink('x', '')).toBe('')
  expect(socialLink('myspace', 'octo')).toBe('')
  expect(socialLink('threads', 'octocat')).toBe('https://www.threads.com/@octocat')
  expect(socialLink('reddit', 'octocat')).toBe('https://www.reddit.com/user/octocat')
  expect(socialLink('gmail', 'ada.lovelace')).toBe('https://mail.google.com/mail/u/?authuser=ada.lovelace@gmail.com')
  expect(socialLink('gmail', 'ada.lovelace@gmail.com')).toBe('https://mail.google.com/mail/u/?authuser=ada.lovelace@gmail.com')
  expect(socialLink('discord', '123456789012345678')).toBe('https://discord.com/users/123456789012345678')
})

test('a network with a user name gets a footer button that opens its profile; one without, none', { timeoutMs: 30000 }, async ($, on) => {
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' }, socials: { github: 'octocat', x: '' } })
  expect((await ui.find({ type: 'Text', in: 'speedy:social:github' }))?.text).toBe(' GH ')
  expect(await ui.find({ key: 'speedy:social:x' })).toBeUndefined()
  await ui.post({ isClicked: true }, { in: 'speedy:social:github' })
  expect(w.opened).toEqual(["Start-Process 'https://github.com/octocat'"])
  await ui.unmount()
})

test('the gear opens the settings, where a user name typed is kept', { timeoutMs: 30000 }, async ($, on) => {
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await ui.post({ isClicked: true }, { in: 'speedy:settings' })
  const band = await $.ui.mount(BAND)
  expect((await band.find({ type: 'Text', text: /Configuración/ }))?.text).toBe(' Configuración ')
  expect((await band.find({ type: 'Text', text: /Redes sociales/ }))?.text).toBe(' Redes sociales ')
  // A click on the user name makes it a field, keyed by the opening: this is the first.
  await band.press({ key: 'edit:github' })
  await band.unmount()
  const editing = await $.ui.mount(BAND)
  await editing.input({ key: 'social:github:1', text: 'octocat' })
  const band2 = editing
  expect(w.kept.socials).toEqual({ github: 'octocat' })
  await band2.unmount()
  await ui.unmount()
})

test('the settings show a table of four columns, each field holding the user name saved', { timeoutMs: 30000 }, async ($, on) => {
  const { ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' }, socials: { github: 'octo', youtube: '@octocat' } })
  await ui.post({ isClicked: true }, { in: 'speedy:settings' })
  const band = await $.ui.mount(BAND)
  for (const header of ['Red', 'Usuario', 'Link']) expect((await band.find({ type: 'Text', text: new RegExp(`^${header}$`) }))?.text).toBe(header)
  // At rest, each user name is text, whole; a network with none says so.
  expect((await band.find({ type: 'Text', text: /^octo$/ }))?.text).toBe('octo')
  expect((await band.find({ type: 'Text', text: /^@octocat$/ }))?.text).toBe('@octocat')
  expect((await band.findAll({ type: 'Text', text: /^usuario ✎$/ })).length).toBe(10)
  expect(await band.find({ key: 'social:github:1' })).toBeUndefined()
  expect((await band.find({ type: 'Text', text: /github\.com/ }))?.text).toBe('https://github.com/octo')
  await band.unmount()
  await ui.unmount()
})

test('accountsOf lists the first account, then each one added, in order', () => {
  expect(accountsOf({ github: 'a', 'github#3': 'c', 'github#2': 'b', x: 'z' }, 'github')).toEqual(['github', 'github#2', 'github#3'])
  expect(accountsOf({}, 'x')).toEqual(['x'])
})

test('every account with a user name has its own footer button, numbered past the first', { timeoutMs: 30000 }, async ($, on) => {
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' }, socials: { github: 'octo', 'github#2': 'trabajo' } })
  expect((await ui.find({ type: 'Text', in: 'speedy:social:github' }))?.text).toBe(' GH ')
  expect((await ui.find({ type: 'Text', in: 'speedy:social:github#2' }))?.text).toBe(' GH2 ')
  await ui.post({ isClicked: true }, { in: 'speedy:social:github#2' })
  expect(w.opened).toEqual(["Start-Process 'https://github.com/trabajo'"])
  await ui.unmount()
})

test('+ adds an empty account with its field open; left empty, it goes', { timeoutMs: 30000 }, async ($, on) => {
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' }, socials: { github: 'octo' } })
  await ui.post({ isClicked: true }, { in: 'speedy:settings' })
  const band = await $.ui.mount(BAND)
  await band.press({ key: 'add:github' })
  await band.unmount()
  expect(w.kept.socials).toEqual({ github: 'octo', 'github#2': '' })
  const open = await $.ui.mount(BAND)
  expect(await open.find({ key: 'social:github#2:1' })).toBeDefined()
  expect((await open.find({ type: 'Text', text: /cuenta 2/ }))?.text).toBe('  cuenta 2')
  await open.input({ key: 'social:github#2:1', text: '', kind: 'submit' })
  await open.unmount()
  expect(w.kept.socials).toEqual({ github: 'octo' })
  await ui.unmount()
})

test('+ on a network with an empty account opens it, closing drops empty accounts, and − removes an added one', { timeoutMs: 30000 }, async ($, on) => {
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' }, socials: { github: 'octo', 'github#2': 'trabajo' } })
  await ui.post({ isClicked: true }, { in: 'speedy:settings' })
  const band = await $.ui.mount(BAND)
  await band.press({ key: 'add:github' })
  await band.press({ key: 'add:github' })
  await band.press({ key: 'add:github' })
  await band.unmount()
  // Three presses, one empty account: the next press opens it again.
  expect(w.kept.socials).toEqual({ github: 'octo', 'github#2': 'trabajo', 'github#3': '' })
  // Closed with nothing typed: the empty account goes.
  await ui.post({ isClicked: true }, { in: 'speedy:settings' })
  expect(w.kept.socials).toEqual({ github: 'octo', 'github#2': 'trabajo' })
  // − removes an added account; the first has none.
  await ui.post({ isClicked: true }, { in: 'speedy:settings' })
  const again = await $.ui.mount(BAND)
  expect(await again.find({ key: 'remove:github' })).toBeUndefined()
  expect(await again.find({ key: 'remove:github#2' })).toBeDefined()
  await again.press({ key: 'remove:github#2' })
  await again.unmount()
  expect(w.kept.socials).toEqual({ github: 'octo' })
  await ui.unmount()
})

test('the accounts go in pages when they do not fit the band, and the page with the field being edited shows', { timeoutMs: 30000 }, async ($, on) => {
  const socials = Object.fromEntries([['github', 'octo'], ...Array.from({ length: 10 }, (_, index) => [`github#${index + 2}`, `cuenta${index + 2}`])])
  const { ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' }, socials })
  await ui.post({ isClicked: true }, { in: 'speedy:settings' })
  const shown = async () => {
    const band = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 110, maxRows: 12 } })
    const keys = (await band.findAll({ type: 'Box' })).map(box => String(box.key ?? '')).filter(key => key.startsWith('social-row:'))
    const page = (await band.findAll({ type: 'Text', text: /^ \d+\/\d+ $/ }))[0]?.text
    return { band, keys, page }
  }
  const first = await shown()
  // 22 accounts, 7 rows a page: four pages.
  expect(first.keys.length).toBe(7)
  expect(first.page).toBe(' 1/4 ')
  await first.band.press({ key: 'social-page:next' })
  await first.band.unmount()
  const second = await shown()
  expect(second.page).toBe(' 2/4 ')
  expect(second.keys[0]).toBe('social-row:github#8')
  await second.band.press({ key: 'social-page:previous' })
  await second.band.unmount()
  // + on page 1 adds github#12, row 12: its field is on page 2, and page 2 shows.
  const third = await shown()
  expect(third.page).toBe(' 1/4 ')
  await third.band.press({ key: 'add:github' })
  await third.band.unmount()
  const fourth = await shown()
  expect(fourth.page).toBe(' 2/4 ')
  expect(fourth.keys).toContain('social-row:github#12')
  await fourth.band.unmount()
  await ui.unmount()
})

test('the icon that opens a menu closes it when clicked again, for the voices, the microphones and the settings', { timeoutMs: 30000 }, async ($, on) => {
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await w.clock.advance(200)
  for (const [icon, title] of [['speedy:voice', /Voz:/], ['speedy:mics', /Micrófono para dictar/], ['speedy:settings', /Configuración/]] as const) {
    await ui.post({ isClicked: true }, { in: icon })
    const open = await $.ui.mount(BAND)
    expect(await open.find({ type: 'Text', text: title })).toBeDefined()
    await open.unmount()
    await ui.post({ isClicked: true }, { in: icon })
    const closed = await $.ui.mount(BAND)
    expect(await closed.find({ type: 'Text', text: title })).toBeUndefined()
    await closed.unmount()
  }
  await ui.unmount()
})

test('the networks take two tables side by side where the width holds them, one where not', { timeoutMs: 30000 }, async ($, on) => {
  const { ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await ui.post({ isClicked: true }, { in: 'speedy:settings' })
  const tablesAt = async (bodyColumns: number) => {
    const band = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns } })
    const keys = (await band.findAll({ type: 'Box' })).map(box => String(box.key ?? '')).filter(key => key.startsWith('social-table:'))
    const rows = (await band.findAll({ type: 'Box' })).filter(box => String(box.key ?? '').startsWith('social-row:')).length
    await band.unmount()
    return { tables: keys.length, rows }
  }
  expect(await tablesAt(180)).toEqual({ tables: 2, rows: 12 })
  expect(await tablesAt(110)).toEqual({ tables: 1, rows: 12 })
  await ui.unmount()
})

test('the setup tab checks what is in place, and its button runs install.ps1 showing each step', { timeoutMs: 30000 }, async ($, on) => {
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await ui.post({ isClicked: true }, { in: 'speedy:settings' })
  await w.clock.advance(200)
  const band = await $.ui.mount(BAND)
  await band.press({ key: 'settings:setup' })
  await band.unmount()
  const setup = await $.ui.mount(BAND)
  expect((await setup.find({ type: 'Text', text: /^Entorno de Python 3.12$/ }))?.text).toBe('Entorno de Python 3.12')
  await setup.press({ key: 'setup:run' })
  await w.clock.advance(200)
  await setup.unmount()
  const after = await $.ui.mount(BAND)
  // Done, it checks again: the environment is in place.
  expect((await after.find({ type: 'Text', text: /^listo$/ }))?.text).toBe('listo')
  expect((await after.find({ type: 'Text', text: /Using Python 3\.12/ }))?.text).toBe('   Using Python 3.12')
  await after.unmount()
  await ui.unmount()
})

test('a first start with nothing installed says so and opens the settings on the setup tab', { timeoutMs: 30000 }, async ($, on) => {
  const toasts: string[] = []
  const w = world(on, {}, '', { on: false }, '', { on: false }, { reply: '', sent: [] }, false)
  on('ui.toast', (_, e) => { toasts.push(e.text); return { value: undefined } })
  on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text>modes</Text> })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  expect(toasts).toEqual(['speedy-code: falta instalar las voces y el dictado. Abrí ⚙️ → Instalación.'])
  const ui = await $.ui.mount(FOOTER)
  await ui.post({ isClicked: true }, { in: 'speedy:settings' })
  await w.clock.advance(200)
  const band = await $.ui.mount(BAND)
  expect((await band.find({ type: 'Text', text: /Instalar \/ reparar todo/ }))).toBeDefined()
  await band.unmount()
  await ui.unmount()
})

test('a session start copies the status line again only when it is switched on', async ($, on) => {
  const w = world(on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } }, '', { on: false }, '', { on: false }, { reply: '', sent: [] }, true, { on: true })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await w.clock.advance(200)
  expect(w.switched).toEqual(['status', 'on'])
})

test('a session start leaves a status line that is switched off alone', async ($, on) => {
  const w = world(on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await w.clock.advance(200)
  expect(w.switched).toEqual(['status'])
})

test('the setup tab switches the colored status line on, keeping the one before', { timeoutMs: 30000 }, async ($, on) => {
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await ui.post({ isClicked: true }, { in: 'speedy:settings' })
  await w.clock.advance(200)
  const band = await $.ui.mount(BAND)
  await band.press({ key: 'settings:bar' })
  await band.unmount()
  const setup = await $.ui.mount(BAND)
  expect((await setup.find({ type: 'Text', text: /Usar la de speedy-code/ }))?.text).toBe(' Usar la de speedy-code ')
  await setup.press({ key: 'bar:statusline' })
  await setup.unmount()
  expect(w.switched).toContain('on')
  const after = await $.ui.mount(BAND)
  expect((await after.find({ type: 'Text', text: /Volver a mi barra anterior/ }))).toBeDefined()
  await after.unmount()
  await ui.unmount()
})

test('the footer shows the model in use, and follows it when /model changes it in the terminal', { timeoutMs: 30000 }, async ($, on) => {
  let model = 'claude-opus-5-5'
  on('session.model', () => ({ value: model }))
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await w.clock.advance(100)
  expect((await ui.find({ type: 'Text', in: 'speedy:model' }))?.text).toContain('◆ Opus 5.5')
  // /model haiku typed in the terminal: the footer asks again, and redraws with the new model.
  model = 'claude-haiku-5-5'
  await w.clock.advance(1600)
  await ui.unmount()
  const redrawn = await $.ui.mount(FOOTER)
  expect((await redrawn.find({ type: 'Text', in: 'speedy:model' }))?.text).toContain('◆ Haiku 5.5')
  await redrawn.unmount()
})

test('the footer shows the effort in force beside the model, follows /effort, and opens the menu', { timeoutMs: 30000 }, async ($, on) => {
  on('turn.step', async function* () { return { turnId: 't1', index: 0, answer: '', toolUses: [] } })
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  const { ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  expect((await ui.find({ type: 'Text', in: 'speedy:model' }))?.text).toBe('◆ Opus 5.5 ▾ ')
  await ui.unmount()
  // /effort max typed in the terminal: the next model request carries it.
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', effort: 'max', messageCount: 1 })) { /* drained */ }
  const redrawn = await $.ui.mount(FOOTER)
  expect((await redrawn.find({ type: 'Text', in: 'speedy:model' }))?.text).toBe('◆ Opus 5.5 ')
  expect((await redrawn.find({ type: 'Text', in: 'speedy:effort' }))?.text).toBe('· max ▾ ')
  expect(effortColor('max')).toBe('#ff6b6b')
  expect(effortColor('low')).toBe('#69db7c')
  await redrawn.post({ isClicked: true }, { in: 'speedy:effort' })
  const band = await $.ui.mount(BAND)
  expect(await band.find({ type: 'Text', text: /Modelo de Claude/ })).toBeDefined()
  await band.unmount()
  await redrawn.unmount()
})

test('the effort in force ignores subagents, clears on a request without one, and on a new model', { timeoutMs: 30000 }, async ($, on) => {
  const commands: string[] = []
  on('turn.step', async function* () { return { turnId: 't1', index: 0, answer: '', toolUses: [] } })
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('command.run', (_, e) => { commands.push(e.command); return { text: '' } })
  const { ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await ui.unmount()
  const step = async (extra: { effort?: 'low' | 'max', agentId?: string }) => {
    for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1, ...extra })) { /* drained */ }
  }
  const shown = async () => {
    const footer = await $.ui.mount(FOOTER)
    const model = (await footer.find({ type: 'Text', in: 'speedy:model' }))?.text
    // find throws when the effort control is not drawn
    const level = await footer.find({ type: 'Text', in: 'speedy:effort' }).then(found => found?.text, () => '')
    await footer.unmount()
    return `${model}|${level}`
  }
  await step({ effort: 'max' })
  // A subagent on low does not change what the session runs at.
  await step({ effort: 'low', agentId: 'a1' })
  expect(await shown()).toBe('◆ Opus 5.5 |· max ▾ ')
  // A request with no effort (a model without one) clears it: the model alone, with its ▾.
  await step({})
  expect(await shown()).toBe('◆ Opus 5.5 ▾ |')
  // A new model from the menu starts from its own effort, unknown until its first request.
  await step({ effort: 'max' })
  const footer = await $.ui.mount(FOOTER)
  await footer.post({ isClicked: true }, { in: 'speedy:model' })
  await footer.unmount()
  const band = await $.ui.mount(BAND)
  await band.press({ key: 'model:claude-sonnet-5-5' })
  await band.press({ key: 'models:apply' })
  await band.unmount()
  expect(commands).toEqual(['model'])
  expect(await shown()).toBe('◆ Opus 5.5 ▾ |')
})

test('the status line levels: the steppers move them by 5, keep yellow under red, and are kept and written for the status line', { timeoutMs: 60000 }, async ($, on) => {
  const { w, ui } = await footerSession($, on, { picks: { es: 'es-AR-ElenaNeural', active: 'es' } })
  await ui.post({ isClicked: true }, { in: 'speedy:settings' })
  await w.clock.advance(200)
  const band = await $.ui.mount(BAND)
  await band.press({ key: 'settings:bar' })
  await band.unmount()
  const bar = await $.ui.mount(BAND)
  await bar.press({ key: 'lvl-up:contextRed' })
  expect(w.kept.barLevels).toEqual({ contextYellow: 60, contextRed: 85, limitYellow: 75, limitRed: 90 })
  expect(w.files.some(text => text.includes('"contextRed": 85'))).toBe(true)
  // Yellow never reaches its red: with red at 85, yellow stops at 80, and at 5 at the bottom.
  for (let i = 0; i < 3; i++) await bar.press({ key: 'lvl-up:contextYellow' })
  expect((w.kept.barLevels as { contextYellow: number }).contextYellow).toBe(75)
  for (let i = 0; i < 5; i++) await bar.press({ key: 'lvl-up:contextYellow' })
  expect((w.kept.barLevels as { contextYellow: number }).contextYellow).toBe(80)
  for (let i = 0; i < 20; i++) await bar.press({ key: 'lvl-down:contextYellow' })
  expect((w.kept.barLevels as { contextYellow: number }).contextYellow).toBe(5)
  await bar.press({ key: 'bar:reset' })
  expect(w.kept.barLevels).toEqual({ contextYellow: 60, contextRed: 80, limitYellow: 75, limitRed: 90 })
  await bar.unmount()
  await ui.unmount()
})
