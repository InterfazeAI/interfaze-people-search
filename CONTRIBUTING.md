# Contributing

Use Node 22.x and the pnpm version pinned in `package.json`. Install with `pnpm install --frozen-lockfile` and run `pnpm dev`.

- Keep Interfaze as the only API provider. The app must work with a visitor’s key and no backend secrets.
- Keep transport in `lib/interfaze.ts`, orchestration in `lib/search.ts`, and evidence rules in `lib/evidence.ts`. UI components should not make API calls.
- Never relax evidence matching to fill an empty result list. Add a regression test for response-shape or grounding changes.
- Preserve keyboard navigation, mobile layouts, and reduced-motion support. Reuse the shared Chakra theme and bundled fonts.
- Keep credentials, `.local/` captures, `.env` files, browser storage, and build artifacts out of commits and issue reports.

Before opening a PR, run:

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

Describe the user-visible behavior and relevant checks. Real-provider testing is optional, requires your own key, and costs API credits: `pnpm test:live`.
