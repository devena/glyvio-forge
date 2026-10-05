# Generates the plugin types (@types) with glyvio-dev-helper, using the .env next to this script.
# The .env is parsed, never executed. Values are passed to the helper as environment variables of
# this process only (removed at the end), so this works with every helper version.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Test-Path '.env')) { throw ".env not found in $PSScriptRoot (see .env.example)" }
if (-not ((Test-Path 'manifest.json') -and (Test-Path 'package.json'))) { throw 'Run it in the plugin root (manifest.json + package.json)' }

$vals = @{}
foreach ($raw in Get-Content '.env') {
  $line = $raw.Trim()
  if ($line -eq '' -or $line.StartsWith('#')) { continue }
  if ($line.StartsWith('export ')) { $line = $line.Substring(7).Trim() }
  $i = $line.IndexOf('=')
  if ($i -le 0) { continue }
  $k = $line.Substring(0, $i).Trim()
  $v = $line.Substring($i + 1).Trim()
  if ($v.Length -ge 2 -and (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'")))) { $v = $v.Substring(1, $v.Length - 2) }
  $vals[$k] = $v
}

$helper = if ($env:GLYVIO_DEV_HELPER) { $env:GLYVIO_DEV_HELPER } else { Join-Path $PSScriptRoot 'tools\glyvio-dev-helper.exe' }
if (-not (Test-Path $helper)) { throw "Helper not found: $helper (see the glyvio-onboarding skill)" }
if (-not $vals['G_USERNAME'] -or -not $vals['G_PASSWORD']) { throw 'Fill G_USERNAME and G_PASSWORD in .env' }

$names = @()
function Set-HelperVar([string]$name, [string]$value) {
  if ($value) { Set-Item -Path "Env:$name" -Value $value; $script:names += $name }
}
try {
  Set-HelperVar 'GLYVIO_USER' $vals['G_USERNAME']
  Set-HelperVar 'GLYVIO_PASSWORD' $vals['G_PASSWORD']
  Set-HelperVar 'GLYVIO_COMPANY_ID' $vals['G_COMPANY_ID']
  Set-HelperVar 'GLYVIO_URL_AUTH' (($vals['G_AUTH_URL'] + '') -replace '/+$', '')
  # G_APP_URL is the web app (browser) address and is NOT the API. Only an explicit G_API_URL overrides the API.
  Set-HelperVar 'GLYVIO_URL_APP' (($vals['G_API_URL'] + '') -replace '/+$', '')
  & $helper @args
  $code = $LASTEXITCODE
} finally {
  foreach ($n in $names) { Remove-Item -Path "Env:$n" -ErrorAction SilentlyContinue }
}
exit $code
