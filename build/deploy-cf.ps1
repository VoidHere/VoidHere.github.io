# Deploy dist/ to Cloudflare Pages (direct upload) without Node or wrangler.
#
# Implements Cloudflare's Pages direct-upload protocol:
#   1. request an upload JWT for the project
#   2. upload file contents as content-addressed assets (wrangler's blake3 key + base64)
#   3. register the hashes (upsert-hashes)
#   4. create the deployment from a path -> hash manifest (multipart/form-data)
#
# The asset key must match wrangler exactly or Pages stores nothing it will
# serve — see build/asset-hashes.py. Needs python + the blake3 package
# (local copy in the gitignored test-assets/pylib):
#   python -m pip install --target test-assets/pylib blake3
#
# Usage:
#   powershell -File build\deploy-cf.ps1
#
# Token: taken from $env:CLOUDFLARE_API_TOKEN, or from the gitignored
# test-assets\cf_token.txt next to the repo root.
param(
    [string]$AccountId = "23dfac4adb6119aca1782946d1a5f757",
    [string]$Project   = "digitpdf",
    [string]$DistDir   = (Join-Path $PSScriptRoot "..\dist"),
    [int]   $BatchBytes = 5000000
)
$ErrorActionPreference = "Stop"
$api = "https://api.cloudflare.com/client/v4"

function ConvertTo-AssetJson($items) {
    # {"key":..,"value":..,"metadata":{"contentType":..},"base64":true} — built by hand:
    # PS 5.1 ConvertTo-Json cannot serialize these ordered maps.
    $parts = foreach ($f in $items) {
        '{"key":"' + $f.Hash + '","value":"' + $f.B64 + '","metadata":{"contentType":"' + $f.CT + '"},"base64":true}'
    }
    "[" + ($parts -join ",") + "]"
}

function Get-Mime([string]$p) {
    switch ([System.IO.Path]::GetExtension($p).ToLowerInvariant()) {
        ".html"      { "text/html" }
        ".css"       { "text/css" }
        ".js"        { "text/javascript" }
        ".mjs"       { "text/javascript" }
        ".json"      { "application/json" }
        ".map"       { "application/json" }
        ".svg"       { "image/svg+xml" }
        ".png"       { "image/png" }
        ".jpg"       { "image/jpeg" }
        ".jpeg"      { "image/jpeg" }
        ".webp"      { "image/webp" }
        ".avif"      { "image/avif" }
        ".gif"       { "image/gif" }
        ".ico"       { "image/x-icon" }
        ".txt"       { "text/plain" }
        ".xml"       { "application/xml" }
        ".webmanifest" { "application/manifest+json" }
        ".woff2"     { "font/woff2" }
        ".woff"      { "font/woff" }
        ".ttf"       { "font/ttf" }
        ".wasm"      { "application/wasm" }
        ".pdf"       { "application/pdf" }
        default      { "application/octet-stream" }
    }
}

# --- token ---
$token = $env:CLOUDFLARE_API_TOKEN
if (-not $token) {
    $tf = Join-Path $PSScriptRoot "..\test-assets\cf_token.txt"
    if (Test-Path $tf) { $token = (Get-Content $tf -Raw).Trim() }
}
if (-not $token) { throw "No API token (set CLOUDFLARE_API_TOKEN or create test-assets/cf_token.txt)" }
$auth = @{ Authorization = "Bearer $token" }

if (-not (Test-Path $DistDir)) { throw "dist folder not found: $DistDir - run build\package-cf.sh first" }
$root = (Resolve-Path $DistDir).Path

# --- collect files (hash scheme must match wrangler; see asset-hashes.py) ---
$env:PYTHONPATH = (Join-Path $PSScriptRoot "..\test-assets\pylib")
try {
    $hashJson = (& python (Join-Path $PSScriptRoot "asset-hashes.py") $root 2>&1) -join ""
} catch {
    throw "python is required for asset hashing: $_"
}
if ($LASTEXITCODE -ne 0 -or -not $hashJson) { throw "asset-hashes.py failed: $hashJson" }
$hashMap = @{}
($hashJson | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $hashMap[$_.Name] = $_.Value }

$files = @(Get-ChildItem -Path $root -Recurse -File | ForEach-Object {
    $rel = "/" + $_.FullName.Substring($root.Length).TrimStart('\').Replace('\', '/')
    $hash = $hashMap[$rel]
    if (-not $hash) { throw "no hash computed for $rel" }
    [pscustomobject]@{
        Rel  = $rel
        Hash = $hash
        B64  = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($_.FullName))
        CT   = Get-Mime $rel
    }
})
Write-Host "files: $($files.Count)"

function Get-UploadJwt {
    $r = Invoke-RestMethod -Method Get -Uri "$api/accounts/$AccountId/pages/projects/$Project/upload-token" -Headers $auth
    if (-not $r.success) { throw "upload-token request failed" }
    $r.result.jwt
}

