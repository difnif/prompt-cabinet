import { useEffect, useRef } from 'react'

/**
 * 위험 동작 확인용 모달.
 * Enter = 확인, Esc = 취소.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmText = '확인',
  cancelText = '취소',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null)

  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel?.()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm?.()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onConfirm, onCancel])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="confirm-title"
      >
        <div className="confirm-dialog__title" id="confirm-title">
          {title}
        </div>
        {message && <div className="confirm-dialog__message">{message}</div>}
        {detail && <div className="confirm-dialog__detail">{detail}</div>}
        <div className="confirm-dialog__actions">
          <button className="pe-btn pe-btn--ghost" onClick={onCancel}>
            {cancelText} <span className="confirm-dialog__hint">Esc</span>
          </button>
          <button
            ref={confirmRef}
            className={`pe-btn ${danger ? 'pe-btn--danger-solid' : 'pe-btn--primary'}`}
            onClick={onConfirm}
          >
            {confirmText} <span className="confirm-dialog__hint">Enter</span>
          </button>
        </div>
      </div>
    </div>
  )
}
