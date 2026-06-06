import type { NextApiRequest, NextApiResponse } from 'next'

import { createDeepSeekClient } from '@/lib/deepseek'
import { methodNotAllowed, setCorsHeaders, type ApiError } from '@/lib/tasks'

type OptimizePromptResponse =
  | {
      prompt: string
    }
  | ApiError

const META_PROMPT_TEMPLATE = `# Universal Meta-Prompt v1.0

你是一个 Prompt Engineering 专家，负责将用户的模糊需求转化为高质量的 Prompt。

## 输入
用户需求：{{user_request}}

## 分析步骤

### 第一步：任务分析
请先分析用户需求，回答以下问题：

1. **任务类型**：
   - [ ] 代码生成
   - [ ] 文本创作
   - [ ] 数据分析
   - [ ] 问题求解
   - [ ] 其他：______

2. **复杂度评估**：
   - [ ] 简单（单步骤，无需推理）
   - [ ] 中等（多步骤，需要一定推理）
   - [ ] 复杂（多步骤，需要深度推理）

3. **是否需要 CoT**：
   - 如果任务涉及数学、逻辑、代码调试 → 需要
   - 如果任务是简单的文本生成、分类 → 不需要

4. **是否需要安全约束**：
   - 如果任务涉及代码生成、文件操作、网络请求 → 需要
   - 如果任务是纯文本创作 → 不需要

### 第二步：生成结构化 Prompt

基于上述分析，生成以下格式的 Prompt：

<instruction>
[清晰的任务描述，一句话说明要做什么]
</instruction>

<constraints>
[约束条件列表，包括但不限于：]
- 编程语言/框架（如果是代码任务）
- 输出格式要求
- 禁止使用的方法/技术
- 性能要求（如时间复杂度）
- 代码规范（如命名规则、注释要求）
</constraints>

<security>
[如果任务涉及代码生成或敏感操作，添加此部分]
安全规则（最高优先级）：
- 不要使用 eval() 或 exec() 等危险函数
- 文件操作必须进行路径验证
- 用户输入必须进行类型检查和清理
- 生成的代码必须处理异常情况
- 敏感操作需要用户确认
</security>

<thinking>
[如果任务复杂度为"中等"或"复杂"，添加此部分]
请在此标签内先写出你的思考过程：
1. 理解需求：用户想要什么？
2. 分析难点：有哪些技术难点？
3. 设计方案：如何实现？
4. 考虑边界：有哪些边界情况需要处理？
</thinking>

<examples>
[根据任务类型生成 2-3 个 Few-Shot 示例]

示例 1：[正常情况]
输入：[示例输入]
输出：[示例输出]

示例 2：[边界情况]
输入：[示例输入]
输出：[示例输出]

示例 3：[错误处理]
输入：[示例输入]
输出：[示例输出]
</examples>

<output_format>
[明确的输出格式要求]
- 如果是代码：完整可运行的代码，包含注释
- 如果是文本：具体的字数、风格、结构要求
- 如果是数据：JSON/CSV 等格式规范
</output_format>

<input>
[用户的实际输入]
{{user_input}}
</input>`

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OptimizePromptResponse>,
) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST', 'OPTIONS'])
  }

  const userRequest = parseUserRequest(req.body)
  if (!userRequest) {
    return res.status(400).json({ error: 'Request body must include a non-empty user_request' })
  }

  try {
    const prompt = await optimizePrompt(userRequest)
    return res.status(200).json({ prompt })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return res.status(500).json({
      error: 'Failed to optimize prompt',
      details: message,
    })
  }
}

async function optimizePrompt(userRequest: string) {
  const client = createDeepSeekClient()
  const metaPrompt = META_PROMPT_TEMPLATE
    .replaceAll('{{user_request}}', userRequest)
    .replaceAll('{{user_input}}', userRequest)

  const completion = await client.chat.completions.create({
    model: 'deepseek-chat',
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content:
          '你是一个资深 Prompt Engineering 专家。请严格根据用户给出的 Universal Meta-Prompt 模版输出优化后的 Prompt。不要输出寒暄、解释或额外标题。',
      },
      {
        role: 'user',
        content: metaPrompt,
      },
    ],
  })

  const content = completion.choices[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('DeepSeek returned an empty response')
  }

  return content
}

function parseUserRequest(body: unknown) {
  if (!isRecord(body)) return null
  const value = body.user_request ?? body.userRequest ?? body.request

  if (typeof value !== 'string') return null

  const userRequest = value.trim()
  return userRequest ? userRequest : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
