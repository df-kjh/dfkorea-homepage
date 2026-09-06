import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const aboutHtmlPath = fileURLToPath(
  new URL('../.output/public/about/index.html', import.meta.url),
)
const html = await readFile(aboutHtmlPath, 'utf8')

const title = '회사 소개 | (주)디에프코리아 - LED 조명 전문 기업'
const description =
  '(주)디에프코리아는 2013년부터 교육시설, 주차장, 상업·산업 현장에 맞는 LED 조명을 개발·생산해 온 조명 제조사입니다.'

const expectedTags = [
  `<title>${title}</title>`,
  `<meta name="description" content="${description}">`,
  `<meta property="og:description" content="${description}">`,
  `<meta name="twitter:description" content="${description}">`,
]

const missingTags = expectedTags.filter((tag) => !html.includes(tag))

if (missingTags.length > 0) {
  throw new Error(`About prerender is missing SEO tags:\n${missingTags.join('\n')}`)
}

console.log('Verified server-rendered SEO metadata for /about.')
