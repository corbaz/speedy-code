# The terminal a popup belongs to, for the speedy-code mod's popups (view_file.ps1, view.ps1, dialog.ps1): they
# dot-source this file. A popup owned by the terminal's window stands above that window and no other: another
# program in front covers it, and it goes and comes back with the terminal when that is minimized and
# restored. It opens on the terminal's screen.
#
# The window is the one of the console the mod runs in, the popup's parent: the popup lets go of its own
# console and takes the parent's for a moment (AttachConsole), reads its window and lets go of it again, so
# a Ctrl+C there never reaches the popup. In Windows Terminal that window is a pseudo one that the terminal's
# own window owns (GetAncestor GA_ROOTOWNER); in the old console it is the console window itself. One that
# cannot be found, or is not shown, leaves the popup as before: above every window, on the pointer's screen.
#
# The P/Invoke is emitted at run time, which costs nothing, where Add-Type would start the C# compiler.

$terminalWindow = [IntPtr]::Zero
try {
  $ownerAssembly = [AppDomain]::CurrentDomain.DefineDynamicAssembly((New-Object System.Reflection.AssemblyName('SpeedyOwnerNative')), [System.Reflection.Emit.AssemblyBuilderAccess]::Run)
  $ownerType = $ownerAssembly.DefineDynamicModule('SpeedyOwnerNative').DefineType('SpeedyOwnerNative.Calls', [System.Reflection.TypeAttributes]'Public, Class')
  $ownerCalls = @(
    @('FreeConsole', 'kernel32.dll', [bool], [Type[]]@()),
    @('AttachConsole', 'kernel32.dll', [bool], [Type[]]@([int])),
    @('GetConsoleWindow', 'kernel32.dll', [IntPtr], [Type[]]@()),
    @('GetAncestor', 'user32.dll', [IntPtr], [Type[]]@([IntPtr], [int])),
    @('IsWindowVisible', 'user32.dll', [bool], [Type[]]@([IntPtr])),
    @('SetWindowLongPtrW', 'user32.dll', [IntPtr], [Type[]]@([IntPtr], [int], [IntPtr]))
  )
  foreach ($call in $ownerCalls) {
    $method = $ownerType.DefinePInvokeMethod($call[0], $call[1], [System.Reflection.MethodAttributes]'Public, Static, PinvokeImpl', [System.Reflection.CallingConventions]::Standard, $call[2], $call[3], [System.Runtime.InteropServices.CallingConvention]::Winapi, [System.Runtime.InteropServices.CharSet]::Unicode)
    # What each call answers is its own, not an HRESULT to turn into an exception.
    $method.SetImplementationFlags([System.Reflection.MethodImplAttributes]::PreserveSig)
  }
  $ownerNative = $ownerType.CreateType()
  # The window shown for the console of process `id` (-1, ATTACH_PARENT_PROCESS: the one that started this
  # one), or zero. GA_ROOTOWNER: the window that owns the console's, all the way up; the console's own when
  # none does. A console with no window shown (one a program started hidden) is no terminal.
  function Get-ConsoleTerminal([int]$id) {
    [void]$ownerNative::FreeConsole()
    if (-not $ownerNative::AttachConsole($id)) { return [IntPtr]::Zero }
    $console = $ownerNative::GetConsoleWindow()
    [void]$ownerNative::FreeConsole()
    if ($console -eq [IntPtr]::Zero) { return [IntPtr]::Zero }
    $root = $ownerNative::GetAncestor($console, 3)
    if ($root -ne [IntPtr]::Zero -and $ownerNative::IsWindowVisible($root)) { return $root }
    [IntPtr]::Zero
  }
  # The mod's console first, the popup's parent; else, past a hidden one between them, up the line of
  # processes to the first whose console is shown.
  $terminalWindow = Get-ConsoleTerminal -1
  if ($terminalWindow -eq [IntPtr]::Zero) {
    $parents = @{}
    foreach ($one in Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId) { $parents[[int]$one.ProcessId] = [int]$one.ParentProcessId }
    $id = $parents[$PID]
    for ($step = 0; $step -lt 8 -and $id -and $terminalWindow -eq [IntPtr]::Zero; $step++) {
      $terminalWindow = Get-ConsoleTerminal $id
      $id = $parents[$id]
    }
  }
} catch {
  $terminalWindow = [IntPtr]::Zero
}

# The screen's working area a popup opens on: the terminal's, else the pointer's.
function Get-PopupArea {
  if ($terminalWindow -ne [IntPtr]::Zero) { return [System.Windows.Forms.Screen]::FromHandle($terminalWindow).WorkingArea }
  [System.Windows.Forms.Screen]::FromPoint([System.Windows.Forms.Cursor]::Position).WorkingArea
}

# A form owned by the terminal's window (GWLP_HWNDPARENT), now and whenever its handle is made again; with no
# terminal found, above every window, as before.
function Set-PopupOwner($form) {
  if ($terminalWindow -eq [IntPtr]::Zero) { $form.TopMost = $true; return }
  $form.TopMost = $false
  # WinForms gives a form out of the taskbar a hidden owner of its own as it is shown: the terminal takes its
  # place once the form is up, and again whenever it is shown anew.
  $form.Add_HandleCreated({ [void]$ownerNative::SetWindowLongPtrW($this.Handle, -8, $terminalWindow) })
  $form.Add_VisibleChanged({ if ($this.Visible) { [void]$ownerNative::SetWindowLongPtrW($this.Handle, -8, $terminalWindow) } })
  if ($form.IsHandleCreated) { [void]$ownerNative::SetWindowLongPtrW($form.Handle, -8, $terminalWindow) }
}
