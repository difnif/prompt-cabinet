import { useEffect } from 'react'
import { SORT_OPTIONS } from './SortMenu'

const TEXT_FORMAT_OPTIONS = [
  { value: 'single-txt', label: 'txt 한 파일 (재입력 가능)' },
  { value: 'individual', label: '셀별 개별 파일 (zip)' },
  { value: 'both', label: '둘 다 (zip 안에 single + individual)' },
]

const THUMB_SIZE_OPTIONS = [
  { value: 256, label: '256px (작게)' },
  { value: 512, label: '512px (썸네일, 권장)' },
  { value: 1024, label: '1024px (선명)' },
  { value: 0, label: '축소 안 함 (원본 유지)' },
]

export default function SettingsModal({ open, settings, onUpdate, onReset, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">환경설정</h2>
          <button className="modal__close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div className="modal__body">
          <section className="settings-section">
            <div className="settings-section__title">정렬</div>
            <label className="settings-row">
              <span className="settings-row__label">기본 정렬</span>
              <select
                className="settings-row__select"
                value={settings.sortBy}
                onChange={(e) => onUpdate({ sortBy: e.target.value })}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="settings-section">
            <div className="settings-section__title">다운로드 (Step 6 적용 예정)</div>
            <label className="settings-row">
              <span className="settings-row__label">텍스트 다운로드 형식</span>
              <select
                className="settings-row__select"
                value={settings.textDownloadFormat}
                onChange={(e) => onUpdate({ textDownloadFormat: e.target.value })}
              >
                {TEXT_FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-row">
              <span className="settings-row__label">다운로드 후 자동 축소 크기</span>
              <select
                className="settings-row__select"
                value={settings.imageThumbSize}
                onChange={(e) =>
                  onUpdate({ imageThumbSize: Number(e.target.value) })
                }
              >
                {THUMB_SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="settings-section">
            <div className="settings-section__title">표시</div>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.showRatingDots}
                onChange={(e) => onUpdate({ showRatingDots: e.target.checked })}
              />
              <span>셀에 별점 도트 표시</span>
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.showImageCountBadge}
                onChange={(e) =>
                  onUpdate({ showImageCountBadge: e.target.checked })
                }
              />
              <span>셀에 이미지 개수 배지 표시</span>
            </label>
          </section>
        </div>

        <div className="modal__footer">
          <button className="pe-btn pe-btn--ghost" onClick={onReset}>
            기본값으로 초기화
          </button>
          <button className="pe-btn pe-btn--primary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
