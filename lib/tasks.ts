import type { NextApiResponse } from 'next'

export type Task = {
  id: string
  title: string
  completed: boolean
  parent_id: string | null
  created_at: string
}

export type ApiError = {
  error: string
  details?: string
}

export type TasksResponse = { tasks: Task[] } | ApiError
export type TaskResponse = { task: Task } | ApiError
export type DeleteTaskResponse = { ok: true } | ApiError

export type CreateTaskInput = {
  title: string
  parent_id: string | null
}

export type UpdateTaskInput = {
  completed: boolean
}

export function parseCreateTaskInput(body: unknown): CreateTaskInput | null {
  if (!isRecord(body) || typeof body.title !== 'string') return null

  const title = body.title.trim()
  if (!title) return null

  if (body.parent_id !== undefined && body.parent_id !== null && typeof body.parent_id !== 'string') {
    return null
  }

  const parentId = typeof body.parent_id === 'string' ? body.parent_id.trim() : null

  return { title, parent_id: parentId || null }
}

export function parseUpdateTaskInput(body: unknown): UpdateTaskInput | null {
  if (!isRecord(body) || typeof body.completed !== 'boolean') return null

  return { completed: body.completed }
}

export function parseTaskId(queryId: string | string[] | undefined): string | null {
  if (typeof queryId !== 'string') return null

  const id = queryId.trim()
  return id ? id : null
}

export function methodNotAllowed(res: NextApiResponse<ApiError>, allowedMethods: string[]) {
  res.setHeader('Allow', allowedMethods)
  return res.status(405).json({ error: 'Method not allowed' })
}

export function setCorsHeaders(res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
