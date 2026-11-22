"""Lays out a minified file for the popup that shows it, never touching the file itself.

    python pretty.py <file>

The format is told by the content first and the name second, so a file named just `blocklist` that holds
one-line JSON is read as JSON. The laid-out text goes to stdout as UTF-8.

Exit codes:
  0  the laid-out text is on stdout
  3  nothing to lay out: not a format this knows, hand-written code, or already laid out (nothing printed)
  2  a package it needs is missing (one line on stderr)
  1  it failed (the reason on stderr)

JSON and JSON Lines are always laid out (2 spaces, keys in their order, every value exactly as written).
JavaScript, CSS, HTML and XML/SVG only when they look minified, so hand-written code is left alone:
JavaScript and CSS through jsbeautifier and cssbeautifier, XML and SVG through xml.dom.minidom, HTML by
the small re-indenter below, which puts each block tag on its own line and keeps every character of the
content, with <pre> and <textarea> untouched and <script> and <style> laid out only when minified.
"""

import json
import os
import re
import sys

JS_TYPES = {'.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'}
CSS_TYPES = {'.css', '.scss', '.less'}
HTML_TYPES = {'.html', '.htm', '.xhtml'}
XML_TYPES = {'.xml', '.svg', '.xsl', '.xslt', '.rss', '.atom', '.xaml', '.plist'}
JSONL_TYPES = {'.jsonl', '.ndjson'}
# Names whose content is never guessed to be JavaScript, CSS or markup: prose, data and other languages.
NO_SNIFF = {
    '.md', '.markdown', '.txt', '.log', '.csv', '.tsv', '.py', '.ps1', '.psm1', '.sh', '.bat', '.cmd',
    '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.sql', '.go', '.rs', '.java', '.c', '.h', '.cpp',
    '.hpp', '.cs', '.rb', '.php', '.lua', '.pl', '.r', '.swift', '.kt', '.diff', '.patch',
}


class Nothing(Exception):
    """Nothing to lay out: exit 3."""


class Missing(Exception):
    """A package is missing: exit 2."""


def read_text(path):
    with open(path, 'rb') as handle:
        data = handle.read()
    if data[:2] in (b'\xff\xfe', b'\xfe\xff'):
        return data.decode('utf-16', errors='replace')
    try:
        return data.decode('utf-8-sig')
    except UnicodeDecodeError:
        pass
    # Not UTF-8: the system's code page, as the popup reads it, else UTF-8 with replacements.
    try:
        return data.decode('mbcs')
    except (LookupError, UnicodeDecodeError):
        return data.decode('utf-8', errors='replace')


def looks_minified(text):
    lines = text.splitlines() or ['']
    size = len(text)
    if any(len(line) > 300 for line in lines):
        return True
    if size / len(lines) > 120:
        return True
    return len(lines) < 3 and size > 500


# ---- JSON ---------------------------------------------------------------------------------------------
JSON_TOKEN = re.compile(r'"(?:[^"\\]|\\.)*"|[{}\[\],:]|[^\s{}\[\],:"]+')


def layout_json(text):
    """JSON laid out as json.dumps(indent=2) lays it out, but from the tokens themselves: numbers, escapes
    and repeated keys stay exactly as written. The text must already parse as JSON."""
    out = []
    depth = 0
    tokens = JSON_TOKEN.findall(text)
    k = 0
    count = len(tokens)
    while k < count:
        token = tokens[k]
        if token in ('{', '['):
            closing = '}' if token == '{' else ']'
            if k + 1 < count and tokens[k + 1] == closing:
                out.append(token + closing)
                k += 2
                continue
            depth += 1
            out.append(token + '\n' + '  ' * depth)
        elif token in ('}', ']'):
            depth = max(0, depth - 1)
            out.append('\n' + '  ' * depth + token)
        elif token == ',':
            out.append(',\n' + '  ' * depth)
        elif token == ':':
            out.append(': ')
        else:
            out.append(token)
        k += 1
    return ''.join(out)


def parses(text):
    try:
        json.loads(text)
        return True
    except (ValueError, RecursionError):
        return False


def try_json(text):
    stripped = text.strip()
    if stripped[:1] in ('{', '[') and parses(stripped):
        return layout_json(stripped)
    return None


def try_json_lines(text, by_name):
    lines = [line for line in text.splitlines() if line.strip()]
    if len(lines) < 2 and not (by_name and lines):
        return None
    records = []
    for line in lines:
        if line.strip()[:1] in ('{', '[') and parses(line):
            records.append(layout_json(line.strip()))
        elif by_name:
            # A .jsonl's broken line (a record cut short) is kept as it is.
            records.append(line)
        else:
            return None
    return '\n\n'.join(records)


