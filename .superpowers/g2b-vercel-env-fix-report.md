# G2B Vercel Environment-Key Compatibility Fix

Date: 2026-09-01

## Change

Railway continues to use `PUBLIC_DATA_SERVICE_KEY` for direct G2B collection.
The Nuxt/Vercel relay now reads only the server-only
`G2B_DATA_SERVICE_KEY` variable. There is intentionally no `PUBLIC_` fallback:
an unset Vercel key leaves the existing relay configuration validation to fail
closed. The same key value is copied from Railway to Vercel under its new name;
the signed relay request never contains the provider key.

## TDD evidence

### RED

`npm test -- src/deployment-config.spec.ts` failed before the production change.
The new regression test set distinct marker values for
`G2B_DATA_SERVICE_KEY` and `PUBLIC_DATA_SERVICE_KEY`; Nuxt incorrectly exposed
the Railway-only marker through `runtimeConfig.publicDataServiceKey`.

Observed failure:

```text
Expected publicDataServiceKey: private-g2b-data-key-marker
Received publicDataServiceKey: railway-only-data-key-marker
```

### GREEN

After changing `nuxt.config.ts` to use only
`process.env.G2B_DATA_SERVICE_KEY`, the same focused test passed: 1 file, 6
tests.

## Verification evidence

- Full frontend test run: 16 files, 114 tests passed.
- `npm run type-check`: exit 0.
- Production build with `NODE_ENV=production` and the Railway API URL: exit 0;
  the existing artifact verifier confirmed `/api/internal/g2b-relay` is in the
  Nitro server output.
- A second production build with the fake value
  `private-g2b-artifact-marker` in `G2B_DATA_SERVICE_KEY` completed, and a
  fixed-string scan of `.output/public` found no marker.
- `npm exec -- eslint nuxt.config.ts src/deployment-config.spec.ts`: exit 0.
- `git diff --check`: exit 0.

## Documentation updated

- Approved G2B relay design: Vercel variable and key-copy boundary.
- Implementation plan: runtime configuration snippet, Vercel variable list,
  and Task 5 secure-copy operation.
- Tender menu status: Railway/Vercel variable ownership and no-key relay
  transport.
