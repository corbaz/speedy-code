"""What the macOS popups share: the frame's page, the lines said to the mod, and the window itself.

A popup is a page (dialog.html, view.html) in a window with no frame of the system's, by pywebview. The
frame is drawn in the page (popup.css), so every popup has the one the Windows popups have.
"""
import os
import sys
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
# What a popup exits with when pywebview is not installed: the mod then shows what macOS itself has.
MISSING = 3

# The move mark (U+2725 on Windows) and the close mark, drawn: no font of macOS has both as Segoe UI Symbol does.
MARKS = (
    '<div id="move" class="on-line mark pywebview-drag-region"><svg viewBox="0 0 16 16"><path d="M8 0l2.6 3.2H8.9v3.9h3.9V5.4L16 8'
    'l-3.2 2.6V8.9H8.9v3.9h1.7L8 16l-2.6-3.2h1.7V8.9H3.2v1.7L0 8l3.2-2.6v1.7h3.9V3.2H5.4z"/></svg></div>'
    '<div id="close" class="on-line mark"><svg viewBox="0 0 13 13"><path d="M1 1l11 11M12 1L1 12"/></svg></div>'
)


def say(line):
    """One line to the mod. With no one reading, the write fails and the popup ends."""
    try:
        sys.stdout.write(line + '\n')
        sys.stdout.flush()
    except (OSError, ValueError):
        os._exit(0)


def page(name):
    """A page of this folder with the shared frame in it: its style and its marks."""
    with open(os.path.join(HERE, name), encoding='utf-8') as file:
        html = file.read()
    with open(os.path.join(HERE, 'popup.css'), encoding='utf-8') as file:
        style = file.read()
    return html.replace('/*popup.css*/', style).replace('<!--marks-->', MARKS)


def pointer_screen(webview):
    """The screen the pointer is on, as pywebview names it, and the size of its working area."""
    try:
        import AppKit
        at = AppKit.NSEvent.mouseLocation()
        for index, screen in enumerate(AppKit.NSScreen.screens()):
            frame = screen.frame()
            if frame.origin.x <= at.x < frame.origin.x + frame.size.width and frame.origin.y <= at.y < frame.origin.y + frame.size.height:
                area = screen.visibleFrame()
                return webview.screens[index], area.size.width, area.size.height
    except Exception:
        pass
    return None, 1440.0, 900.0


def front():
    """The popup comes to the front with the keys, as the Windows ones do when shown. macOS may not hand
    them over at the first asking, so it is asked a few times, until the popup has them."""
    try:
        import AppKit
        from PyObjCTools import AppHelper
        from webview.platforms.cocoa import BrowserView
    except ImportError:
        return

    def attempt():
        app = AppKit.NSApp
        if not app.isActive():
            AppKit.NSRunningApplication.currentApplication().activateWithOptions_(AppKit.NSApplicationActivateAllWindows)
            app.activateIgnoringOtherApps_(True)
        # The page takes the keys only as the window's first responder: Esc, Enter and the typing go to it.
        for view in BrowserView.instances.values():
            if not view.window.isKeyWindow():
                view.window.makeKeyAndOrderFront_(None)
            if view.window.firstResponder() is not view.webview:
                view.window.makeFirstResponder_(view.webview)

    def ask():
        for _ in range(8):
            AppHelper.callAfter(attempt)
            time.sleep(0.15)

    threading.Thread(target=ask, daemon=True).start()


def square(window):
    """No frame of the system at all: macOS rounds the corners of a window with a title bar, even a hidden one,
    and the popup's contour is square, as on Windows."""
    try:
        import AppKit
        from PyObjCTools import AppHelper
        from webview.platforms.cocoa import BrowserView
    except ImportError:
        return

    def apply():
        native = BrowserView.instances[window.uid].window
        frame = native.frame()
        native.setStyleMask_(AppKit.NSWindowStyleMaskBorderless)
        native.setFrame_display_(frame, True)

    AppHelper.callAfter(apply)


def no_dock_icon():
    """A popup is a window of the mod's, not a program of its own: no Python icon in the Dock, no menu bar.
    pywebview asks for both as its macOS part loads, so that is loaded here, and the asking undone at once."""
    try:
        import AppKit
        import webview.platforms.cocoa  # noqa: F401
        AppKit.NSApplication.sharedApplication().setActivationPolicy_(AppKit.NSApplicationActivationPolicyAccessory)
    except Exception:
        pass


def open_window(webview, title, name, api, width, height, screen=None):
    """The page `name` in a window of that size, in the middle of `screen`, above the others. Runs until it ends."""
    no_dock_icon()
    window = webview.create_window(
        title, html=page(name), js_api=api, width=int(width), height=int(height), screen=screen,
        frameless=True, easy_drag=False, resizable=False, on_top=True, background_color='#000000')
    # The application's loop, stopped, would wait for one more event: the popup ends at once instead.
    window.events.closed += api.close
    window.events.shown += lambda: square(window)
    webview.start()