# ---- JavaScript and CSS -------------------------------------------------------------------------------
def beautifier(name):
    try:
        return __import__(name)
    except ImportError:
        raise Missing(name)


def layout_js(text):
    jsbeautifier = beautifier('jsbeautifier')
    options = jsbeautifier.default_options()
    options.indent_size = 2
    return jsbeautifier.beautify(text, options)


def layout_css(text):
    cssbeautifier = beautifier('cssbeautifier')
    options = cssbeautifier.default_options()
    options.indent_size = 2
    return cssbeautifier.beautify(text, options)


def sniff_css(text):
    head = text[:20000]
    if re.search(r'\bfunction\b|=>|\bvar\s|\bconst\s|\blet\s', head):
        return False
    rules = re.findall(r'[^{};]+\{[^{}]*?[\w-]+\s*:[^{}]*\}', head)
    return len(rules) >= 3


def sniff_js(text):
    head = text[:20000]
    signals = [
        r'\bfunction\s*[\w$]*\s*\(', r'=>', r'\b(?:var|let|const)\s+[\w$]', r'\breturn\b',
        r'!function', r'["\']use strict["\']', r'\bthis\.', r'\bwindow\.|\bdocument\.|\bmodule\.exports|\brequire\(',
    ]
    found = sum(1 for one in signals if re.search(one, head))
    return found >= 2 and head.count(';') >= 3


# ---- XML and SVG --------------------------------------------------------------------------------------
def layout_xml(text):
    from xml.dom import minidom
    from xml.parsers.expat import ExpatError
    body = text.strip()
    # The declaration as written: minidom writes its own, without the encoding.
    declaration = re.match(r'<\?xml[^>]*\?>', body)
    if declaration:
        body = body[declaration.end():]
    try:
        document = minidom.parseString(body)
    except (ExpatError, ValueError):
        return None
    parts = [declaration.group(0)] if declaration else []
    for node in document.childNodes:
        parts.append(node.toprettyxml(indent='  '))
    lines = '\n'.join(parts).splitlines()
    return '\n'.join(line.rstrip() for line in lines if line.strip())


# ---- HTML ---------------------------------------------------------------------------------------------
BLOCK = {
    'html', 'head', 'body', 'title', 'meta', 'link', 'base', 'script', 'style', 'noscript', 'template',
    'div', 'p', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside', 'address', 'hgroup',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'menu', 'blockquote', 'pre',
    'figure', 'figcaption', 'hr', 'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr',
    'td', 'th', 'form', 'fieldset', 'legend', 'select', 'optgroup', 'option', 'textarea', 'details',
    'summary', 'dialog', 'iframe', 'video', 'audio', 'source', 'track', 'canvas', 'svg', 'picture', 'object',
}
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
RAW = {'script', 'style', 'textarea', 'pre', 'xmp'}
# A tag of these closes an open one of the same group, as an HTML parser does with <li>a<li>b.
SIBLINGS = {'li': {'li'}, 'option': {'option'}, 'tr': {'tr'}, 'td': {'td', 'th'}, 'th': {'td', 'th'},
            'dt': {'dt', 'dd'}, 'dd': {'dt', 'dd'}, 'p': {'p'}}
HTML_TOKEN = re.compile(
    r'<!--.*?(?:-->|$)'
    r'|<!\[CDATA\[.*?(?:\]\]>|$)'
    r'|<![^>]*>'
    r'|<\?.*?(?:\?>|>|$)'
    r'|</?[A-Za-z][^\s/>]*(?:[^>"\']|"[^"]*"|\'[^\']*\')*>'
    r'|[^<]+|<',
    re.S)
INLINE_WIDTH = 100


class Element:
    def __init__(self, name, start):
        self.name = name
        self.start = start
        self.children = []
        self.end = ''


def parse_html(text):
    root = Element('', '')
    stack = [root]
    position = 0
    while position < len(text):
        match = HTML_TOKEN.match(text, position)
        token = match.group(0)
        position = match.end()
        opening = re.match(r'<([A-Za-z][^\s/>]*)', token)
        closing = re.match(r'</([A-Za-z][^\s/>]*)', token)
        if opening:
            name = opening.group(1).lower()
            group = SIBLINGS.get(name)
            if group and stack[-1].name in group:
                stack.pop()
            element = Element(name, token)
            stack[-1].children.append(element)
            if name in RAW and not token.endswith('/>'):
                # Its content as it is, up to its own end tag.
                end = re.compile(r'</' + re.escape(name) + r'\s*>', re.I).search(text, position)
                stop = end.start() if end else len(text)
                element.children.append(text[position:stop])
                element.end = end.group(0) if end else ''
                position = end.end() if end else len(text)
            elif name not in VOID and not token.endswith('/>'):
                stack.append(element)
        elif closing:
            name = closing.group(1).lower()
            if any(one.name == name for one in stack[1:]):
                while stack[-1].name != name:
                    stack.pop()
                stack.pop().end = token
            else:
                # An end tag with no start: kept where it stands.
                stack[-1].children.append(token)
        else:
            stack[-1].children.append(token)
    return root


