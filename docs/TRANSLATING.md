# Translating StellarWork

This guide explains how to contribute translations to StellarWork. The platform uses [next-intl](https://next-intl-docs.vercel.app/) for internationalization, which maps JSON message keys to translated strings.

## How the i18n System Works

StellarWork uses a key-based translation system:

- Every piece of UI text has a unique key (e.g., `job.accept`, `wallet.connect`).
- Each locale has a corresponding JSON file in `frontend/messages/`.
- At runtime, `next-intl` loads the file for the active locale and resolves keys to their translated values.
- If a key is missing in a locale file, the UI falls back to the default locale (`en`).

The locale is detected from the browser's `Accept-Language` header and can be switched manually in the UI via the language selector.

## File Structure

```
frontend/
├── i18n/
│   ├── routing.ts       # Defines supported locales and default locale
│   └── request.ts       # Loads the correct message file per request
└── messages/
    ├── en.json          # Reference file (English — do not delete keys)
    ├── es.json          # Spanish
    └── <locale>.json    # Your new locale goes here
```

The `en.json` file is the **reference file**. It always contains the full set of keys and is the source of truth for structure. All other locale files must mirror this structure.

## Adding a New Locale

### 1. Copy the reference file

```bash
cp frontend/messages/en.json frontend/messages/<locale>.json
```

Replace `<locale>` with the [BCP 47 language tag](https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry) for your language (e.g., `fr` for French, `pt-BR` for Brazilian Portuguese, `zh-Hans` for Simplified Chinese).

### 2. Translate the strings

Open your new file and translate each value. Leave keys unchanged — only translate the values.

```json
{
  "common": {
    "siteName": "StellarWork",
    "siteTagline": "Marché Escrow Décentralisé",
    "loading": "Chargement...",
    ...
  }
}
```

Do **not** translate:
- Key names (`"siteName"`, `"loading"`)
- Brand names (`"StellarWork"`, `"Freighter"`, `"Stellar"`)
- Format placeholders like `{locale}`, `{count}` — these are replaced at runtime

### 3. Register the locale

Add your locale code to `frontend/i18n/routing.ts`:

```ts
export const routing = defineRouting({
  locales: ["en", "es", "fr"],   // add your locale here
  defaultLocale: "en",
  ...
});
```

Also add a display name entry in **both** `en.json` and your new locale file under the `language` namespace:

```json
"language": {
  "switchTo": "Switch to {locale}",
  "en": "English",
  "es": "Español",
  "fr": "Français"
}
```

### 4. Verify in the dev environment

Start the development server and switch to your locale using the language selector in the site header. Check that all pages render correctly and no keys appear as raw strings (e.g., `job.accept`).

```bash
cd frontend
npm run dev
```

Navigate through `/`, `/post-job`, `/dashboard`, `/disputes`, and `/profile/[address]` to verify coverage.

## Translation Guidelines

### General

- Translate for meaning, not word-for-word. Natural phrasing in the target language is preferred.
- Keep translated strings roughly the same length as the English original to avoid layout issues.
- Maintain sentence case unless the English value uses title case (e.g., button labels).
- Preserve punctuation style consistent with the target language's conventions.

### Placeholders

Some strings contain runtime placeholders wrapped in curly braces:

```json
"switchTo": "Switch to {locale}"
```

Keep placeholders exactly as written — do not translate or remove them. You may reorder them if the grammar of the target language requires it:

```json
"switchTo": "{locale} に切り替える"
```

### Pluralization

`next-intl` supports [ICU message syntax](https://next-intl-docs.vercel.app/docs/usage/messages#plurals) for pluralization. If you need plural forms, use:

```json
"unread": "{count, plural, one {# unread message} other {# unread messages}}"
```

Adapt plural categories to your language's rules (some languages have more than two plural forms).

### Gender-specific Terms

For languages with grammatical gender, use ICU `select` syntax where needed:

```json
"role": "{gender, select, male {Freelancer} female {Freelancera} other {Freelancer}}"
```

Only add gender variants if the difference is meaningful in context. Do not introduce unnecessary complexity.

### Formal vs. Informal Register

Decide on one register per locale and apply it consistently throughout the file. Most locales should use the informal/familiar form unless the target culture strongly prefers formal address.

## Automated Translation Verification & CI Check

StellarWork enforces translation catalog parity via an automated CI check (`.github/workflows/check-translations.yml`) powered by `scripts/check-translations.mjs`.

The check validates:
1. **Locale Parity (Strict)**: Bidirectionally compares every locale catalog (`frontend/messages/*.json`) against the reference (`frontend/messages/en.json`). Every key in `en.json` must exist in other locales, and no orphaned/extra keys may exist. Any discrepancy causes the CI build to fail.
2. **Unused Key Reporting (Advisory)**: Scans all frontend components, hooks, and utilities for references to translation keys. Any keys defined in catalogs that are not referenced in code are flagged with GitHub Actions annotations and listed in the job summary.

### Running the Check Locally

You can run the verification script before opening a pull request:

```bash
# From repository root:
node scripts/check-translations.mjs

# Or from frontend/:
cd frontend && npm run check-translations
```

### Resolving CI Translation Failures

- **Missing Keys in Target Locale**: If CI reports keys missing from `<locale>.json`, add them under the exact same JSON key path as `en.json`.
- **Orphaned / Extra Keys in Target Locale**: If an English string was deleted or refactored, remove the corresponding deleted key from your locale JSON catalog.
- **Unused Key Warnings**: Review the flagged keys. If they are no longer in use anywhere in the frontend, clean them up from both `en.json` and other locale catalogs.

## Submitting a Translation

1. Fork the repository and create a branch: `feature/<issue-number>-add-<locale>-translations`.
2. Add your locale file and the routing change as described above.
3. Open a pull request referencing the relevant issue.
4. In the PR description, include:
   - The locale code and language name
   - Any keys you left untranslated (with justification)
   - Your availability to maintain the locale going forward (optional but appreciated)

See [CONTRIBUTING.md](../CONTRIBUTING.md) for general PR requirements.

## Locale Maintainers

Locale maintainers are community members who keep a translation up to date as new keys are added to `en.json`. Responsibilities:

- Watch for PRs or issues that add new English strings.
- Submit follow-up PRs to add the corresponding translated strings.
- Review translation PRs for your locale.

To become a maintainer for a locale, open an issue or leave a comment on the relevant translation PR. Active maintainers are listed in [MAINTAINERS.md](../MAINTAINERS.md).

## Translation Status

| Locale | Language | Status | Maintainer |
|--------|----------|--------|------------|
| `en` | English | ✅ Complete (reference) | Core team |
| `es` | Spanish | ✅ Complete | Community |

> To add a new row, open a PR with your locale file and update this table.

## Useful Tools and Resources

- [next-intl documentation](https://next-intl-docs.vercel.app/) — full reference for the i18n library used in this project
- [ICU Message Syntax](https://unicode-org.github.io/icu/userguide/format_parse/messages/) — pluralization and select syntax
- [BCP 47 language tags](https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry) — official locale code reference
- [Poedit](https://poedit.net/) — desktop translation editor (open the JSON file directly)
- [i18n-ally VS Code extension](https://marketplace.visualstudio.com/items?itemName=Lokalise.i18n-ally) — inline translation hints in the editor
- [Unicode CLDR plural rules](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html) — plural category rules per language
