import { extractHeaders, parsePrompts } from './parsePrompts'
import { generatePrefix } from './generatePrefix'

/**
 * 파일명에서 확장자를 제거하고 프로젝트명으로 사용 가능한 형태로 정제.
 */
function filenameToProjectName(filename) {
  if (!filename) return null
  // 경로 제거
  const basename = filename.split('/').pop().split('\\').pop()
  // 확장자 제거
  const dotIdx = basename.lastIndexOf('.')
  const stem = dotIdx > 0 ? basename.slice(0, dotIdx) : basename
  // 하이픈/언더스코어를 공백으로
  const cleaned = stem.replace(/[-_]+/g, ' ').trim()
  return cleaned || null
}

/**
 * md 또는 txt 파일을 파싱.
 *
 * @param {string} filename - 파일 이름 (예: 'goods-shop.md')
 * @param {string} content - 파일 내용 텍스트
 * @returns {{
 *   filename: string,
 *   projectName: string | null,
 *   prefix: string | null,
 *   prompts: string[],
 *   source: 'header' | 'filename' | 'mixed',
 *   errors: string[]
 * }}
 */
export function parseMdFile(filename, content) {
  const errors = []

  if (!content || !content.trim()) {
    errors.push('빈 파일')
    return {
      filename,
      projectName: null,
      prefix: null,
      prompts: [],
      source: 'header',
      errors,
    }
  }

  const headers = extractHeaders(content)
  const prompts = parsePrompts(content)

  // 프로젝트명 결정
  let projectName = headers.name
  let nameSource = 'header'
  if (!projectName) {
    projectName = filenameToProjectName(filename)
    nameSource = 'filename'
  }

  // 접두어 결정
  let prefix = headers.prefix
  let prefixSource = 'header'
  if (!prefix) {
    prefix = generatePrefix(projectName || filename)
    prefixSource = 'filename'
  }

  // 길이 보정 (3자 초과는 자르기)
  if (prefix && prefix.length > 3) {
    prefix = prefix.slice(0, 3)
  }

  let source = 'header'
  if (nameSource === 'filename' && prefixSource === 'filename') source = 'filename'
  else if (nameSource !== prefixSource) source = 'mixed'

  if (!projectName) {
    errors.push('프로젝트명을 결정할 수 없음')
  }
  if (prompts.length === 0) {
    errors.push('프롬프트 0개')
  }

  return {
    filename,
    projectName,
    prefix,
    prompts,
    source,
    errors,
  }
}
