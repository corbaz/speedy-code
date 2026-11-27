// The surface module of the explorer's tree: the rows shown, one line each, drawn by one instance. A click
// selects a file or a folder; a second one in time opens it, which the hooks module tells by its clock, so
// every click on a name is posted as `{ pick, isFolder }`. A folder's ▸ or ▾ opens or closes it with one
// click: `{ toggle }`. The right button, Ctrl with a click, or ⋯ at the end of the row selected open the
// row's menu inside the tree: its tools one under the other, each with what it does at its right; a press
// on one posts `{ act, path }`, a press anywhere else closes the menu. Selection and menu are kept here, so
// they are drawn at once, with no word to the hooks module and back. While a popup of the explorer is up
// (`isHeld`) the tree holds still: it takes no press, fills no row under the pointer and shows no menu, so the
// one row filled is the one the popup is about.
import type { ClientModule } from 'claude-code'

/**
 * A row as register.tsx hands it: its text, cut and filled to the tree's width, and its look. `fill`, on a
 * file or a folder alone, is the color its row takes under the pointer and while selected; `backgroundColor`,
 * a mark the hooks module put on it (found, viewed, just pressed), which stays whatever the pointer does.
 * `at` is the cell of a folder's ▸ or ▾; `menu`, which of `menus` is the row's.
 */
type Row = {
  path: string
  text: string
  kind: 'dir' | 'file' | 'link' | 'note'
  color?: string
  bold?: boolean
  backgroundColor?: string
  isDim?: boolean
  isItalic?: boolean
  fill?: string
  at?: number
  menu?: string
}
/** A tool of a menu: what it posts, its icon on two cells, what it does, its color; `isIdle`: grey, it only says why. */
type Item = { kind: string; icon: string; text: string; color: string; isIdle?: boolean }
/** A menu: its tools, and the cells the longest of their texts takes, which all are filled to. */
type Menu = { width: number; items: Item[] }
/**
 * The tree's width and rows of room, the rows shown, the menus by name, and the mark that opens one. `isHeld`:
 * a popup of the explorer is up, and the tree holds still.
 */
type Props = { width: number; room: number; rows: Row[]; menus: Record<string, Menu>; more: string; isHeld?: true }
/**
 * The path of the row selected; and the row whose menu is open: its path, its place among the rows shown when
 * it was asked, and the cell it was asked at.
 */
type State = { selected?: string; menu?: { path: string; at: number; x: number } }

/** The text of a row filled: dark on the row's color. */
const DARK = '#1a1a1a'
/** A tool that does nothing here, and the menu's frame. */
const IDLE_COLOR = '#495057'
const FRAME_COLOR = '#868e96'
/** The cells a menu takes beside its texts: the frame's two, a space, the icon's two, two spaces and one at the end. */
const MENU_EDGE = 8

/**
 * Where the menu open stands, in the tree's cells: under its row, or over it where the room under is short,
 * and from the cell it was asked at, kept within the tree. Nothing while no menu is open, or once its row is no
 * longer where it was: the tree moved, or what it holds changed.
 */
function menuBox (props: Props, state: State) {
  if (!state.menu) return undefined
  const { at } = state.menu
  const row = props.rows[at]
  const menu = props.menus[row?.menu ?? '']
  if (!row || row.path !== state.menu.path || !menu) return undefined
  const width = Math.min(props.width, menu.width + MENU_EDGE)
  const height = menu.items.length + 2
  const top = at + 1 + height <= props.room ? at + 1 : at - height >= 0 ? at - height : Math.max(0, props.room - height)
  const left = Math.max(0, Math.min(props.width - width, state.menu.x))
  return { path: row.path, items: menu.items, left, top, width, height }
}

