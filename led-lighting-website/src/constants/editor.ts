import type { ToolbarNames } from 'md-editor-v3'

/**
 * 마크다운 에디터 기본 툴바 설정
 */
export const DEFAULT_TOOLBAR: ToolbarNames[] = [
  'bold',
  'underline',
  'italic',
  'strikeThrough',
  '-',
  'title',
  'sub',
  'sup',
  'quote',
  'unorderedList',
  'orderedList',
  'task',
  '-',
  'codeRow',
  'code',
  'link',
  'image',
  'table',
  '-',
  'revoke',
  'next',
  '=',
  'pageFullscreen',
  'fullscreen',
  'preview',
  'catalog',
]

/**
 * 마크다운 에디터 기본 플레이스홀더
 */
export const DEFAULT_MARKDOWN_PLACEHOLDER =
  '마크다운 형식으로 내용을 작성하세요. 이미지는 툴바의 이미지 버튼을 클릭하여 추가할 수 있습니다.'
