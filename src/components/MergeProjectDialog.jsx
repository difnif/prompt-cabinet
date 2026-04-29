import { useEffect, useState } from 'react'

export default function MergeProjectDialog({
  open,
  sourceProject,
  projects,
  onConfirm,
  onClose,
}) {
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelectedProjectId('')
    setSubmitting(false)
  }, [open])

  if (!open || !sourceProject) return null

  const otherProjects = projects.filter((p) => p.id !== sourceProject.id)

  const handleSubmit = async () => {
    if (!selectedProjectId || submitting) return
    setSubmitting(true)
    try {
      await onConfirm(selectedProjectId)
    } catch {
      setSubmitting(false)
    }
  }

  const dstProject = projects.find((p) => p.id === selectedProjectId)

  return (
    <div className="modal-backdrop" onClick={submitting ? undefined : onClose}>
      <div className="modal modal--narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">프로젝트 합치기</h2>
          <button
            className="modal__close"
            onClick={onClose}
            disabled={submitting}
          >
            ×
          </button>
        </div>

        <div className="modal__body">
          <div className="merge-source">
            <span className="move-project__prefix">{sourceProject.prefix}</span>
            <div>
              <div className="merge-source__name">{sourceProject.name}</div>
              <div className="merge-source__count">
                {sourceProject.cellCount ?? 0}개 셀
              </div>
            </div>
          </div>

          <div className="merge-arrow">↓ 합칠 대상</div>

          {otherProjects.length === 0 ? (
            <div className="move-form__empty">
              합칠 다른 프로젝트가 없어요.
            </div>
          ) : (
            <div className="move-projects">
              {otherProjects.map((p) => (
                <button
                  key={p.id}
                  className={`move-project ${
                    selectedProjectId === p.id ? 'is-selected' : ''
                  }`}
                  onClick={() => setSelectedProjectId(p.id)}
                  disabled={submitting}
                >
                  <span className="move-project__prefix">{p.prefix}</span>
                  <span className="move-project__name">{p.name}</span>
                  <span className="move-project__count">{p.cellCount ?? 0}개</span>
                </button>
              ))}
            </div>
          )}

          {dstProject && (
            <div className="merge-warning">
              <strong>"{sourceProject.name}"의 모든 셀</strong>이{' '}
              <strong>"{dstProject.name}"</strong>로 이동되고,{' '}
              <strong>"{sourceProject.name}" 프로젝트는 삭제됩니다.</strong>
              <br />
              식별어는 새 프로젝트의 체계로 재할당됩니다 (되돌리기 어려움).
            </div>
          )}
        </div>

        <div className="modal__footer">
          <button
            className="pe-btn pe-btn--ghost"
            onClick={onClose}
            disabled={submitting}
          >
            취소
          </button>
          <button
            className="pe-btn pe-btn--danger-solid"
            onClick={handleSubmit}
            disabled={!selectedProjectId || submitting}
          >
            {submitting ? '합치는 중…' : '합치기'}
          </button>
        </div>
      </div>
    </div>
  )
}
