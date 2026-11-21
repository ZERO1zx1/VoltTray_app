# VoltTray Windows PowerShell CLI Installer
# Usage:
#   irm https://raw.githubusercontent.com/ZERO1zx1/VoltTray_app/main/scripts/install.ps1 | iex
param(
  [string]$Version = "latest",
  [switch]$Uninstall,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$Repo = "ZERO1zx1/VoltTray_app"
$InstallDir = Join-Path $env:LOCALAPPDATA "VoltTray"
$RunRegPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"

function Write-Log([string]$Message) {
  Write-Host "[volttray] $Message"
}

if ($Uninstall) {
  Write-Log "Removing VoltTray from $InstallDir..."
  if ($DryRun) {
    Write-Log "[dry-run] Would remove $InstallDir and HKCU Run entry 'VoltTray'."
    exit 0
  }
  if (Test-Path $InstallDir) {
    Remove-Item -Recurse -Force $InstallDir
  }
  if (Get-ItemProperty -Path $RunRegPath -Name "VoltTray" -ErrorAction SilentlyContinue) {
    Remove-ItemProperty -Path $RunRegPath -Name "VoltTray" -ErrorAction SilentlyContinue
  }
  Write-Log "VoltTray removed."
  exit 0
}

$ApiUrl = if ($Version -eq "latest") {
  "https://api.github.com/repos/$Repo/releases/latest"
} else {
  "https://api.github.com/repos/$Repo/releases/tags/$Version"
}

if ($DryRun) {
  Write-Log "[dry-run] Fetch release metadata from $ApiUrl"
  Write-Log "[dry-run] Download Windows installer (.exe or .msi) and execute silently."
  exit 0
}

Write-Log "Querying GitHub Releases ($Version)..."
$Headers = @{ "Accept" = "application/vnd.github+json"; "User-Agent" = "volttray-installer" }
try {
  $Release = Invoke-RestMethod -Uri $ApiUrl -Headers $Headers
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  if ($status -eq 404) {
    throw "No published GitHub Release found yet for '$Repo' ($Version). Publish a release tag (e.g. v1.0.0) first, or clone the repo and run 'npm run tauri:build'."
  }
  throw
}

$Asset = $Release.assets | Where-Object { $_.name -match "-setup\.exe$" } | Select-Object -First 1
if (-not $Asset) {
  $Asset = $Release.assets | Where-Object { $_.name -match "\.msi$" } | Select-Object -First 1
}
if (-not $Asset) {
  throw "No Windows installer (.exe or .msi) found in release '$Version'. Build locally with: npm run tauri:build"
}

$TempFile = Join-Path ([System.IO.Path]::GetTempPath()) $Asset.name
Write-Log "Downloading $($Asset.name)..."
Invoke-WebRequest -Uri $Asset.browser_download_url -OutFile $TempFile

try {
  if ($Asset.name.EndsWith(".msi")) {
    Write-Log "Running MSI installer..."
    Start-Process "msiexec.exe" -ArgumentList "/i `"$TempFile`" /passive" -Wait
  } else {
    Write-Log "Running setup installer..."
    Start-Process $TempFile -ArgumentList "/S" -Wait
  }
  Write-Log "VoltTray installation complete."
} finally {
  if (Test-Path $TempFile) {
    Remove-Item -Force $TempFile -ErrorAction SilentlyContinue
  }
}
