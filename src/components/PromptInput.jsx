import { useRef, useState } from 'react'
import { parsePrompts } from '../utils/parsePrompts'

export default function PromptInput({ onSubmit, disabled }) {
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef(null)

  const previewCount = parsePrompts(text).length

  const openInput = () => {
    setExpanded(true)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const closeInput = () => {
    setExpanded(false)
    setText('')
  }

  const handleSubmit = async () => {
    const prompts = parsePrompts(text)
    if (prompts.length === 0) return
    setSubmitting(true)
    try {
      await onSubmit(prompts)
      closeInput()
    } catch (e) {
      // 에러는 부모(작업 로그)에서 노출
    } finally {
      setSubmitting(false)
    }
  }

  if (!expanded) {
    return (
      <div className="prompt-input">
        <button
          className="prompt-input__open"
          onClick={openInput}
          disabled={disabled}
        >
          ＋ 프롬프트 추가
        </button>
      </div>
    )
  }

  return (
    <div className="prompt-input prompt-input--expanded">
      <div className="prompt-input__header">
        <span className="prompt-input__label">
          프롬프트 붙여넣기 · 빈 줄로 구분
        </span>
        <span className="prompt-input__count">
          {previewCount > 0 && `${previewCount}개 감지됨`}
        </span>
      </div>
      <textarea
        ref={textareaRef}
        className="prompt-input__textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`프롬프트를 빈 줄로 구분해서 붙여넣으세요.

예)
a mystical forest in pastel colors --ar 1:1 --s 250

geometric shapes floating in space --ar 1:1 --s 250

번호, 불릿, 헤더 라인(프로젝트명/접두어)은 자동 제거됩니다.`}
        disabled={submitting}
        rows={10}
      />
      <div className="prompt-input__actions">
        <button
          className="pe-btn pe-btn--ghost"
          onClick={closeInput}
          disabled={submitting}
        >
          취소
        </button>
        <button
          className="pe-btn pe-btn--primary"
          onClick={handleSubmit}
          disabled={submitting || previewCount === 0}
        >
          {submitting ? '저장 중…' : `${previewCount}개 저장`}
        </button>
      </div>
    </div>
  )
}
