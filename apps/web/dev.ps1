$env:PORT = "5173"
$env:BASE_PATH = "/"
# Dev: aponta ao backend local. Em producao o bundle usa URLs same-origin
# (sem VITE_API_URL), por isso funciona em qualquer dominio/host Render.
$env:VITE_API_URL = "http://localhost:3000"
# Corre a partir de apps/web. O path anterior estava fixo para outra maquina e
# outro projecto (.../Solve-Corporate-CRM/artifacts/solve-crm) e nao existia.
Push-Location $PSScriptRoot
try {
  pnpm dev
} finally {
  Pop-Location
}
