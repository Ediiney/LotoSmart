import {NextResponse} from 'next/server'
import {getPublicState} from '../../../lib/public-state-server'

export const revalidate=30

export async function GET(){
  try{
    const state=await getPublicState()
    return NextResponse.json(state,{headers:{'Cache-Control':'public, s-maxage=30, stale-while-revalidate=300'}})
  }catch{
    return NextResponse.json({draws:[],plans:[],foundersRemaining:100,fetchedAt:new Date().toISOString(),degraded:true},{status:200,headers:{'Cache-Control':'public, s-maxage=10, stale-while-revalidate=300'}})
  }
}
