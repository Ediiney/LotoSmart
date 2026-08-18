'use client'

import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase'

export default function GamingLabsLink(){
  const [show,setShow]=useState(false)
  useEffect(()=>{
    let active=true
    async function load(){
      const {data:{session}}=await supabase.auth.getSession()
      if(!session){if(active)setShow(false);return}
      const {data}=await supabase.rpc('get_my_entitlements')
      if(active)setShow(Boolean(data?.is_pro))
    }
    load()
    const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>load())
    return()=>{active=false;subscription.unsubscribe()}
  },[])
  if(!show)return null
  return <a href="/app/labs" style={{position:'fixed',right:14,bottom:14,zIndex:80,textDecoration:'none',background:'#5be899',color:'#07110d',fontWeight:900,fontSize:12,padding:'10px 13px',borderRadius:999,boxShadow:'0 8px 28px rgba(0,0,0,.28)'}}>Gaming Labs v2</a>
}
