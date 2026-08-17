# LotoSmart V1.15 — Monetização/Admin (Patch)

## O que já foi aplicado no Supabase
- `profiles.role`: `user | admin`
- `profiles.plan_code`
- planos Free, Pro e Founders (Founders = R$149, 100 vagas)
- `payment_transactions`
- `financial_entries`
- `founder_leads`
- função `is_admin()`
- função pública `founders_remaining()`
- RLS para proteger dados administrativos
- conta `edineyofc@gmail.com` promovida a `admin`

## Arquivos deste patch
Copie as pastas `app/landing` e `app/admin` para o repositório LotoSmart.

Rotas:
- `/landing` — landing comercial + captura Founders
- `/admin` — dashboard administrativo protegido por role

## Próxima etapa
1. tornar `/landing` a entrada principal pública e mover produto para `/app` ou `/dashboard`;
2. gateway de pagamento (Mercado Pago/Stripe/Pagar.me);
3. webhook que ativa assinatura e `plan_code`;
4. enforcement Free/Pro/Founders no backend;
5. gráficos de MRR, churn, CAC, LTV e fluxo mensal;
6. checkout Founders até 100 vendas.
