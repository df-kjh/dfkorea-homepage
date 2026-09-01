import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const RELAY_ROUTE = '/api/internal/g2b-relay'

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

export const verifyG2bRelayArtifact = async (outputDirectory) => {
  const serverDirectory = resolve(outputDirectory, 'server')
  const files = await collectFiles(serverDirectory)

  for (const file of files) {
    if ((await readFile(file, 'utf8')).includes(RELAY_ROUTE)) {
      return
    }
  }

  throw new Error('G2B relay route is absent from the Nitro server artifact')
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await verifyG2bRelayArtifact(resolve(process.cwd(), '.output'))
  console.log(`Verified ${RELAY_ROUTE} in the Nitro server artifact.`)
}
