import { useEffect, useRef, useState } from 'react'
import RatingInput from './RatingInput'
import {
  deleteCellImage,
  extractImageFromClipboard,
  uploadCellImage,
} from '../utils/imageUpload'

export default function CellDetailPanel({
  cell,
  userId,
  projectId,
  onClose,
  onDelete,
  onCopy,
  onRatingChange,
  taskLog,
}) {
  const [copying, setCopying] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const panelRef = useRef(null)

  // 패널이 열린 동안 클립보드 붙여넣기 활성화
  useEffect(() => {
    if (!cell) return
    const onPaste = (e) => {
      const target = e.target
      // 텍스트 input/textarea에 붙여넣을 땐 가로채지 않음
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')
      ) {
        return
      }
      const blob = extractImageFromClipboard(e)
      if (blob) {
        e.preventDefault()
        handleUpload(blob)
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell])

  if (!cell) return null

  const handleUpload = async (blob) => {
    if (!blob) return
    if (uploading) return
    setUploading(true)
    const taskId = taskLog?.startTask?.(`${cell.identifier} 이미지 업로드 중…`)
    try {
      await uploadCellImage({
        userId,
        projectId,
        cellId: cell.id,
        identifier: cell.identifier,
        blob,
      })
      taskLog?.succeedTask?.(taskId, `${cell.identifier} 이미지 업로드됨`)
    } catch (e) {
      console.error('Upload failed:', e)
      taskLog?.failTask?.(taskId, `업로드 실패: ${e.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      await handleUpload(file)
    }
  }

  const handleDeleteImage = async (image) => {
    if (!confirm('이 이미지를 삭제할까요?')) return
    const taskId = taskLog?.startTask?.(`${cell.identifier} 이미지 삭제 중…`)
    try {
      await deleteCellImage({
        projectId,
        cellId: cell.id,
        image,
        currentImages: cell.images || [],
      })
      taskLog?.succeedTask?.(taskId, `${cell.identifier} 이미지 삭제됨`)
    } catch (e) {
      console.error('Delete image failed:', e)
      taskLog?.failTask?.(taskId, `삭제 실패: ${e.message}`)
    }
  }

  const handleCopy = async () => {
    setCopying(true)
    try {
      await onCopy(cell)
    } finally {
      setTimeout(() => setCopying(false), 800)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const images = cell.images ?? []

  return (
    <div className="detail-panel" ref={panelRef}>
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

      <div className="detail-panel__rating-row">
        <span className="detail-panel__rating-label">별점</span>
        <RatingInput
          value={cell.rating ?? null}
          onChange={(v) => onRatingChange(cell, v)}
        />
      </div>

      <div
        className={`detail-panel__upload ${dragOver ? 'is-drag-over' : ''} ${
          uploading ? 'is-uploading' : ''
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="detail-panel__upload-text">
          {uploading
            ? '업로드 중…'
            : 'Ctrl+V로 붙여넣기 · 드래그 · 클릭해서 파일 선택'}
        </div>
        <button
          className="detail-panel__upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          파일 선택
        </button>
      </div>

      {images.length > 0 && (
        <div className="detail-panel__images">
          {images.map((img, i) => (
            <div key={img.path || i} className="detail-panel__image">
              <img src={img.url} alt={`${cell.identifier} ${i + 1}`} />
              <button
                className="detail-panel__image-del"
                onClick={() => handleDeleteImage(img)}
                aria-label="이미지 삭제"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="detail-panel__meta">
        <span>이미지 {images.length}개</span>
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
          셀 삭제
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
