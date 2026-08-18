const base = process.env.LOTOSMART_BASE_URL || 'https://lotosmart-ediineys-projects.vercel.app'
const routes = ['/', '/app', '/app/labs', '/admin']

let failed = false
for (const route of routes) {
  const started = Date.now()
  try {
    const response = await fetch(`${base}${route}`, { redirect: 'follow', signal: AbortSignal.timeout(15000) })
    const ms = Date.now() - started
    if (!response.ok) {
      failed = true
      console.error(`FAIL ${route}: HTTP ${response.status} (${ms}ms)`)
    } else {
      console.log(`PASS ${route}: HTTP ${response.status} (${ms}ms)`)
    }
  } catch (error) {
    failed = true
    console.error(`FAIL ${route}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failed) process.exit(1)
console.log('Production smoke QA passed.')
