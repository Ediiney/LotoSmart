# LotoSmart

MVP de um otimizador matemático para apostas de loterias CAIXA.

## O que esta V1 faz
- Mega-Sena, Lotofácil e Quina.
- Consulta o último concurso por um provider server-side da CAIXA.
- Gera sempre 4 jogos.
- Penaliza sobreposição entre jogos e favorece maior cobertura de dezenas.
- Mostra custo, chance matemática por jogo e métricas do portfólio.
- Três modos iniciais: cobertura máxima, balanceado e experimental.

> Loterias são aleatórias. O sistema não prevê resultados e não garante premiação.

## Rodar localmente
```bash
npm install
npm run dev
```
Acesse http://localhost:3000

## Arquitetura
- `app/`: Next.js App Router e UI.
- `app/api/lottery/[game]`: adapter server-side para dados públicos da CAIXA.
- `lib/lotteries.ts`: regras, preços e combinatória.
- `lib/generator.ts`: motor de geração/diversificação dos 4 jogos.

## Próximos passos
1. Persistência PostgreSQL para concursos e carteiras de jogos.
2. Backtesting histórico.
3. Otimizador por orçamento em vez de apenas quantidade de dezenas.
4. Covering designs / wheeling systems mais formais.
5. Autenticação e perfis.
6. Motor Python para simulações Monte Carlo e otimização pesada.
7. IA somente após benchmarks objetivos contra estratégias aleatórias.

## V1.13.0
- Statistical Validation Engine V1: backtest histórico do portfólio estrutural contra carteiras aleatórias de mesmo custo.
- Corpus separado do Data Agent ao vivo, com 250 concursos históricos por modalidade.
- Resultados persistidos no Supabase por usuário.
