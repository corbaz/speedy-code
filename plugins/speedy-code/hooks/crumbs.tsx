// The surface module of the explorer's path: one row under the disks with each folder from the disk down to
// the row selected, or to the session's folder while none is, ` › ` between them and the last one in bold. A
// folder pressed is posted as `{ go: path }`: the tree goes to it. Under the pointer a folder is underlined, in
// the folders' color; what stands between two folders takes no press. While a popup of the explorer is up
// (`isHeld`) the row holds still, as the tree does.
import type { ClientModule } from 'claude-code'

/** A piece of the row as register.tsx's crumbsOf hands it: its text, its cells and the cell it starts at; `path`, on a folder alone. */
type Part = { text: string; width: number; at: number; path?: string }
/** The row's width, its pieces, and whether the explorer holds still. */
type Props = { width: number; parts: Part[]; isHeld?: true }

/** A folder of the path, the last one, what parts them, and a folder under the pointer. */
const REST_COLOR = '#adb5bd'
const LAST_COLOR = '#5fd7ff'
const BETWEEN_COLOR = '#495057'
const HOVER_COLOR = '#74c0fc'

const Crumbs: ClientModule<Props> = (props, surface) => {
  surface.onPointer(event => {
    if (props.isHeld || event.type !== 'down' || event.button !== 'left' || event.y !== 0) return
    const part = props.parts.find(one => one.path !== undefined && event.x >= one.at && event.x < one.at + one.width)
    if (part?.path !== undefined) surface.post({ go: part.path })
  })
  const { Box, Text } = surface.elements
  const lastAt = props.parts.reduce((found, part, index) => part.path !== undefined ? index : found, -1)
  return (
    <Box flexDirection="row" width={props.width}>
      {props.parts.map((part, index) => part.path === undefined
        ? <Text key={`between:${index}`} color={BETWEEN_COLOR}>{part.text}</Text>
        : (
          <Text
            key={`folder:${index}`}
            color={index === lastAt ? LAST_COLOR : REST_COLOR}
            bold={index === lastAt}
            hover={props.isHeld ? undefined : { scope: `speedy-crumb:${index}`, color: HOVER_COLOR, underline: true }}
          >
            {part.text}
          </Text>
          ))}
    </Box>
  )
}

export default Crumbs
