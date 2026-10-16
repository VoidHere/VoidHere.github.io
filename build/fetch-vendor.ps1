# fetch-vendor.ps1 â€” downloads third-party libraries and fonts into vendor/
# Run from the digitpdf folder:  powershell -ExecutionPolicy Bypass -File build\fetch-vendor.ps1
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$vendor = Join-Path $root "vendor"
$fontsDir = Join-Path $vendor "fonts"
New-Item -ItemType Directory -Force -Path $vendor, $fontsDir | Out-Null

$libs = @(
  @{ u = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";              f = "pdf-lib.min.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";            f = "pdf.min.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";     f = "pdf.worker.min.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";                  f = "jszip.min.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js";                       f = "fflate.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js";                f = "qrcode.min.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";                         f = "jsQR.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js";      f = "JsBarcode.all.min.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";               f = "xlsx.full.min.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js";                     f = "marked.min.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/turndown@7.1.3/dist/turndown.js";                 f = "turndown.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/diff@5.2.0/dist/diff.min.js";                     f = "diff.min.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/piexifjs@1.0.6/piexif.js";                        f = "piexif.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";             f = "heic2any.min.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js";                              f = "UTIF.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js";                     f = "pako.min.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js";       f = "ffmpeg.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js";           f = "ffmpeg-util.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js";     f = "ffmpeg-core.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm";   f = "ffmpeg-core.wasm" },
  @{ u = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";        f = "tesseract.min.js" },
  @{ u = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js";           f = "tesseract.worker.min.js" },
  @{ u = "https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz";             f = "eng.traineddata.gz" }
)

$report = @()
foreach ($l in $libs) {
  $dest = Join-Path $vendor $l.f
  curl.exe -L -s --fail -o $dest $l.u 2>$null
  $ok = ($LASTEXITCODE -eq 0) -and (Test-Path $dest)
  $size = if ($ok) { (Get-Item $dest).Length } else { 0 }
  if (-not $ok -or $size -lt 500) { $report += "FAIL  $($l.f)"; if (Test-Path $dest) { Remove-Item $dest -Force } }
  else { $report += "ok    $($l.f)  ($([math]::Round($size/1KB)) KB)" }
}

# ---- fonts (variable, latin subset only â€” take the last @font-face block) ----
$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
$fontJobs = @(
  @{ css = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..900&display=swap"; out = "fraunces.woff2"; family = "Fraunces";    range = "300 900" },
  @{ css = "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap";                 out = "inter.woff2";    family = "Inter";       range = "100 900" },
  @{ css = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@100..800&display=swap";        out = "jetbrains-mono.woff2"; family = "JetBrains Mono"; range = "100 800" },
  @{ css = "https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&display=swap";                out = "caveat.woff2";   family = "Caveat";      range = "400 700" }
)
$faces = @()
foreach ($j in $fontJobs) {
  $css = curl.exe -s -A $ua $j.css 2>$null
  $m = [regex]::Matches($css, "url\((https://[^)]+\.woff2)\)")
  if ($m.Count -gt 0) {
    $url = $m[$m.Count - 1].Groups[1].Value
    $dest = Join-Path $fontsDir $j.out
    curl.exe -L -s --fail -o $dest $url 2>$null
    $size = if (Test-Path $dest) { (Get-Item $dest).Length } else { 0 }
    if ($size -gt 500) {
      $report += "ok    fonts/$($j.out)  ($([math]::Round($size/1KB)) KB)"
      $faces += @"
@font-face { font-family: "$($j.family)"; font-style: normal; font-weight: $($j.range); font-display: swap; src: url("./fonts/$($j.out)") format("woff2"); }
"@
    } else { $report += "FAIL  fonts/$($j.out)" }
  } else { $report += "FAIL  fonts/$($j.out) (css parse)" }
}
if ($faces.Count -gt 0) {
  $header = "/* Local fonts, latin subset. Generated by build/fetch-vendor.ps1 */`r`n"
  Set-Content -Path (Join-Path $fontsDir "fonts.css") -Value ($header + ($faces -join "`r`n")) -Encoding UTF8
  $report += "ok    fonts/fonts.css"
}

$report | ForEach-Object { Write-Output $_ }

