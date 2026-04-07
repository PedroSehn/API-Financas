# Skill: Database

## Lógica de duração (CRÍTICO)
expenses, incomes e card_transactions NÃO usam month_id.
Usam start_month, start_year e duration_months.

Filtro de mês obrigatório:
```sql
(start_year * 12 + start_month) <= ($ano * 12 + $mes)
AND (start_year * 12 + start_month + duration_months - 1) >= ($ano * 12 + $mes)
```

Helper disponível em: src/utils/monthFilter.js

## Total do cartão por mês
```sql
SELECT cc.id, cc.name, cc.emoji, cc.color,
  COALESCE(SUM(ct.value), 0) AS total
FROM credit_cards cc
LEFT JOIN card_transactions ct
  ON ct.credit_card_id = cc.id
  AND (ct.start_year * 12 + ct.start_month) <= ($1 * 12 + $2)
  AND (ct.start_year * 12 + ct.start_month + ct.duration_months - 1) >= ($1 * 12 + $2)
WHERE cc.user_id = $3
GROUP BY cc.id, cc.name, cc.emoji, cc.color;
```

## Padrão de query
```js
const { rows } = await pool.query(`SELECT ...`, [params]);
return rows;
```