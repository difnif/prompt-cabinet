import { useEffect, useState } from 'react'
import { generatePrefix, ensureUniquePrefix } from '../utils/generatePrefix'

/**
 * 셀 이동 모달.
 * mode: 'new' | 'existing'
 *   - 'new': 새 프로젝트로 빼기 (이름/접두어 입력)
 *   - 'existing': 기존 프로젝트 선택해서 이동
 */
export default function MoveCellsDialog({
  open,
  selectedCells,
  projects,
  currentProjectId,
  onConfirmMoveToNew,
  onConfirmMoveToExisting,
  onClose,
}) {
  const [mode, setMode] = useState('new') // 'new' | 'existing'
  const [newName, setNewName] = useState('')
  const [newPrefix, setNewPrefix] = useState('')
  const [prefixManuallyEdited, setPrefixManuallyEdited] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode('new')
    setNewName('')
    setNewPrefix('')
    setPrefixManuallyEdited(false)
    setSelectedProjectId('')
    setSubmitting(false)
  }, [open])

  // 이름 변경 시 자동으로 접두어 생성 (수동 편집 전까지만)
  useEffect(() => {
    if (mode !== 'new') return
    if (prefixManuallyEdited) return
    if (!newName.trim()) {
      setNewPrefix('')
      return
    }
    const auto = generatePrefix(newName)
    const existingPrefixes = projects.map((p) => p.prefix)
    const unique = ensureUniquePrefix(auto, existingPrefixes)
    setNewPrefix(unique)
  }, [newName, mode, projects, prefixManuallyEdited])

  if (!open) return null

  const otherProjects = projects.filter((p) => p.id !== currentProjectId)
  const cellCount = selectedCells?.length ?? 0

  const handleSubmit = async () => {
    if (submitting) return

    if (mode === 'new') {
      if (!newName.trim() || !newPrefix.trim()) return
      setSubmitting(true)
      try {
        await onConfirmMoveToNew({
          name: newName.trim(),
          prefix: newPrefix.trim(),
        })
      } catch (e) {
        setSubmitting(false)
      }
    } else {
      if (!selectedProjectId) return
      setSubmitting(true)
      try {
        await onConfirmMoveToExisting(selectedProjectId)
      } catch (e) {
        setSubmitting(false)
      }
    }
  }

  const canSubmit =
    mode === 'new'
      ? newName.trim() && newPrefix.trim() && !submitting
      : selectedProjectId && !submitting

  return (
    <div className="modal-backdrop" onClick={submitting ? undefined : onClose}>
      <div className="modal modal--narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">{cellCount}개 셀 이동</h2>
          <button
            className="modal__close"
            onClick={onClose}
            disabled={submitting}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="modal__body">
          <div className="move-tabs">
            <button
              className={`move-tab ${mode === 'new' ? 'is-active' : ''}`}
              onClick={() => setMode('new')}
              disabled={submitting}
            >
              새 프로젝트로 빼기
            </button>
            <button
              className={`move-tab ${mode === 'existing' ? 'is-active' : ''}`}
              onClick={() => setMode('existing')}
              disabled={submitting || otherProjects.length === 0}
            >
              기존 프로젝트로
            </button>
          </div>

          {mode === 'new' ? (
            <div className="move-form">
              <div className="pe-field">
                <label className="pe-label">프로젝트 이름</label>
                <input
                  className="pe-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예: plaza-emoji-동물"
                  autoFocus
                  disabled={submitting}
                />
              </div>
              <div className="pe-field">
                <label className="pe-label">
                  접두어 <span className="pe-hint">(자동 생성됨, 수정 가능)</span>
                </label>
                <input
                  className="pe-input pe-input--prefix"
                  value={newPrefix}
                  onChange={(e) => {
                    setNewPrefix(e.target.value)
                    setPrefixManuallyEdited(true)
                  }}
                  placeholder="동"
                  disabled={submitting}
                  maxLength={3}
                />
              </div>
              <div className="move-form__hint">
                {cellCount}개 셀이 새 프로젝트 <strong>{newName || '...'}</strong>로
                이동되고, 식별어가 <code>{newPrefix || '?'}01</code>부터 다시
                할당됩니다.
              </div>
            </div>
          ) : (
            <div className="move-form">
              {otherProjects.length === 0 ? (
                <div className="move-form__empty">
                  이동할 다른 프로젝트가 없어요. 새 프로젝트로 빼기를 사용하세요.
                </div>
              ) : (
                <>
                  <div className="pe-field">
                    <label className="pe-label">대상 프로젝트</label>
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
                          <span className="move-project__count">
                            {p.cellCount ?? 0}개
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {selectedProjectId && (
                    <div className="move-form__hint">
                      {cellCount}개 셀이 <strong>
                        {projects.find((p) => p.id === selectedProjectId)?.name}
                      </strong>로 이동됩니다. 식별어는 그쪽 체계로 재할당됩니다.
                    </div>
                  )}
                </>
              )}
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
            disabled={!canSubmit}
          >
            {submitting ? '이동 중…' : '이동'}
          </button>
        </div>
      </div>
    </div>
  )
}
