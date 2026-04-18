param(
  [Parameter(Position = 0)]
  [string]$Action = "manual",

  [Parameter(Position = 1)]
  [string]$FunctionName = "",

  [Parameter(Position = 2)]
  [string]$EnvFile = "supabase/functions/.env.local"
)

$ErrorActionPreference = "Stop"

$knownFunctions = @(
  "teacher-admin-actions",
  "automation-dispatch",
  "integration-webhook",
  "secure-ops"
)

function Get-SupabaseCliCommand {
  $localCli = Join-Path $PSScriptRoot "..\node_modules\.bin\supabase.cmd"
  if (Test-Path $localCli) {
    return @{
      FilePath = $localCli
      Prefix = @()
    }
  }

  $npx = Get-Command npx.cmd -ErrorAction SilentlyContinue
  if ($npx) {
    return @{
      FilePath = $npx.Source
      Prefix = @("supabase")
    }
  }

  throw "Supabase CLI nao encontrado. Rode 'npm install --save-dev supabase' ou use Node.js com npx habilitado."
}

function Invoke-SupabaseCli {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  $cli = Get-SupabaseCliCommand
  & $cli.FilePath @($cli.Prefix + $Arguments)
}

function Assert-FunctionName {
  param([string]$Name)

  if ([string]::IsNullOrWhiteSpace($Name)) {
    throw "Informe o nome da function."
  }

  if ($knownFunctions -notcontains $Name) {
    throw "Function invalida: $Name. Opcoes: $($knownFunctions -join ', ')"
  }
}

function Show-Manual {
  Write-Host ""
  Write-Host "Manual minimo na Supabase:" -ForegroundColor Cyan
  Write-Host "1. Instale o Supabase CLI e faca login." -ForegroundColor Yellow
  Write-Host "2. Rode 'supabase link --project-ref <SEU_PROJECT_REF>' na raiz do projeto." -ForegroundColor Yellow
  Write-Host "3. Configure os secrets usados pelas functions." -ForegroundColor Yellow
  Write-Host "4. Rode os scripts de deploy abaixo." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Comandos ja preparados no projeto:" -ForegroundColor Cyan
  Write-Host "npm run supabase:functions:check"
  Write-Host "npm run supabase:functions:deploy:teacher-admin"
  Write-Host "npm run supabase:functions:deploy:automation"
  Write-Host "npm run supabase:functions:deploy:webhook"
  Write-Host "npm run supabase:functions:deploy:secure-ops"
  Write-Host "npm run supabase:functions:deploy:all"
  Write-Host ""
  Write-Host "Secrets esperados:" -ForegroundColor Cyan
  Write-Host "SUPABASE_URL"
  Write-Host "SUPABASE_ANON_KEY"
  Write-Host "SUPABASE_SERVICE_ROLE_KEY"
  Write-Host "INTERNAL_AUTOMATION_SECRET"
  Write-Host "INTEGRATION_WEBHOOK_SECRET"
  Write-Host "SECURE_OPS_SECRET"
  Write-Host ""
}

switch ($Action) {
  "check" {
    Invoke-SupabaseCli --version
    break
  }

  "serve" {
    Assert-FunctionName -Name $FunctionName

    if (-not (Test-Path $EnvFile)) {
      throw "Arquivo de env nao encontrado: $EnvFile"
    }

    Invoke-SupabaseCli functions serve $FunctionName --env-file $EnvFile
    break
  }

  "deploy" {
    Assert-FunctionName -Name $FunctionName
    Invoke-SupabaseCli functions deploy $FunctionName
    break
  }

  "deploy-all" {
    foreach ($name in $knownFunctions) {
      Write-Host "Deployando $name ..." -ForegroundColor Cyan
      Invoke-SupabaseCli functions deploy $name
    }
    break
  }

  "manual" {
    Show-Manual
    break
  }

  default {
    throw "Acao invalida: $Action. Use check, serve, deploy, deploy-all ou manual."
  }
}
