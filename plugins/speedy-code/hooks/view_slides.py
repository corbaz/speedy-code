"""A presentation's slides (pptx) as pages of HTML, for view_file.py's popup: each slide drawn at its own size,
its shapes, pictures, tables and text where the presentation puts them.

Enough to read a deck as it looks: the slide's background, the shapes of its layout and master behind its
own, text with its size, weight, color and alignment (taken from the run, the shape, the layout or the master,
in that order), bullets, pictures and tables. Charts, diagrams and effects are not drawn: a chart's place says
so. Nothing here opens a window, and the file is only read.
"""
import colorsys
import html
import posixpath
import re
import urllib.parse
import zipfile
from xml.etree import ElementTree

A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
# English Metric Units to a point of the page: 914400 to the inch, 96 points of the page to the inch.
EMU = 9525.0
SCHEME = {'tx1': 'dk1', 'bg1': 'lt1', 'tx2': 'dk2', 'bg2': 'lt2'}
PRESETS = {'black': '000000', 'white': 'FFFFFF', 'red': 'FF0000', 'green': '008000', 'blue': '0000FF', 'yellow': 'FFFF00', 'gray': '808080', 'grey': '808080'}
DRAWN_PICTURES = ('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp', '.tif', '.tiff')
FONT = "Calibri, Carlito, 'Helvetica Neue', Arial, sans-serif"


def local(tag):
    return tag.rsplit('}', 1)[-1]


def px(emu):
    return round(int(emu or 0) / EMU, 2)


class Deck:
    """One pptx, open: its parts read as they are asked for."""

    def __init__(self, path):
        self.archive = zipfile.ZipFile(path)
        self.names = set(self.archive.namelist())
        self._xml = {}
        self._rels = {}
        self._theme = {}

    def xml(self, part):
        if part not in self._xml:
            try:
                self._xml[part] = ElementTree.fromstring(self.archive.read(part)) if part in self.names else None
            except ElementTree.ParseError:
                self._xml[part] = None
        return self._xml[part]

    def rels(self, part):
        """A part's relations: {id: (the part it names, its kind)}."""
        if part not in self._rels:
            found = {}
            tree = self.xml(posixpath.join(posixpath.dirname(part), '_rels', posixpath.basename(part) + '.rels'))
            for one in (tree if tree is not None else []):
                target = one.get('Target') or ''
                if one.get('TargetMode') != 'External':
                    target = target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(part), target))
                found[one.get('Id')] = (target, (one.get('Type') or '').rsplit('/', 1)[-1])
            self._rels[part] = found
        return self._rels[part]

    def related(self, part, kind):
        return next((target for target, what in self.rels(part).values() if what == kind), None)

    def theme(self, master):
        """The master's theme colors: {dk1: 'RRGGBB', accent1: ...}."""
        if master not in self._theme:
            colors = {}
            tree = self.xml(self.related(master, 'theme') or '')
            scheme = tree.find(f'.//{A}clrScheme') if tree is not None else None
            for one in (scheme if scheme is not None else []):
                inner = next(iter(one), None)
                if inner is not None:
                    colors[local(one.tag)] = inner.get('lastClr') or inner.get('val') or '000000'
            self._theme[master] = colors
        return self._theme[master]


def color_of(node, theme):
    """The color a fill or a run names, as CSS; None when it names none."""
    if node is None:
        return None
    for one in node:
        kind = local(one.tag)
        if kind == 'srgbClr':
            value = one.get('val')
        elif kind == 'schemeClr':
            name = one.get('val') or ''
            value = theme.get(SCHEME.get(name, name))
        elif kind == 'sysClr':
            value = one.get('lastClr')
        elif kind == 'prstClr':
            value = PRESETS.get(one.get('val') or '')
        else:
            continue
        if not value or not re.fullmatch(r'[0-9A-Fa-f]{6}', value):
            return None
        red, green, blue = (int(value[index:index + 2], 16) / 255 for index in (0, 2, 4))
        alpha = 1.0
        for change in one:
            amount = int(change.get('val') or 0) / 100000
            what = local(change.tag)
            if what in ('lumMod', 'lumOff'):
                hue, light, saturation = colorsys.rgb_to_hls(red, green, blue)
                light = min(1.0, max(0.0, light * amount if what == 'lumMod' else light + amount))
                red, green, blue = colorsys.hls_to_rgb(hue, light, saturation)
            elif what == 'tint':
                red, green, blue = (channel + (1 - channel) * (1 - amount) for channel in (red, green, blue))
            elif what == 'shade':
                red, green, blue = (channel * amount for channel in (red, green, blue))
            elif what == 'alpha':
                alpha = amount
        parts = [round(channel * 255) for channel in (red, green, blue)]
        return f'rgba({parts[0]},{parts[1]},{parts[2]},{alpha:.2f})' if alpha < 1 else '#%02x%02x%02x' % tuple(parts)
    return None


