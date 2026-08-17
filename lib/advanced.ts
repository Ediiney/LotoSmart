import {Rule, combination} from './lotteries'
import {generatePortfolio} from './generator'

export type BudgetOption={picks:number;games:number;cost:number;equivalentSimpleBets:number;efficiency:number;label:string}
export function optimizeBudget(rule:Rule,budget:number):BudgetOption[]{
  const options:BudgetOption[]=[]
  for(let picks=rule.minPick;picks<=rule.maxPick;picks++){
    const price=rule.prices[picks]||0
    if(!price||price>budget) continue
    const maxGames=Math.min(100,Math.floor(budget/price))
    const candidateCounts=Array.from(new Set([1,4,maxGames].filter(n=>n>0&&n<=maxGames)))
    for(const games of candidateCounts){
      const cost=price*games
      const eq=combination(picks,rule.drawSize)*games
      options.push({picks,games,cost,equivalentSimpleBets:eq,efficiency:eq/cost,label:games===4?'Portfólio LotoSmart':picks===rule.minPick?'Cobertura por jogos simples':'Aposta ampliada'})
    }
  }
  return options.sort((a,b)=>b.equivalentSimpleBets-a.equivalentSimpleBets || Number(b.games===4)-Number(a.games===4) || b.efficiency-a.efficiency).slice(0,4)
}

function shuffle<T>(arr:T[]){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function intersectionCount(a:number[],b:number[]){const s=new Set(a);return b.reduce((n,x)=>n+(s.has(x)?1:0),0)}
export type MonteCarloResult={simulations:number;atLeastTarget:number;rate:number;bestAvg:number;distribution:Record<number,number>}
export function monteCarlo(rule:Rule,games:number[][],simulations=12000):MonteCarloResult{
  const dist:Record<number,number>={};let success=0,bestTotal=0
  for(let i=0;i<simulations;i++){
    const draw=shuffle(Array.from({length:rule.universe},(_,k)=>k+1)).slice(0,rule.drawSize)
    const best=Math.max(...games.map(g=>intersectionCount(g,draw)))
    dist[best]=(dist[best]||0)+1;bestTotal+=best;if(best>=rule.targetHits)success++
  }
  return{simulations,atLeastTarget:success,rate:Number((success/simulations*100).toFixed(2)),bestAvg:Number((bestTotal/simulations).toFixed(2)),distribution:dist}
}

function combos(items:number[],k:number):number[][]{
  const out:number[][]=[];const cur:number[]=[]
  function rec(start:number){if(cur.length===k){out.push([...cur]);return}for(let i=start;i<=items.length-(k-cur.length);i++){cur.push(items[i]);rec(i+1);cur.pop()}}
  rec(0);return out
}
export type WheelResult={base:number[];tickets:number[][];targetHits:number;scenarios:number;covered:number;coverage:number;validated:boolean}
export function buildWheel(rule:Rule,baseSize:number,maxTickets=40):WheelResult{
  const base=Array.from({length:baseSize},(_,i)=>i+1)
  const candidates=combos(base,rule.minPick)
  const scenarios=combos(base,rule.targetHits)
  const uncovered=new Set(scenarios.map((_,i)=>i));const tickets:number[][]=[]
  while(uncovered.size&&tickets.length<maxTickets&&candidates.length){
    let bestIdx=-1,bestCover:number[]=[]
    for(let ci=0;ci<candidates.length;ci++){
      const set=new Set(candidates[ci]);const cover:number[]=[]
      for(const si of uncovered){if(scenarios[si].every(n=>set.has(n)))cover.push(si)}
      if(cover.length>bestCover.length){bestCover=cover;bestIdx=ci}
    }
    if(bestIdx<0||!bestCover.length)break
    const [chosen]=candidates.splice(bestIdx,1);tickets.push(chosen);bestCover.forEach(i=>uncovered.delete(i))
  }
  const covered=scenarios.length-uncovered.size
  return{base,tickets,targetHits:rule.targetHits,scenarios:scenarios.length,covered,coverage:Number((covered/scenarios.length*100).toFixed(2)),validated:covered===scenarios.length}
}

export function generateBudgetPortfolio(rule:Rule,option:BudgetOption){return generatePortfolio(rule,option.picks,option.games)}
