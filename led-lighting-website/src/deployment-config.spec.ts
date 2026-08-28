import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const frontendRoot = resolve(process.cwd())
const repositoryRoot = resolve(frontendRoot, '..')
const dockerfile = readFileSync(resolve(frontendRoot, 'Dockerfile'), 'utf8')
const composeFile = readFileSync(resolve(repositoryRoot, 'docker-compose.yml'), 'utf8')
const deploymentGuide = readFileSync(resolve(repositoryRoot, 'DEPLOYMENT.md'), 'utf8')
const vercelConfig = readFileSync(resolve(frontendRoot, 'vercel.json'), 'utf8')

describe('production API URL deployment contract', () => {
  it('validates and passes the Docker API build argument to Nuxt', () => {
    expect(dockerfile).toContain('ARG VITE_API_BASE_URL')
    expect(dockerfile).toContain('VITE_API_BASE_URL="$VITE_API_BASE_URL" npm run build')
    expect(dockerfile).toContain('VITE_API_BASE_URL must be a public http(s) URL')
    expect(dockerfile).not.toContain('http://localhost:3000')
  })

  it('requires the Compose API build argument from the root environment', () => {
    const frontendService = composeFile.slice(composeFile.indexOf('\n  frontend:'))

    expect(frontendService).toContain('VITE_API_BASE_URL: "${FRONTEND_API_BASE_URL:?')
    expect(frontendService).not.toContain('localhost:3000')
  })

  it('documents a public API URL for production deployment providers', () => {
    expect(deploymentGuide).toContain('FRONTEND_API_BASE_URL=https://api.yourdomain.com/api')
    expect(vercelConfig).not.toContain('localhost:3000')
  })
})
