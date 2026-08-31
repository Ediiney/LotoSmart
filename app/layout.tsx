import './globals.css'
import './mobile-v119.css'
import './lottery-themes.css'
import type {Metadata} from 'next'
import AuthSessionRecovery from './AuthSessionRecovery'

export const metadata:Metadata={title:'LotoSmart',description:'Inteligência matemática e acompanhamento de jogos'}

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="pt-BR"><body><AuthSessionRecovery/>{children}</body></html>
}
