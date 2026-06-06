import type { NextApiRequest, NextApiResponse } from 'next'

import { createDeepSeekClient } from '@/lib/deepseek'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  methodNotAllowed,
  parseTaskId,
  setCorsHeaders,
  type ApiError,
  type Task,
} from '@/lib/tasks'

type BreakdownResponse =
  | {
      subtasks: Task[]
      steps: string[]
    }
  | ApiError

type BreakdownInput = {
  id: string
  title: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BreakdownResponse>,
) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST', 'OPTIONS'])
  }

  const input = parseBreakdownInput(req.body)
  if (!input) {
    return res.status(400).json({
      error: 'Request body must include a task id and a non-empty title',
    })
  }

  try {
    const steps = await generateBreakdown(input.title)
    const subtasks = await saveSubtasksInOrder(input.id, steps)

    return res.status(201).json({
      subtasks,
      steps,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return res.status(500).json({
      error: 'Failed to break down task',
      details: message,
    })
  }
}

async function saveSubtasksInOrder(parentId: string, steps: string[]) {
  const subtasks: Task[] = []
  const baseTime = Date.now()

  try {
    for (const [index, step] of steps.entries()) {
      const { data, error } = await supabaseAdmin
        .from('tasks')
        .insert({
          title: step,
          completed: false,
          parent_id: parentId,
          created_at: new Date(baseTime + index).toISOString(),
        })
        .select('*')
        .single()

      if (error) {
        throw new Error(error.message)
      }

      subtasks.push(data)
    }
  } catch (error) {
    const insertedIds = subtasks.map((task) => task.id)

    if (insertedIds.length) {
      await supabaseAdmin.from('tasks').delete().in('id', insertedIds)
    }

    throw error
  }

  return subtasks
}

function parseBreakdownInput(body: unknown): BreakdownInput | null {
  if (!isRecord(body)) return null

  const id = parseTaskId(readString(body.id) ?? readString(body.parent_id) ?? readString(body.parentId))
  const rawTitle = readString(body.title) ?? readString(body.task) ?? readString(body.taskName)
  const title = rawTitle?.trim()

  if (!id || !title) return null

  return { id, title }
}

async function generateBreakdown(title: string): Promise<string[]> {
  const client = createDeepSeekClient()

  const completion = await client.chat.completions.create({
    model: 'deepseek-chat',
    response_format: { type: 'json_object' },
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content:
          '你是一个任务拆解助手。只返回 JSON，格式为 {"steps":["步骤1","步骤2","步骤3"]}。steps 必须是 3 到 5 个可执行的小步骤，每个步骤简洁具体，不要编号，不要 Markdown。',
      },
      {
        role: 'user',
        content: `请把这个任务拆解成 3-5 个可执行的小步骤：${title}`,
      },
    ],
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    throw new Error('DeepSeek returned an empty response')
  }

  const steps = parseSteps(content)
  if (steps.length < 3 || steps.length > 5) {
    throw new Error('DeepSeek response must include 3 to 5 steps')
  }

  return steps
}

function parseSteps(content: string): string[] {
  const parsed = JSON.parse(content) as unknown
  const rawSteps = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.steps)
      ? parsed.steps
      : null

  if (!rawSteps) {
    throw new Error('DeepSeek response did not include a steps array')
  }

  return rawSteps
    .filter((step): step is string => typeof step === 'string')
    .map((step) => step.replace(/^\s*\d+[.)、-]?\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