def has_block(element):
    for child in element.children:
        if isinstance(child, Element) and (child.name in BLOCK or has_block(child)):
            return True
    return False


def flat(node):
    if not isinstance(node, Element):
        return node
    return node.start + ''.join(flat(child) for child in node.children) + node.end


def layout_raw(element):
    """A <script> or <style>'s content: laid out when minified and of a kind the beautifiers know."""
    content = element.children[0] if element.children else ''
    if not content.strip() or not looks_minified(content):
        return None
    if element.name == 'style':
        return layout_css(content)
    if element.name == 'script':
        kind = re.search(r'\btype\s*=\s*["\']?([^"\'\s>]+)', element.start, re.I)
        if kind and not re.search(r'javascript|ecmascript|module|babel|jsx', kind.group(1), re.I):
            return None
        return layout_js(content)
    return None


def render(element, depth, lines):
    pad = '  ' * depth
    if element.name in RAW:
        laid = layout_raw(element)
        if laid is None:
            lines.append(pad + flat(element))
        else:
            lines.append(pad + element.start)
            lines.extend(('  ' * (depth + 1) + one) if one.strip() else '' for one in laid.splitlines())
            lines.append(pad + element.end)
        return
    whole = flat(element)
    if not has_block(element) and '\n' not in whole and len(whole) + len(pad) <= INLINE_WIDTH:
        lines.append(pad + whole.strip())
        return
    lines.append(pad + element.start)
    render_children(element.children, depth + 1, lines)
    if element.end:
        lines.append(pad + element.end)


def render_children(children, depth, lines):
    pad = '  ' * depth
    run = []

    def flush():
        joined = ''.join(run).strip()
        if joined:
            lines.append(pad + joined)
        run.clear()

    for child in children:
        if isinstance(child, Element) and (child.name in BLOCK or child.name in RAW or has_block(child)):
            flush()
            render(child, depth, lines)
        elif isinstance(child, str) and child.startswith('<!--') and not ''.join(run).strip():
            flush()
            lines.append(pad + child)
        else:
            run.append(flat(child))
    flush()


def layout_html(text):
    lines = []
    render_children(parse_html(text).children, 0, lines)
    return '\n'.join(line.rstrip() for line in lines)


# ---- Choosing -----------------------------------------------------------------------------------------
def layout(text, extension):
    stripped = text.strip()
    if not stripped:
        raise Nothing()
    by_name = extension in JSONL_TYPES
    if by_name:
        laid = try_json_lines(text, True)
        if laid is not None:
            return laid
    laid = try_json(text)
    if laid is not None:
        return laid
    if stripped[:1] in ('{', '['):
        laid = try_json_lines(text, False)
        if laid is not None:
            return laid
    if extension == '.json' or by_name:
        raise Nothing()
    sniff = extension == '' or (extension not in NO_SNIFF and extension not in JS_TYPES | CSS_TYPES | HTML_TYPES | XML_TYPES)
    if not looks_minified(text):
        raise Nothing()
    if extension in JS_TYPES:
        return layout_js(text)
    if extension in CSS_TYPES:
        return layout_css(text)
    if extension in XML_TYPES:
        laid = layout_xml(text)
        return laid if laid is not None else layout_html(text)
    if extension in HTML_TYPES:
        return layout_html(text)
    if not sniff:
        raise Nothing()
    if stripped.startswith('<'):
        if re.match(r'<!doctype\s+html|<html\b', stripped, re.I):
            return layout_html(text)
        laid = layout_xml(text)
        return laid if laid is not None else layout_html(text)
    if sniff_css(text):
        return layout_css(text)
    if sniff_js(text):
        return layout_js(text)
    raise Nothing()


def main():
    if len(sys.argv) != 2:
        sys.stderr.write('usage: pretty.py <file>\n')
        return 1
    path = sys.argv[1]
    try:
        text = read_text(path)
        extension = os.path.splitext(path)[1].lower()
        laid = layout(text, extension).rstrip()
    except Nothing:
        return 3
    except Missing as missing:
        sys.stderr.write('missing package: %s\n' % missing)
        return 2
    except Exception as error:  # noqa: BLE001 - the popup shows the original whatever goes wrong
        sys.stderr.write('%s: %s\n' % (type(error).__name__, error))
        return 1
    if laid == text.replace('\r\n', '\n').rstrip():
        return 3
    sys.stdout.buffer.write((laid + '\n').encode('utf-8'))
    sys.stdout.buffer.flush()
    return 0


if __name__ == '__main__':
    sys.exit(main())
