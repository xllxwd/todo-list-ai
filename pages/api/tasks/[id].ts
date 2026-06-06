import type { NextApiRequest, NextApiResponse } from 'next'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  methodNotAllowed,
  parseTaskId,
  parseUpdateTaskInput,
  setCorsHeaders,
  type DeleteTaskResponse,
  type TaskResponse,
} from '@/lib/tasks'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TaskResponse | DeleteTaskResponse>,
) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  const id = parseTaskId(req.query.id)
  if (!id) {
    return res.status(400).json({ error: 'Invalid task id' })
  }

  try {
    if (req.method === 'PATCH') {
      const input = parseUpdateTaskInput(req.body)
      if (!input) {
        return res.status(400).json({ error: 'Request body must include a boolean completed value' })
      }

      const { data, error } = await supabaseAdmin
        .from('tasks')
        .update({ completed: input.completed })
        .eq('id', id)
        .select('*')
        .single()

      if (error) {
        return res.status(500).json({ error: 'Failed to update task', details: error.message })
      }

      return res.status(200).json({ task: data })
    }

    if (req.method === 'DELETE') {
      const { error } = await supabaseAdmin.from('tasks').delete().eq('id', id)

      if (error) {
        return res.status(500).json({ error: 'Failed to delete task', details: error.message })
      }

      return res.status(200).json({ ok: true })
    }

    return methodNotAllowed(res, ['PATCH', 'DELETE', 'OPTIONS'])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return res.status(500).json({ error: 'Unexpected server error', details: message })
  }
}
