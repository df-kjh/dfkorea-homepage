import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  // Nuxt writes type declarations and bundled server code here. They are build
  // artifacts, not authored application files, and linting them creates false
  // positives after a normal type-check or production build.
  globalIgnores([
    '**/.nuxt/**',
    '**/.output/**',
    '**/dist/**',
    '**/dist-ssr/**',
    '**/coverage/**',
  ]),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  // Nuxt file-system routes are intentionally named `index`, `new`, or `[id]`.
  // These route component names are generated from their paths, not reused Vue
  // component identifiers, so the multi-word convention does not apply here.
  {
    files: ['src/pages/**/*.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },

  skipFormatting,
)
