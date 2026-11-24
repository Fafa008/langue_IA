param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("up", "dev", "down", "test", "test-ia", "check", "seed", "reset", "doctor")]
    [string]$Task,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ExtraArgs
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $Root

function Invoke-Compose {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [switch]$Production
    )

    $ComposeFiles = @("-f", "docker-compose.yml")
    if (-not $Production) {
        $ComposeFiles += @("-f", "docker-compose.dev.yml")
    }
    $AllArguments = $ComposeFiles + $Arguments
    & docker compose @AllArguments
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

try {
    switch ($Task) {
        "up" { Invoke-Compose -Production -Arguments @("up", "--build", "-d", "--wait") }
        "dev" { Invoke-Compose -Arguments @("up", "--build") }
        "down" { Invoke-Compose -Arguments @("down") }
        "test" { Invoke-Compose -Arguments (@("run", "--build", "--rm", "backend", "pytest") + $ExtraArgs) }
        "test-ia" { Invoke-Compose -Arguments (@("run", "--build", "--rm", "--no-deps", "ia-service", "pytest", "-p", "no:cacheprovider") + $ExtraArgs) }
        "check" {
            Invoke-Compose -Arguments @("run", "--build", "--rm", "-e", "RUFF_NO_CACHE=true", "backend", "sh", "-c", "ruff check . && ruff format --check . && pytest -q --cov=app --cov-fail-under=70")
            Invoke-Compose -Arguments @("run", "--build", "--rm", "--no-deps", "-e", "RUFF_NO_CACHE=true", "ia-service", "sh", "-c", "ruff check . && ruff format --check . && pytest -q -p no:cacheprovider --cov=app --cov-fail-under=70")
            Invoke-Compose -Arguments @("run", "--build", "--rm", "--no-deps", "frontend", "npm", "run", "check")
        }
        "seed" { Invoke-Compose -Arguments @("exec", "backend", "python", "-m", "app.seed") }
        "reset" { Invoke-Compose -Arguments @("down", "--volumes") }
        "doctor" {
            $Python = Get-Command python -ErrorAction SilentlyContinue
            if (-not $Python) { $Python = Get-Command py -ErrorAction SilentlyContinue }
            if (-not $Python) {
                Write-Error "Python est nécessaire pour lancer doctor. Installez Python 3.11."
                exit 1
            }
            & $Python.Source scripts/doctor.py
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
    }
}
finally {
    Pop-Location
}
