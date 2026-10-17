import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { useScheduledTasks, useTaskAction, useUpdateTaskTriggers } from '@/api/queries/admin'
import { ErrorText } from '@/components/AuthCard'
import { Button } from '@/components/Button'
import { TimeField } from '@/components/TimeField'
import { triggerLabel, type ScheduledTask, type TaskTrigger } from '@/domain/admin'
import { formatDuration, formatRelative } from '@/lib/format'
import { Meter, SectionTitle } from './parts'

const STATUS_TONE: Record<string, string> = { Completed: 'text-emerald-400', Failed: 'text-red-400', Cancelled: 'text-amber-300', Aborted: 'text-red-400' }

/** All scheduled tasks by category: last run, schedule, run / stop, schedule editor. */
export function TasksSection() {
  const tasks = useScheduledTasks()
  const categories = new Map<string, ScheduledTask[]>()
  for (const task of tasks.data ?? []) categories.set(task.category, [...(categories.get(task.category) ?? []), task])

  const running = (tasks.data ?? []).filter((t) => t.state !== 'Idle').length

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle action={running > 0 && <span className="text-xs text-accent-400">{running} running</span>}>Scheduled tasks</SectionTitle>
      {tasks.isError && <ErrorText>{errorMessage(tasks.error)}</ErrorText>}
      {[...categories].map(([category, list]) => (
        <div key={category} className="flex flex-col gap-1">
          <h3 className="border-b border-neutral-800 pb-1 text-xs font-semibold text-neutral-300">{category}</h3>
          <ul className="flex flex-col divide-y divide-neutral-800">
            {list.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

function TaskRow({ task }: { task: ScheduledTask }) {
  const action = useTaskAction()
  const [editing, setEditing] = useState(false)
  const running = task.state !== 'Idle'
  const last = task.lastResult
  const duration = last?.start && last.end ? (new Date(last.end).getTime() - new Date(last.start).getTime()) / 1000 : undefined

  return (
    <li className="flex flex-col gap-1 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{task.name}</div>
          <div className="text-xs text-neutral-500">{task.description}</div>
        </div>
        <Button
          variant={running ? 'ghost' : 'secondary'}
          disabled={task.state === 'Cancelling' || action.isPending}
          onClick={() => action.mutate({ taskId: task.id, action: running ? 'stop' : 'start' })}
        >
          {task.state === 'Cancelling' ? 'Stopping…' : running ? 'Stop' : 'Run'}
        </Button>
      </div>
      {running ? (
        <div className="flex items-center gap-2">
          <Meter value={(task.progress ?? 0) / 100} />
          <span className="text-xs text-neutral-400 tabular-nums">{Math.round(task.progress ?? 0)}%</span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-3 text-xs text-neutral-500">
          {last ? (
            <span>
              Last run <span className={STATUS_TONE[last.status] ?? ''}>{last.status.toLowerCase()}</span>
              {last.end && ` ${formatRelative(last.end)}`}
              {duration !== undefined && duration >= 1 && ` · took ${formatDuration(duration)}`}
            </span>
          ) : (
            <span>Never run</span>
          )}
          <span>{task.triggers.length > 0 ? task.triggers.map(triggerLabel).join(', ') : 'No schedule'}</span>
          <button type="button" className="text-accent-400 hover:underline" onClick={() => setEditing((e) => !e)}>
            {editing ? 'Close schedule' : 'Edit schedule'}
          </button>
        </div>
      )}
      {last?.error && last.status !== 'Completed' && <p className="text-xs text-red-300">{last.error}</p>}
      {action.isError && <ErrorText>{errorMessage(action.error)}</ErrorText>}
      {editing && !running && <TriggerEditor task={task} />}
    </li>
  )
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const INPUT = 'rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm focus:border-accent-500 focus:outline-none'

const fromClock = (value: string) => {
  const [h = 0, m = 0] = value.split(':').map(Number)
  return h * 3600 + m * 60
}

/** List of the task's triggers with remove, plus a form to add one. Saves the whole list. */
function TriggerEditor({ task }: { task: ScheduledTask }) {
  const update = useUpdateTaskTriggers()
  const [type, setType] = useState<TaskTrigger['type']>('daily')
  const [time, setTime] = useState('03:00')
  const [hours, setHours] = useState(12)
  const [day, setDay] = useState('Sunday')

  const save = (triggers: TaskTrigger[]) => update.mutate({ taskId: task.id, triggers })
  const newTrigger = (): TaskTrigger => {
    switch (type) {
      case 'daily':
        return { type, secondsOfDay: fromClock(time) }
      case 'weekly':
        return { type, day, secondsOfDay: fromClock(time) }
      case 'interval':
        return { type, seconds: Math.max(0.25, hours) * 3600 }
      case 'startup':
        return { type }
    }
  }

  return (
    <div className="mt-1 flex flex-col gap-2 rounded border border-neutral-800 px-3 py-2">
      {task.triggers.length === 0 && <p className="text-xs text-neutral-500">Runs only when started by hand.</p>}
      <ul className="flex flex-col gap-1">
        {task.triggers.map((trigger, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-sm">
            {triggerLabel(trigger)}
            <Button variant="ghost" disabled={update.isPending} onClick={() => save(task.triggers.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select aria-label="Trigger type" className={INPUT} value={type} onChange={(e) => setType(e.target.value as TaskTrigger['type'])}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="interval">Every …</option>
          <option value="startup">On startup</option>
        </select>
        {type === 'weekly' && (
          <select aria-label="Day" className={INPUT} value={day} onChange={(e) => setDay(e.target.value)}>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
        {(type === 'daily' || type === 'weekly') && (
          <TimeField label="Time" value={time} onChange={setTime} />
        )}
        {type === 'interval' && (
          <label className="flex items-center gap-1">
            <input
              aria-label="Hours"
              type="number"
              min={0.25}
              step={0.25}
              className={`${INPUT} w-20`}
              value={hours}
              onChange={(e) => setHours(e.target.valueAsNumber || 1)}
            />
            hours
          </label>
        )}
        <Button variant="primary" disabled={update.isPending} onClick={() => save([...task.triggers, newTrigger()])}>
          Add
        </Button>
      </div>
      {update.isError && <ErrorText>{errorMessage(update.error)}</ErrorText>}
    </div>
  )
}
