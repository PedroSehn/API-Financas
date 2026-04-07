# Skill: Simulation

Simulação NUNCA persiste dados. Tudo calculado em memória.

## Entrada
```json
{ "startYear": 2025, "startMonth": 4, 
  "months": 12,
  "scenario": { 
    "description": "MacBook", 
    "value": 1500, 
    "durationMonths": 12
  } }
```

## Saída por mês
```json
{ "year": 2025, "month": 4, "totalIncomes": 4592,
  "totalExpenses": 3200, "scenarioImpact": 1500,
  "balance": -108, "isNegative": true }
```

## Regras
- Reutilizar monthFilter para buscar dados reais de cada mês projetado
- Somar scenarioImpact nos meses que o cenário cobre
- Rota acessível pelo usuário demo (GET permitido)
- NUNCA fazer INSERT, UPDATE ou DELETE