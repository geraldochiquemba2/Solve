# WhatsApp — estado e o que falta

## Hoje
- No CRM: cartão "WhatsApp · SamoraFit" em Integrações (estado `inativo` —
  o servidor de produção ainda não tem rotas WhatsApp).
- Código parcial só no `api-server` TS (não vai a produção): `send-text`,
  `send-template`, webhook recetor, `lib/whatsapp.ts`.
- Marca pronta: `WHATSAPP_DISPLAY_NAME=SAMORAFIT`.
- Guia de registo Meta entregue ao cliente em
  `Desktop/WhatsApp-SamoraFit-Instrucoes.txt` (2 formas: migrar número ou novo).

## Falta (quando chegarem as credenciais Meta)
1. `WHATSAPP_TOKEN` (sistema), `WHATSAPP_PHONE_NUMBER_ID`, verify token.
2. Portar para `standalone-server`: health, send-text/template, webhook
   GET (verificação) + POST, tabela `whatsapp_messages`.
3. Display name `SamoraFit` no perfil Meta.
4. Template(s) aprovado(s) + envio automático ao gerar cobrança.

## SMS (canal separado)
SMS verdadeiro exige outro provedor (Vonage/Africa's Talking/agregador local)
— nada existe hoje para isso.