const Tree: ClientModule<Props, State> = (props, surface) => {
  const state = surface.state ?? {}
  const box = props.isHeld ? undefined : menuBox(props, state)
  // A menu whose row moved away is closed for good: it does not come back when the row does.
  if (state.menu && !box) surface.setState({ selected: state.selected })
  surface.onPointer(event => {
    if (props.isHeld || event.type !== 'down' || (event.button !== 'left' && event.button !== 'right')) return
    const asksMenu = event.button === 'right' || event.ctrl === true
    if (box && event.x >= box.left && event.x < box.left + box.width && event.y >= box.top && event.y < box.top + box.height) {
      // On a tool: it is done, and the menu closes. On the frame, nothing.
      const item = box.items[event.y - box.top - 1]
      if (!item || asksMenu || event.x === box.left || event.x === box.left + box.width - 1) return
      surface.setState({ selected: state.selected })
      surface.post({ act: item.kind, path: box.path })
      return
    }
    const row = props.rows[event.y]
    // A press outside the menu closes it, and does nothing else.
    if (box && !asksMenu) { surface.setState({ selected: state.selected }); return }
    // Only a file or a folder is selected: a press on a note, a link or the room left under the tree lets go.
    if (!row || row.fill === undefined) {
      if (state.selected !== undefined || state.menu) surface.setState({})
      return
    }
    if (asksMenu || (state.selected === row.path && event.x >= props.width - props.more.length)) {
      surface.setState({ selected: row.path, menu: { path: row.path, at: event.y, x: asksMenu ? event.x : props.width } })
      surface.post({ pick: row.path, isFolder: row.kind === 'dir', isMenu: true })
      return
    }
    surface.setState({ selected: row.path })
    if (row.at !== undefined && event.x >= row.at && event.x < row.at + 2) surface.post({ toggle: row.path })
    else surface.post({ pick: row.path, isFolder: row.kind === 'dir' })
  })
  const { Box, Text } = surface.elements
  const selectedAt = props.rows.findIndex(row => row.fill !== undefined && row.path === state.selected)
  const selected = props.rows[selectedAt]
  return (
    <Box flexDirection="column" width={props.width} height={props.room}>
      {props.rows.map((row, index) => {
        const isFilled = row.backgroundColor !== undefined || index === selectedAt
        return (
          <Text
            key={`row:${index}`}
            color={isFilled ? DARK : row.color}
            backgroundColor={row.backgroundColor ?? (index === selectedAt ? row.fill : undefined)}
            bold={isFilled || row.bold === true}
            dimColor={row.isDim === true && !isFilled}
            italic={row.isItalic === true}
            // The pointer on a file or a folder fills its row, in its color; a row filled already stays as it is.
            hover={row.fill !== undefined && !isFilled && !props.isHeld ? { scope: `speedy-tree:${index}`, backgroundColor: row.fill, color: DARK } : undefined}
            wrap="truncate-end"
          >
            {row.text}
          </Text>
        )
      })}
      {/* ⋯ at the end of the row selected opens its menu: the one mark that says the tools are there. */}
      {selected
        ? (
          <Box key="more" position="absolute" top={selectedAt} left={Math.max(0, props.width - props.more.length)}>
            <Text bold color={DARK} backgroundColor={selected.backgroundColor ?? selected.fill}>{props.more}</Text>
          </Box>
          )
        : null}
      {/* The menu, over the rows: every line is as wide as its inside, so no row shows through it. */}
      {box
        ? (
          <Box key="menu" position="absolute" top={box.top} left={box.left} width={box.width} height={box.height} flexDirection="column" borderStyle="round" borderColor={FRAME_COLOR}>
            {box.items.map((item, index) => {
              const color = item.isIdle ? IDLE_COLOR : item.color
              const hover = item.isIdle ? undefined : { scope: `speedy-tree-menu:${index}`, backgroundColor: item.color, color: DARK }
              return (
                <Box key={`item:${item.kind}`} flexDirection="row">
                  <Text bold color={color} hover={hover}>{` ${item.icon}  `}</Text>
                  <Text color={item.isIdle ? IDLE_COLOR : undefined} hover={hover} wrap="truncate-end">{`${item.text} `}</Text>
                </Box>
              )
            })}
          </Box>
          )
        : null}
    </Box>
  )
}

export default Tree
