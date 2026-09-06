import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const outputCandidates = [
  '../.vercel/output/static/about/index.html',
  '../.output/public/about/index.html',
]

let html

for (const outputPath of outputCandidates) {
  try {
    html = await readFile(fileURLToPath(new URL(outputPath, import.meta.url)), 'utf8')
    break
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

if (!html) {
  throw new Error(`About prerender was not found in:\n${outputCandidates.join('\n')}`)
}

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
