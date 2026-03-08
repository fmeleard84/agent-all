import type { TaskExecution } from '@agent-all/types'

export class DependencyResolver {
  getReadyTasks(
    tasks: TaskExecution[],
    definitions: { id: string; dependsOn?: string[] }[],
  ): TaskExecution[] {
    const completedIds = new Set(
      tasks.filter(t => t.status === 'completed').map(t => t.taskDefId),
    )

    return tasks.filter(task => {
      if (task.status !== 'pending' && task.status !== 'blocked') return false

      const def = definitions.find(d => d.id === task.taskDefId)
      if (!def?.dependsOn?.length) return task.status === 'pending'

      return def.dependsOn.every(depId => completedIds.has(depId))
    })
  }

  isComplete(tasks: TaskExecution[]): boolean {
    return tasks.every(t => t.status === 'completed' || t.status === 'failed')
  }

  hasFailed(tasks: TaskExecution[]): boolean {
    return tasks.some(t => t.status === 'failed')
  }

  resolveInput(
    taskDef: { input?: Record<string, any> | { fromTask: string; field: string } },
    completedTasks: TaskExecution[],
  ): Record<string, any> {
    if (!taskDef.input) return {}

    const input = taskDef.input as any
    if (input.fromTask && input.field) {
      const sourceTask = completedTasks.find(t => t.taskDefId === input.fromTask)
      if (!sourceTask?.output) return {}
      return { [input.field]: sourceTask.output[input.field], ...sourceTask.output }
    }

    return taskDef.input as Record<string, any>
  }
}
