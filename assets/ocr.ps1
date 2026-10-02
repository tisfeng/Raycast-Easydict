# ==============================================================================
# Easydict for Windows - screenshot area capture + local OCR helper.
#
# Adapted from ScreenOCR for Windows (MIT), the Windows support merged into the
# Raycast ScreenOCR extension: https://github.com/raycast/extensions/tree/main/extensions/screenocr
# Original Windows implementation by duckieeeduck.
#
# Runs only for one capture, then exits. OCR uses the Windows.Media.Ocr engine
# with the language packs installed in Windows; nothing leaves the machine.
#
# Exit codes:
# 0 = success (recognized text written to stdout as raw UTF-8 bytes, may be empty)
# 2 = user cancelled the selection (Esc / right-click / tiny selection)
# 3 = no OCR engine could be created from the Windows profile languages
# 5 = unexpected error (details on stderr)
# ==============================================================================

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false } catch {}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime

# Load the WinRT types before they are used.
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]

$script:AsTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]

function Wait-WinRtOperation {
    param($Operation, [Type]$ResultType)
    $task = $script:AsTaskGeneric.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    $task.Wait()
    return $task.Result
}

function Resize-Bitmap {
    param([System.Drawing.Bitmap]$Source, [int]$Width, [int]$Height)
    $width = [Math]::Max(1, $Width)
    $height = [Math]::Max(1, $Height)
    $dest = New-Object System.Drawing.Bitmap ($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = $null
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($dest)
        $graphics.Clear([System.Drawing.Color]::White)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($Source, 0, 0, $width, $height)
        return $dest
    }
    catch {
        $dest.Dispose()
        throw
    }
    finally {
        if ($graphics) { $graphics.Dispose() }
    }
}

function Get-VirtualScreenBitmap {
    $bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
    if ($bounds.Width -lt 1 -or $bounds.Height -lt 1) { throw 'The virtual desktop has invalid dimensions.' }
    $bitmap = New-Object System.Drawing.Bitmap ($bounds.Width, $bounds.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = $null
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bitmap.Size)
        return $bitmap
    }
    catch {
        $bitmap.Dispose()
        throw
    }
    finally {
        if ($graphics) { $graphics.Dispose() }
    }
}

