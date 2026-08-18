export type PublicDraw={game:'megasena'|'lotofacil'|'quina';contest_number:number;draw_date:string|null;numbers:number[];status:string;confidence:number|null;source_count:number|null;next_contest_number:number|null;next_draw_date:string|null;estimated_next_prize:number|string|null;updated_at:string}
export type PublicPlan={id:string;name:string;price_monthly:number|null;price_yearly:number|null;lifetime_price:number|null;is_founders:boolean;founders_limit:number|null;features:string[]}
export type PublicState={draws:PublicDraw[];plans:PublicPlan[];foundersRemaining:number;fetchedAt:string}

const SUPABASE_URL='https://ujpsoxgdsqkwcywyvnno.supabase.co'
const SUPABASE_KEY='sb_publishable_M-dLoOThrazh4uigeQkMgA_mLT8q3W5'
const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'}

async function jsonFetch<T>(url:string,init:RequestInit={}):Promise<T>{
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),3500)
  try{
    const response=await fetch(url,{...init,headers:{...headers,...(init.headers||{})},signal:controller.signal,next:{revalidate:30}})
    if(!response.ok)throw new Error(`PUBLIC_STATE_HTTP_${response.status}`)
    return await response.json() as T
  }finally{clearTimeout(timer)}
}

export async function getPublicState():Promise<PublicState>{
  const [drawsResult,plansResult,foundersResult]=await Promise.allSettled([
    jsonFetch<PublicDraw[]>(`${SUPABASE_URL}/rest/v1/rpc/get_public_latest_draws`,{method:'POST',body:'{}'}),
    jsonFetch<PublicPlan[]>(`${SUPABASE_URL}/rest/v1/plans?active=eq.true&select=id,name,price_monthly,price_yearly,lifetime_price,is_founders,founders_limit,features`),
    jsonFetch<number>(`${SUPABASE_URL}/rest/v1/rpc/founders_remaining`,{method:'POST',body:'{}'})
  ])
  return{
    draws:drawsResult.status==='fulfilled'?drawsResult.value:[],
    plans:plansResult.status==='fulfilled'?plansResult.value:[],
    foundersRemaining:foundersResult.status==='fulfilled'&&typeof foundersResult.value==='number'?foundersResult.value:100,
    fetchedAt:new Date().toISOString()
  }
}
