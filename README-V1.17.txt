LotoSmart V1.17.0 — Plans & Entitlements

Copie TODO o conteúdo deste pacote para E:\LotoSmart-work, substituindo os arquivos existentes quando solicitado.

Arquivos:
- middleware.ts: / continua como landing e /app passa a usar uma rota própria.
- app/app/page.tsx: reutiliza o produto atual sem alterar app/page.tsx.
- app/app/plan-guard.tsx: consulta get_my_entitlements() e protege recursos Pro.
- app/app/plan-guard.module.css: UI de plano/upgrade.
- package.json: versão 1.17.0.

Backend já preparado:
Free:
  Portfólio, Data Agent, métricas, Meus Jogos.
  Até 10 jogos salvos (limite também no banco).
Pro:
  Free + Budget Optimizer, Wheeling, Monte Carlo, Validation Engine, Alertas.
Founders:
  Mesmo acesso funcional do Pro, vitalício.
Admin:
  Acesso funcional Pro/Founders + /admin.

Depois:
cd E:\LotoSmart-work
npm run build
git status
git add .
git commit -m "release: LotoSmart v1.17.0 - plans and entitlements"
git push origin main
