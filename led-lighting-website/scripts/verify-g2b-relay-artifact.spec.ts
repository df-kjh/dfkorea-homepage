import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { verifyG2bRelayArtifact } from './verify-g2b-relay-artifact.mjs'

const temporaryDirectories: string[] = []

const createOutput = async (serverSource: string) => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'g2b-relay-artifact-'))
  temporaryDirectories.push(outputDirectory)
  const serverDirectory = join(outputDirectory, 'server')
  await mkdir(serverDirectory, { recursive: true })
  await writeFile(join(serverDirectory, 'routes.mjs'), serverSource)
  return outputDirectory
}

const createVercelOutput = async (serverSource: string) => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'g2b-relay-vercel-artifact-'))
  temporaryDirectories.push(outputDirectory)
  const functionsDirectory = join(outputDirectory, 'functions', '__fallback.func', 'chunks', 'routes')
  await mkdir(functionsDirectory, { recursive: true })
  await writeFile(join(functionsDirectory, 'g2b-relay.post.mjs'), serverSource)
  return outputDirectory
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

describe('verifyG2bRelayArtifact', () => {
  it('rejects a production artifact that omits the internal relay route', async () => {
    const outputDirectory = await createOutput('export const routes = []')

    await expect(verifyG2bRelayArtifact(outputDirectory)).rejects.toThrow(
      'G2B relay route is absent from the Nitro server artifact',
    )
  })

  it('accepts a production artifact that registers the internal relay route', async () => {
    const outputDirectory = await createOutput(
      'export const routes = [{ route: "/api/internal/g2b-relay" }]',
    )

    await expect(verifyG2bRelayArtifact(outputDirectory)).resolves.toBeUndefined()
  })

  it('accepts the Vercel preset functions artifact that registers the relay route', async () => {
    const outputDirectory = await createVercelOutput(
      'export const route = "/api/internal/g2b-relay"',
    )

    await expect(verifyG2bRelayArtifact(outputDirectory)).resolves.toBeUndefined()
  })
})
