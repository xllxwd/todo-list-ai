import type { NextApiRequest, NextApiResponse } from 'next'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  methodNotAllowed,
  parseCreateTaskInput,
  setCorsHeaders,
  type TaskResponse,
  type TasksResponse,
} from '@/lib/tasks'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TasksResponse | TaskResponse>,
) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch tasks', details: error.message })
      }

      return res.status(200).json({ tasks: data ?? [] })
    }

    if (req.method === 'POST') {
      const input = parseCreateTaskInput(req.body)
      if (!input) {
        return res.status(400).json({ error: 'Request body must include a non-empty title' })
      }

      const { data, error } = await supabaseAdmin
        .from('tasks')
        .insert({ title: input.title, completed: false, parent_id: input.parent_id })
        .select('*')
        .single()

      if (error) {
        return res.status(500).json({ error: 'Failed to create task', details: error.message })
      }

      return res.status(201).json({ task: data })
    }

    return methodNotAllowed(res, ['GET', 'POST', 'OPTIONS'])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return res.status(500).json({ error: 'Unexpected server error', details: message })
  }
}
