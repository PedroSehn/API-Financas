# Skill: Auth

## Fluxo
- Login via email + senha (bcryptjs para comparação)
- Retorna JWT assinado com JWT_SECRET do .env
- Sem endpoint de registro — usuários criados direto no banco

## Middlewares (ordem obrigatória no app.js)
1. `auth.middleware.js` — valida Bearer token, injeta req.user
2. `demo.middleware.js` — bloqueia escrita para is_demo

## auth.middleware.js
```js
// req.user deve conter:
{ id, email, name, is_demo }
```

## demo.middleware.js
```js
if (req.user.is_demo && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
  return res.status(403).json({ message: 'Ação não permitida no modo demo.' });
}
```

## Rotas
- Pública: apenas POST /auth/login
- Todas as demais: protegidas pelos dois middlewares

## Regras críticas
- NUNCA confiar em user_id vindo do body ou params
- SEMPRE usar req.user.id como user_id nas queries
- Usuário demo tem is_demo: true — somente leitura
- Usuários reais têm is_demo: false — acesso total aos próprios dados