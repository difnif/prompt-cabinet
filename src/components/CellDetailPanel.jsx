import { useState } from 'react'

export default function CellDetailPanel({ cell, onClose, onDelete, onCopy }) {
  const [copying, setCopying] = useState(false)

  if (!cell) return null

  const handleCopy = async () => {
    setCopying(true)
    try {
      await onCopy(cell)
    } finally {
      setTimeout(() => setCopying(false), 800)
    }
  }

  return (
    <div className="detail-panel">
      <div className="detail-panel__handle" />
      <div className="detail-panel__header">
        <div className="detail-panel__id">{cell.identifier}</div>
        <button
          className="detail-panel__close"
          onClick={onClose}
          aria-label="닫기"
        >
          ×
        </button>
      </div>
      <div className="detail-panel__prompt">{cell.prompt}</div>
      <div className="detail-panel__meta">
        <span>이미지 {cell.images?.length ?? 0}개</span>
        <span>·</span>
        <span>{cell.rating != null ? `별점 ${cell.rating}` : '평가 전'}</span>
      </div>
      <div className="detail-panel__actions">
        <button
          className="pe-btn pe-btn--danger"
          onClick={() => {
            if (confirm(`${cell.identifier}을(를) 삭제할까요?`)) onDelete(cell)
          }}
        >
          삭제
        </button>
        <div className="detail-panel__actions-right">
          <button
            className="pe-btn pe-btn--primary"
            onClick={handleCopy}
            disabled={copying}
          >
            {copying ? '복사됨 ✓' : '프롬프트 복사'}
          </button>
        </div>
      </div>
    </div>
  )
}
