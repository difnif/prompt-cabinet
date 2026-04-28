import { useEffect, useState } from 'react'

const HELP_DISMISSED_KEY = 'prompt-cabinet:work-help-dismissed:v1'

export default function WorkModeBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onDownloadText,
  onDownloadImages,
  onDownloadAll,
  onCopyIdentifiers,
  onDelete,
}) {
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    // 처음 사용 시 안내 자동 펼침
    try {
      const dismissed = localStorage.getItem(HELP_DISMISSED_KEY) === '1'
      if (!dismissed) setHelpOpen(true)
    } catch {}
  }, [])

  const closeHelp = () => {
    setHelpOpen(false)
    try {
      localStorage.setItem(HELP_DISMISSED_KEY, '1')
    } catch {}
  }

  const hasSelection = selectedCount > 0
  const allSelected = selectedCount === totalCount && totalCount > 0

  return (
    <div className="work-bar">
      <div className="work-bar__main">
        <button
          className="work-bar__help-toggle"
          onClick={() => (helpOpen ? closeHelp() : setHelpOpen(true))}
          aria-label="도움말"
          title="도움말"
        >
          ?
        </button>

        <div className="work-bar__count">
          {hasSelection ? (
            <>
              <strong>{selectedCount}</strong>
              <span className="work-bar__count-total"> / {totalCount}</span>
            </>
          ) : (
            <span className="work-bar__hint">셀을 클릭해서 선택하세요</span>
          )}
        </div>

        <div className="work-bar__select-actions">
          <button
            className="work-bar__btn work-bar__btn--ghost"
            onClick={allSelected ? onClearSelection : onSelectAll}
            disabled={totalCount === 0}
          >
            {allSelected ? '선택 해제' : '전체 선택'}
          </button>
        </div>

        <div className="work-bar__divider" />

        <div className="work-bar__actions">
          <button
            className="work-bar__btn"
            onClick={onCopyIdentifiers}
            disabled={!hasSelection}
            title="식별어를 클립보드로 복사"
          >
            식별어 복사
          </button>
          <button
            className="work-bar__btn"
            onClick={onDownloadText}
            disabled={!hasSelection}
          >
            텍스트
          </button>
          <button
            className="work-bar__btn"
            onClick={onDownloadImages}
            disabled={!hasSelection}
          >
            이미지
          </button>
          <button
            className="work-bar__btn work-bar__btn--primary"
            onClick={onDownloadAll}
            disabled={!hasSelection}
          >
            둘 다 (zip)
          </button>
          <button
            className="work-bar__btn work-bar__btn--danger"
            onClick={onDelete}
            disabled={!hasSelection}
          >
            삭제
          </button>
        </div>
      </div>

      {helpOpen && (
        <div className="work-bar__help">
          <div className="work-bar__help-header">
            <strong>작업 모드 사용법</strong>
            <button
              className="work-bar__help-close"
              onClick={closeHelp}
              aria-label="도움말 닫기"
            >
              ×
            </button>
          </div>
          <ul className="work-bar__help-list">
            <li>
              <span className="kbd">클릭</span>으로 셀을 하나씩 선택/해제
            </li>
            <li>
              <span className="kbd">Shift+클릭</span>으로 범위 선택 (마지막 선택부터)
            </li>
            <li>
              <span className="kbd">드래그</span>로 첫 셀부터 끝 셀까지 한 번에 선택
            </li>
            <li>
              <span className="kbd">전체 선택</span> 버튼으로 현재 정렬된 모든 셀 선택
            </li>
            <li>선택 후 <strong>텍스트/이미지/둘 다</strong>로 다운로드</li>
            <li>
              <strong>식별어 복사</strong>는 명령 모드에 붙여넣을 때 유용 (Step 7)
            </li>
            <li>다운로드 형식과 자동 축소 크기는 <strong>⚙ 환경설정</strong>에서 변경</li>
          </ul>
          <div className="work-bar__help-note">
            도움말은 다시 보지 않습니다. 필요하면 좌측의 <span className="kbd">?</span> 버튼을 누르세요.
          </div>
        </div>
      )}
    </div>
  )
}
