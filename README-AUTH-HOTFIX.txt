LotoSmart v1.17.2 — Mobile Auth Hotfix

Problema confirmado:
- O Supabase cria a conta e inicia a sessão com status 200.
- Em alguns navegadores móveis, especialmente Safari/iPhone, o modal pode continuar em "Aguarde…" mesmo após a sessão ter sido persistida.

Correção:
- Watchdog global de sessão.
- Se houver sessão Supabase válida e a UI ficar presa em Aguarde por ~3 segundos, a página faz uma única reidratação.
- Evita loop por sessionStorage.
- Não altera gerador, planos, concursos, Data Agent ou banco.

Copie para E:\LotoSmart-work:
- app\AuthSessionRecovery.tsx
- app\layout.tsx

Depois:
git status
git add .
git commit -m "hotfix: recover mobile signup session v1.17.2"
git push origin main
