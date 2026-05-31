param(
  [Parameter(Mandatory=$true)][string]$HostName,
  [Parameter(Mandatory=$true)][string]$User,
  [Parameter(Mandatory=$true)][string]$KeyPath,
  [string]$RemoteDir = "/opt/protocolito-proxy"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$archive = Join-Path $env:TEMP "protocolito-proxy.tar.gz"

Push-Location (Join-Path $root "server")
try {
  tar -czf $archive package.json src README.md .env.example
} finally {
  Pop-Location
}

ssh -i $KeyPath "$User@$HostName" "sudo mkdir -p $RemoteDir && sudo chown ${User}:${User} $RemoteDir"
scp -i $KeyPath $archive "$User@$HostName`:$RemoteDir/protocolito-proxy.tar.gz"
ssh -i $KeyPath "$User@$HostName" "cd $RemoteDir && tar -xzf protocolito-proxy.tar.gz && npm install --omit=dev && test -f .env || cp .env.example .env"

Write-Host "Uploaded proxy to $RemoteDir. Edit $RemoteDir/.env on the server, then create the systemd service."
