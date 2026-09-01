import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createJiti } from 'jiti'
import { afterEach, describe, expect, it, vi } from 'vitest'

const frontendRoot = resolve(process.cwd())
const repositoryRoot = resolve(frontendRoot, '..')
const dockerfile = readFileSync(resolve(frontendRoot, 'Dockerfile'), 'utf8')
const composeFile = readFileSync(resolve(repositoryRoot, 'docker-compose.yml'), 'utf8')
const deploymentGuide = readFileSync(resolve(repositoryRoot, 'DEPLOYMENT.md'), 'utf8')
const vercelConfig = readFileSync(resolve(frontendRoot, 'vercel.json'), 'utf8')
const vercelSetup = readFileSync(resolve(frontendRoot, 'VERCEL_SETUP.md'), 'utf8')
const nuxtConfig = readFileSync(resolve(frontendRoot, 'nuxt.config.ts'), 'utf8')
const apiClient = readFileSync(resolve(frontendRoot, 'src/api/client.ts'), 'utf8')
const uploadConstants = readFileSync(resolve(frontendRoot, 'src/constants/upload.ts'), 'utf8')
const imageUtility = readFileSync(resolve(frontendRoot, 'src/utils/image.ts'), 'utf8')
const apiBaseUtility = readFileSync(resolve(frontendRoot, 'src/utils/api-base.ts'), 'utf8')
const backendMain = readFileSync(resolve(repositoryRoot, 'dfkorea-backend/src/main.ts'), 'utf8')
const productsController = readFileSync(
  resolve(repositoryRoot, 'dfkorea-backend/src/products/products.controller.ts'),
  'utf8',
)
const tendersController = readFileSync(
  resolve(repositoryRoot, 'dfkorea-backend/src/tenders/tenders.controller.ts'),
  'utf8',
)
const r2Quickstart = readFileSync(resolve(repositoryRoot, 'dfkorea-backend/R2_QUICKSTART.md'), 'utf8')

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

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
    expect(frontendService).not.toContain('/api URL')
  })

  it('matches the backend root route contract in production URL examples', () => {
    expect(backendMain).not.toContain('setGlobalPrefix')
    expect(productsController).toContain('@Controller("products")')
    expect(tendersController).toContain('@Controller("tenders")')
    expect(deploymentGuide).toContain('FRONTEND_API_BASE_URL=https://api.yourdomain.com')
    expect(deploymentGuide).not.toContain('FRONTEND_API_BASE_URL=https://api.yourdomain.com/api')
    expect(vercelSetup).toContain('VITE_API_BASE_URL=https://api.dfkorea.com')
    expect(vercelSetup).not.toContain('VITE_API_BASE_URL=https://api.dfkorea.com/api')
    expect(r2Quickstart).not.toContain('https://dfkorea-production.up.railway.app/api/')
  })

  it('uses one VITE API source instead of conflicting Nuxt environment variables', () => {
    expect(vercelConfig).not.toContain('NUXT_PUBLIC_API_BASE_URL')
    expect(vercelConfig).not.toContain('"VITE_API_BASE_URL"')
    expect(nuxtConfig).not.toContain('NUXT_PUBLIC_API_BASE_URL')
    expect(imageUtility).not.toContain('NUXT_PUBLIC_API_BASE_URL')
    expect(nuxtConfig).toContain('process.env.NODE_ENV === "production"')
    expect(nuxtConfig).toContain('argument === "build" || argument === "generate"')
    expect(nuxtConfig).toContain('VITE_API_BASE_URL is required for production builds')
  })

  it('guards localhost fallbacks in production client sources and verifies fresh output', () => {
    expect(apiBaseUtility).toContain('import.meta.env.DEV')
    expect(apiBaseUtility).toContain('http://localhost:3000')
    expect(apiClient).not.toContain('http://localhost:3000')
    expect(uploadConstants).not.toContain('http://localhost:3000')
    expect(imageUtility).not.toContain('http://localhost:3000')

    const verifierPath = resolve(frontendRoot, 'scripts/verify-production-api-bundle.mjs')
    expect(existsSync(verifierPath)).toBe(true)
    const verifier = readFileSync(verifierPath, 'utf8')
    expect(verifier).toContain('.output')
    expect(verifier).toContain('http://localhost:3000')
    expect(verifier).toContain('VITE_API_BASE_URL')
  })
})

describe('server-only G2B relay configuration', () => {
  it('keeps all relay credentials outside public runtime configuration', async () => {
    const markers = {
      G2B_RELAY_SHARED_SECRET: 'private-relay-secret-marker',
      G2B_TENDER_API_BASE_URL: 'https://private-provider.example.test/base',
      PUBLIC_DATA_SERVICE_KEY: 'private-public-data-key-marker',
    }
    for (const [name, value] of Object.entries(markers)) {
      vi.stubEnv(name, value)
    }
    vi.stubGlobal('defineNuxtConfig', <T>(config: T) => config)

    const jiti = createJiti(import.meta.url, { moduleCache: false })
    const config = await jiti.import<Record<string, unknown>>(
      resolve(frontendRoot, 'nuxt.config.ts'),
      { default: true },
    )
    const runtimeConfig = config.runtimeConfig as Record<string, unknown> & {
      public: Record<string, unknown>
    }

    expect(runtimeConfig).toMatchObject({
      g2bRelaySharedSecret: markers.G2B_RELAY_SHARED_SECRET,
      g2bTenderApiBaseUrl: markers.G2B_TENDER_API_BASE_URL,
      publicDataServiceKey: markers.PUBLIC_DATA_SERVICE_KEY,
    })
    expect(runtimeConfig.public).not.toHaveProperty('g2bRelaySharedSecret')
    expect(runtimeConfig.public).not.toHaveProperty('g2bTenderApiBaseUrl')
    expect(runtimeConfig.public).not.toHaveProperty('publicDataServiceKey')

    const clientConfig = JSON.stringify(runtimeConfig.public)
    expect(clientConfig).not.toContain(markers.G2B_RELAY_SHARED_SECRET)
    expect(clientConfig).not.toContain(markers.G2B_TENDER_API_BASE_URL)
    expect(clientConfig).not.toContain(markers.PUBLIC_DATA_SERVICE_KEY)
  })
})
