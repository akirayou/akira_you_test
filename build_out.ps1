[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    throw "npm コマンドが見つかりません。Node.js の利用可否を確認してください。"
}

& $npm.Source "run" "build" "--silent" | Write-Host
