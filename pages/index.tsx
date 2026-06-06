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

type ActiveTab = 'tasks' | 'prompt'

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('tasks')
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

      <main className="app-main">
        <section className="paper-shell app-shell">
          <nav className="journal-tabs">
            <TabButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')}>
              待办事项
            </TabButton>
            <TabButton active={activeTab === 'prompt'} onClick={() => setActiveTab('prompt')}>
              提示词生成
            </TabButton>
          </nav>

          {activeTab === 'tasks' ? (
            <>
              <header className="task-header">
                <h1 className="page-title">
                  待办事项
                </h1>

                <form
                  className="task-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleAddTask()
                  }}
                >
                  <input
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                    className="task-input"
                    placeholder="写下新任务..."
                    aria-label="写下新任务"
                  />
                  <button
                    type="submit"
                    disabled={saving || !newTitle.trim()}
                    className="button button-primary add-button"
                  >
                    {saving ? '添加中' : '添加'}
                  </button>
                </form>

                {error ? (
                  <p className="error-banner">
                    {error}
                  </p>
                ) : null}
              </header>

              <TaskBoard
                loading={loading}
                taskTree={taskTree}
                breakingTaskId={breakingTaskId}
                onToggle={handleToggleTask}
                onDelete={handleDeleteTask}
                onBreakdown={handleBreakdownTask}
              />
            </>
          ) : (
            <PromptGenerator />
          )}
        </section>
      </main>
    </>
  )
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'journal-tab',
        active ? '' : 'journal-tab-idle',
      ].join(' ')}
      data-active={active}
    >
      {children}
    </button>
  )
}

function TaskBoard({
  loading,
  taskTree,
  breakingTaskId,
  onToggle,
  onDelete,
  onBreakdown,
}: {
  loading: boolean
  taskTree: TaskNode[]
  breakingTaskId: string | null
  onToggle: (task: Task) => Promise<void>
  onDelete: (task: Task) => Promise<void>
  onBreakdown: (task: Task) => Promise<void>
}) {
  return (
    <section className="task-board">
      {loading ? (
        <p className="empty-state">
          正在翻开手账...
        </p>
      ) : taskTree.length ? (
        <ul className="task-list" aria-label="任务列表">
          {taskTree.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              level={0}
              breakingTaskId={breakingTaskId}
              onToggle={onToggle}
              onDelete={onDelete}
              onBreakdown={onBreakdown}
            />
          ))}
        </ul>
      ) : (
        <p className="empty-state">
          还没有任务
        </p>
      )}
    </section>
  )
}

function PromptGenerator() {
  const [userRequest, setUserRequest] = useState('')
  const [optimizedPrompt, setOptimizedPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGeneratePrompt() {
    const request = userRequest.trim()
    if (!request) return

    setGenerating(true)
    setCopied(false)
    setError(null)

    try {
      const data = await apiRequest<{ prompt: string }>('/api/prompts/optimize', {
        method: 'POST',
        body: { user_request: request },
      })
      setOptimizedPrompt(data.prompt)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopyPrompt() {
    if (!optimizedPrompt) return

    try {
      await navigator.clipboard.writeText(optimizedPrompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('复制失败，请手动选中提示词内容复制')
    }
  }

  function handleClearPrompt() {
    setUserRequest('')
    setOptimizedPrompt('')
    setCopied(false)
    setError(null)
  }

  return (
    <section className="prompt-section">
      <h1 className="page-title">
        提示词优化
      </h1>

      <div className="prompt-stack">
        <div>
        <label className="journal-label" htmlFor="prompt-request">
          输入你的提示词：
        </label>
        <textarea
          id="prompt-request"
          value={userRequest}
          onChange={(event) => setUserRequest(event.target.value)}
          className="prompt-paper prompt-textarea"
          placeholder="分析一篇文章的写作风格、创作方法论和思维内核"
        />
        </div>

        <div className="button-row">
          <button
            type="button"
            disabled={generating || !userRequest.trim()}
            onClick={() => void handleGeneratePrompt()}
            className="button button-brown"
          >
            {generating ? '优化中' : '开始优化'}
          </button>
          <button
            type="button"
            disabled={!optimizedPrompt}
            onClick={() => void handleCopyPrompt()}
            className="button button-green"
          >
            {copied ? '已复制' : '复制结果'}
          </button>
          <button
            type="button"
            onClick={handleClearPrompt}
            className="button button-red"
          >
            清空
          </button>
        </div>

        {error ? (
          <p className="error-banner">
            {error}
          </p>
        ) : null}

        <div>
        <h2 className="journal-label">优化后的提示词：</h2>
        {optimizedPrompt ? (
          <pre className="prompt-paper prompt-output prompt-clip">
            {optimizedPrompt}
          </pre>
        ) : (
          <p className="prompt-paper prompt-empty prompt-clip">
            优化结果会显示在这里
          </p>
        )}
        </div>
      </div>
    </section>
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
    <li className="task-list-item">
      <article
        data-completed={task.completed}
        className={[
          'task-note task-card',
          level > 0 ? 'task-card-child' : 'task-card-root',
        ].join(' ')}
      >
        {task.completed ? <span className="pin" aria-hidden="true" /> : null}

        <button
          type="button"
          data-checked={task.completed}
          className="hand-checkbox"
          aria-label={task.completed ? `标记 ${task.title} 为未完成` : `标记 ${task.title} 为完成`}
          onClick={() => void onToggle(task)}
        />

        <p
          className={[
            'task-title',
            task.completed ? 'task-title-completed' : '',
          ].join(' ')}
        >
          {task.title}
        </p>

        <div className="task-actions">
          <button
            type="button"
            disabled={isBreaking}
            onClick={() => void onBreakdown(task)}
            className="button button-small button-brown"
          >
            {isBreaking ? '拆解中' : '拆解'}
          </button>
          <button
            type="button"
            onClick={() => void onDelete(task)}
            className="button button-small button-red"
          >
            删除
          </button>
        </div>
      </article>

      {children.length ? (
        <ul className="task-list task-sublist">
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
