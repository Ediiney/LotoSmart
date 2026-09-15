import './globals.css'
import './mobile-v119.css'
import './lottery-themes.css'
import './app/product-minimal.css'
import './light-theme-v125.css'
import type {Metadata} from 'next'
import AuthSessionRecovery from './AuthSessionRecovery'

export const metadata:Metadata={title:'LotoSmart',description:'Geração, organização e acompanhamento de jogos com transparência matemática'}

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="pt-BR"><body><AuthSessionRecovery/>{children}</body></html>
}
