import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const outputDirectory = resolve(process.cwd(), '.output')
const configuredUrl = process.env.VITE_API_BASE_URL?.trim()
const localhostFallback = 'http://localhost:3000'

if (!configuredUrl) {
  throw new Error('VITE_API_BASE_URL is required to verify the production bundle')
}

const collectFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path)))
    } else if (entry.isFile()) {
      files.push(path)
    }
  }

  return files
}

const files = await collectFiles(outputDirectory)
let configuredMatches = 0
const fallbackMatches = []

for (const file of files) {
  const content = await readFile(file, 'utf8')
  if (content.includes(configuredUrl)) {
    configuredMatches += 1
  }
  if (content.includes(localhostFallback)) {
    fallbackMatches.push(file)
  }
}

if (configuredMatches === 0) {
  throw new Error(`Configured API URL was not found in ${outputDirectory}`)
}

if (fallbackMatches.length > 0) {
  throw new Error(
    `Production bundle contains localhost API fallback in: ${fallbackMatches.join(', ')}`,
  )
}

console.log(
  `Verified ${configuredUrl} in ${configuredMatches} production files; localhost fallback absent.`,
)
