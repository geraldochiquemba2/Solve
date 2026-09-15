# Acesso físico / Solve Access (catraca)

## Tempo real (`/admin/acesso-fisico`)
Métricas (ativos, terminais, acessos hoje), Live/Offline via SSE, tabelas
Entradas/Saídas com filtros, pico por hora, clientes dentro agora, libertar
catraca (Entrada/Saída), estado do terminal (`192.168.1.182:8080`, ZKTeco).

## Direção dos dados (importante)
- **Sobe** (ginásio → nuvem): `pg_sync.py` (direto), `sync_crm.py`
  (`POST /api/v1/access/sync`), `sync_ovg.py` (sócios OVG). Automático no PC.
- **Desce**: só comandos (`GET /api/edge/comandos`, fila hoje em memória) e
  desbloqueio remoto. **Mudar o Neon não muda a catraca** — a catraca lê a BD
  local/ZKTeco e a OVG.
- **Meia-noite**: `online=true` sem movimento hoje faz checkout automático.

## Sócios vs funcionários
Automático: nome completo + ≤3 entradas/dia = sócio; o resto (e `*_del`) é
ocultado em todo o CRM. Para bloquear aluno: OVG/ZKTeco no PC (ou comando edge).

## PC do ginásio
Scripts no PC (fora deste repo): `pg_sync.py`, `sync_crm.py`, `sync_ovg.py`,
`edge_agent.py`; túnel Cloudflare (`iniciar-tunnel.cmd`) para acesso remoto.
