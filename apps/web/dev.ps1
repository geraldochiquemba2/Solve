$env:PORT = "5173"
$env:BASE_PATH = "/"
$env:VITE_API_URL = "https://solve-sqoh.onrender.com"
$env:VITE_ACCESS_API_URL = "https://solve-sqoh.onrender.com"
# Configurar localmente via variável de ambiente (nunca commitar valor real)
$env:VITE_ACCESS_API_KEY = ""
# Corre a partir de apps/web. O path anterior estava fixo para outra maquina e
# outro projecto (.../Solve-Corporate-CRM/artifacts/solve-crm) e nao existia.
Push-Location $PSScriptRoot
try {
  pnpm dev
} finally {
  Pop-Location
}
