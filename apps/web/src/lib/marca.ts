// Modo Solve escondido: ativa uma única vez via ?marca=solve e dura até ao
// refresh (o parâmetro é apagado do URL ao abrir). Partilhado entre o CRM
// (App.tsx) e o login (landing/Login.tsx) sem dependências circulares.
export let solveAtivo = false;
try {
  if (new URLSearchParams(window.location.search).get('marca') === 'solve') solveAtivo = true;
} catch {
  /* sem browser / sem query: modo SamoraFit */
}
