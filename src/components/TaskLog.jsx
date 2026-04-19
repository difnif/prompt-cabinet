import { useTaskLog } from '../contexts/TaskLogContext'

function StatusIcon({ status }) {
  if (status === 'running') return <span className="tl-spinner" />
  if (status === 'success') return <span className="tl-icon tl-icon--ok">✓</span>
  if (status === 'error') return <span className="tl-icon tl-icon--err">!</span>
  return null
}

export default function TaskLog() {
  const { entries, removeEntry, clearAll } = useTaskLog()

  if (entries.length === 0) return null

  return (
    <div className="task-log">
      <div className="task-log__header">
        <span className="task-log__title">작업</span>
        <button className="task-log__clear" onClick={clearAll}>
          모두 지우기
        </button>
      </div>
      <ul className="task-log__list">
        {entries.map((e) => (
          <li key={e.id} className={`tl-item tl-item--${e.status}`}>
            <StatusIcon status={e.status} />
            <span className="tl-label">{e.label}</span>
            <button
              className="tl-dismiss"
              onClick={() => removeEntry(e.id)}
              aria-label="제거"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
