const {defineConfig} = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const typescriptPlugin = require('@typescript-eslint/eslint-plugin');

/**
 * Deliberately narrow, mirroring the web storefront's reasoning: `tsc` already
 * does full type checking, so lint exists to catch what types cannot.
 *
 * Above all that means the React hook rules. Nearly every screen here is a
 * composition of query hooks, and a conditional or mis-ordered hook is a
 * runtime crash that type checking cannot see.
 *
 * Type-aware linting is not enabled: it would mean a full program build per
 * run for rules that largely duplicate `npm run check`.
 */
module.exports = defineConfig([
    expoConfig,
    {
        ignores: [
            'dist/*',
            'android/*',
            'ios/*',
            '.expo/*',
            'tests/.bundles/*',
            // Copied verbatim from the web storefront and kept diffable against
            // it. Linting them would produce hundreds of findings that must not
            // be fixed here.
            'src/lib/vendure/queries.ts',
            'src/lib/vendure/mutations.ts',
            'src/lib/vendure/fragments.ts',
            'src/graphql/graphql-env.d.ts',
        ],
    },
    {
        // Scoped to TS/TSX and reusing the plugin instance expo registers:
        // referencing a plugin's rules from a block that does not declare it
        // is an ESLint flat-config error, not a lookup miss.
        files: ['**/*.ts', '**/*.tsx'],
        plugins: {
            '@typescript-eslint': typescriptPlugin,
        },
        rules: {
            // Always a bug.
            'no-var': 'error',
            'prefer-const': 'error',
            // `catch {}` that swallows an error silently is how the storefront's
            // worst bugs stayed hidden; require a comment or a rethrow.
            'no-empty': ['error', {allowEmptyCatch: false}],
            // Warnings, so `--max-warnings` stays useful on new code without
            // demanding a sweep of everything at once.
            'no-console': ['warn', {allow: ['warn', 'error']}],
            // The core rule misreports type-only constructs; the plugin's
            // version is the one that understands TypeScript.
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true},
            ],
            // The Intl polyfills are conditional side-effect loads: a static
            // import would defeat the point, since the whole design is to skip
            // them on an engine that already implements the API. This is the
            // one place require() is correct.
            '@typescript-eslint/no-require-imports': 'off',
            // Unistyles' theme registration is a declaration-merging interface
            // that is empty by design.
            '@typescript-eslint/no-empty-object-type': 'off',
            // Stylistic only, and it fires ~27 times across code copied from
            // the web storefront where `Array<T>` is the house style. Not worth
            // a diff-churning sweep for zero behavioural gain.
            '@typescript-eslint/array-type': 'off',
        },
    },
    {
        // The test harness reports results by printing; that is its entire
        // job, so `no-console` is noise there rather than a signal.
        files: ['tests/**'],
        rules: {'no-console': 'off'},
    },
]);
