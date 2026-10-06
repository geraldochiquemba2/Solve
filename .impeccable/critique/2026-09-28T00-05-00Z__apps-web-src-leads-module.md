# Critique — módulo de Leads (`/admin/leads`)

- **Data:** 2026-09-28
- **Âmbito:** alterações por confirmar em `apps/web/src/App.tsx` (coluna **Observações** editável + `LeadNotesCell`) e `apps/web/src/index.css` (`.stage-select`, `.cell-notes`).
- **Method:** dual-agent — A (heurísticas, `ses_f15efa1bb`) · B (detector + browser, `ses_f15cb020f`).
- **Ambiente:** preview local `http://localhost:5173` com API mock em `:4010`; zero pedidos à produção.

## Veredicto

| | |
|---|---|
| Heurísticas (10) | **17/40 — Poor** |
| Detector em `App.tsx` | `[]`, exit 0 |
| Detector em `index.css` | 14 achados, **nenhum no hunk** (`overused-font` ×10, `gradient-text` ×3, `codex-grid-background` ×1 — todos pré-existentes) |
| Erros de tipos | HEAD 15 · árvore 15 · conjuntos idênticos → **zero regressões** |
| Build | `vite build` ✓ (2219 módulos, 13,9 s) |

Heurísticas: Visibilidade do estado 1 · Sistema↔mundo 2 · Controlo 2 · Consistência 2 · Prevenção 1 · Reconhecer 3 · Flexibilidade 2 · Estética 1 · Recuperação 1 · Ajuda 2.

## Prioridades e estado

| | Problema | Estado |
|---|---|---|
| P0-1 | A coluna nova empurrou os botões de acção para fora da vista (tabela 1248,7 px num contentor de 1108 px) | **Corrigido** — `sticky-first` no `.table-wrap`; overflow 141 → 129 px; nome permanece visível ao percorrer (verificado por CDP) |
| P0-2 | Campo só de escrita: PATCH 500 deixava texto não persistido, sem feedback nem rollback | **Corrigido** — rollback para o valor do servidor, `aria-invalid`, borda destrutiva, selo `!` com `role="status"`, toast; selo `…`/`✓` no sucesso |
| P1-3 | Escape não cancelava (o blur seguinte gravava o rascunho); Enter deitava o foco fora | **Corrigido** — Escape repõe e sai com guarda; Enter guarda e desce para a linha seguinte |
| P1-4 | `.stage-select` com matéria de cartão (elevação + borda diferente) e 27,2 px reservados para uma seta inexistente | **Corrigido** — matéria plana igual a `.input`/`.select`; seta SVG desenhada (`.select` + variante `.dark`) |
| P1-5 | Sem `scope="col"`, feedback, `title` do valor | **Corrigido** — 10 `th` com `scope="col"`, "Acções" em `sr-only`, `title` no campo |
| P2 | A nota só existe dentro da caixa de 144 px; `LeadFicha` não mostra `lead.notes`; `LeadModal` não tem campo de notas | **Em aberto** (recomendação) |
| P2 | Espaços a mais deixavam a célula suja sem PATCH | **Corrigido** — normaliza no blur |
| P2 | Foco sem indicador (leitura inicial) | **Falso positivo retido** — o anel existe (outline 2 px + `box-shadow`), confirmado por Tab real e contagem de píxeis |

## Causa raiz adicional (descoberta na verificação)

`CRM` usava `<Route path="/admin/leads" component={() => <LeadsPage … />} />`. O wouter faz `createElement(component, params)` e uma arrow function inline é um **tipo novo a cada render** de `CRM` → o `LeadsPage` inteiro era desmontado e remontado a cada refetch da lista (inclusive o que a própria gravação dispara). Efeitos: o estado de gravação desaparecia, a guarda `aEditar` ficava powerless, o scroll da tabela e o foco perdiam-se, e um modal aberto fechava sozinho. Corrigido para `<Route path="/admin/leads"><LeadsPage … /></Route>` (children = elemento de tipo estável).

**Mesma armadilha, por corrigir, noutras rotas de `/admin`:** `/admin` (Dashboard), `/admin/pipeline`, `/admin/clientes`, `/admin/clientes/:id` — idêntica linha, idêntico defeito.

## Não verificado

- Contraste do `::placeholder` (3,54:1) é default do UA, **app-wide** — a caixa de pesquisa pré-existente calcula o mesmo. Defeito de `::placeholder` global ausente, não deste diff.
- Tema escuro e larguras intermédias (700 px, 1440 px) não foram renderizados.
- Listas de `<option>` nativas: a cor é pintada pelo UA, não exposta a `getComputedStyle`.
- Toque/ponteiro reais; só o caminho de teclado foi exercitado.
