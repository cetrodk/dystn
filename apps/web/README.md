# @dystn/web

Vite + React-klienten (host- og spillerskærme). Se rod-README'en (`../../README.md`) for arkitektur, miljøvariabler og dev-/deploy-flow.

```bash
pnpm dev                       # dev-server på :5173 (kræver party-server på :1999)
pnpm build                     # produktion (kræver VITE_PARTY_HOST)
pnpm exec playwright test      # e2e-tests i e2e/
```