function Select-ScreenRegion {
    param([System.Drawing.Bitmap]$Frozen)

    $bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
    $form = New-Object System.Windows.Forms.Form
    $dimBrush = $null
    $borderPen = $null
    try {
        # Freeze the screen, dim it, and show a live rubber-band selection.
        $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
        $form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
        $form.Bounds = $bounds
        $form.TopMost = $true
        $form.ShowInTaskbar = $false
        $form.Cursor = [System.Windows.Forms.Cursors]::Cross
        $form.KeyPreview = $true
        $form.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::None
        $form.GetType().GetProperty('DoubleBuffered', [System.Reflection.BindingFlags]'Instance,NonPublic').SetValue($form, $true, $null)

        $state = @{ Dragging = $false; Start = [System.Drawing.Point]::Empty; Current = [System.Drawing.Point]::Empty; Selection = [System.Drawing.Rectangle]::Empty; Done = $false }
        $getRectangle = {
            $x = [Math]::Max(0, [Math]::Min($Frozen.Width, [Math]::Min($state.Start.X, $state.Current.X)))
            $y = [Math]::Max(0, [Math]::Min($Frozen.Height, [Math]::Min($state.Start.Y, $state.Current.Y)))
            $right = [Math]::Max(0, [Math]::Min($Frozen.Width, [Math]::Max($state.Start.X, $state.Current.X)))
            $bottom = [Math]::Max(0, [Math]::Min($Frozen.Height, [Math]::Max($state.Start.Y, $state.Current.Y)))
            New-Object System.Drawing.Rectangle ($x, $y, [Math]::Max(0, $right - $x), [Math]::Max(0, $bottom - $y))
        }

        $dimBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(120, 0, 0, 0))
        $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White, 1)
        $borderPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash

        $form.Add_Paint({
            param($sender, $event)
            $event.Graphics.DrawImageUnscaled($Frozen, 0, 0)
            if ($state.Dragging) {
                $rectangle = & $getRectangle
                $outside = New-Object System.Drawing.Region ($sender.ClientRectangle)
                try {
                    $outside.Exclude($rectangle)
                    $event.Graphics.FillRegion($dimBrush, $outside)
                }
                finally {
                    $outside.Dispose()
                }
                if ($rectangle.Width -gt 0 -and $rectangle.Height -gt 0) {
                    $event.Graphics.DrawRectangle($borderPen, $rectangle.X, $rectangle.Y, [Math]::Max(1, $rectangle.Width - 1), [Math]::Max(1, $rectangle.Height - 1))
                }
            }
            else {
                $event.Graphics.FillRectangle($dimBrush, $sender.ClientRectangle)
            }
        })
        $form.Add_MouseDown({
            param($sender, $event)
            if ($event.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
                $state.Dragging = $true
                $state.Start = $event.Location
                $state.Current = $event.Location
                $sender.Invalidate()
            }
            elseif ($event.Button -eq [System.Windows.Forms.MouseButtons]::Right) {
                $sender.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
                $sender.Close()
            }
        })
        $form.Add_MouseMove({
            param($sender, $event)
            if ($state.Dragging) {
                $state.Current = $event.Location
                $sender.Invalidate()
            }
        })
        $form.Add_MouseUp({
            param($sender, $event)
            if ($event.Button -eq [System.Windows.Forms.MouseButtons]::Left -and $state.Dragging) {
                $state.Dragging = $false
                $state.Current = $event.Location
                $state.Selection = & $getRectangle
                $state.Done = $true
                $sender.DialogResult = [System.Windows.Forms.DialogResult]::OK
                $sender.Close()
            }
        })
        $form.Add_KeyDown({
            param($sender, $event)
            if ($event.KeyCode -eq [System.Windows.Forms.Keys]::Escape) {
                $sender.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
                $sender.Close()
            }
        })
        $form.Add_Shown({
            param($sender, $event)
            $overlay = $sender
            $requestFocus = {
                if (-not $overlay.IsDisposed -and $overlay.Visible) {
                    $overlay.BringToFront()
                    $overlay.Activate()
                    [void]$overlay.Focus()
                }
            }.GetNewClosure()
            [void]$overlay.BeginInvoke([System.Action]$requestFocus)
        })

        # Escape may not reach the form while another window grabs focus, so poll it.
        $escapeTimer = New-Object System.Windows.Forms.Timer
        $escapeTimer.Interval = 30
        try {
            $escapeTimer.Add_Tick({
                if ($form.Visible -and -not $form.IsDisposed -and [EasyDictOcrNative.Dpi]::GetAsyncKeyState(27) -lt 0) {
                    $escapeTimer.Stop()
                    $form.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
                    $form.Close()
                }
            })
            $escapeTimer.Start()
            $dialogResult = $form.ShowDialog()
        }
        finally {
            $escapeTimer.Stop()
            $escapeTimer.Dispose()
        }

        if ($dialogResult -ne [System.Windows.Forms.DialogResult]::OK -or -not $state.Done) { return $null }
        if ($state.Selection.Width -lt 3 -or $state.Selection.Height -lt 3) { return $null }
        return $state.Selection
    }
    finally {
        if ($dimBrush) { $dimBrush.Dispose() }
        if ($borderPen) { $borderPen.Dispose() }
        $form.Dispose()
    }
}

function Normalize-OcrLine {
    param([string]$Text, [string]$LanguageTag)
    if ($LanguageTag -notmatch '^(zh|yue|ja)(-|$)') { return $Text }
    # Windows OCR inserts spaces between CJK glyphs; remove only that artifact.
    # \uXXXX escapes keep this file ASCII-only, so Windows PowerShell 5.1 reads
    # it correctly no matter which ANSI code page is active.
    $han = '\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF'
    $kana = '\u3040-\u30FF'
    $value = [regex]::Replace($Text, "(?<=[$han])\x20(?=[$han])", '')
    return [regex]::Replace($value, "(?<=[$kana])\x20(?=[$han$kana])|(?<=[$han])\x20(?=[$kana])", '')
}

