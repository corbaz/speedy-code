# Opens the folder in SPEEDY_FOLDER in Explorer and brings its window to the front.
#
# `start` on a folder that already has a window only flashes it in the taskbar, and explorer.exe run by
# itself leaves a new window behind the terminal: Windows lets no program in the background take the
# front. So the window is found (or opened and waited for), restored if it is minimized, and put in
# front after a tap of Alt, which is what makes Windows allow it.
#
# Explorer keeps windows that are not on screen: hidden ones left from a window closed, and the ones of
# another virtual desktop. Neither counts as the folder's window: putting one "in front" shows nothing.
$folder = $env:SPEEDY_FOLDER
if (-not $folder -or -not (Test-Path -LiteralPath $folder -PathType Container)) { 'missing'; exit 1 }

$signatures = @'
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr window);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
[DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr window, int attribute, out int value, int size);
[DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
'@
$user32 = Add-Type -MemberDefinition $signatures -Name User32 -Namespace SpeedyCode -PassThru
$shell = New-Object -ComObject Shell.Application

function Test-OnScreen($handle) {
  if (-not $user32::IsWindowVisible($handle)) { return $false }
  # 14 is DWMWA_CLOAKED: not zero for a window of another virtual desktop.
  $cloaked = 0
  [void]$user32::DwmGetWindowAttribute($handle, 14, [ref]$cloaked, 4)
  return $cloaked -eq 0
}

function Find-Window {
  foreach ($one in $shell.Windows()) {
    try {
      if ($one.Document.Folder.Self.Path -eq $folder -and (Test-OnScreen ([IntPtr]$one.HWND))) { return $one }
    } catch { }
  }
}

$window = Find-Window
if (-not $window) {
  Start-Process explorer.exe -ArgumentList "`"$folder`""
  for ($turn = 0; $turn -lt 30 -and -not $window; $turn++) {
    Start-Sleep -Milliseconds 150
    $window = Find-Window
  }
}
if (-not $window) { 'opened'; exit 0 }

$handle = [IntPtr]$window.HWND
# 9 is SW_RESTORE: a minimized window comes back as it was.
if ($user32::IsIconic($handle)) { [void]$user32::ShowWindow($handle, 9) }
# Alt down and up (0x12, then KEYEVENTF_KEYUP): after it Windows lets this process set the front window.
$user32::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
$user32::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
[void]$user32::SetForegroundWindow($handle)
'front'
