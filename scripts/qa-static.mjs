import { readFile } from 'node:fs/promises'

const checks = [
  {
    file: 'app/app/labs/page.tsx',
    mustInclude: ['Voltar ao Portfólio', 'Gerar novos jogos no Portfólio', 'lotosmart-labs-context-v1', 'carteira real', "href=\"/app\"", 'Gaming Engine v4'],
    mustNotInclude: ['Nova simulação', 'Voltar ao produto', 'quatro jogos estruturais mínimos como amostra']
  },
  {
    file: 'app/landing/PaidLanding.tsx',
    mustInclude: ['Sem plano gratuito. Acesso a partir de R$ 49,90.', 'founders_remaining', 'R$ 149'],
    mustNotInclude: ['Criar conta grátis']
  },
  {
    file: 'app/app/PaidAccessGate.tsx',
    mustInclude: ['R$ 49,90', "plan:'none'|'pro'|'founders'", 'ASSINATURA NECESSÁRIA'],
    mustNotInclude: ['Plano Free permite']
  },
  {
    file: 'app/app/ProductApp.tsx',
    mustInclude: ['save_generated_portfolio', 'lotosmart-labs-context-v1', 'Analisar estes jogos no Monte Carlo', "plan:'none'|'pro'|'founders'", "PRODUCT_VERSION='1.21.5'"],
    mustNotInclude: ["plan:'free'|'pro'|'founders'", 'Seu plano Free permite', 'Plano Free:', 'V1.20.0']
  },
  {
    file: 'app/admin/AdminPaid.tsx',
    mustInclude: ['admin_record_pix_payment', 'admin_revoke_manual_access', 'PIX Pro', 'PIX Founder', 'R$ 49,90', 'R$ 149'],
    mustNotInclude: ['Não existe plano Free. Pro é o plano recorrente de entrada e Founders é a oferta vitalícia limitada. Mock']
  },
  {
    file: 'package.json',
    mustInclude: ['"version": "1.21.5"']
  }
]

let failed = false
for (const check of checks) {
  const text = await readFile(check.file, 'utf8')
  for (const needle of check.mustInclude ?? []) {
    if (!text.includes(needle)) {
      failed = true
      console.error(`FAIL ${check.file}: missing required text -> ${needle}`)
    }
  }
  for (const needle of check.mustNotInclude ?? []) {
    if (text.includes(needle)) {
      failed = true
      console.error(`FAIL ${check.file}: legacy/forbidden text found -> ${needle}`)
    }
  }
}

if (failed) process.exit(1)
console.log('Static business-rule QA passed.')
