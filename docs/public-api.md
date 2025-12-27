# Public API (Integrações) — NossoCRM

Este documento é o guia **humano** de integração (produto em primeiro lugar).  
O contrato técnico completo está no OpenAPI:

- `GET /api/public/v1/openapi.json`

## Conceitos

- **API Key**: gerada na interface (Settings → Integrações → API). Cada chave dá acesso à **sua organização** (single-tenant).
- **Board**: seu pipeline/funil (ex.: “Vendas”, “Onboarding”).
- **Board Key (slug)**: identificador simples e estável (ex.: `vendas-b2b`) para integrar sem depender de UUID.

## Autenticação

Todas as chamadas usam:

- Header: `X-Api-Key: <sua-chave>`

## Como identificar um Board (sem listar “pra sempre”)

Fluxo recomendado:

1) Abra o CRM e copie a **Chave do board (slug)** no modal de editar/criar board.
2) Na integração, use essa `board_key` para buscar etapas e criar/mover deals.

## Erros (padrão)

O padrão de erro é:

```json
{ "error": "mensagem", "code": "CODIGO_OPCIONAL" }
```

## Paginação (padrão)

Listagens retornam:

```json
{ "data": [], "nextCursor": "..." }
```

