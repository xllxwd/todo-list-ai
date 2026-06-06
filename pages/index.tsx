import Head from 'next/head'
import { useEffect, useMemo, useState } from 'react'

type Task = {
  id: string
  title: string
  completed: boolean
  parent_id: string | null
  created_at: string
}

type TaskNode = Task & {
  children: Task[]
}

type ApiError = {
  error?: string
  details?: string
}

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [breakingTaskId, setBreakingTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const taskTree = useMemo(() => buildTaskTree(tasks), [tasks])

  useEffect(() => {
    void loadTasks()
  }, [])

  async function loadTasks() {
    setLoading(true)
    setError(null)

    try {
      const data = await apiRequest<{ tasks: Task[] }>('/api/tasks')
      setTasks(data.tasks)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  async function handleAddTask() {
    const title = newTitle.trim()
    if (!title) return

    setSaving(true)
    setError(null)

    try {
      const data = await apiRequest<{ task: Task }>('/api/tasks', {
        method: 'POST',
        body: { title, parent_id: null },
      })

      setTasks((currentTasks) => [data.task, ...currentTasks])
      setNewTitle('')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleTask(task: Task) {
    const nextCompleted = !task.completed
    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask.id === task.id ? { ...currentTask, completed: nextCompleted } : currentTask,
      ),
    )
    setError(null)

    try {
      await apiRequest<{ task: Task }>(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: { completed: nextCompleted },
      })
    } catch (requestError) {
      setTasks((currentTasks) =>
        currentTasks.map((currentTask) =>
          currentTask.id === task.id ? { ...currentTask, completed: task.completed } : currentTask,
        ),
      )
      setError(getErrorMessage(requestError))
    }
  }

  async function handleDeleteTask(task: Task) {
    const removedIds = collectTaskIds(task.id, tasks)
    const previousTasks = tasks

    setTasks((currentTasks) => currentTasks.filter((currentTask) => !removedIds.has(currentTask.id)))
    setError(null)

    try {
      await apiRequest<{ ok: true }>(`/api/tasks/${task.id}`, {
        method: 'DELETE',
      })
    } catch (requestError) {
      setTasks(previousTasks)
      setError(getErrorMessage(requestError))
    }
  }

  async function handleBreakdownTask(task: Task) {
    setBreakingTaskId(task.id)
    setError(null)

    try {
      const data = await apiRequest<{ subtasks: Task[]; steps: string[] }>('/api/tasks/breakdown', {
        method: 'POST',
        body: { id: task.id, title: task.title },
      })

      setTasks((currentTasks) => [...data.subtasks, ...currentTasks])
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBreakingTaskId(null)
    }
  }

  return (
    <>
      <Head>
        <title>待办事项</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen px-4 py-6 font-serifcn text-[#28313a] sm:px-6 lg:px-8">
        <section className="paper-shell mx-auto min-h-[calc(100vh-3rem)] w-full max-w-5xl border border-[#927d5f]/25 px-4 py-7 shadow-paper sm:px-8 lg:px-12">
          <header className="mx-auto mb-8 max-w-4xl">
            <h1 className="mb-7 text-center font-journal text-5xl font-normal leading-none text-[#28313a] sm:text-6xl">
              待办事项
            </h1>

            <form
              className="grid gap-3 sm:grid-cols-[1fr_auto]"
              onSubmit={(event) => {
                event.preventDefault()
                void handleAddTask()
              }}
            >
              <input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                className="min-h-14 border-2 border-dashed border-[#806549]/75 bg-white/45 px-4 font-journal text-xl outline-none transition focus:border-[#725337] focus:bg-white/70 focus:ring-4 focus:ring-[#806549]/10"
                placeholder="写下新任务..."
                aria-label="写下新任务"
              />
              <button
                type="submit"
                disabled={saving || !newTitle.trim()}
                className="min-h-14 bg-[#b5a691] px-8 font-journal text-lg text-[#fffaf0] shadow-note transition hover:-translate-y-0.5 hover:bg-[#a3947f] disabled:cursor-not-allowed disabled:opacity-55 sm:min-w-28"
              >
                {saving ? '添加中' : '添加'}
              </button>
            </form>

            {error ? (
              <p className="mt-4 border border-[#bf6b68]/30 bg-[#fff4ef]/70 px-4 py-3 font-journal text-lg text-[#914a47]">
                {error}
              </p>
            ) : null}
          </header>

          <section className="mx-auto max-w-4xl">
            {loading ? (
              <p className="border border-dashed border-[#806549]/40 bg-white/35 px-5 py-10 text-center font-journal text-xl text-[#8e806f]">
                正在翻开手账...
              </p>
            ) : taskTree.length ? (
              <ul className="space-y-3" aria-label="任务列表">
                {taskTree.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    level={0}
                    breakingTaskId={breakingTaskId}
                    onToggle={handleToggleTask}
                    onDelete={handleDeleteTask}
                    onBreakdown={handleBreakdownTask}
                  />
                ))}
              </ul>
            ) : (
              <p className="border border-dashed border-[#806549]/40 bg-white/35 px-5 py-10 text-center font-journal text-xl text-[#8e806f]">
                还没有任务
              </p>
            )}
          </section>
        </section>
      </main>
    </>
  )
}

