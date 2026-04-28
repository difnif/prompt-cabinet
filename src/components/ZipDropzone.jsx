import { useRef, useState } from 'react'

export default function ZipDropzone({ onFileSelected, importing, progress }) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onFileSelected(file)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) onFileSelected(file)
    // 같은 파일 재선택 가능하도록 초기화
    e.target.value = ''
  }

  return (
    <div
      className={`zip-dropzone ${dragOver ? 'is-drag-over' : ''} ${
        importing ? 'is-importing' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        if (!importing) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !importing && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,.md,.txt,application/zip,text/markdown,text/plain"
        hidden
        onChange={handleFileChange}
      />
      {importing ? (
        <div className="zip-dropzone__importing">
          <div className="zip-dropzone__spinner" />
          <div className="zip-dropzone__importing-text">
            {progress?.label || '처리 중…'}
          </div>
          {progress?.total > 0 && (
            <div className="zip-dropzone__progress-bar">
              <div
                className="zip-dropzone__progress-fill"
                style={{
                  width: `${Math.min(100, (progress.current / progress.total) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="zip-dropzone__icon">📦</div>
          <div className="zip-dropzone__title">
            zip 또는 md/txt 파일을 끌어다 놓거나 클릭
          </div>
          <div className="zip-dropzone__sub">
            여러 프로젝트를 한 번에 가져올 수 있어요. 같은 이름의 프로젝트는 자동으로 병합됩니다.
          </div>
        </>
      )}
    </div>
  )
}
