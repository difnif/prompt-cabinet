import { useState } from 'react'
import ProjectEditor from './ProjectEditor'
import ProjectMenu from './ProjectMenu'

export default function ProjectList({
  projects,
  loading,
  selectedId,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onMerge,
  onChangePrefix,
}) {
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const handleCreate = async (data) => {
    await onCreate(data)
    setCreating(false)
  }

  const handleUpdate = async (id, patch) => {
    await onUpdate(id, patch)
    setEditingId(null)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <div className="sidebar__title">프로젝트</div>
        <button
          className="sidebar__add"
          onClick={() => setCreating(true)}
          aria-label="새 프로젝트"
          title="새 프로젝트"
        >
          ＋
        </button>
      </div>

      {creating && (
        <ProjectEditor
          existingPrefixes={projects.map((p) => p.prefix)}
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}

      {!loading && projects.length === 0 && !creating && (
        <div className="sidebar__empty">
          <div>아직 프로젝트가 없습니다</div>
          <div className="sidebar__empty-hint">＋ 버튼으로 시작하세요</div>
        </div>
      )}

      <ul className="project-list">
        {projects.map((p) => {
          const isEditing = editingId === p.id
          const isSelected = p.id === selectedId
          if (isEditing) {
            return (
              <li key={p.id}>
                <ProjectEditor
                  initial={{ name: p.name, prefix: p.prefix }}
                  existingPrefixes={projects
                    .filter((x) => x.id !== p.id)
                    .map((x) => x.prefix)}
                  onSubmit={(patch) => handleUpdate(p.id, patch)}
                  onCancel={() => setEditingId(null)}
                  onDelete={async () => {
                    if (
                      confirm(
                        `프로젝트 "${p.name}"과 모든 셀을 삭제할까요?`
                      )
                    ) {
                      await onDelete(p.id)
                      setEditingId(null)
                    }
                  }}
                />
              </li>
            )
          }
          return (
            <li
              key={p.id}
              className={`project-item ${isSelected ? 'is-selected' : ''}`}
            >
              <button
                className="project-item__main"
                onClick={() => onSelect(p.id)}
              >
                <span className="project-item__prefix">{p.prefix}</span>
                <span className="project-item__name">{p.name}</span>
                <span className="project-item__count">{p.cellCount ?? 0}</span>
              </button>
              <ProjectMenu
                onRename={() => setEditingId(p.id)}
                onMerge={() => onMerge?.(p)}
                onChangePrefix={() => onChangePrefix?.(p)}
                onDelete={async () => {
                  if (
                    confirm(`프로젝트 "${p.name}"과 모든 셀을 삭제할까요?`)
                  ) {
                    await onDelete(p.id)
                  }
                }}
              />
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
