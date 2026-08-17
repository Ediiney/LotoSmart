export type GameId='megasena'|'lotofacil'|'quina'
export type Rule={id:GameId;name:string;universe:number;drawSize:number;minPick:number;maxPick:number;prices:Record<number,number>;targetHits:number}
export const LOTTERIES:Record<GameId,Rule>={
megasena:{id:'megasena',name:'Mega-Sena',universe:60,drawSize:6,minPick:6,maxPick:20,targetHits:4,prices:{6:6,7:42,8:168,9:504,10:1260,11:2772,12:5544,13:10296,14:18018,15:30030,16:48048,17:74256,18:111384,19:162792,20:232560}},
lotofacil:{id:'lotofacil',name:'Lotofácil',universe:25,drawSize:15,minPick:15,maxPick:20,targetHits:11,prices:{15:3.5,16:56,17:476,18:2856,19:13566,20:54264}},
quina:{id:'quina',name:'Quina',universe:80,drawSize:5,minPick:5,maxPick:15,targetHits:2,prices:{5:3,6:18,7:63,8:168,9:378,10:756,11:1386,12:2376,13:3861,14:6006,15:9009}}}
export function combination(n:number,k:number){if(k<0||k>n)return 0;k=Math.min(k,n-k);let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return Math.round(r)}
export function jackpotOdds(rule:Rule,picks:number){return Math.round(combination(rule.universe,rule.drawSize)/combination(picks,rule.drawSize))}
