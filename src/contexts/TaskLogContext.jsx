import { createContext, useCallback, useContext, useRef, useState } from 'react'

const TaskLogContext = createContext(null)

let _id = 0
const nextId = () => ++_id

export function TaskLogProvider({ children }) {
  const [entries, setEntries] = useState([])
  const timersRef = useRef(new Map())

  const removeEntry = useCallback((id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
    const t = timersRef.current.get(id)
    if (t) {
      clearTimeout(t)
      timersRef.current.delete(id)
    }
  }, [])

  const scheduleAutoRemove = useCallback(
    (id, delay) => {
      const t = setTimeout(() => removeEntry(id), delay)
      timersRef.current.set(id, t)
    },
    [removeEntry]
  )

  const startTask = useCallback((label, meta = {}) => {
    const id = nextId()
    setEntries((prev) => [
      { id, label, status: 'running', startedAt: Date.now(), ...meta },
      ...prev,
    ])
    return id
  }, [])

  const succeedTask = useCallback(
    (id, label) => {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, status: 'success', label: label || e.label, endedAt: Date.now() }
            : e
        )
      )
      scheduleAutoRemove(id, 3000)
    },
    [scheduleAutoRemove]
  )

  const failTask = useCallback(
    (id, label) => {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, status: 'error', label: label || e.label, endedAt: Date.now() }
            : e
        )
      )
      scheduleAutoRemove(id, 6000)
    },
    [scheduleAutoRemove]
  )

  const clearAll = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t))
    timersRef.current.clear()
    setEntries([])
  }, [])

  const value = { entries, startTask, succeedTask, failTask, removeEntry, clearAll }

  return <TaskLogContext.Provider value={value}>{children}</TaskLogContext.Provider>
}

export function useTaskLog() {
  const ctx = useContext(TaskLogContext)
  if (!ctx) throw new Error('useTaskLog must be used within TaskLogProvider')
  return ctx
}
