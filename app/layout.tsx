import './globals.css'
import type {Metadata} from 'next'
export const metadata:Metadata={title:'LotoSmart',description:'Inteligência matemática e acompanhamento de jogos'}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
