'use client'

import { useEffect } from 'react'

const replacements: Array<[string,string]> = [
  ['ÃƒO','ÃO'],['ÃƒA','ÃA'],['Ãƒ','Ã'],
  ['Ã¡','á'],['Ã¢','â'],['Ã£','ã'],['Ã¤','ä'],['Ã©','é'],['Ãª','ê'],['Ã­','í'],['Ã³','ó'],['Ã´','ô'],['Ãµ','õ'],['Ãº','ú'],['Ã§','ç'],
  ['Ã','Á'],['Ã‰','É'],['Ã“','Ó'],['Ãš','Ú'],['Ã‡','Ç'],
  ['â€”','—'],['â€“','–'],['â€¢','•'],['â€¦','…'],['â€œ','“'],['â€','”'],['âœ“','✓'],['â—','●'],['âˆ‘','∑'],['Ã—','×'],
  ['NÃƒO','NÃO'],['PROVISÃ“RIO','PROVISÓRIO'],['TRANSPARÃŠNCIA','TRANSPARÊNCIA'],['NOTIFICAÃ‡Ã•ES','NOTIFICAÇÕES']
]

function repairText(input:string){
  let out=input
  for(let pass=0;pass<3;pass++){
    const before=out
    for(const [bad,good] of replacements) out=out.split(bad).join(good)
    if(out===before) break
  }
  return out
}

function repair(root:ParentNode=document){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT)
  let node:Node|null
  while((node=walker.nextNode())){
    const value=node.nodeValue
    if(!value || (!value.includes('Ã') && !value.includes('â'))) continue
    const fixed=repairText(value)
    if(fixed!==value) node.nodeValue=fixed
  }
}

export default function Utf8CompatRepair(){
  useEffect(()=>{
    let clickTimer:number|undefined
    const initial=requestAnimationFrame(()=>repair())
    const delayed=window.setTimeout(()=>repair(),300)
    const onClick=()=>{
      if(clickTimer) window.clearTimeout(clickTimer)
      clickTimer=window.setTimeout(()=>repair(),0)
    }
    const onPageShow=()=>repair()
    document.addEventListener('click',onClick,true)
    window.addEventListener('pageshow',onPageShow)
    return ()=>{
      cancelAnimationFrame(initial)
      window.clearTimeout(delayed)
      if(clickTimer) window.clearTimeout(clickTimer)
      document.removeEventListener('click',onClick,true)
      window.removeEventListener('pageshow',onPageShow)
    }
  },[])
  return null
}
