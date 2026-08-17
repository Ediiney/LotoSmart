LotoSmart V1.16 patch

1. Copie estes arquivos sobre E:\LotoSmart-work.
2. Não remova app/page.tsx atual.
3. O middleware transforma / em landing pública e /app no produto existente.
4. Supabase já recebeu a migration de entitlements:
   - Free: até 10 jogos salvos
   - Pro/Founders: ilimitado
   - founders: R$149
5. Depois:
   git add .
   git commit -m "release: LotoSmart v1.16.0 - home, routing and entitlements"
   git push origin main
