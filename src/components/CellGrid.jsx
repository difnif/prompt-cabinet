import { useEffect, useRef } from 'react'

export default function CellGrid({
  cells,
  onSelect,
  selectedId,
  workMode,
  selectedIds,
  onToggleSelect,
  onRangeSelect,
  onDragSelect,
  showRatingDots = true,
  showImageCountBadge = true,
}) {
  const dragStateRef = useRef(null)

  useEffect(() => {
    if (!workMode) return
    const onUp = () => {
      dragStateRef.current = null
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [workMode])

  if (cells.length === 0) {
    return (
      <div className="cell-grid__empty">
        <div className="cell-grid__empty-title">아직 프롬프트가 없습니다</div>
        <div className="cell-grid__empty-sub">
          상단의 <strong>＋ 프롬프트 추가</strong> 버튼으로 시작하세요
        </div>
      </div>
    )
  }

  const handleCellMouseDown = (e, cell, index) => {
    if (!workMode) return
    e.preventDefault()
    if (e.shiftKey) return
    dragStateRef.current = {
      startIndex: index,
      lastIndex: index,
    }
  }

  const handleCellMouseEnter = (cell, index) => {
    if (!workMode) return
    const drag = dragStateRef.current
    if (!drag) return
    if (drag.lastIndex === index) return
    drag.lastIndex = index
    const lo = Math.min(drag.startIndex, drag.lastIndex)
    const hi = Math.max(drag.startIndex, drag.lastIndex)
    const ids = []
    for (let i = lo; i <= hi; i++) {
      if (cells[i]) ids.push(cells[i].id)
    }
    onDragSelect?.(ids)
  }

  const handleCellClick = (e, cell, index) => {
    if (!workMode) {
      onSelect(cell)
      return
    }
    if (e.shiftKey) {
      onRangeSelect?.(index)
      return
    }
    onToggleSelect?.(cell.id)
  }

  return (
    <div className={`cell-grid ${workMode ? 'cell-grid--work' : ''}`}>
      {cells.map((cell, index) => (
        <Cell
          key={cell.id}
          cell={cell}
          selected={!workMode && cell.id === selectedId}
          multiSelected={workMode && selectedIds?.has(cell.id)}
          workMode={workMode}
          onMouseDown={(e) => handleCellMouseDown(e, cell, index)}
          onMouseEnter={() => handleCellMouseEnter(cell, index)}
          onClick={(e) => handleCellClick(e, cell, index)}
          showRatingDots={showRatingDots}
          showImageCountBadge={showImageCountBadge}
        />
      ))}
    </div>
  )
}

function Cell({
  cell,
  selected,
  multiSelected,
  workMode,
  onMouseDown,
  onMouseEnter,
  onClick,
  showRatingDots,
  showImageCountBadge,
}) {
  const images = cell.images ?? []
  const hasImage = images.length > 0
  const hasRating = cell.rating != null && cell.rating > 0
  const discarded = !hasImage && cell.rating === 1
  const thumbUrl = hasImage ? images[0].url : null

  const cls = [
    'cell',
    selected ? 'is-selected' : '',
    multiSelected ? 'is-multi-selected' : '',
    workMode ? 'is-work' : '',
    hasImage ? 'has-image' : '',
    discarded ? 'is-discarded' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      className={cls}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      style={
        thumbUrl
          ? {
              backgroundImage: `url(${thumbUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      {hasImage && <div className="cell__overlay" />}
      {showRatingDots && hasRating && (
        <div className="cell__rating" aria-label={`${cell.rating}점`}>
          {Array.from({ length: cell.rating }).map((_, i) => (
            <span key={i} className="cell__rating-dot" />
          ))}
        </div>
      )}
      <div className="cell__id">{cell.identifier}</div>
      {showImageCountBadge && hasImage && (
        <div className="cell__image-count">{images.length}</div>
      )}
      {multiSelected && <div className="cell__check">✓</div>}
    </button>
  )
}
