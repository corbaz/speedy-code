// The surface module of the explorer's scroll bar: a column of one cell, its track dim and its thumb in
// color. Held down with the left button, the thumb follows the pointer, past the bar's ends too, and the
// tree's first row it asks for is posted as `{ scrollTo }`; a press on the track brings the thumb's middle
// there. It draws from its props alone: the hooks module moves the tree and hands the new `top` back.
import type { ClientModule } from 'claude-code'

/** The tree's rows, the first one shown, the rows of room, and the thumb's color. */
type Props = { total: number; top: number; room: number; color: string }
/** Where on the thumb the pointer took it, in rows from the thumb's top; absent while it is not held. */
type State = { grab?: number }

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
    let grab = surface.state?.grab
    if (event.type === 'down') {
      grab = y >= thumb.start && y < thumb.start + thumb.size ? y - thumb.start : thumb.size / 2
      surface.setState({ grab })
    }
    if (grab === undefined) return
    const span = props.room - thumb.size
    const start = Math.max(0, Math.min(span, y - grab))
    const top = span > 0 ? Math.round(start / span * (props.total - props.room)) : 0
    if (top !== props.top) surface.post({ scrollTo: top })
  })
  const { Box, Text } = surface.elements
  return (
    <Box flexDirection="column">
      {Array.from({ length: props.room }, (_, index) => {
        const isThumb = index >= thumb.start && index < thumb.start + thumb.size
        return <Text key={`bar:${index}`} color={isThumb ? props.color : undefined} dimColor={!isThumb}>{isThumb ? '█' : '│'}</Text>
      })}
    </Box>
  )
}

export default ScrollBar
