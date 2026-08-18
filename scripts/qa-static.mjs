import { readFile } from 'node:fs/promises'

const checks = [
  {
    file: 'app/app/labs/page.tsx',
    mustInclude: ['Voltar ao Portfólio', "href=\"/app\"", "Gaming Engine v4"],
    mustNotInclude: ['Nova simulação</button><a href=\"/app\">Voltar ao produto</a>']
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
