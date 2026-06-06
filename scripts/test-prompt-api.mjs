import fs from 'node:fs'

const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000'
const envText = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : ''
const hasDeepSeekKey = envText
  .split(/\n/)
  .some((line) => line.startsWith('DEEPSEEK_API_KEY=') && line.split('=').slice(1).join('=').trim())

if (!hasDeepSeekKey) {
  console.log('SKIP /api/prompts/optimize: DEEPSEEK_API_KEY is missing in .env.local')
  process.exit(0)
}

try {
  const { status, body } = await request('/api/prompts/optimize', {
    method: 'POST',
    body: {
      user_request: '帮我生成一个 Next.js 登录页，包含表单校验、错误提示和移动端适配',
    },
  })

  assert(status === 200, `POST /api/prompts/optimize expected 200, received ${status}`)
  assert(typeof body.prompt === 'string' && body.prompt.length > 100, 'Expected optimized prompt text')
  assert(body.prompt.includes('<instruction>'), 'Expected optimized prompt to include <instruction>')
  assert(body.prompt.includes('<constraints>'), 'Expected optimized prompt to include <constraints>')
  assert(body.prompt.includes('<output_format>'), 'Expected optimized prompt to include <output_format>')

  console.log('PASS POST /api/prompts/optimize')
} catch (error) {
  console.error('Prompt optimize API test failed.')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const text = await response.text()
  let body

  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }

  return { status: response.status, body }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}
