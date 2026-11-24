// The surface module of the explorer's scroll bar: an empty cell that parts it from the tree's tools, then a
// column of one cell, its track dark and its thumb in color. Held down with the left button, the thumb
// follows the pointer, past the bar's ends too, and the tree's first row it asks for is posted as
// `{ scrollTo }`; a press on the track brings the thumb's middle there. While held the thumb is drawn where
// the pointer has it, at once: the tree comes after, when the hooks module has moved it. Each first row is
// asked for once, however many moves a terminal that reports pixels says within a cell.
import type { ClientModule } from 'claude-code'

/** The tree's rows, the first one shown, the rows of room, and the thumb's color. */
type Props = { total: number; top: number; room: number; color: string }
/**
 * While the thumb is held: where on it the pointer took it, in rows from the thumb's top; the row its top is
 * drawn at; and the tree's first row last asked for. Empty while it is not held.
 */
type State = { grab?: number; start?: number; sent?: number }

/** The track's color: dark, under a thumb in the folders' color. */
const TRACK_COLOR = '#3a3a3a'

/** The rows of the room the thumb takes, as register.tsx's scrollThumb gives them. */
function thumbOf (total: number, top: number, room: number) {
  if (room < 1 || total <= room) return { start: 0, size: 0 }
  const size = Math.max(1, Math.min(room, Math.round(room * room / total)))
  const start = Math.round(Math.min(1, Math.max(0, top / (total - room))) * (room - size))
  return { start, size }
}

const ScrollBar: ClientModule<Props, State> = (props, surface) => {
  const thumb = thumbOf(props.total, props.top, props.room)
  surface.onPointer(event => {
    if (event.type === 'up') { surface.setState({}); return }
    if (event.button !== 'left' || (event.type !== 'down' && event.type !== 'move')) return
    // The row under the pointer, with its fraction where the terminal reports it, else the row's middle.
    const y = event.fine?.y ?? event.y + 0.5
    const held = surface.state ?? {}
    const isDown = event.type === 'down'
    const grab = isDown ? (y >= thumb.start && y < thumb.start + thumb.size ? y - thumb.start : thumb.size / 2) : held.grab
    if (grab === undefined) return
    const span = props.room - thumb.size
    const start = Math.max(0, Math.min(span, y - grab))
    const top = span > 0 ? Math.round(start / span * (props.total - props.room)) : 0
    const drawn = Math.round(start)
    const sent = isDown ? props.top : held.sent ?? props.top
    if (isDown || drawn !== held.start || top !== sent) surface.setState({ grab, start: drawn, sent: top })
    if (top !== sent) surface.post({ scrollTo: top })
  })
  const { Box, Text } = surface.elements
  // Held, the thumb is where the pointer has it; else where the tree's first row puts it.
  const start = surface.state?.start ?? thumb.start
  return (
    <Box flexDirection="column">
      {Array.from({ length: props.room }, (_, index) => {
        const isThumb = index >= start && index < start + thumb.size
        return <Text key={`bar:${index}`} color={isThumb ? props.color : TRACK_COLOR}>{' █'}</Text>
      })}
    </Box>
  )
}

export default ScrollBar
