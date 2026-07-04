# Contributing to CelebStyle

Thank you for contributing to CelebStyle. This guide covers the development workflow, code conventions, and submission process.

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 9+
- Docker 24+ (for full stack testing)
- Git

### Setup

```bash
git clone <repository-url>
cd Style
npm install
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local
```

Fill in the required environment variables, then:

```bash
npm run dev:backend   # Terminal 1
npm run dev:frontend  # Terminal 2
```

---

## Project Structure

```
apps/
  backend/   Express 5 + TypeScript
    src/
      auth/          Authentication middleware + JWT helpers
      lib/           Shared utilities (email, redis, etc.)
      payments/      Razorpay integration
      repositories/  Data access layer (Prisma wrappers)
      routes/        Express route handlers
      services/      Business logic services
      __tests__/     Test suites
  frontend/  Next.js 15 App Router + React 19 + Tailwind CSS
    app/             Pages and layouts (App Router)
    components/      Reusable React components
    lib/             Client utilities (api.ts, cart, etc.)
```

---

## Development Workflow

### Branching

```bash
git checkout -b feat/your-feature-name    # new feature
git checkout -b fix/issue-description     # bug fix
git checkout -b chore/task-description    # maintenance
```

### Commits

Follow conventional commits:

```
feat: add size selector to outfit detail page
fix: correct commission routing for multi-manufacturer orders
chore: update dependencies
docs: add AR integration guide
test: add coverage for recovery service
```

### Type-checking

Run before every commit:

```bash
npm run typecheck   # both workspaces
```

### Tests

```bash
cd apps/backend

# Individual suites
npx tsx --env-file=.env src/__tests__/auth.test.ts
npx tsx --env-file=.env src/__tests__/orders.test.ts
npx tsx --env-file=.env src/__tests__/ops.test.ts
npx tsx --env-file=.env src/__tests__/security.test.ts
npx tsx --env-file=.env src/__tests__/release.test.ts

# Named scripts
npm run test:devops
npm run test:ops
npm run test:security
npm run test:release
```

There is no test runner configured (no Jest/Vitest) — tests execute directly with `tsx`. All test files are self-contained and report pass/fail to stdout.

### Linting

No linter is configured. Follow the existing code style: 2-space indent, single quotes, no semicolons on object properties.

---

## Code Conventions

### Backend

- One route file per domain (`orders.ts`, `celebrities.ts`, etc.)
- Services contain all business logic; route handlers only parse/validate/respond
- All responses use `{ data: T }` envelope
- Error responses use `res.status(code).json({ error: { code, message, statusCode } })`
- All admin routes must include `authenticate, authorize("ADMIN", "SUPER_ADMIN")` middleware
- No raw SQL — use Prisma ORM for all database access

### Frontend

- Pages in `app/` use Next.js App Router conventions
- Server components fetch data; client components handle interaction
- All API calls go through `lib/api.ts` — never call the backend directly from a component
- Cart state lives in `localStorage` under key `"celebstyle-cart"`

### TypeScript

- Prefer explicit return types on all exported functions
- Avoid `any` — use `unknown` and narrow explicitly
- Use `z.infer<typeof schema>` for Zod-validated types

---

## Environment Variables

Never commit `.env` or `.env.local` files. These are gitignored.

When adding a new environment variable:
1. Add it to `apps/backend/.env.example` with a comment explaining its purpose
2. Add validation in `apps/backend/src/env.ts` (throws on startup if invalid)
3. Document it in `DEPLOYMENT_GUIDE.md`

---

## Database Migrations

After modifying `apps/backend/prisma/schema.prisma`:

```bash
cd apps/backend
npx prisma migrate dev --name describe_your_change
npx prisma generate
```

Commit both the schema change and the generated migration file. Never edit migration files manually.

---

## Adding a New Route

1. Create `apps/backend/src/routes/<domain>.ts`
2. Add the router to `apps/backend/src/app.ts`
3. Add a corresponding test file `apps/backend/src/__tests__/<domain>.test.ts`
4. Add a `test:<domain>` script to `apps/backend/package.json`
5. Document all new endpoints in `API_DOCUMENTATION.md`

---

## Pull Request Checklist

Before opening a PR:

- [ ] `npm run typecheck` passes (both workspaces)
- [ ] All affected test suites pass
- [ ] No new environment variables committed in `.env` files
- [ ] Prisma migrations generated and committed (if schema changed)
- [ ] `API_DOCUMENTATION.md` updated (if new endpoints added)
- [ ] No `console.log` left in production code paths

---

## Security

- Never log sensitive data (passwords, tokens, PII) — use pino's `redact` config
- All admin endpoints must check `authorize("ADMIN", "SUPER_ADMIN")`
- Validate user input with Zod schemas at route boundaries
- Never use `eval` or `Function()` with user-supplied strings
- Report security vulnerabilities privately to the maintainers before opening a public issue

---

## Questions

Open an issue on GitHub or start a discussion. For security reports, contact the maintainers directly.
