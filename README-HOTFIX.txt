LotoSmart v1.17.1 — Contest Data Hotfix

Correções:
- Home/landing volta a exibir os últimos concursos da Mega-Sena, Lotofácil e Quina.
- Leitura via RPC pública get_public_latest_draws().
- Atualização automática a cada 60 segundos e ao voltar para a aba.
- Último concurso, dezenas, próximo concurso, data, prêmio estimado, fontes e confiança.
- Estado de erro explícito sem apagar o último dado já carregado.
- Data Agent continua persistindo os resultados a cada 5 minutos no Supabase.

Aplicação:
1. Copie o conteúdo deste ZIP para E:\LotoSmart-work e substitua os arquivos.
2. git status
3. git add .
4. git commit -m "hotfix: restore contest data on home v1.17.1"
5. git push origin main

A Vercel fará o build automaticamente.
