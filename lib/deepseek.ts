import OpenAI from 'openai'

export function createDeepSeekClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    throw new Error('Missing DEEPSEEK_API_KEY environment variable')
  }

  return new OpenAI({
    apiKey,
    baseURL: 'https://api.deepseek.com',
  })
}
