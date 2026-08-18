import PaidLanding from './PaidLanding'
import {getPublicState} from '../../lib/public-state-server'

export const revalidate=30

export default async function LandingPage(){
  const initial=await getPublicState()
  return <PaidLanding initialDraws={initial.draws} initialPlans={initial.plans} initialFoundersRemaining={initial.foundersRemaining}/>
}
