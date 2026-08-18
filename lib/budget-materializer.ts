import type {Rule} from './lotteries'
import {generatePortfolio} from './generator'

export type BudgetOption={
  picks:number
  games:number
  cost:number
  equivalentSimpleBets:number
  efficiency:number
  label:string
}

export function generateBudgetPortfolio(rule:Rule,option:BudgetOption){
  return generatePortfolio(rule,option.picks,option.games)
}
