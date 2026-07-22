param(
    [string]$HermesRoot = (Join-Path $env:LOCALAPPDATA 'hermes')
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$source = Join-Path $projectRoot 'integrations\hermes\syka-world-observer'
$hermesPython = Join-Path $HermesRoot 'hermes-agent\venv\Scripts\python.exe'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$profiles = [ordered]@{
    default  = $HermesRoot
    elen     = Join-Path $HermesRoot 'profiles\elen'
    astrelis = Join-Path $HermesRoot 'profiles\astrelis'
    zerny    = Join-Path $HermesRoot 'profiles\zerny'
}

$oldHermesHome = $env:HERMES_HOME
$oldProfile = $env:HERMES_PROFILE
try {
    if (-not (Test-Path -LiteralPath $hermesPython)) {
        throw "Hermes Python runtime not found: $hermesPython"
    }

    foreach ($entry in $profiles.GetEnumerator()) {
        $profileName = $entry.Key
        $profileHome = $entry.Value
        if (-not (Test-Path -LiteralPath $profileHome)) {
            throw "Hermes profile home not found: $profileHome"
        }

        $config = Join-Path $profileHome 'config.yaml'
        if (Test-Path -LiteralPath $config) {
            Copy-Item -LiteralPath $config -Destination "$config.bak-syka-world-$stamp"
        }

        $destination = Join-Path $profileHome 'plugins\syka-world-observer'
        New-Item -ItemType Directory -Path $destination -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $source 'plugin.yaml') -Destination $destination -Force
        Copy-Item -LiteralPath (Join-Path $source '__init__.py') -Destination $destination -Force

        # Use the exact runtime owned by Hermes Desktop and name the profile
        # explicitly. Relying on a global `hermes` command can target another
        # installation and left the special `default` profile disabled.
        Remove-Item Env:HERMES_HOME -ErrorAction SilentlyContinue
        Remove-Item Env:HERMES_PROFILE -ErrorAction SilentlyContinue
        & $hermesPython -m hermes_cli.main --profile $profileName plugins enable syka-world-observer --no-allow-tool-override
        if ($LASTEXITCODE -ne 0) {
            throw "Could not enable observer for profile $profileName"
        }
    }
}
finally {
    $env:HERMES_HOME = $oldHermesHome
    if ($null -eq $oldProfile) {
        Remove-Item Env:HERMES_PROFILE -ErrorAction SilentlyContinue
    }
    else {
        $env:HERMES_PROFILE = $oldProfile
    }
}

Write-Host 'Syka World observer installed and enabled for all four profiles.'
Write-Host 'Already-running Hermes backends will load it on their next restart.'
