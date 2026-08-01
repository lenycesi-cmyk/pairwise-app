import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Code qui tourne sous Node, pas dans le navigateur : Cloud Functions,
    // scripts de déploiement et tests. Sans ce bloc, `require`, `module` et
    // `process` y étaient signalés comme indéfinis — un bruit permanent qui
    // noyait les vraies erreurs et rendait la sortie du lint inutilisable comme
    // garde-fou.
    files: ['functions/**/*.js', 'scripts/**/*.js', 'tests/**/*.js', '*.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
])
