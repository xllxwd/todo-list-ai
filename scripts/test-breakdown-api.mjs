import fs from 'node:fs'

const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000'
const envText = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : ''
const hasDeepSeekKey = envText
  .split(/\n/)
  .some((line) => line.startsWith('DEEPSEEK_API_KEY=') && line.split('=').slice(1).join('=').trim())

let parentTaskId

if (!hasDeepSeekKey) {
  console.log('SKIP /api/tasks/breakdown: DEEPSEEK_API_KEY is missing in .env.local')
  process.exit(0)
}

try {
  const parent = await createTask(`Breakdown API test ${new Date().toISOString()}`)
  parentTaskId = parent.id

  const { status, body } = await request('/api/tasks/breakdown', {
    method: 'POST',
    body: {
      id: parent.id,
      title: parent.title,
    },
  })

  assert(status === 201, `POST /api/tasks/breakdown expected 201, received ${status}`)
  assert(Array.isArray(body.steps), 'POST /api/tasks/breakdown expected body.steps to be an array')
  assert(
    body.steps.length >= 3 && body.steps.length <= 5,
    'POST /api/tasks/breakdown expected 3 to 5 steps',
  )
  assert(
    Array.isArray(body.subtasks) && body.subtasks.length === body.steps.length,
    'POST /api/tasks/breakdown expected one saved subtask per step',
  )

  for (const subtask of body.subtasks) {
    assertTask(subtask)
    assert(subtask.parent_id === parent.id, 'Saved subtask has the wrong parent_id')
  }

  assertSameOrder(
    body.subtasks.map((subtask) => subtask.title),
    body.steps,
    'Breakdown response subtasks are not in the same order as steps',
  )

  const { status: fetchStatus, body: fetchBody } = await request('/api/tasks')
  assert(fetchStatus === 200, `GET /api/tasks expected 200, received ${fetchStatus}`)

  const fetchedChildTitles = fetchBody.tasks
    .filter((task) => task.parent_id === parent.id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((task) => task.title)

  assertSameOrder(
    fetchedChildTitles,
    body.steps,
    'Fetched subtasks are not in the same order as breakdown steps',
  )

  await deleteTask(parent.id)
  parentTaskId = undefined

  console.log('PASS POST /api/tasks/breakdown')
} catch (error) {
  if (parentTaskId) {
    await deleteTask(parentTaskId).catch(() => undefined)
  }

  console.error('Breakdown API test failed.')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

async function createTask(title) {
  const { status, body } = await request('/api/tasks', {
    method: 'POST',
    body: { title },
  })

  assert(status === 201, `POST /api/tasks expected 201, received ${status}`)
  assertTask(body.task)

  return body.task
}

async function deleteTask(id) {
  const { status } = await request(`/api/tasks/${id}`, {
    method: 'DELETE',
  })

  assert(status === 200, `DELETE /api/tasks/[id] expected 200, received ${status}`)
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

function assertTask(task) {
  assert(task && typeof task === 'object', 'Expected task to be an object')
  assert(typeof task.id === 'string' && task.id.length > 0, 'Expected task.id to be a string')
  assert(typeof task.title === 'string' && task.title.length > 0, 'Expected task.title to be a string')
  assert(typeof task.completed === 'boolean', 'Expected task.completed to be a boolean')
  assert(
    task.parent_id === null || typeof task.parent_id === 'string',
    'Expected task.parent_id to be null or a string',
  )
  assert(
    typeof task.created_at === 'string' && !Number.isNaN(Date.parse(task.created_at)),
    'Expected task.created_at to be an ISO date string',
  )
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertSameOrder(actual, expected, message) {
  assert(actual.length === expected.length, `${message}: length mismatch`)

  for (const [index, value] of actual.entries()) {
    assert(value === expected[index], `${message}: mismatch at index ${index}`)
  }
}
