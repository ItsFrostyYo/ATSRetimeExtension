[CmdletBinding()]
param(
  [ValidateSet("all", "chrome", "firefox")]
  [string]$Target = "all"
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$distRoot = Join-Path $projectRoot "dist"
$releaseRoot = Join-Path $projectRoot "release"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$targets = if ($Target -eq "all") { @("chrome", "firefox") } else { @($Target) }

function Merge-Objects {
  param(
    [Parameter(Mandatory)] [pscustomobject]$Base,
    [Parameter(Mandatory)] [pscustomobject]$Overlay
  )

  $result = $Base | ConvertTo-Json -Depth 100 | ConvertFrom-Json
  foreach ($property in $Overlay.PSObject.Properties) {
    $result | Add-Member -NotePropertyName $property.Name -NotePropertyValue $property.Value -Force
  }
  return $result
}

New-Item -ItemType Directory -Force -Path $distRoot, $releaseRoot | Out-Null
$baseManifest = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "manifest.base.json") | ConvertFrom-Json
$package = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "package.json") | ConvertFrom-Json
if ([string]$baseManifest.version -ne [string]$package.version) {
  throw "Version mismatch: manifest.base.json is $($baseManifest.version), package.json is $($package.version)."
}

foreach ($browser in $targets) {
  $targetRoot = Join-Path $distRoot $browser
  $resolvedDist = [IO.Path]::GetFullPath($distRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
  $resolvedTarget = [IO.Path]::GetFullPath($targetRoot)
  if (-not $resolvedTarget.StartsWith($resolvedDist + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to clean unexpected build path: $resolvedTarget"
  }

  if (Test-Path -LiteralPath $targetRoot) {
    Remove-Item -Recurse -Force -LiteralPath $targetRoot
  }
  New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null

  Copy-Item -Recurse -LiteralPath (Join-Path $projectRoot "src") -Destination $targetRoot
  Copy-Item -Recurse -LiteralPath (Join-Path $projectRoot "assets") -Destination $targetRoot

  $overlayPath = Join-Path $projectRoot "manifests\$browser.json"
  $overlay = Get-Content -Raw -LiteralPath $overlayPath | ConvertFrom-Json
  $manifest = Merge-Objects -Base $baseManifest -Overlay $overlay
  $manifestJson = $manifest | ConvertTo-Json -Depth 100
  [IO.File]::WriteAllText((Join-Path $targetRoot "manifest.json"), $manifestJson + [Environment]::NewLine, $utf8NoBom)

  $version = [string]$manifest.version
  $archivePath = Join-Path $releaseRoot "SNRetimeExtension-$browser-v$version.zip"
  if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -Force -LiteralPath $archivePath
  }
  Compress-Archive -Path (Join-Path $targetRoot "*") -DestinationPath $archivePath -CompressionLevel Optimal
  Write-Host "Built $browser release: $archivePath"
}
