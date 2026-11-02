// The surface module of a footer control: it draws its label, never inverted nor underlined (a
// Button inverts under the pointer, and the footer keeps no background), and posts
// `{ isClicked: true }` as soon as the left button goes down anywhere on its region: a press is
// enough, and the region is wider than the glyph, so a click need not land on it exactly.
import type { ClientModule } from 'claude-code'

/** The label drawn, its color and, for a control that shows a choice, the fill behind it. */
type Props = { label: string; color: string; bold?: boolean; backgroundColor?: string }

const Control: ClientModule<Props> = (props, surface) => {
  surface.onPointer(event => {
    if (event.type === 'down' && event.button === 'left') surface.post({ isClicked: true })
  })
  const { Text } = surface.elements
  return <Text color={props.color} bold={props.bold} backgroundColor={props.backgroundColor}>{props.label}</Text>
}

export default Control
