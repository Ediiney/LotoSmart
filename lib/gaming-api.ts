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

type EngineResponse<T>={ok?:boolean;result?:T;error?:string;message?:string;retry_after_seconds?:number}

async function errorCodeFromInvoke(error:any){
  try{
    const response=error?.context as Response|undefined
    if(response&&typeof response.clone==='function'){
      const payload=await response.clone().json().catch(()=>null)
      if(payload?.error)return String(payload.error)
      if(payload?.message)return String(payload.message)
      if(response.status===401)return 'UNAUTHORIZED'
      if(response.status===403)return 'PLAN_REQUIRED'
      if(response.status===429)return 'RATE_LIMITED'
    }
  }catch{}
  const message=String(error?.message||'')
  if(message.includes('Failed to send a request'))return 'NETWORK_OR_CORS'
  return message||'ENGINE_REQUEST_FAILED'
}

async function invokeEngine<T>(body:Record<string,unknown>):Promise<T>{
  const {data:{session}}=await supabase.auth.getSession()
  if(!session)throw new Error('UNAUTHORIZED')

  const {data,error}=await supabase.functions.invoke<EngineResponse<T>>('gaming-engine',{body})
  if(error)throw new Error(await errorCodeFromInvoke(error))
  if(data?.result===undefined)throw new Error(data?.error||data?.message||'INVALID_ENGINE_RESPONSE')
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
