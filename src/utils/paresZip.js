import JSZip from 'jszip'

const ALLOWED_EXTS = ['md', 'txt']

function getExt(name) {
  const m = name.match(/\.([a-zA-Z0-9]+)$/)
  return m ? m[1].toLowerCase() : null
}

function getBasename(path) {
  return path.split('/').pop().split('\\').pop()
}

/**
 * zip 파일을 풀어서 허용된 확장자(.md, .txt)의 파일들을 추출.
 *
 * @param {File} file
 * @returns {Promise<Array<{filename: string, content: string}>>}
 *   filename은 basename만 (폴더 경로 제거됨)
 */
export async function parseZip(file) {
  if (!file) return []

  const buf = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buf)

  const entries = []
  // forEach가 아니라 키 배열을 모아서 비동기 처리
  const items = []
  zip.forEach((relativePath, entry) => {
    if (entry.dir) return
    const basename = getBasename(relativePath)
    const ext = getExt(basename)
    if (!ALLOWED_EXTS.includes(ext)) return
    items.push({ entry, basename })
  })

  for (const { entry, basename } of items) {
    try {
      const content = await entry.async('string')
      entries.push({ filename: basename, content })
    } catch (e) {
      console.warn(`Failed to read ${basename}:`, e)
    }
  }

  return entries
}

/**
 * 단일 md/txt 파일을 처리 (드롭존이 zip이 아닌 단일 파일을 받았을 때).
 */
export async function readSingleTextFile(file) {
  const ext = getExt(file.name)
  if (!ALLOWED_EXTS.includes(ext)) {
    throw new Error(`지원하지 않는 확장자: .${ext}`)
  }
  const content = await file.text()
  return [{ filename: file.name, content }]
}

/**
 * 파일 종류에 따라 적절한 처리.
 */
export async function readImportFile(file) {
  if (file.name.toLowerCase().endsWith('.zip')) {
    return await parseZip(file)
  }
  return await readSingleTextFile(file)
}
