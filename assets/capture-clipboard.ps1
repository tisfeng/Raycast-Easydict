param([string]$FixtureImage)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
try {
    $image = $null
    if ($FixtureImage) {
        $image = [System.Drawing.Image]::FromFile($FixtureImage)
    } elseif ([System.Windows.Forms.Clipboard]::ContainsImage()) {
        $image = [System.Windows.Forms.Clipboard]::GetImage()
    } elseif ([System.Windows.Forms.Clipboard]::ContainsFileDropList()) {
        $paths = [System.Windows.Forms.Clipboard]::GetFileDropList()
        if ($paths.Count -eq 1 -and [System.IO.Path]::GetExtension($paths[0]) -match '^\.(png|jpe?g|gif|bmp|tiff?)$') {
            if ((Get-Item -LiteralPath $paths[0]).Length -gt 10MB) { throw 'Image exceeds 10 MB.' }
            $image = [System.Drawing.Image]::FromFile($paths[0])
        }
    }
    if ($null -ne $image) {
        $stream = New-Object System.IO.MemoryStream
        try {
            $image.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
            if ($stream.Length -gt 10MB) { throw 'Image exceeds 10 MB.' }
            $result = @{ kind = 'image'; data = [Convert]::ToBase64String($stream.ToArray()) }
        } finally { $stream.Dispose(); $image.Dispose() }
    } elseif ([System.Windows.Forms.Clipboard]::ContainsText()) {
        $result = @{ kind = 'text'; text = [System.Windows.Forms.Clipboard]::GetText() }
    } else { $result = @{ kind = 'empty' } }
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    [Console]::Write(($result | ConvertTo-Json -Compress))
} catch { [Console]::Error.WriteLine('Clipboard unavailable or image unreadable: ' + $_.Exception.Message); exit 1 }
