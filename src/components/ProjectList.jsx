import { useState } from 'react'
import ProjectEditor from './ProjectEditor'

export default function ProjectList({
  projects,
  loading,
  selectedId,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
}) {
  const [editingId, setEditingId] = useState(null)
  const [creating, setCreating] = useState(false)

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <span className="sidebar__title">프로젝트</span>
        <button
          className="sidebar__add"
          onClick={() => setCreating(true)}
          aria-label="프로젝트 추가"
        >
          +
        </button>
      </div>

      {creating && (
        <ProjectEditor
          mode="create"
          onSubmit={async (payload) => {
            await onCreate(payload)
            setCreating(false)
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {loading && <div className="sidebar__empty">불러오는 중…</div>}

      {!loading && projects.length === 0 && !creating && (
        <div className="sidebar__empty">
          아직 프로젝트가 없습니다.
          <br />
          <span className="sidebar__empty-hint">＋ 를 눌러 추가하세요</span>
        </div>
      )}

      <ul className="project-list">
        {projects.map((p) =>
          editingId === p.id ? (
            <li key={p.id}>
              <ProjectEditor
                mode="edit"
                initial={{ name: p.name, prefix: p.prefix }}
                onSubmit={async (payload) => {
                  await onUpdate(p.id, payload)
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
                onDelete={async () => {
                  if (confirm(`"${p.name}" 프로젝트를 삭제할까요?\n(속한 셀도 함께 사라집니다)`)) {
                    await onDelete(p.id)
                    setEditingId(null)
                  }
                }}
              />
            </li>
          ) : (
            <li
              key={p.id}
              className={`project-item ${selectedId === p.id ? 'is-selected' : ''}`}
            >
              <button className="project-item__main" onClick={() => onSelect(p.id)}>
                <span className="project-item__prefix">{p.prefix}</span>
                <span className="project-item__name">{p.name}</span>
                <span className="project-item__count">{p.cellCount || 0}</span>
              </button>
              <button
                className="project-item__edit"
                onClick={() => setEditingId(p.id)}
                aria-label="편집"
              >
                ⋯
              </button>
            </li>
          )
        )}
      </ul>
    </aside>
  )
}