def fill_of(properties, theme):
    """A shape's fill: a CSS color, 'none' when it says it has none, None when it does not say."""
    if properties is None:
        return None
    for one in properties:
        kind = local(one.tag)
        if kind == 'noFill':
            return 'none'
        if kind == 'solidFill':
            return color_of(one, theme) or None
        if kind == 'gradFill':
            stop = one.find(f'{A}gsLst/{A}gs')
            return color_of(stop, theme) if stop is not None else None
        if kind in ('blipFill', 'pattFill', 'grpFill'):
            return 'none'
    return None


def placeholder_of(shape):
    """A shape's placeholder as (type, idx), or None when it is not one."""
    found = shape.find(f'{P}nvSpPr/{P}nvPr/{P}ph')
    if found is None:
        found = shape.find(f'{P}nvPicPr/{P}nvPr/{P}ph')
    if found is None:
        found = shape.find(f'{P}nvGraphicFramePr/{P}nvPr/{P}ph')
    if found is None:
        return None
    return found.get('type') or ('body' if found.get('idx') else 'obj'), found.get('idx')


def placeholders(tree):
    """The placeholders of a layout or a master: {(type, idx): shape}."""
    found = {}
    shapes = tree.find(f'{P}cSld/{P}spTree') if tree is not None else None
    for shape in (shapes if shapes is not None else []):
        held = placeholder_of(shape)
        if held:
            found[held] = shape
    return found


def match(held, among):
    """The layout's or the master's placeholder a slide's one takes after: by its idx, else by its type."""
    kind, idx = held
    kinds = {'ctrTitle': ('ctrTitle', 'title'), 'subTitle': ('subTitle', 'body'), 'obj': ('obj', 'body'), 'body': ('body', 'obj')}.get(kind, (kind,))
    for (other, other_idx), shape in among.items():
        if idx is not None and other_idx == idx:
            return shape
    for wanted in kinds:
        for (other, _), shape in among.items():
            if other == wanted:
                return shape
    return None


def frame_of(shape):
    """A shape's place: (x, y, width, height, turn in degrees, flipped across, flipped down) in EMU, or None."""
    xfrm = shape.find(f'{P}spPr/{A}xfrm')
    if xfrm is None:
        xfrm = shape.find(f'{P}xfrm')
    if xfrm is None:
        xfrm = shape.find(f'{P}grpSpPr/{A}xfrm')
    if xfrm is None:
        return None
    off, ext = xfrm.find(f'{A}off'), xfrm.find(f'{A}ext')
    if off is None or ext is None:
        return None
    return (int(off.get('x') or 0), int(off.get('y') or 0), int(ext.get('cx') or 0), int(ext.get('cy') or 0),
            int(xfrm.get('rot') or 0) / 60000, xfrm.get('flipH') == '1', xfrm.get('flipV') == '1')


def level_styles(chain, level):
    """The paragraph properties that speak for a level, nearest first: from each list of styles in `chain`."""
    found = []
    for styles in chain:
        if styles is None:
            continue
        one = styles.find(f'{A}lvl{level + 1}pPr')
        if one is not None:
            found.append(one)
    return found


