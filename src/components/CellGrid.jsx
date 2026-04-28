export default function CellGrid({
  cells,
  onSelect,
  selectedId,
  workMode,
  showRatingDots = true,
  showImageCountBadge = true,
}) {
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

  return (
    <div className={`cell-grid ${workMode ? 'cell-grid--work' : ''}`}>
      {cells.map((cell) => (
        <Cell
          key={cell.id}
          cell={cell}
          selected={cell.id === selectedId}
          onClick={() => onSelect(cell)}
          showRatingDots={showRatingDots}
          showImageCountBadge={showImageCountBadge}
        />
      ))}
    </div>
  )
}

function Cell({ cell, selected, onClick, showRatingDots, showImageCountBadge }) {
  const images = cell.images ?? []
  const hasImage = images.length > 0
  const hasRating = cell.rating != null && cell.rating > 0
  const discarded = !hasImage && cell.rating === 1
  const thumbUrl = hasImage ? images[0].url : null

  return (
    <button
      className={`cell ${selected ? 'is-selected' : ''} ${
        hasImage ? 'has-image' : ''
      } ${discarded ? 'is-discarded' : ''}`}
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
    </button>
  )
}
