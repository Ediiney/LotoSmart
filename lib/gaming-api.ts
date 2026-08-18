import { supabase } from './supabase'
import type { GameId } from './lotteries'

export type ServerBudgetOption={
  picks:number
  games:number
  cost:number
  equivalentSimpleBets:number
  efficiency:number
  label:string
}

export type ServerMonteCarloResult={
  simulations:number
  atLeastTarget:number
  rate:number
  bestAvg:number
  distribution:Record<number,number>
}

export type ServerWheelResult={
  base:number[]
  tickets:number[][]
  targetHits:number
  scenarios:number
  covered:number
  coverage:number
  validated:boolean
}

type EngineResponse<T>={ok?:boolean;result?:T;error?:string;message?:string}

async function invokeEngine<T>(body:Record<string,unknown>):Promise<T>{
  const {data,error}=await supabase.functions.invoke<EngineResponse<T>>('gaming-engine',{body})
  if(error)throw new Error(error.message||'Falha de comunicação com o Gaming Engine.')
  if(data?.result===undefined){
    if(data?.error==='PLAN_REQUIRED')throw new Error('PLAN_REQUIRED')
    if(data?.error==='UNAUTHORIZED')throw new Error('UNAUTHORIZED')
    throw new Error(data?.message||data?.error||'Resposta inválida do Gaming Engine.')
  }
  return data.result
}

export function optimizeBudgetServer(game:GameId,budget:number){
  return invokeEngine<ServerBudgetOption[]>({action:'optimize_budget',game,budget})
}

export function monteCarloServer(game:GameId,games:number[][],simulations=12000){
  return invokeEngine<ServerMonteCarloResult>({action:'monte_carlo',game,games,simulations})
}

export function buildWheelServer(game:GameId,baseSize:number,maxTickets=40){
  return invokeEngine<ServerWheelResult>({action:'build_wheel',game,baseSize,maxTickets})
}
