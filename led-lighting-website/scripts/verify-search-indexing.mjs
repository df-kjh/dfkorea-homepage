import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const pages = [
  {
    path: '/',
    outputPath: 'index.html',
    title: '(주)디에프코리아 - LED 조명 전문 기업 | 혁신적인 조명 솔루션',
    description:
      '혁신적인 LED 조명 기술로 더 나은 빛을 제공하는 (주)디에프코리아. 고품질 LED 제품과 솔루션을 경험해보세요. 에너지 효율적이고 친환경적인 LED 조명 제품을 만나보세요.',
  },
  {
    path: '/about',
    outputPath: 'about/index.html',
    title: '회사 소개 | (주)디에프코리아 - LED 조명 전문 기업',
    description:
      '(주)디에프코리아는 2013년부터 교육시설, 주차장, 상업·산업 현장에 맞는 LED 조명을 개발·생산해 온 조명 제조사입니다.',
  },
  {
    path: '/products',
    outputPath: 'products/index.html',
    title: '제품 목록 | (주)디에프코리아 - 다양한 LED 조명 제품',
    description:
      '(주)디에프코리아의 다양한 LED 조명 제품을 만나보세요. 산업용, 상업용, 가정용 LED 조명 솔루션을 제공합니다. 에너지 효율적이고 고품질의 LED 제품을 확인하세요.',
  },
  {
    path: '/blog',
    outputPath: 'blog/index.html',
    title: '회사 소식 | (주)디에프코리아 - LED 조명 업계 뉴스 및 정보',
    description:
      '(주)디에프코리아의 최신 소식과 LED 조명 산업 동향을 확인하세요. 신제품 출시, 기술 혁신, 업계 트렌드 등 다양한 정보를 제공합니다.',
  },
  {
    path: '/certificates',
    outputPath: 'certificates/index.html',
    title: '인증 현황 | (주)디에프코리아 - LED 조명 전문 기업',
    description:
      '(주)디에프코리아가 보유한 다양한 인증서와 품질 기준을 확인하세요. 국제 표준을 준수하는 LED 조명 전문 기업입니다.',
  },
]

const outputRoots = ['../.vercel/output/static', '../.output/public']
const canonicalOrigin = 'https://dfkorealed.com'

// Discoverable detail links must never make editable/deletable content a build snapshot.
const detailRoute = /^\/?(products|blog)\/[^/]+\/?$/
const detailArtifact =
  /^(products|blog)\/(?:[^/]+\/(?:index\.html|_payload\.json)|(?!index\.html$)[^/]+\.html)$/
try {
  const config = JSON.parse(
    await readFile(new URL('../.vercel/output/config.json', import.meta.url), 'utf8'),
  )
  const staticDetails = Object.entries(config.overrides ?? {}).filter(
    ([file, override]) => detailArtifact.test(file) || detailRoute.test(override.path ?? ''),
  )
  if (staticDetails.length) {
    throw new Error(
      `Dynamic details must be request-rendered; found ${staticDetails.length} Vercel static overrides: ${staticDetails.map(([file]) => file).join(', ')}`,
    )
  }
  for (const section of ['products', 'blog']) {
    if (!config.routes?.some((route) => route.dest === `/${section}/[id]`)) {
      throw new Error(`Vercel is missing the dynamic /${section}/:id route`)
    }
  }
  console.log(
    'Verified product/blog detail routes: zero Vercel static overrides and dynamic routes present.',
  )
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

for (const outputRoot of outputRoots) {
  try {
    const files = await readdir(new URL(outputRoot, import.meta.url), { recursive: true })
    const staticDetails = files.filter((file) => detailArtifact.test(file))
    if (staticDetails.length) {
      throw new Error(
        `Dynamic detail artifacts must not be static in ${outputRoot}: ${staticDetails.join(', ')}`,
      )
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

async function readGeneratedPage(outputPath) {
  for (const outputRoot of outputRoots) {
    try {
      return await readFile(
        fileURLToPath(new URL(`${outputRoot}/${outputPath}`, import.meta.url)),
        'utf8',
      )
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }

  throw new Error(`Generated HTML was not found for ${outputPath}`)
}

for (const page of pages) {
  const html = await readGeneratedPage(page.outputPath)
  const canonicalUrls = [...html.matchAll(/<link rel="canonical" href="([^"]+)">/g)].map(
    (match) => match[1],
  )
  const expectedCanonical = `${canonicalOrigin}${page.path === '/' ? '' : page.path}`

  if (canonicalUrls.length !== 1 || canonicalUrls[0] !== expectedCanonical) {
    throw new Error(
      `${page.path} must have exactly one canonical ${expectedCanonical}; found ${JSON.stringify(canonicalUrls)}`,
    )
  }

  if (html.includes('www.dfkorealed.com')) {
    throw new Error(`${page.path} still includes www.dfkorealed.com`)
  }

  const expectedTags = [
    `<title>${page.title}</title>`,
    `<meta name="description" content="${page.description}">`,
    '<meta name="robots" content="index, follow">',
  ]
  const missingTags = expectedTags.filter((tag) => !html.includes(tag))

  if (missingTags.length > 0) {
    throw new Error(`${page.path} is missing SEO tags:\n${missingTags.join('\n')}`)
  }

  if (page.path === '/products' || page.path === '/blog') {
    const detailAnchors = [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].filter(([, href]) => {
      const url = new URL(href, canonicalOrigin)
      return (
        url.origin === canonicalOrigin &&
        new RegExp(`^${page.path}/[^/]+$`).test(url.pathname) &&
        !url.search &&
        !url.hash
      )
    })
    if (detailAnchors.length === 0) {
      throw new Error(`${page.path} generated HTML has zero canonical detail anchors`)
    }
    console.log(`Verified ${page.path}: ${detailAnchors.length} server-rendered detail anchors.`)
  }
}

console.log('Verified search indexing metadata.')
