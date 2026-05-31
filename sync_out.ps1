[CmdletBinding()]
param(
    [switch]$Execute,
    [switch]$SkipBuild,
    [string]$RemoteHost,
    [string]$RemotePath
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$localOut = Join-Path $repoRoot "out"
$localConfig = Join-Path $repoRoot "sync_out.local.ps1"

if (Test-Path -LiteralPath $localConfig) {
    . $localConfig
}

if (-not $RemoteHost -or -not $RemotePath) {
    throw "同期先が未設定です。sync_out.local.ps1 を作成するか、-RemoteHost と -RemotePath を指定してください。"
}

if (-not $SkipBuild) {
    & (Join-Path $repoRoot "build_out.ps1")
}

if (-not (Test-Path -LiteralPath $localOut)) {
    throw "out フォルダが見つかりません: $localOut"
}

$rsync = Get-Command rsync -ErrorAction SilentlyContinue
$ssh = Get-Command ssh -ErrorAction SilentlyContinue
$scp = Get-Command scp -ErrorAction SilentlyContinue

$modeLabel = if ($Execute) { "LIVE SYNC" } else { "DRY RUN" }
Write-Host "[$modeLabel] $localOut -> ${RemoteHost}:$RemotePath"

if ($rsync) {
    $arguments = @(
        "-avz",
        "--delete",
        "--human-readable"
    )

    if (-not $Execute) {
        $arguments += "--dry-run"
        $arguments += "--itemize-changes"
    }

    $arguments += "$($localOut.Replace('\', '/'))/"
    $arguments += "${RemoteHost}:$RemotePath/"

    & $rsync.Source @arguments
} else {
    if (-not $ssh -or -not $scp) {
        throw "rsync も scp/ssh も見つかりません。転送手段を追加してください。"
    }

    $items = Get-ChildItem -LiteralPath $localOut
    if ($items.Count -eq 0) {
        Write-Host "out フォルダは空です。"
        exit 0
    }

    Write-Host "[scp fallback] remote files are uploaded, but obsolete remote files are not deleted."

    if (-not $Execute) {
        Write-Host "Preview:"
        foreach ($item in $items) {
            Write-Host "  upload $($item.FullName) -> ${RemoteHost}:$RemotePath/"
        }
        Write-Host "  then chmod 755 for directories and 644 for files under $RemotePath"
    } else {
        & $ssh.Source $RemoteHost "mkdir -p '$RemotePath'"
        foreach ($item in $items) {
            & $scp.Source "-r" $item.FullName "${RemoteHost}:$RemotePath/"
        }
        & $ssh.Source $RemoteHost "find '$RemotePath' -type d -exec chmod 755 {} + && find '$RemotePath' -type f -exec chmod 644 {} +"
    }
}

if (-not $Execute) {
    Write-Host ""
    Write-Host "dry-run only です。実際に同期するには: .\sync_out.ps1 -Execute"
}
