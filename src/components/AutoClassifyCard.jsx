import { useAutoClassify } from '../contexts/AutoClassifyContext'

/**
 * 자동 분류 플로팅 카드
 *
 * 우하단에 떠 있는 카드. 다음 단계를 모두 한 카드 안에서 처리:
 *   - preview: 사용자에게 분류 결과 미리보기 보여주고 "실행" 받기
 *   - running: 진행률 + 그룹별 상태
 *   - cancelling: 되돌리는 중
 *   - done: 완료 (3초 후 자동 닫힘)
 *   - error: 에러 표시
 *
 * 접기 누르면 헤더만 남아서 진행률만 작은 영역으로 표시됨.
 */
export default function AutoClassifyCard() {
  const {
    currentJob,
    queue,
    progress,
    phase,
    pendingPreview,
    error,
    cardCollapsed,
    setCardCollapsed,
    confirmAndStart,
    cancelPreview,
    requestCancel,
    finishAndAdvance,
  } = useAutoClassify()

  // 표시할 게 없으면 안 보임
  const showPreview = phase === 'preview' && pendingPreview
  const showJob = currentJob && (phase === 'running' || phase === 'cancelling' || phase === 'done')
  const showError = phase === 'error'

  if (!showPreview && !showJob && !showError) {
    return null
  }

  // ────────── PREVIEW ──────────
  if (showPreview) {
    const { project, classification } = pendingPreview
    return (
      <div className="ac-card">
        <div className="ac-card__header">
          <div className="ac-card__title">자동 분류 — {project.name}</div>
        </div>
        <div className="ac-card__body">
          <p className="ac-card__summary">
            <strong>{classification.stats.totalCells}개</strong> 중{' '}
            <strong>{classification.stats.classifiedCells}개</strong> 분류 가능 (
            {classification.stats.classificationRate}%)
          </p>
          {classification.groups.length === 0 ? (
            <p className="ac-card__warning">
              의미 있는 그룹이 발견되지 않았어요. 키워드 매칭이 약한 데이터일 수 있어요.
            </p>
          ) : (
            <>
              <p className="ac-card__lead">
                새 프로젝트 <strong>{classification.groups.length}개</strong>가 생성됩니다:
              </p>
              <ul className="ac-card__group-list">
                {classification.groups.map((g) => (
                  <li key={g.id}>
                    <span className="ac-card__group-label">{g.label}</span>
                    <span className="ac-card__group-count">{g.cells.length}개</span>
                  </li>
                ))}
              </ul>
              {classification.unclassified.length > 0 && (
                <p className="ac-card__hint">
                  분류 안 된 {classification.unclassified.length}개는 원본 프로젝트에 그대로 남아요.
                </p>
              )}
            </>
          )}
        </div>
        <div className="ac-card__footer">
          <button className="ac-card__btn" onClick={cancelPreview}>
            취소
          </button>
          {classification.groups.length > 0 && (
            <button className="ac-card__btn ac-card__btn--primary" onClick={confirmAndStart}>
              실행
            </button>
          )}
        </div>
      </div>
    )
  }

  // ────────── ERROR ──────────
  if (showError) {
    return (
      <div className="ac-card">
        <div className="ac-card__header">
          <div className="ac-card__title">자동 분류 오류</div>
        </div>
        <div className="ac-card__body">
          <p className="ac-card__error">{error || '알 수 없는 오류'}</p>
        </div>
        <div className="ac-card__footer">
          <button className="ac-card__btn" onClick={finishAndAdvance}>
            닫기
          </button>
        </div>
      </div>
    )
  }

  // ────────── RUNNING / CANCELLING / DONE ──────────
  const job = currentJob
  const completedGroups = job.plannedGroups.filter((g) => g.status === 'done').length
  const totalGroups = job.plannedGroups.length
  const progressPercent =
    totalGroups > 0 ? Math.round((completedGroups / totalGroups) * 100) : 0

  // 접힌 상태 — 헤더와 진행률만
  if (cardCollapsed) {
    return (
      <div className="ac-card ac-card--collapsed">
        <div
          className="ac-card__header"
          onClick={() => setCardCollapsed(false)}
          style={{ cursor: 'pointer' }}
        >
          <div className="ac-card__title">
            {phase === 'cancelling'
              ? '되돌리는 중…'
              : phase === 'done'
              ? '완료'
              : `${job.sourceProjectName} 분류 중`}
          </div>
          <div className="ac-card__compact-progress">
            {completedGroups}/{totalGroups}
          </div>
          <button
            className="ac-card__icon-btn"
            onClick={(e) => {
              e.stopPropagation()
              setCardCollapsed(false)
            }}
            aria-label="펼치기"
          >
            ⌃
          </button>
        </div>
        <div className="ac-card__progress-bar">
          <div
            className="ac-card__progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    )
  }

  // 펼친 상태
  return (
    <div className="ac-card">
      <div className="ac-card__header">
        <div className="ac-card__title">
          {phase === 'cancelling' ? '되돌리는 중…' : `자동 분류 — ${job.sourceProjectName}`}
        </div>
        <button
          className="ac-card__icon-btn"
          onClick={() => setCardCollapsed(true)}
          aria-label="접기"
          title="접기"
        >
          ⌄
        </button>
      </div>

      <div className="ac-card__body">
        {job.resumedFromInterrupt && phase === 'running' && completedGroups > 0 && (
          <p className="ac-card__resumed">↻ 이전 작업 이어서 진행 중</p>
        )}

        <div className="ac-card__progress-bar">
          <div
            className="ac-card__progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="ac-card__progress-text">
          {completedGroups} / {totalGroups} 그룹 ({progressPercent}%)
        </p>
        <p className="ac-card__current-label">{progress.label || ' '}</p>

        {/* 그룹별 상태 리스트 */}
        <ul className="ac-card__group-list">
          {job.plannedGroups.map((g, i) => {
            const cls =
              g.status === 'done'
                ? 'is-done'
                : g.status === 'running'
                ? 'is-running'
                : g.status === 'failed'
                ? 'is-failed'
                : 'is-pending'
            const icon =
              g.status === 'done'
                ? '✓'
                : g.status === 'running'
                ? '◐'
                : g.status === 'failed'
                ? '✗'
                : '○'
            return (
              <li key={g.categoryId} className={`ac-card__group-item ${cls}`}>
                <span className="ac-card__group-status-icon">{icon}</span>
                <span className="ac-card__group-label">{g.label}</span>
                <span className="ac-card__group-count">{g.cellIds.length}개</span>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="ac-card__footer">
        {phase === 'running' && (
          <button className="ac-card__btn ac-card__btn--danger" onClick={requestCancel}>
            취소·되돌리기
          </button>
        )}
        {phase === 'cancelling' && (
          <button className="ac-card__btn" disabled>
            되돌리는 중…
          </button>
        )}
        {phase === 'done' && (
          <button className="ac-card__btn ac-card__btn--primary" onClick={finishAndAdvance}>
            확인
          </button>
        )}
        {queue.length > 0 && (
          <span className="ac-card__queue">+{queue.length}개 대기 중</span>
        )}
      </div>
    </div>
  )
}