function Upload-Assets($items) {
    $json  = ConvertTo-AssetJson $items
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            $resp = Invoke-RestMethod -Method Post -Uri "$api/pages/assets/upload" `
                -Headers @{ Authorization = "Bearer $(Get-UploadJwt)" } `
                -ContentType "application/json" -Body $bytes -TimeoutSec 600
            if ($resp.success) { return }
            $msg = $resp | ConvertTo-Json -Depth 6 -Compress
        } catch {
            $msg = $_.Exception.Message
            if ($_.ErrorDetails) { $msg += " | " + $_.ErrorDetails.Message }
        }
        Write-Host "  attempt $attempt failed: $msg"
        Start-Sleep -Seconds 5
    }
    throw "asset upload failed after retries"
}

# --- figure out which assets the store already has (wrangler's check-missing) ---
$allHashes = @($files | ForEach-Object { $_.Hash } | Select-Object -Unique)
$cmBody = '{"hashes":["' + ($allHashes -join '","') + '"]}'
$cm = Invoke-RestMethod -Method Post -Uri "$api/pages/assets/check-missing" `
    -Headers @{ Authorization = "Bearer $(Get-UploadJwt)" } `
    -ContentType "application/json" -Body ([System.Text.Encoding]::UTF8.GetBytes($cmBody)) -TimeoutSec 120
if (-not $cm.success) { throw "check-missing failed" }
$missing = @($cm.result)

# --- upload the missing unique assets in batches ---
$unique = @($files | Group-Object Hash | ForEach-Object { $_.Group[0] } | Where-Object { $missing -contains $_.Hash })
Write-Host "assets: $($allHashes.Count) total, $($unique.Count) to upload"

$batch = New-Object System.Collections.Generic.List[object]
$batchBytes = 0
$uploadsDone = 0
foreach ($f in $unique) {
    $item = [pscustomobject]@{ Hash = $f.Hash; B64 = $f.B64; CT = $f.CT }
    $sz = $f.B64.Length + 200
    if (($batchBytes + $sz) -gt $BatchBytes -and $batch.Count -gt 0) {
        Upload-Assets $batch
        $uploadsDone += $batch.Count
        Write-Host "  uploaded $uploadsDone / $($unique.Count)"
        $batch.Clear(); $batchBytes = 0
    }
    $batch.Add($item); $batchBytes += $sz
}
if ($batch.Count -gt 0) {
    Upload-Assets $batch
    $uploadsDone += $batch.Count
}
Write-Host "assets uploaded: $uploadsDone"

# --- register hashes ---
$hbody = '{"hashes":["' + ($allHashes -join '","') + '"]}'
try {
    $resp = Invoke-RestMethod -Method Post -Uri "$api/pages/assets/upsert-hashes" `
        -Headers @{ Authorization = "Bearer $(Get-UploadJwt)" } `
        -ContentType "application/json" -Body ([System.Text.Encoding]::UTF8.GetBytes($hbody)) -TimeoutSec 120
} catch {
    $msg = $_.Exception.Message
    if ($_.ErrorDetails) { $msg += " | " + $_.ErrorDetails.Message }
    throw "upsert-hashes failed: $msg"
}
if (-not $resp.success) { throw "upsert-hashes failed" }
Write-Host "hashes registered"

# --- manifest + deployment ---
$mparts = foreach ($f in $files) { '"' + $f.Rel + '":"' + $f.Hash + '"' }
$manifestJson = "{" + ($mparts -join ",") + "}"

$boundary = "----digitpdf" + [guid]::NewGuid().ToString("N")
$sb = New-Object System.Text.StringBuilder
[void]$sb.Append("--$boundary`r`n")
[void]$sb.Append("Content-Disposition: form-data; name=`"manifest`"`r`n")
[void]$sb.Append("Content-Type: application/json`r`n`r`n")
[void]$sb.Append($manifestJson)
[void]$sb.Append("`r`n--$boundary`r`n")
[void]$sb.Append("Content-Disposition: form-data; name=`"branch`"`r`n`r`n")
[void]$sb.Append("main`r`n")
[void]$sb.Append("--$boundary--`r`n")
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($sb.ToString())

Write-Host "creating deployment..."
$dep = Invoke-RestMethod -Method Post -Uri "$api/accounts/$AccountId/pages/projects/$Project/deployments" `
    -Headers $auth -ContentType "multipart/form-data; boundary=$boundary" -Body $bodyBytes -TimeoutSec 600
if (-not $dep.success) { throw "deployment failed: $($dep | ConvertTo-Json -Depth 6 -Compress)" }

$id = $dep.result.id
Write-Host "deployment: $($dep.result.short_id)  env=$($dep.result.environment)  url=$($dep.result.url)"

# --- wait for the deploy stage ---
$stage = $dep.result.latest_stage
for ($i = 0; $i -lt 40; $i++) {
    if ($stage.status -in @("success", "failure", "canceled")) { break }
    Start-Sleep -Seconds 3
    $d = Invoke-RestMethod -Method Get -Uri "$api/accounts/$AccountId/pages/projects/$Project/deployments/$id" -Headers $auth
    $stage = $d.result.latest_stage
}
Write-Host "stage: $($stage.name)/$($stage.status)"
if ($stage.status -ne "success") { throw "deployment stage did not succeed: $($stage | ConvertTo-Json -Compress)" }
Write-Host "done: https://$Project.pages.dev"
