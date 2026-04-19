import { useEffect, useRef, useState } from 'react'

export default function ProjectEditor({
  mode = 'create',
  initial,
  onSubmit,
  onCancel,
  onDelete,
}) {
  const [name, setName] = useState(initial?.name || '')
  const [prefix, setPrefix] = useState(initial?.prefix || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const nameRef = useRef(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedPrefix = prefix.trim()
    if (!trimmedName) return setError('프로젝트 이름을 입력하세요')
    if (!trimmedPrefix) return setError('접두어를 입력하세요')
    if (trimmedPrefix.length > 3) return setError('접두어는 3자 이내를 권장합니다')

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ name: trimmedName, prefix: trimmedPrefix })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <form className="project-editor" onSubmit={handleSubmit}>
      <label className="pe-field">
        <span className="pe-label">이름</span>
        <input
          ref={nameRef}
          className="pe-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 굿즈샵 스티커"
          maxLength={40}
          disabled={submitting}
        />
      </label>
      <label className="pe-field">
        <span className="pe-label">
          접두어 <span className="pe-hint">식별어에 붙습니다 (예: 굿, 다)</span>
        </span>
        <input
          className="pe-input pe-input--prefix"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="굿"
          maxLength={3}
          disabled={submitting}
        />
      </label>

      {error && <div className="pe-error">{error}</div>}

      <div className="pe-actions">
        {mode === 'edit' && onDelete && (
          <button
            type="button"
            className="pe-btn pe-btn--danger"
            onClick={onDelete}
            disabled={submitting}
          >
            삭제
          </button>
        )}
        <div className="pe-actions__right">
          <button
            type="button"
            className="pe-btn pe-btn--ghost"
            onClick={onCancel}
            disabled={submitting}
          >
            취소
          </button>
          <button type="submit" className="pe-btn pe-btn--primary" disabled={submitting}>
            {mode === 'create' ? '추가' : '저장'}
          </button>
        </div>
      </div>
    </form>
  )
}
