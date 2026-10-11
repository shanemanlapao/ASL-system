Add-Type -AssemblyName System.Drawing

$src = "C:\Users\Radny\.gemini\antigravity\brain\6187107e-679c-497a-af44-ebe206031b08\brightpath_book_solid_1791709339652.jpg"
$bytes = [System.IO.File]::ReadAllBytes($src)
$ms = New-Object System.IO.MemoryStream(,$bytes)
$img = [System.Drawing.Image]::FromStream($ms)

$targets = @(
    "assets/images/brightpath-logo.png",
    "assets/images/icon.png",
    "assets/images/android-icon-foreground.png",
    "assets/images/splash-icon.png",
    "assets/images/favicon.png"
)

foreach ($target in $targets) {
    $fullPath = (Resolve-Path $target).Path
    $outMs = New-Object System.IO.MemoryStream
    $img.Save($outMs, [System.Drawing.Imaging.ImageFormat]::Png)
    [System.IO.File]::WriteAllBytes($fullPath, $outMs.ToArray())
    $outMs.Dispose()
    Write-Host "Updated $target to new book logo (genuine PNG)"
}

$img.Dispose()
$ms.Dispose()