class Slide:
    """One slide drawn as HTML, with what it takes from its layout and its master."""

    def __init__(self, deck, part, width, height):
        self.deck = deck
        self.part = part
        self.width, self.height = width, height
        self.tree = deck.xml(part)
        self.layout_part = deck.related(part, 'slideLayout') or ''
        self.layout = deck.xml(self.layout_part)
        self.master_part = deck.related(self.layout_part, 'slideMaster') or ''
        self.master = deck.xml(self.master_part)
        self.theme = deck.theme(self.master_part)
        self.layout_holders = placeholders(self.layout)
        self.master_holders = placeholders(self.master)
        self.text = []

    # ---- The page ---------------------------------------------------------------------------------------

    def html(self):
        out = [f'<div class="slide" style="position:relative;overflow:hidden;width:{px(self.width)}px;height:{px(self.height)}px;background:{self.background()};font-family:{FONT};color:#000;line-height:1.2">']
        # The layout's and the master's own shapes (a logo, a band) stand behind the slide's.
        behind = []
        if self.tree is not None and self.tree.get('showMasterSp') != '0':
            if self.layout is None or self.layout.get('showMasterSp') != '0':
                behind.append((self.master, self.master_part))
            behind.append((self.layout, self.layout_part))
        for tree, part in behind:
            shapes = tree.find(f'{P}cSld/{P}spTree') if tree is not None else None
            for shape in (shapes if shapes is not None else []):
                if placeholder_of(shape) is None:
                    out.append(self.shape(shape, part, (0, 0, 1, 1), False))
        shapes = self.tree.find(f'{P}cSld/{P}spTree') if self.tree is not None else None
        for shape in (shapes if shapes is not None else []):
            out.append(self.shape(shape, self.part, (0, 0, 1, 1), True))
        out.append('</div>')
        return ''.join(out)

    def background(self):
        for tree in (self.tree, self.layout, self.master):
            properties = tree.find(f'{P}cSld/{P}bg/{P}bgPr') if tree is not None else None
            fill = fill_of(properties, self.theme)
            if fill and fill != 'none':
                return fill
            reference = tree.find(f'{P}cSld/{P}bg/{P}bgRef') if tree is not None else None
            fill = color_of(reference, self.theme)
            if fill:
                return fill
        return '#ffffff'

    def box(self, frame, into):
        """A frame in the slide's points, through the group it is in: (left, top, width, height, style)."""
        x, y, width, height, turn, across, down = frame
        ox, oy, sx, sy = into
        left, top, wide, tall = px(ox + x * sx), px(oy + y * sy), px(width * sx), px(height * sy)
        style = f'position:absolute;left:{left}px;top:{top}px;width:{wide}px;height:{tall}px;box-sizing:border-box;'
        moves = ([f'rotate({turn:.2f}deg)'] if turn else []) + (['scaleX(-1)'] if across else []) + (['scaleY(-1)'] if down else [])
        if moves:
            style += 'transform:' + ' '.join(moves) + ';'
        return left, top, wide, tall, style

    def shape(self, shape, part, into, own):
        try:
            kind = local(shape.tag)
            if kind == 'grpSp':
                return self.group(shape, part, into, own)
            if kind == 'pic':
                return self.picture(shape, part, into)
            if kind == 'graphicFrame':
                return self.graphic(shape, into, own)
            if kind == 'cxnSp':
                return self.line(shape, into)
            if kind == 'sp':
                return self.text_shape(shape, into, own)
        except Exception:
            pass
        return ''

    def group(self, shape, part, into, own):
        xfrm = shape.find(f'{P}grpSpPr/{A}xfrm')
        inner = into
        if xfrm is not None:
            off, ext, child_off, child_ext = (xfrm.find(A + name) for name in ('off', 'ext', 'chOff', 'chExt'))
            if None not in (off, ext, child_off, child_ext):
                ox, oy, sx, sy = into
                scale_x = int(ext.get('cx') or 1) / (int(child_ext.get('cx') or 1) or 1)
                scale_y = int(ext.get('cy') or 1) / (int(child_ext.get('cy') or 1) or 1)
                inner = (ox + (int(off.get('x') or 0) - int(child_off.get('x') or 0) * scale_x) * sx,
                         oy + (int(off.get('y') or 0) - int(child_off.get('y') or 0) * scale_y) * sy, sx * scale_x, sy * scale_y)
        return ''.join(self.shape(child, part, inner, own) for child in shape if local(child.tag) in ('sp', 'pic', 'grpSp', 'graphicFrame', 'cxnSp'))

    def picture(self, shape, part, into):
        frame = frame_of(shape)
        blip = shape.find(f'{P}blipFill/{A}blip')
        if frame is None or blip is None:
            return ''
        target = self.deck.rels(part).get(blip.get(R + 'embed'), ('', ''))[0]
        style = self.box(frame, into)[4]
        if target in self.deck.names and target.lower().endswith(DRAWN_PICTURES):
            return f'<img alt="" src="zip/{urllib.parse.quote(target)}" style="{style}object-fit:fill;-webkit-user-drag:none">'
        return f'<div style="{style}background:#e9ecef;color:#868e96;font-size:12px;display:flex;align-items:center;justify-content:center">[imagen]</div>'

    def line(self, shape, into):
        frame = frame_of(shape)
        if frame is None:
            return ''
        left, top, wide, tall, style = self.box(frame[:4] + (0, False, False), into)
        outline = shape.find(f'{P}spPr/{A}ln')
        color = color_of(outline.find(f'{A}solidFill') if outline is not None else None, self.theme) or '#000000'
        weight = max(1.0, px(outline.get('w') if outline is not None else 0))
        ends = (wide, 0, 0, tall) if frame[5] != frame[6] else (0, 0, wide, tall)
        return (f'<svg style="{style}overflow:visible" width="{wide}" height="{tall}"><line x1="{ends[0]}" y1="{ends[1]}" x2="{ends[2]}" y2="{ends[3]}"'
                f' stroke="{color}" stroke-width="{weight}"/></svg>')

    def graphic(self, shape, into, own):
        frame = frame_of(shape)
        if frame is None:
            return ''
        table = shape.find(f'{A}graphic/{A}graphicData/{A}tbl')
        style = self.box(frame, into)[4]
        if table is None:
            return f'<div style="{style}border:1px dashed #adb5bd;color:#868e96;font-size:14px;display:flex;align-items:center;justify-content:center">[gráfico]</div>'
        accent = '#' + self.theme.get('accent1', '4472C4')
        properties = table.find(f'{A}tblPr')
        headed = properties is not None and properties.get('firstRow') == '1'
        banded = properties is not None and properties.get('bandRow') == '1'
        columns = [px(column.get('w')) for column in table.findall(f'{A}tblGrid/{A}gridCol')]
        out = [f'<table style="{style}border-collapse:collapse;table-layout:fixed;height:auto"><colgroup>' + ''.join(f'<col style="width:{width}px">' for width in columns) + '</colgroup>']
        for number, row in enumerate(table.findall(f'{A}tr')):
            out.append(f'<tr style="height:{px(row.get("h"))}px">')
            for cell in row.findall(f'{A}tc'):
                if cell.get('hMerge') == '1' or cell.get('vMerge') == '1':
                    continue
                head = headed and number == 0
                fill = fill_of(cell.find(f'{A}tcPr'), self.theme)
                if not fill or fill == 'none':
                    fill = accent if head else f'color-mix(in srgb, {accent} {30 if number % 2 else 15}%, #fff)' if banded else '#fff'
                spans = (f' colspan="{cell.get("gridSpan")}"' if cell.get('gridSpan') else '') + (f' rowspan="{cell.get("rowSpan")}"' if cell.get('rowSpan') else '')
                body = self.paragraphs(cell.find(f'{A}txBody'), [], 18, '#ffffff' if head else '#000000', head, False, 1.0, own)
                out.append(f'<td{spans} style="background:{fill};border:1px solid #fff;padding:4px 8px;vertical-align:top;overflow:hidden">{body}</td>')
            out.append('</tr>')
        out.append('</table>')
        return ''.join(out)

    # ---- Text ---------------------------------------------------------------------------------------------

    def text_shape(self, shape, into, own):
        held = placeholder_of(shape)
        above = [match(held, self.layout_holders), match(held, self.master_holders)] if held else []
        frame = frame_of(shape)
        for other in above:
            if frame is None and other is not None:
                frame = frame_of(other)
        if frame is None:
            return ''
        properties = shape.find(f'{P}spPr')
        fill = fill_of(properties, self.theme)
        outline = properties.find(f'{A}ln') if properties is not None else None
        edge = fill_of(outline, self.theme) if outline is not None else None
        styled = shape.find(f'{P}style')
        is_box = shape.find(f'{P}nvSpPr/{P}cNvSpPr') is not None and shape.find(f'{P}nvSpPr/{P}cNvSpPr').get('txBox') == '1'
        if styled is not None and not held and not is_box:
            # A drawn shape with no fill of its own takes its style's: the theme's accent, as PowerPoint draws it.
            if fill is None:
                fill = color_of(styled.find(f'{A}fillRef'), self.theme)
            if edge is None and outline is None:
                edge = color_of(styled.find(f'{A}lnRef'), self.theme)
        geometry = properties.find(f'{A}prstGeom') if properties is not None else None
        form = geometry.get('prst') if geometry is not None else 'rect'
        if properties is not None and properties.find(f'{A}custGeom') is not None:
            fill, edge = None, None
        style = self.box(frame, into)[4]
        if fill and fill != 'none':
            style += f'background:{fill};'
        if edge and edge != 'none':
            style += f'border:{max(1.0, px(outline.get("w") if outline is not None else 0))}px solid {edge};'
        if form in ('ellipse', 'flowChartConnector'):
            style += 'border-radius:50%;'
        elif form and 'round' in form.lower():
            style += 'border-radius:12px;'
        body = shape.find(f'{P}txBody')
        if body is None:
            return f'<div style="{style}"></div>' if (fill and fill != 'none') or (edge and edge != 'none') else ''
        # What speaks for the text, nearest first: the shape's own list of styles, its layout's and its
        # master's placeholder, then the master's styles for titles, bodies or anything else.
        chain = [body.find(f'{A}lstStyle')]
        bodies = [body.find(f'{A}bodyPr')]
        for other in above:
            other_body = other.find(f'{P}txBody') if other is not None else None
            chain.append(other_body.find(f'{A}lstStyle') if other_body is not None else None)
            bodies.append(other_body.find(f'{A}bodyPr') if other_body is not None else None)
        kind = held[0] if held else ''
        is_title = kind in ('title', 'ctrTitle')
        is_body = kind in ('body', 'obj', 'subTitle')
        styles = self.master.find(f'{P}txStyles') if self.master is not None else None
        if styles is not None:
            chain.append(styles.find(P + ('titleStyle' if is_title else 'bodyStyle' if is_body else 'otherStyle')))

        def setting(name, default):
            return next((one.get(name) for one in bodies if one is not None and one.get(name) is not None), default)

        anchor = {'t': 'flex-start', 'ctr': 'center', 'b': 'flex-end'}.get(setting('anchor', 't'), 'flex-start')
        insets = [px(setting(name, default)) for name, default in (('tIns', 45720), ('rIns', 91440), ('bIns', 45720), ('lIns', 91440))]
        fit = bodies[0].find(f'{A}normAutofit') if bodies[0] is not None else None
        scale = int(fit.get('fontScale') or 100000) / 100000 if fit is not None else 1.0
        # White on a filled shape, as a shape's style has its text; black, or the master's color, elsewhere.
        ink = None
        if styled is not None and not held and not is_box:
            ink = color_of(styled.find(f'{A}fontRef'), self.theme)
        default_size = 44 if is_title else 18
        text = self.paragraphs(body, chain, default_size, ink or '#' + self.theme.get('dk1', '000000'), False, is_body and kind != 'subTitle', scale, own)
        middle = 'center' if shape.find(f'{P}style') is not None and not held and not is_box else None
        align = f'text-align:{middle};' if middle else ''
        return (f'<div style="{style}display:flex;flex-direction:column;justify-content:{anchor};padding:{insets[0]}px {insets[1]}px {insets[2]}px {insets[3]}px;{align}'
                f'overflow:visible;user-select:text;-webkit-user-select:text;cursor:text">{text}</div>')

    def paragraphs(self, body, chain, default_size, default_color, bold, bulleted, scale, own):
        out = []
        for paragraph in (body.findall(f'{A}p') if body is not None else []):
            own_style = paragraph.find(f'{A}pPr')
            level = int(own_style.get('lvl') or 0) if own_style is not None else 0
            styles = ([own_style] if own_style is not None else []) + level_styles(chain, level)

            def of_paragraph(name):
                return next((one.get(name) for one in styles if one.get(name) is not None), None)

            def of_run(run_style, name):
                if run_style is not None and run_style.get(name) is not None:
                    return run_style.get(name)
                for one in styles:
                    default = one.find(f'{A}defRPr')
                    if default is not None and default.get(name) is not None:
                        return default.get(name)
                return None

            def color_for(run_style):
                for one in [run_style] + [style.find(f'{A}defRPr') for style in styles]:
                    found = color_of(one.find(f'{A}solidFill') if one is not None else None, self.theme)
                    if found:
                        return found
                return default_color

            pieces, plain = [], []
            size = default_size
            for run in paragraph:
                what = local(run.tag)
                if what == 'br':
                    pieces.append('<br>')
                    plain.append('\n')
                    continue
                if what not in ('r', 'fld'):
                    continue
                run_style = run.find(f'{A}rPr')
                words = ''.join(part.text or '' for part in run.findall(f'{A}t'))
                if not words:
                    continue
                size = int(of_run(run_style, 'sz') or default_size * 100) / 100
                look = f'font-size:{size * scale * 96 / 72:.1f}px;color:{color_for(run_style)};'
                if (of_run(run_style, 'b') or ('1' if bold else '0')) == '1':
                    look += 'font-weight:bold;'
                if of_run(run_style, 'i') == '1':
                    look += 'font-style:italic;'
                if (of_run(run_style, 'u') or 'none') != 'none':
                    look += 'text-decoration:underline;'
                face = run_style.find(f'{A}latin') if run_style is not None else None
                if face is not None and face.get('typeface') and not face.get('typeface').startswith('+'):
                    look += f"font-family:'{html.escape(face.get('typeface'))}', {FONT};"
                pieces.append(f'<span style="{look}">{html.escape(words)}</span>')
                plain.append(words)
            if not pieces:
                end = paragraph.find(f'{A}endParaRPr')
                size = int((end.get('sz') if end is not None else None) or of_run(None, 'sz') or default_size * 100) / 100
            align = {'l': 'left', 'ctr': 'center', 'r': 'right', 'just': 'justify'}.get(of_paragraph('algn') or '', '')
            look = f'margin:0;font-size:{size * scale * 96 / 72:.1f}px;min-height:1.2em;' + (f'text-align:{align};' if align else '')
            # A bullet where the paragraph, or what speaks for it, has one and does not say it has none.
            has_bullet = bulleted
            for one in styles:
                marks = {local(child.tag) for child in one}
                if 'buNone' in marks:
                    has_bullet = False
                    break
                if marks & {'buChar', 'buAutoNum'}:
                    has_bullet = True
                    break
            margin = px(of_paragraph('marL')) if of_paragraph('marL') else (level * 36 + 28 if has_bullet else 0)
            if has_bullet and pieces:
                look += f'margin-left:{margin}px;text-indent:-{min(margin, 22)}px;margin-top:.25em;'
                pieces.insert(0, f'<span style="display:inline-block;width:{min(margin, 22)}px;text-indent:0;color:{default_color}">&bull;</span>')
            elif margin:
                look += f'margin-left:{margin}px;'
            out.append(f'<div style="{look}">{"".join(pieces)}</div>')
            if own and plain:
                self.text.append(('  ' * level) + ''.join(plain))
        return ''.join(out)


