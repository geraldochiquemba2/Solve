$env:PORT = "5173"
$env:BASE_PATH = "/"
$env:VITE_API_URL = "https://solve-sqoh.onrender.com"
$env:VITE_ACCESS_API_URL = "https://solve-sqoh.onrender.com"
# Configurar localmente via variável de ambiente (nunca commitar valor real)
$env:VITE_ACCESS_API_KEY = ""
cd "C:\Users\Geraldo\Downloads\Solve-Corporate-CRM\Solve-Corporate-CRM\artifacts\solve-crm"
pnpm dev
