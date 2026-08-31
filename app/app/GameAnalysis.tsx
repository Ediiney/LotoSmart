'use client'

import type {GameId} from '../../lib/lotteries'

type Props={game:GameId;games:number[][]}

type GameStats={sum:number;odd:number;even:number;average:number;min:number;max:number;sequencePairs:number;sequenceRuns:number;longestRun:number;endings:string[];blocks:number[]}

function getStats(numbers:number[],universe:number):GameStats{
  const sorted=[...numbers].sort((a,b)=>a-b)
  let sequencePairs=0
  let sequenceRuns=0
  let longestRun=1
  let currentRun=1
  for(let i=1;i<sorted.length;i++){
    if(sorted[i]===sorted[i-1]+1){
      sequencePairs++
      currentRun++
    }else{
      if(currentRun>=2)sequenceRuns++
      longestRun=Math.max(longestRun,currentRun)
      currentRun=1
    }
  }
  if(currentRun>=2)sequenceRuns++
  longestRun=Math.max(longestRun,currentRun)

  const blockSize=Math.ceil(universe/5)
  const blocks=Array.from({length:5},()=>0)
  sorted.forEach(n=>{blocks[Math.min(4,Math.floor((n-1)/blockSize))]++})
  const endingCounts=new Map<number,number>()
  sorted.forEach(n=>endingCounts.set(n%10,(endingCounts.get(n%10)||0)+1))
  const endings=[...endingCounts.entries()].sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,3).map(([ending,count])=>`${ending} (${count}x)`)

  return {
    sum:sorted.reduce((a,b)=>a+b,0),
    odd:sorted.filter(n=>n%2!==0).length,
    even:sorted.filter(n=>n%2===0).length,
    average:Number((sorted.reduce((a,b)=>a+b,0)/Math.max(1,sorted.length)).toFixed(1)),
    min:sorted[0]||0,
    max:sorted[sorted.length-1]||0,
    sequencePairs,
    sequenceRuns,
    longestRun,
    endings,
    blocks,
  }
}

function blockLabel(index:number,universe:number){
  const size=Math.ceil(universe/5)
  const from=index*size+1
  const to=Math.min(universe,(index+1)*size)
  return `${from}-${to}`
}

function MetricCard({label,value,help}:{label:string;value:string;help:string}){
  return <article className="analysisMetric"><small>{label}</small><strong>{value}</strong><span>{help}</span></article>
}

export default function GameAnalysis({game,games}:Props){
  if(!games.length)return null
  const universe=game==='lotofacil'?25:game==='quina'?80:60
  const stats=games.map(g=>getStats(g,universe))
  const flat=games.flat()
  const unique=new Set(flat).size
  const pairOverlaps=[]
  for(let i=0;i<games.length;i++)for(let j=i+1;j<games.length;j++){
    const set=new Set(games[i])
    pairOverlaps.push(games[j].filter(n=>set.has(n)).length)
  }
  const avgOverlap=pairOverlaps.length?(pairOverlaps.reduce((a,b)=>a+b,0)/pairOverlaps.length).toFixed(2):'0'
  const avgSum=(stats.reduce((a,s)=>a+s.sum,0)/stats.length).toFixed(1)
  const avgOdd=(stats.reduce((a,s)=>a+s.odd,0)/stats.length).toFixed(1)
  const avgEven=(stats.reduce((a,s)=>a+s.even,0)/stats.length).toFixed(1)
  const allSequences=stats.reduce((a,s)=>a+s.sequencePairs,0)
  const mostUsedEnding=new Map<string,number>()
  stats.flatMap(s=>s.endings).forEach(label=>{const ending=label.split(' ')[0];mostUsedEnding.set(ending,(mostUsedEnding.get(ending)||0)+1)})

  return <section className="gameAnalysis" aria-label="Análise matemática dos jogos">
    <div className="analysisIntro">
      <div>
        <p className="eyebrow">ANÁLISE DOS JOGOS</p>
        <h3>Entenda a estrutura da sua carteira</h3>
        <p>O LotoSmart não escolhe números por promessa de prêmio. Ele monta combinações e mede características matemáticas de cada jogo — pares e ímpares, soma das dezenas, sequências, distribuição por faixas e repetição entre jogos.</p>
      </div>
      <div className="analysisBadge"><strong>{games.length}</strong><span>jogos analisados</span></div>
    </div>

    <div className="analysisGrid">
      <MetricCard label="Soma média das dezenas" value={avgSum} help="Soma de todos os números de cada jogo, depois calculada como média da carteira."/>
      <MetricCard label="Pares / ímpares" value={`${avgEven} / ${avgOdd}`} help="Quantidade média de dezenas pares e ímpares por jogo."/>
      <MetricCard label="Sequências" value={String(allSequences)} help="Pares consecutivos encontrados nos jogos, como 07-08 ou 14-15."/>
      <MetricCard label="Números únicos" value={String(unique)} help="Quantidade de dezenas diferentes usadas nos jogos."/>
      <MetricCard label="Sobreposição média" value={avgOverlap} help="Média de números repetidos quando comparamos cada par de jogos."/>
    </div>

    <div className="analysisGames">
      {stats.map((s,index)=><article className="analysisGame" key={index}>
        <div className="analysisGameHead"><div><span>JOGO {String(index+1).padStart(2,'0')}</span><h4>Perfil matemático</h4></div><strong>Soma {s.sum}</strong></div>
        <div className="analysisFacts">
          <div><small>Pares</small><b>{s.even}</b></div>
          <div><small>Ímpares</small><b>{s.odd}</b></div>
          <div><small>Média</small><b>{s.average}</b></div>
          <div><small>Faixa</small><b>{s.min}–{s.max}</b></div>
        </div>
        <div className="analysisDetail"><span>Sequências consecutivas</span><b>{s.sequencePairs} pares · {s.sequenceRuns} grupos · máx. {s.longestRun}</b></div>
        <div className="analysisDetail"><span>Finais mais frequentes</span><b>{s.endings.join(' · ')||'Nenhum destaque'}</b></div>
        <div className="analysisBlocks"><span>Distribuição por faixas</span><div>{s.blocks.map((count,i)=><em key={i}>{blockLabel(i,universe)}: {count}</em>)}</div></div>
      </article>)}
    </div>

    <div className="analysisExplanation">
      <h4>Como o cálculo funciona?</h4>
      <div className="analysisSteps">
        <p><b>1. Estrutura.</b> Cada combinação é validada para conter a quantidade correta de dezenas, sem duplicidades e dentro do universo da modalidade.</p>
        <p><b>2. Perfil.</b> Calculamos soma, média, pares/ímpares, intervalos, sequências consecutivas e distribuição das dezenas por faixas.</p>
        <p><b>3. Carteira.</b> Comparamos os jogos entre si para medir números únicos e sobreposição. Isso ajuda a enxergar redundâncias.</p>
        <p><b>4. Transparência.</b> Essas métricas descrevem a combinação gerada. Elas não aumentam matematicamente a probabilidade de uma dezena específica sair no próximo sorteio.</p>
      </div>
    </div>
  </section>
}
