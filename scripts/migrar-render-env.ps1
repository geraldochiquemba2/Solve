# migrar-render-env.ps1
# Copia as variáveis de ambiente de um serviço Render (conta antiga) para outro
# serviço Render (conta nova), sem reescrever segredos à mão.
#
# Requisitos: Render CLI (instalar com: winget install render-cli  OU  npm i -g @render-inc/cli)
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\migrar-render-env.ps1 `
#       -OldServiceId srv-xxxx -NewServiceId srv-yyyy
#
# -OldServiceId / -NewServiceId aparecem no URL do dashboard Render:
#   https://dashboard.render.com/web/srv-xxxxxxxx
#
# Este script NÃO faz commit de nada. Só lê/envia variáveis via API do Render.

param(
  [Parameter(Mandatory = $true)] [string]$OldServiceId,
  [Parameter(Mandatory = $true)] [string]$NewServiceId
)

$ErrorActionPreference = "Stop"

# Variáveis que NÃO devem ser copiadas (geridas pelo Render ou específicas do host).
# RENDER_EXTERNAL_URL é injectada automaticamente e difere entre serviços.
$EXCLUIR = @("RENDER_EXTERNAL_URL", "RENDER", "RENDER_SERVICE_ID", "RENDER_INSTANCE_ID")

Write-Host "==> A verificar Render CLI..." -ForegroundColor Cyan
if (-not (Get-Command render -ErrorAction SilentlyContinue)) {
  Write-Host "Render CLI nao encontrado." -ForegroundColor Red
  Write-Host "Instala com um destes:" -ForegroundColor Yellow
  Write-Host "  winget install render-cli"
  Write-Host "  npm i -g @render-inc/cli"
  exit 1
}

Write-Host "==> A ler variaveis do servico ANTIGO ($OldServiceId)..." -ForegroundColor Cyan
$json = render services env list --service-id $OldServiceId --output json --confirm
if ($LASTEXITCODE -ne 0) {
  Write-Host "Falha a ler o servico antigo. Confirma o ID e que estás logado (render login)." -ForegroundColor Red
  exit 1
}
$envs = $json | ConvertFrom-Json

$aCopiar = @()
foreach ($e in $envs) {
  if ($EXCLUIR -contains $e.key) { continue }
  $aCopiar += $e
}

Write-Host ("==> {0} variaveis a copiar:" -f $aCopiar.Count) -ForegroundColor Cyan
$aCopiar | ForEach-Object { Write-Host ("   - {0}" -f $_.key) }

Write-Host "==> A aplicar no servico NOVO ($NewServiceId)..." -ForegroundColor Cyan
foreach ($e in $aCopiar) {
  $args = @("services", "env", "set", "$($e.key)=$($e.value)", "--service-id", $NewServiceId, "--confirm")
  render @args
  if ($LASTEXITCODE -ne 0) {
    Write-Host ("   [ERRO] {0}" -f $e.key) -ForegroundColor Red
  } else {
    Write-Host ("   [ok] {0}" -f $e.key) -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "==> Concluido. O Render reinicia o servico sozinho ao mudar env." -ForegroundColor Green
Write-Host "    Verifica em: https://dashboard.render.com/web/$NewServiceId" -ForegroundColor Green
Write-Host ""
Write-Host "Lembretes:" -ForegroundColor Yellow
Write-Host "  1. Nova conta tem novo host -> atualizar segredos da edge function Supabase:"
Write-Host "     supabase secrets set CRM_API_URL=https://<novo-host> CRM_API_KEY=<API_KEY> --project-ref fslrkrhuatzfqxbzilnd"
Write-Host "  2. Atualizar o <script src> do pay-widget.js na Cademi para o novo host."
Write-Host "  3. POR O SERVICO ANTIGO EM SUSPEND antes do novo ficar Live (evita jobs/webhooks duplicados)."
