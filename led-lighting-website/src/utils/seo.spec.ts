import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './seo'

const render = (markdown: string): HTMLDivElement => {
  const container = document.createElement('div')
  container.innerHTML = renderMarkdown(markdown)
  return container
}

describe('product description Markdown tables', () => {
  it('renders the existing PIPE specification header and first row as a semantic table', () => {
    const result = render('## 기술 사양\n| 구분 | 세부 내용 |\n| :--- | :--- |\n| **제품명** | 파이프 팬던트 (PIPE) |')

    expect(result.querySelectorAll('table')).toHaveLength(1)
    expect([...result.querySelectorAll('th')].map(cell => cell.textContent)).toEqual(['구분', '세부 내용'])
    expect(result.querySelector('th')?.getAttribute('scope')).toBe('col')
    expect(result.querySelector('tbody tr')?.textContent).toBe('제품명파이프 팬던트 (PIPE)')
    expect(result.querySelector('td strong')?.textContent).toBe('제품명')
  })

  it('accepts tables without outer pipes and preserves column alignment', () => {
    const result = render('항목 | 옵션 | 값\n:--- | :---: | ---:\n전력 | 일반 | 40W')

    expect([...result.querySelectorAll('th')].map(cell => cell.style.textAlign)).toEqual(['left', 'center', 'right'])
    expect([...result.querySelectorAll('td')].map(cell => cell.style.textAlign)).toEqual(['left', 'center', 'right'])
    expect(result.querySelectorAll('td')).toHaveLength(3)
  })

  it('keeps escaped pipes and inline code inside their cell', () => {
    const result = render('| 표기 | 설명 |\n| --- | --- |\n| A\\|B | `x|y` 및 **굵게** |')

    expect([...result.querySelectorAll('td')].map(cell => cell.textContent)).toEqual(['A|B', 'x|y 및 굵게'])
    expect(result.querySelector('td code')?.textContent).toBe('x|y')
  })

  it('fills missing cells and ignores extra body cells without consuming following prose', () => {
    const result = render('- 선택 안내\n\n항목 | 값\n--- | ---\n전력 | 40W | 참고\n인증 |\n\n## 문의\n사양을 확인해 주세요.')

    expect(result.querySelectorAll('tbody tr')).toHaveLength(2)
    expect([...result.querySelectorAll('td')].map(cell => cell.textContent)).toEqual(['전력', '40W', '인증', ''])
    expect(result.querySelector('ul table')).toBeNull()
    expect(result.querySelector('h2')?.textContent).toBe('문의')
    expect(result.lastElementChild?.textContent).toBe('사양을 확인해 주세요.')
  })

  it.each([
    '항목 | 값\n설명 | 내용',
    '항목 | 값\n--- | --- | ---',
    '항목 | 값\n--- | 잘못된 구분',
    '일반 제목\n---',
  ])('keeps non-table pipe text and malformed separators as text: %s', markdown => {
    const result = render(markdown)
    expect(result.querySelector('table')).toBeNull()
    expect(result.querySelectorAll('p')).toHaveLength(2)
  })

  it.each([
    ['## 설치 | 문의', 'h2', '설치 | 문의'],
    ['- A | B', 'ul li', 'A | B'],
  ])('ends a table before a following block containing pipes: %s', (following, selector, content) => {
    const result = render(`| A | B |\n| --- | --- |\n| x | y |\n${following}`)
    expect(result.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(result.querySelector(selector)?.textContent).toBe(content)
  })

  it('escapes HTML in table headers and values', () => {
    const result = render('| <script>alert(1)</script> | 값 |\n| --- | --- |\n| <img src=x onerror=alert(1)> | **A&B** |')

    expect(result.querySelector('table')).not.toBeNull()
    expect(result.querySelector('script, img')).toBeNull()
    expect(result.querySelector('th')?.textContent).toBe('<script>alert(1)</script>')
    expect(result.querySelector('td')?.textContent).toBe('<img src=x onerror=alert(1)>')
    expect(result.querySelector('strong')?.textContent).toBe('A&B')
  })
})

describe('product description inline content', () => {
  it('renders preserved technical image URLs and safe reference links', () => {
    const result = render('![배광 자료](https://example.com/technical.webp)\n[상세 사양](/products/example)')
    expect(result.querySelector('img')?.getAttribute('src')).toBe('https://example.com/technical.webp')
    expect(result.querySelector('img')?.getAttribute('alt')).toBe('배광 자료')
    expect(result.querySelector('a')?.getAttribute('href')).toBe('/products/example')
    expect(result.querySelector('a')?.textContent).toBe('상세 사양')
  })

  it.each(['javascript:alert%281%29', 'data:text/html,evil', '//evil.example.com/file', 'vbscript:evil'])('rejects unsafe Markdown URL %s', url => {
    const result = render(`![자료](${url}) [참조](${url})`)
    expect(result.querySelector('img, a')).toBeNull()
  })

  it('escapes link labels and URL attributes without parsing Markdown inside code', () => {
    const result = render('[<img onerror=evil>](https://example.com/?q="&x=1)\n`**plain** ![x](https://example.com/x)`')
    expect(result.querySelector('a')?.textContent).toBe('<img onerror=evil>')
    expect(result.querySelector('a')?.getAttribute('href')).toBe('https://example.com/?q="&x=1')
    expect(result.querySelector('img, strong')).toBeNull()
    expect(result.querySelector('code')?.textContent).toBe('**plain** ![x](https://example.com/x)')
  })
})
