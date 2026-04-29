import { useEffect, useState } from 'react'

export default function ChangePrefixDialog({
  open,
  project,
  existingPrefixes,
  onConfirm,
  onClose,
}) {
  const [newPrefix, setNewPrefix] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setNewPrefix(project?.prefix ?? '')
    setSubmitting(false)
    setError(null)
  }, [open, project])

  if (!open || !project) return null

  const cleanNew = newPrefix.trim()
  const sameAsCurrent = cleanNew === project.prefix
  const conflicts = existingPrefixes
    .filter((p) => p !== project.prefix)
    .includes(cleanNew)

  const handleSubmit = async () => {
    setError(null)
    if (!cleanNew) {
      setError('접두어를 입력하세요')
      return
    }
    if (sameAsCurrent) {
      onClose()
      return
    }
    if (conflicts) {
      setError(`'${cleanNew}'는 이미 사용 중인 접두어입니다`)
      return
    }
    if (cleanNew.length > 3) {
      setError('접두어는 3자 이내여야 합니다')
      return
    }

    setSubmitting(true)
    try {
      await onConfirm(cleanNew)
    } catch (e) {
      setSubmitting(false)
      setError(e.message)
    }
  }

  return (
    <div className="modal-backdrop" onClick={submitting ? undefined : onClose}>
      <div className="modal modal--narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">접두어 변경</h2>
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
            <span className="move-project__prefix">{project.prefix}</span>
            <div>
              <div className="merge-source__name">{project.name}</div>
              <div className="merge-source__count">
                {project.cellCount ?? 0}개 셀
              </div>
            </div>
          </div>

          <div className="pe-field" style={{ marginTop: 16 }}>
            <label className="pe-label">새 접두어 (1~3자)</label>
            <input
              className="pe-input pe-input--prefix"
              value={newPrefix}
              onChange={(e) => setNewPrefix(e.target.value)}
              maxLength={3}
              autoFocus
              disabled={submitting}
            />
          </div>

          {error && <div className="pe-error">{error}</div>}

          {!error && cleanNew && !sameAsCurrent && !conflicts && (
            <div className="merge-warning">
              모든 셀의 식별어가 <code>{project.prefix}01</code> →{' '}
              <code>{cleanNew}01</code> 형식으로 변경됩니다.
              <br />
              외부에 식별어를 기록해두셨다면 모두 어긋나니 주의하세요.
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
            className="pe-btn pe-btn--primary"
            onClick={handleSubmit}
            disabled={
              !cleanNew || sameAsCurrent || conflicts || submitting
            }
          >
            {submitting ? '변경 중…' : '변경'}
          </button>
        </div>
      </div>
    </div>
  )
}
