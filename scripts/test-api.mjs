const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000'
const title = `API smoke test ${new Date().toISOString()}`

let createdTaskId

async function main() {
  await testGetTasks()
  const createdTask = await testCreateTask()
  createdTaskId = createdTask.id

  await testUpdateTask(createdTask.id)
  const childTask = await testCreateSubtask(createdTask.id)
  await testSubtaskParent(childTask.id, createdTask.id)
  await testDeleteTask(createdTask.id)
  createdTaskId = undefined
  await testDeletedTaskIsGone(createdTask.id)
  await testDeletedTaskIsGone(childTask.id)

  console.log('All API tests passed.')
}

async function testGetTasks() {
  const { status, body } = await request('/api/tasks')

  assert(status === 200, `GET /api/tasks expected 200, received ${status}`)
  assert(Array.isArray(body.tasks), 'GET /api/tasks expected body.tasks to be an array')

  pass('GET /api/tasks')
}

async function testCreateTask() {
  const { status, body } = await request('/api/tasks', {
    method: 'POST',
    body: { title },
  })

  assert(status === 201, `POST /api/tasks expected 201, received ${status}`)
  assertTask(body.task)
  assert(body.task.title === title, 'POST /api/tasks returned the wrong task title')
  assert(body.task.completed === false, 'POST /api/tasks expected completed to default to false')

  pass('POST /api/tasks')
  return body.task
}

async function testUpdateTask(id) {
  const { status, body } = await request(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: { completed: true },
  })

  assert(status === 200, `PATCH /api/tasks/[id] expected 200, received ${status}`)
  assertTask(body.task)
  assert(body.task.id === id, 'PATCH /api/tasks/[id] returned the wrong task id')
  assert(body.task.completed === true, 'PATCH /api/tasks/[id] did not update completed')

  pass('PATCH /api/tasks/[id]')
}

async function testCreateSubtask(parentId) {
  const childTitle = `${title} child`
  const { status, body } = await request('/api/tasks', {
    method: 'POST',
    body: { title: childTitle, parent_id: parentId },
  })

  assert(status === 201, `POST /api/tasks subtask expected 201, received ${status}`)
  assertTask(body.task)
  assert(body.task.title === childTitle, 'POST /api/tasks subtask returned the wrong task title')
  assert(body.task.parent_id === parentId, 'POST /api/tasks subtask returned the wrong parent_id')

  pass('POST /api/tasks subtask')
  return body.task
}

async function testSubtaskParent(childId, parentId) {
  const { status, body } = await request('/api/tasks')

  assert(status === 200, `GET /api/tasks after subtask expected 200, received ${status}`)
  assert(Array.isArray(body.tasks), 'GET /api/tasks after subtask expected body.tasks to be an array')

  const child = body.tasks.find((task) => task.id === childId)
  assert(child, 'Created subtask does not appear in GET /api/tasks response')
  assert(child.parent_id === parentId, 'Created subtask did not keep its parent_id')

  pass('GET /api/tasks includes subtask parent_id')
}

async function testDeleteTask(id) {
  const { status, body } = await request(`/api/tasks/${id}`, {
    method: 'DELETE',
  })

  assert(status === 200, `DELETE /api/tasks/[id] expected 200, received ${status}`)
  assert(body.ok === true, 'DELETE /api/tasks/[id] expected { ok: true }')

  pass('DELETE /api/tasks/[id]')
}

async function testDeletedTaskIsGone(id) {
  const { status, body } = await request('/api/tasks')

  assert(status === 200, `GET /api/tasks after delete expected 200, received ${status}`)
  assert(Array.isArray(body.tasks), 'GET /api/tasks after delete expected body.tasks to be an array')
  assert(
    !body.tasks.some((task) => task.id === id),
    'Deleted task still appears in GET /api/tasks response',
  )

  pass('GET /api/tasks after delete')
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

function pass(name) {
  console.log(`PASS ${name}`)
}

main().catch(async (error) => {
  if (createdTaskId) {
    await request(`/api/tasks/${createdTaskId}`, { method: 'DELETE' }).catch(() => undefined)
  }

  console.error('API test run failed.')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
