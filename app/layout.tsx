import './globals.css'
import './mobile-v119.css'
import type {Metadata} from 'next'
import AuthSessionRecovery from './AuthSessionRecovery'
import Utf8CompatRepair from './Utf8CompatRepair'

export const metadata:Metadata={title:'LotoSmart',description:'Inteligência matemática e acompanhamento de jogos'}

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="pt-BR"><body><AuthSessionRecovery/><Utf8CompatRepair/>{children}</body></html>
}
