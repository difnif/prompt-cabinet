import { useEffect, useRef, useState } from 'react'

const SORT_OPTIONS = [
  { value: 'identifier', label: '식별어 순' },
  { value: 'rating-desc', label: '별점 높은 순' },
  { value: 'rating-asc', label: '별점 낮은 순' },
  { value: 'recent', label: '최근 추가 순' },
  { value: 'unrated-first', label: '미평가 우선' },
]

export default function SortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const current = SORT_OPTIONS.find((o) => o.value === value) || SORT_OPTIONS[0]

  return (
    <div className="sort-menu" ref={ref}>
      <button
        className="sort-menu__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="sort-menu__label-prefix">정렬:</span>
        <span className="sort-menu__label">{current.label}</span>
        <span className="sort-menu__caret">▾</span>
      </button>
      {open && (
        <ul className="sort-menu__list" role="listbox">
          {SORT_OPTIONS.map((opt) => (
            <li key={opt.value}>
              <button
                className={`sort-menu__item ${
                  opt.value === value ? 'is-selected' : ''
                }`}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                role="option"
                aria-selected={opt.value === value}
              >
                {opt.label}
                {opt.value === value && <span className="sort-menu__check">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export { SORT_OPTIONS }

/**
 * 셀 배열을 정렬한다.
 */
export function sortCells(cells, sortBy) {
  const arr = [...cells]
  switch (sortBy) {
    case 'rating-desc':
      return arr.sort((a, b) => {
        const ra = a.rating ?? -1
        const rb = b.rating ?? -1
        if (rb !== ra) return rb - ra
        return (a.number ?? 0) - (b.number ?? 0)
      })
    case 'rating-asc':
      return arr.sort((a, b) => {
        const ra = a.rating ?? Infinity
        const rb = b.rating ?? Infinity
        if (ra !== rb) return ra - rb
        return (a.number ?? 0) - (b.number ?? 0)
      })
    case 'recent':
      return arr.sort((a, b) => {
        const at = a.createdAt?.toMillis?.() ?? 0
        const bt = b.createdAt?.toMillis?.() ?? 0
        return bt - at
      })
    case 'unrated-first':
      return arr.sort((a, b) => {
        const aRated = a.rating != null ? 1 : 0
        const bRated = b.rating != null ? 1 : 0
        if (aRated !== bRated) return aRated - bRated
        return (a.number ?? 0) - (b.number ?? 0)
      })
    case 'identifier':
    default:
      return arr.sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
  }
}