function Invoke-Ocr {
    param([System.Drawing.Bitmap]$Bitmap)

    # Auto mode: build the engine from the languages in the Windows language profile.
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if (-not $engine) { throw 'EASYDICT_OCR_LANGUAGE_UNAVAILABLE' }

    $work = $Bitmap
    $ownsWork = $false
    $stream = $null
    $randomAccessStream = $null
    $softwareBitmap = $null
    try {
        $maxDimension = [Windows.Media.Ocr.OcrEngine]::MaxImageDimension
        if ($Bitmap.Width -gt $maxDimension -or $Bitmap.Height -gt $maxDimension) {
            # Windows OCR rejects images above MaxImageDimension; downscale to fit.
            $ratio = [Math]::Min($maxDimension / [double]$Bitmap.Width, $maxDimension / [double]$Bitmap.Height)
            $work = Resize-Bitmap $Bitmap ([int][Math]::Floor($Bitmap.Width * $ratio)) ([int][Math]::Floor($Bitmap.Height * $ratio))
            $ownsWork = $true
        }
        elseif ($Bitmap.Height -lt 300 -and $Bitmap.Width -le [Math]::Floor($maxDimension / 2) -and $Bitmap.Height -le [Math]::Floor($maxDimension / 2)) {
            # Small snips recognize noticeably better when upscaled 2x.
            $work = Resize-Bitmap $Bitmap ($Bitmap.Width * 2) ($Bitmap.Height * 2)
            $ownsWork = $true
        }

        $stream = New-Object System.IO.MemoryStream
        $work.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        $stream.Position = 0
        $randomAccessStream = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($stream)
        $decoder = Wait-WinRtOperation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($randomAccessStream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $softwareBitmap = Wait-WinRtOperation ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $result = Wait-WinRtOperation ($engine.RecognizeAsync($softwareBitmap)) ([Windows.Media.Ocr.OcrResult])

        return (@($result.Lines | ForEach-Object { Normalize-OcrLine $_.Text $engine.RecognizerLanguage.LanguageTag }) -join "`n")
    }
    finally {
        if ($softwareBitmap) { $softwareBitmap.Dispose() }
        if ($randomAccessStream) { $randomAccessStream.Dispose() }
        if ($stream) { $stream.Dispose() }
        if ($ownsWork) { $work.Dispose() }
    }
}

$exitCode = 0
try {
    Add-Type -Namespace EasyDictOcrNative -Name Dpi -MemberDefinition @'
[DllImport("user32.dll")]
public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
[DllImport("user32.dll")]
public static extern bool SetProcessDPIAware();
[DllImport("user32.dll")]
public static extern short GetAsyncKeyState(int virtualKey);
'@
    # -4 = DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2, fall back to system aware.
    # SetProcessDpiAwarenessContext requires Windows 10 1703+, so guard for older builds.
    try {
        if (-not [EasyDictOcrNative.Dpi]::SetProcessDpiAwarenessContext([IntPtr]::new(-4))) {
            [void][EasyDictOcrNative.Dpi]::SetProcessDPIAware()
        }
    }
    catch {
        [void][EasyDictOcrNative.Dpi]::SetProcessDPIAware()
    }

    if (-not $script:AsTaskGeneric) { throw 'Windows Runtime initialization failed.' }

    $frozen = Get-VirtualScreenBitmap
    $bitmap = $null
    try {
        $selection = Select-ScreenRegion -Frozen $frozen
        if (-not $selection) { throw 'EASYDICT_OCR_CANCELLED' }
        $bitmap = $frozen.Clone($selection, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $text = Invoke-Ocr -Bitmap $bitmap
    }
    finally {
        if ($bitmap) { $bitmap.Dispose() }
        $frozen.Dispose()
    }

    # Write raw UTF-8 bytes so the output never depends on the console code page.
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    $stdout = [Console]::OpenStandardOutput()
    $stdout.Write($bytes, 0, $bytes.Length)
    $stdout.Flush()
}
catch {
    if ($_.Exception.Message -eq 'EASYDICT_OCR_CANCELLED') { $exitCode = 2 }
    elseif ($_.Exception.Message -eq 'EASYDICT_OCR_LANGUAGE_UNAVAILABLE') {
        [Console]::Error.WriteLine('No OCR engine is available from the Windows language profile. Install an OCR language pack in Windows Settings.')
        $exitCode = 3
    }
    else {
        [Console]::Error.WriteLine($_.Exception.ToString())
        $exitCode = 5
    }
}
exit $exitCode
