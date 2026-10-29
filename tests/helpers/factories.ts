import type { Task, User } from '@/types'

// Typed fixture factories (issue 149). Every required field of the schema has a
// default, so a spec states only what it is about and needs no `as any` or
// `as Task`. A schema change that adds a required field fails here, once.

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    userId: 'user-1',
    username: 'ada',
    email: 'ada@example.org',
    role: 'student',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    taskId: 'task-1',
    deploymentId: 'dep-1',
    type: 'deploy',
    status: 'success',
    created_at: '2026-06-08T12:09:00Z',
    logs: null,
    ...overrides,
  }
}
