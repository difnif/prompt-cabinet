import { useEffect, useRef, useState } from 'react'

/**
 * 프로젝트 항목의 ⋯ 메뉴.
 *
 * @param {Object} props
 * @param {() => void} props.onRename
 * @param {() => void} props.onMerge
 * @param {() => void} props.onChangePrefix
 * @param {() => void} props.onAutoClassify
 * @param {() => void} props.onDelete
 */
export default function ProjectMenu({
  onRename,
  onMerge,
  onChangePrefix,
  onAutoClassify,
  onDelete,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleAction = (action) => {
    setOpen(false)
    action()
  }

  return (
    <div className="project-menu" ref={ref}>
      <button
        className="project-menu__trigger"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        aria-label="프로젝트 메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ⋯
      </button>
      {open && (
        <div className="project-menu__list" role="menu">
          <button
            className="project-menu__item"
            onClick={(e) => {
              e.stopPropagation()
              handleAction(onRename)
            }}
          >
            이름 변경
          </button>
          <button
            className="project-menu__item"
            onClick={(e) => {
              e.stopPropagation()
              handleAction(onChangePrefix)
            }}
          >
            접두어 변경
          </button>
          <button
            className="project-menu__item"
            onClick={(e) => {
              e.stopPropagation()
              handleAction(onAutoClassify)
            }}
          >
            자동 분류
          </button>
          <button
            className="project-menu__item"
            onClick={(e) => {
              e.stopPropagation()
              handleAction(onMerge)
            }}
          >
            다른 프로젝트와 합치기
          </button>
          <div className="project-menu__divider" />
          <button
            className="project-menu__item project-menu__item--danger"
            onClick={(e) => {
              e.stopPropagation()
              handleAction(onDelete)
            }}
          >
            삭제
          </button>
        </div>
      )}
    </div>
  )
}
