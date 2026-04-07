# Finança API

API REST de finanças pessoais. Node.js + Express + PostgreSQL (pg, sem ORM). Deploy no Railway.

## Stack
- Runtime: Node.js | Framework: Express | Banco: PostgreSQL via `pg`
- Auth: JWT + bcryptjs | Hospedagem: Railway

## Estrutura de módulos
Cada módulo em `src/modules/` tem: `*.routes.js` → `*.controller.js` → `*.service.js`
Controllers: só req/res. Services: toda lógica e queries SQL.

## Resposta padrão
`{ data }` para sucesso, `{ message }` para erros e operações sem retorno.

## Regras críticas
- `user_id` vem SEMPRE de `req.user.id`, nunca do body
- Usuário demo (`is_demo: true`) não pode fazer POST/PUT/DELETE/PATCH
- Nunca usar ORM, query builder ou tabela de meses

## Referências
- Schema completo: @db/db.sql
- Visão geral do projeto: @README.md