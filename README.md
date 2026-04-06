# 💰 Finança API

Backend da aplicação **Finança**, um gerenciador de finanças pessoais desenvolvido para uso próprio e como projeto de portfólio.

---

## 🎯 Objetivo

O projeto nasceu da necessidade de ter um controle financeiro pessoal acessível em qualquer lugar, com suporte a múltiplos usuários e uma experiência pensada para o dia a dia. A ideia é simples: registrar ganhos e gastos mensais, visualizar o saldo, e simular o impacto de novas compras ou parcelas no orçamento futuro.

---

## ✨ Funcionalidades

- **Configuração de salário** com cálculo automático de descontos (INSS, IRRF, VT, Plano de Saúde e outros)
- **Ganhos e despesas com duração** — qualquer lançamento tem uma data de início e uma duração em meses, eliminando a necessidade de recadastro mensal
- **Suporte a parcelamentos** — uma compra de 10x cadastrada em março aparece automaticamente nos 10 meses seguintes
- **Cartões de crédito** com lista própria de transações parceladas, exibindo o total do mês no dashboard
- **Emojis** em despesas, ganhos e transações para identificação visual rápida
- **Tela de simulação** — projeta o impacto de uma compra hipotética nos meses futuros, sem salvar nada no banco
- **Usuário demo** protegido — visitantes do portfólio podem explorar o app sem alterar dados reais

---

## 🗂️ Estrutura do Projeto

```
financa-api/
├── src/
│   ├── config/
│   │   └── database.js          # Conexão com PostgreSQL
│   ├── modules/
│   │   ├── auth/                # Login e autenticação JWT
│   │   ├── users/               # Dados do usuário logado
│   │   ├── salary/              # Configuração de salário e descontos
│   │   ├── incomes/             # Ganhos (salário, VR, renda extra)
│   │   ├── expenses/            # Despesas fixas e parceladas
│   │   ├── credit-cards/        # Cartões e transações
│   │   └── simulation/          # Projeção financeira hipotética
│   ├── middlewares/
│   │   ├── auth.middleware.js   # Verificação do JWT
│   │   └── demo.middleware.js   # Bloqueio de escrita no usuário demo
│   ├── utils/
│   │   └── monthFilter.js       # Helper de filtro por mês/ano
│   ├── app.js
│   └── server.js
├── db/
│   └── db.sql                   # Schema completo do banco
├── .env.example
└── package.json
```

---

## 🗄️ Banco de Dados

O banco utiliza **PostgreSQL** hospedado no Railway. O modelo foi projetado para ser simples e sem redundância: não existem tabelas de "meses" — cada lançamento tem `start_month`, `start_year` e `duration_months`, e é filtrado dinamicamente pela query.

**Tabelas:**

| Tabela | Descrição |
|---|---|
| `users` | Usuários da aplicação |
| `salary_config` | Configuração de salário bruto e descontos |
| `incomes` | Ganhos com duração (salário, VR, extras) |
| `expenses` | Despesas com duração (fixas, parceladas) |
| `credit_cards` | Cartões de crédito do usuário |
| `card_transactions` | Transações dos cartões com duração |

### Lógica de duração

Todo lançamento aparece em um mês se:

```
(start_year * 12 + start_month) <= (ano_alvo * 12 + mês_alvo)
AND
(start_year * 12 + start_month + duration_months - 1) >= (ano_alvo * 12 + mês_alvo)
```

Isso significa que `duration_months: 1` é pontual, `duration_months: 10` são 10 parcelas, e `duration_months: 999` é recorrente indefinidamente.

---

## 🔐 Autenticação

Autenticação via **JWT**. O sistema não possui tela de registro — os usuários são cadastrados diretamente no banco. Existem três perfis:

- **Usuário principal** — acesso total
- **Usuário da namorada** — acesso total aos próprios dados
- **Usuário demo** — acesso de leitura apenas; qualquer tentativa de escrita (POST, PUT, DELETE) retorna `403`

---

## 🚀 Stack

- **Runtime:** Node.js
- **Framework:** Express
- **Banco de dados:** PostgreSQL
- **Hospedagem:** Railway
- **Frontend:** React + Vercel *(repositório separado)*

---

## ⚙️ Variáveis de Ambiente

Copie o `.env.example` e preencha:

```env
PORT=3333
DATABASE_URL=postgresql://user:password@host:5432/financa
JWT_SECRET=sua_chave_secreta
JWT_EXPIRES_IN=7d
```

---

## 🏃 Rodando Localmente

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Rodar em produção
npm start
```

Certifique-se de ter um PostgreSQL rodando localmente ou apontar `DATABASE_URL` para o banco do Railway.

Para criar as tabelas, execute o script:

```bash
psql $DATABASE_URL -f db/db.sql
```