import JSZip from 'jszip'

/**
 * Blob을 브라우저에서 다운로드 트리거.
 */
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 약간 지연 후 revoke
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * 셀들의 프롬프트를 prompt-cabinet 규격(빈 줄 구분)의 단일 txt로 만든다.
 */
export function buildSingleTxt(cells) {
  return cells.map((c) => c.prompt).join('\n\n') + '\n'
}

/**
 * 오늘 날짜 문자열 (다운로드 파일명 prefix용).
 */
function todayStr() {
  const d = new Date()
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * URL의 이미지를 fetch해서 Blob으로 가져온다.
 */
async function fetchImageBlob(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${res.status}`)
  return await res.blob()
}

/**
 * 텍스트만 다운로드.
 *
 * format:
 *   'single-txt'  → 단일 txt 파일
 *   'individual'  → 셀별 개별 txt를 zip으로
 *   'both'        → zip 안에 single + individual 둘 다
 *
 * onProgress?: ({current, total, label}) => void
 */
export async function downloadTextOnly(cells, format, projectName, onProgress) {
  const dateStr = todayStr()
  const baseName = sanitizeFilename(`${projectName || '프로젝트'}_${dateStr}`)
  onProgress?.({ current: 0, total: 1, label: '텍스트 생성 중…' })

  if (format === 'single-txt') {
    const text = buildSingleTxt(cells)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    triggerDownload(blob, `${baseName}.txt`)
    return
  }

  // individual or both → zip
  const zip = new JSZip()
  if (format === 'both') {
    zip.file('all-prompts.txt', buildSingleTxt(cells))
  }
  cells.forEach((c) => {
    zip.file(`prompts/${c.identifier}.txt`, c.prompt + '\n')
  })
  const blob = await zip.generateAsync({ type: 'blob' }, (meta) => {
    onProgress?.({
      current: Math.round(meta.percent),
      total: 100,
      label: 'zip 생성 중…',
    })
  })
  triggerDownload(blob, `${baseName}_text.zip`)
}

/**
 * 이미지만 다운로드.
 * 이미지를 모두 zip으로 묶는다.
 * 파일명: {identifier}_{n}.{ext}
 */
export async function downloadImagesOnly(cells, projectName, onProgress) {
  const dateStr = todayStr()
  const baseName = sanitizeFilename(`${projectName || '프로젝트'}_${dateStr}`)
  const zip = new JSZip()

  // 다운로드 대상 수 계산
  let total = 0
  cells.forEach((c) => (total += c.images?.length || 0))
  if (total === 0) {
    throw new Error('다운로드할 이미지가 없습니다')
  }

  let done = 0
  for (const cell of cells) {
    const images = cell.images || []
    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      onProgress?.({
        current: done,
        total,
        label: `${cell.identifier}_${i + 1} 다운로드 중…`,
      })
      try {
        const blob = await fetchImageBlob(img.url)
        const ext = extractExt(img.name) || extractExt(img.path) || 'png'
        zip.file(`images/${cell.identifier}_${i + 1}.${ext}`, blob)
      } catch (e) {
        console.warn(`Failed to fetch ${img.url}:`, e)
      }
      done++
    }
  }

  onProgress?.({ current: 95, total: 100, label: 'zip 생성 중…' })
  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, `${baseName}_images.zip`)
}

/**
 * 텍스트 + 이미지 모두 다운로드. 한 zip에 묶음.
 *
 * 구조:
 *   /all-prompts.txt
 *   /prompts/굿17.txt
 *   /prompts/굿18.txt
 *   /images/굿17_1.png
 *   /images/굿17_2.png
 *   ...
 */
export async function downloadAll(cells, projectName, textFormat, onProgress) {
  const dateStr = todayStr()
  const baseName = sanitizeFilename(`${projectName || '프로젝트'}_${dateStr}`)
  const zip = new JSZip()

  // 텍스트 추가
  if (textFormat === 'single-txt') {
    zip.file('prompts.txt', buildSingleTxt(cells))
  } else if (textFormat === 'individual') {
    cells.forEach((c) => {
      zip.file(`prompts/${c.identifier}.txt`, c.prompt + '\n')
    })
  } else {
    // both
    zip.file('all-prompts.txt', buildSingleTxt(cells))
    cells.forEach((c) => {
      zip.file(`prompts/${c.identifier}.txt`, c.prompt + '\n')
    })
  }

  // 이미지 추가
  let total = 0
  cells.forEach((c) => (total += c.images?.length || 0))
  let done = 0
  for (const cell of cells) {
    const images = cell.images || []
    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      onProgress?.({
        current: done,
        total: total || 1,
        label: `${cell.identifier}_${i + 1} 다운로드 중…`,
      })
      try {
        const blob = await fetchImageBlob(img.url)
        const ext = extractExt(img.name) || extractExt(img.path) || 'png'
        zip.file(`images/${cell.identifier}_${i + 1}.${ext}`, blob)
      } catch (e) {
        console.warn(`Failed to fetch ${img.url}:`, e)
      }
      done++
    }
  }

  onProgress?.({ current: 95, total: 100, label: 'zip 생성 중…' })
  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, `${baseName}.zip`)
}

function extractExt(name) {
  if (!name) return null
  const m = name.match(/\.([a-zA-Z0-9]+)$/)
  return m ? m[1].toLowerCase() : null
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100)
}