function TaskItem({
  task,
  level,
  breakingTaskId,
  onToggle,
  onDelete,
  onBreakdown,
}: {
  task: TaskNode | Task
  level: number
  breakingTaskId: string | null
  onToggle: (task: Task) => Promise<void>
  onDelete: (task: Task) => Promise<void>
  onBreakdown: (task: Task) => Promise<void>
}) {
  const children = 'children' in task ? task.children : []
  const isBreaking = breakingTaskId === task.id

  return (
    <li className="space-y-3">
      <article
        data-completed={task.completed}
        className={[
          'task-note border border-[#8a7658]/25 bg-[#fffdf8]/85 px-4 py-4 shadow-note backdrop-blur-md transition',
          'grid grid-cols-[auto_1fr] gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-6',
          level > 0 ? 'ml-7 border-l-4 border-l-[#806549]/80 sm:ml-14' : 'border-l-4 border-l-[#806549]/85',
        ].join(' ')}
      >
        {task.completed ? <span className="pin" aria-hidden="true" /> : null}

        <button
          type="button"
          data-checked={task.completed}
          className="hand-checkbox mt-1"
          aria-label={task.completed ? `标记 ${task.title} 为未完成` : `标记 ${task.title} 为完成`}
          onClick={() => void onToggle(task)}
        />

        <p
          className={[
            'min-w-0 break-words font-journal text-[1.35rem] leading-snug',
            task.completed ? 'text-[#6f675e]/60 line-through decoration-[#8f6c44] decoration-2' : '',
          ].join(' ')}
        >
          {task.title}
        </p>

        <div className="col-start-2 flex flex-wrap justify-end gap-2 sm:col-start-auto">
          <button
            type="button"
            disabled={isBreaking}
            onClick={() => void onBreakdown(task)}
            className="min-h-10 bg-[#806549] px-5 font-journal text-base text-[#fffaf0] shadow-note transition hover:-translate-y-0.5 hover:bg-[#624e39] disabled:cursor-wait disabled:opacity-60"
          >
            {isBreaking ? '拆解中' : '拆解'}
          </button>
          <button
            type="button"
            onClick={() => void onDelete(task)}
            className="min-h-10 bg-[#c86f70] px-5 font-journal text-base text-[#fffaf0] shadow-note transition hover:-translate-y-0.5 hover:bg-[#a85355]"
          >
            删除
          </button>
        </div>
      </article>

      {children.length ? (
        <ul className="space-y-3">
          {children.map((child) => (
            <TaskItem
              key={child.id}
              task={{ ...child, children: [] }}
              level={level + 1}
              breakingTaskId={breakingTaskId}
              onToggle={onToggle}
              onDelete={onDelete}
              onBreakdown={onBreakdown}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

async function apiRequest<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const data = (await response.json().catch(() => ({}))) as T | ApiError

  if (!response.ok) {
    const errorData = data as ApiError
    throw new Error(errorData.details || errorData.error || '请求失败')
  }

  return data as T
}

function buildTaskTree(tasks: Task[]): TaskNode[] {
  const sortedTasks = [...tasks].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  const topLevelTasks: TaskNode[] = []
  const childrenByParent = new Map<string, Task[]>()

  sortedTasks.forEach((task) => {
    if (!task.parent_id) {
      topLevelTasks.push({ ...task, children: [] })
      return
    }

    const children = childrenByParent.get(task.parent_id) ?? []
    children.push(task)
    childrenByParent.set(task.parent_id, children)
  })

  return topLevelTasks.map((task) => ({
    ...task,
    children: (childrenByParent.get(task.id) ?? []).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    ),
  }))
}

function collectTaskIds(taskId: string, tasks: Task[]) {
  const ids = new Set([taskId])
  let changed = true

  while (changed) {
    changed = false

    tasks.forEach((task) => {
      if (task.parent_id && ids.has(task.parent_id) && !ids.has(task.id)) {
        ids.add(task.id)
        changed = true
      }
    })
  }

  return ids
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '请求失败'
}