def read_pptx(path, most=500):
    """A presentation: {'width', 'height' of a slide in points of the page, 'slides': each one's HTML, 'text':
    the slides' text for Copiar, 'members': the pictures its pages ask for, by their path in the file}."""
    deck = Deck(path)
    root = 'ppt/presentation.xml'
    tree = deck.xml(root)
    if tree is None:
        raise ValueError('ppt/presentation.xml no existe')
    size = tree.find(f'{P}sldSz')
    width, height = (int(size.get('cx') or 9144000), int(size.get('cy') or 6858000)) if size is not None else (9144000, 6858000)
    relations = deck.rels(root)
    parts = [relations[one.get(R + 'id')][0] for one in tree.findall(f'{P}sldIdLst/{P}sldId') if one.get(R + 'id') in relations]
    if not parts:
        parts = sorted((name for name in deck.names if re.fullmatch(r'ppt/slides/slide\d+\.xml', name)), key=lambda name: int(re.findall(r'\d+', name)[-1]))
    slides, text = [], []
    for number, part in enumerate(parts[:most], 1):
        slide = Slide(deck, part, width, height)
        try:
            slides.append(slide.html())
        except Exception as error:
            slides.append(f'<div style="width:{px(width)}px;height:{px(height)}px;background:#fff;color:#c92a2a;font:16px sans-serif;padding:24px;box-sizing:border-box">No se pudo dibujar esta diapositiva: {html.escape(str(error))}</div>')
        text.append(f'--- Diapositiva {number} ---\n' + '\n'.join(slide.text))
    members = {name for name in deck.names if name.lower().endswith(DRAWN_PICTURES)}
    deck.archive.close()
    return {'width': px(width), 'height': px(height), 'slides': slides, 'text': '\n\n'.join(text) + '\n', 'members': members, 'total': len(parts)}
