import { readFile } from 'node:fs/promises'

const checks = [
  {file:'app/app/labs/page.tsx',mustInclude:['Voltar ao Portfólio','Gerar novos jogos no Portfólio','lotosmart-labs-context-v1','carteira real','href="/app"','Gaming Engine v4'],mustNotInclude:['Nova simulação','Voltar ao produto','quatro jogos estruturais mínimos como amostra']},
  {file:'app/landing/PaidLanding.tsx',mustInclude:['LotoNex','Sem plano gratuito. Acesso a partir de R$ 49,90.','/api/public-state','lotosmart-public-state-v1','R$ 149'],mustNotInclude:['Criar conta grátis',"supabase.rpc('get_public_latest_draws')",'Consultando…','LotoSmart organiza']},
  {file:'app/landing/page.tsx',mustInclude:['getPublicState','initialDraws','initialFoundersRemaining']},
  {file:'app/api/public-state/route.ts',mustInclude:['getPublicState','stale-while-revalidate=300']},
  {file:'app/app/PaidAccessGate.tsx',mustInclude:['R$ 49,90',"plan:'none'|'pro'|'founders",'ASSINATURA NECESSÁRIA','lotosmart-paid-access-v2','ENTITLEMENT_TIMEOUT','initialSession'],mustNotInclude:['Plano Free permite','SavedGamesManager']},
  {file:'app/app/ProductApp.tsx',mustInclude:['save_generated_portfolio','PRODUCT_VERSION=\'1.26.0\'','/api/public-state','initialSession','Criar jogos','Meus Jogos','LotoNex'],mustNotInclude:['Cobertura única','Cobertura da carteira','Budget Optimizer','Wheeling Lab','Validation Engine','Data Agent','LotoSmart em números']},
  {file:'app/app/product-minimal.css',mustInclude:['.sections button:first-child','.sections button:nth-child(7)']},
  {file:'app/layout.tsx',mustInclude:["./app/product-minimal.css","title:'LotoNex'"]},
  {file:'app/admin/AdminPaid.tsx',mustInclude:['admin_record_pix_payment','admin_revoke_manual_access','PIX Pro','PIX Founder','R$ 49,90','R$ 149']},
  {file:'package.json',mustInclude:['"name": "lotonex"','"version": "1.26.0"']}
]

let failed=false
for(const check of checks){
 const text=await readFile(check.file,'utf8')
 for(const needle of check.mustInclude??[]){if(!text.includes(needle)){failed=true;console.error(`FAIL ${check.file}: missing required text -> ${needle}`)}}
 for(const needle of check.mustNotInclude??[]){if(text.includes(needle)){failed=true;console.error(`FAIL ${check.file}: legacy/forbidden text found -> ${needle}`)}}
}
if(failed)process.exit(1)
console.log('LotoNex v1.26 SaaS static QA passed.')
