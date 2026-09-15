# Akshara LearnQuest — Developer Handover

This guide gets a second developer from a fresh clone to shipping changes. It covers setup, how the app is put together, the features built recently, the rules that keep production safe, and what is still open.

- **Repo:** https://github.com/Zaclee030314/Akshara-Music-Hub
- **Live site:** https://akshara-music-hub.vercel.app
- **Branch:** `main` deploys to production automatically on every push.

---

## 1. Access you need first

Ask the project owner for these. None of them live in the repo.

| What | Why |
|---|---|
| GitHub collaborator access | To push branches and open pull requests |
| Vercel project access | To see deploys, logs and environment variables |
| A copy of the environment variables | The app will not start without them (see section 3) |
| A **separate development database** | Never point local development at the production database |

> **Never commit secrets.** `.env`, `.env.local` and `.env.production` are git-ignored. Share keys through a password manager or Vercel, never through chat, email or commits.

---

## 2. Stack at a glance

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, React Router 7, Tailwind (CDN), lucide-react icons |
| Backend | Express, bundled as a single Vercel serverless function (`api/index.ts`, 60s limit) |
| Database | PostgreSQL through Prisma 5 |
| Auth | JWT stored in `localStorage` as `quest_token` |
| Payments | Stripe PaymentIntents (with a mock mode for local work) |
| AI | Google Gemini via REST (`gemini-3-flash-preview`, falling back to `gemini-2.5-flash`, then `gemini-flash-latest`) |
| Email | Gmail SMTP through nodemailer |
| Languages | English, Malay, Chinese, Tamil |

---

## 3. Local setup

### Prerequisites
- Node.js 20 or newer
- Git
- A PostgreSQL database for development (a free Neon or Supabase database works well)

### Steps

```bash
git clone https://github.com/Zaclee030314/Akshara-Music-Hub.git
cd Akshara-Music-Hub
npm install
```

`npm install` also runs `prisma generate` automatically.

Create a file named `.env.local` in the project root with the variables below. Get the real values from the owner.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. **Use your development database.** |
| `JWT_SECRET` | Yes | Signs login tokens |
| `GEMINI_API_KEY` | Yes | Quest and study-plan generation |
| `GMAIL_USER` | For email | Sender account for verification codes and welcome emails |
| `GMAIL_PASS` | For email | Gmail app password |
| `GMAIL_SMTP_HOST`, `GMAIL_SMTP_PORT`, `GMAIL_SMTP_SECURE` | Optional | Defaults to `smtp.gmail.com`, port 465 |
| `STRIPE_SECRET_KEY` | For payments | Leave blank locally to use mock payments |
| `STRIPE_MOCK_MODE` | Optional | Set to `true` to force simulated payments |
| `STRIPE_WEBHOOK_SECRET` | Production only | Verifies Stripe webhooks |
| `FRONTEND_URL` | Optional | Used in email links and Stripe redirects |
| `AI_MOCK_MODE` | Optional | `true` disables real AI calls |

Push the schema to your development database once:

```bash
npx prisma db push --schema=api/_server/prisma/schema.prisma
```

Run the frontend and API together:

```bash
npm run dev:all
```

- Frontend: http://localhost:3000
- API: http://localhost:5000 (Vite proxies every `/api/*` request to it)

The API is started with `npx tsx`. The first time, `npx` may ask to download `tsx`; answer yes.

### Make yourself an admin locally
Admin access is granted automatically to e-mails in the `ADMIN_EMAILS` allow-list near the top of `api/_server/routes/auth.ts`. For local testing you can add your own e-mail there, but do not commit that change unless the owner agrees.

---

## 4. Checks before every push

There is no automated test suite yet. Run these three and make sure they pass.

```bash
npx tsc --noEmit -p api/tsconfig.json
```

```bash
npx tsc --noEmit
```

```bash
npm run build
```

The client type-check has **four known, pre-existing errors** in `components/Benefits.tsx`, `components/HowItWorks.tsx`, `test-quest-gen.ts` and `test-rand-dist.ts`. Anything beyond those four is new and must be fixed.

---

## 5. How deploys work

1. Push to `main`.
2. Vercel runs `vercel-build`: `prisma generate`, then **`prisma db push --accept-data-loss` against production**, then `vite build`.
3. The new version is live in about two minutes.

Because step 2 changes the production database on every deploy, follow the schema rules in section 8 strictly.

### Working together
- Do not both push straight to `main`. Create a branch per task and open a pull request.
- Vercel builds a preview URL for every pull request, so changes can be checked before merging.
- Pull `main` before starting new work to avoid conflicts.

```bash
git checkout -b feature/short-description
```

---

## 6. Project map

```
App.tsx                     Main app shell: routes, navbar, pricing page, checkout, dashboards
index.tsx                   React entry point
types.ts                    Shared frontend types and the Syllabus enum
components/                 Pages and UI
  admin/                    Admin dashboard sub-tabs (seasons, polls, referrals, tiers, CSV import)
  AdminDashboard.tsx        Admin dashboard shell and most admin tabs
  ProfilePage.tsx           My Profile
  ProfilePicker.tsx         "Who's learning?" family profile picker (/profiles)
  FamilySetupModal.tsx      Converts a student account into a family account
  ReferralPage.tsx          Member Refer & Earn page (/referrals)
  LoginModal.tsx            Login, sign-up, verification, password reset
  PaymentForm.tsx           Checkout card (real Stripe or mock)
contexts/                   AuthContext (login, profile switching) and LanguageContext
i18n/                       en.ts, ms.ts, zh.ts, ta.ts translation tables
lib/                        Frontend curriculum, grade and music-subject helpers

api/index.ts                Express app: loads env, mounts every route under /api
api/server-local.ts         Runs the API on port 5000 for local development
api/_server/
  prisma/schema.prisma      Database schema
  routes/                   One file per area (auth, quests, generation, subscription,
                            family, profile, admin, leaderboard, seasons, polls, ...)
  middleware/               JWT auth, parent-session guard, subscription expiry check
  utils/                    ai.ts (Gemini), referral.ts, family.ts, seasonScore.ts, ...
  data/                     Music curriculum, grade syllabi and reference question banks
  services/mailService.ts   E-mail templates

scripts/                    One-off data scripts (music question bank seed, syllabus migration)
```

The many `test-*.js`, `check-*.js` and `debug_*.txt` files in the root are old debugging leftovers. They are not part of the app.

---

## 7. Features and how they work

### Quests and AI generation
- Quests are generated by Gemini in `api/_server/routes/generation.ts`, with every quest having **at least 20 questions**.
- For music syllabi the server first tries the curated question bank, then falls back to AI.
- Prompts are grounded with the curated topics, grade-exam syllabi, instrument facts and reference questions in `api/_server/data/`.
- Questions a student has already seen are tracked in the `ServedQuestion` table so they are not repeated.
- Free users get **3 quests** in total. For family accounts that allowance is shared by the whole family.

### Music curriculum
- Three music syllabi: **Western Music, Carnatic Music, Hindustani Music**, each with grades, instruments, and a Theory or Aural & Practical focus.
- Subject lists live in `lib/musicSubjects.ts`; curriculum content lives in `api/_server/data/`.

### Seasons, XP and levels
- The dashboard level is based on **current-season XP** and resets each season.
- `User.xp` keeps lifetime "banked" XP, which the all-time leaderboard uses.
- Past season winners are shown on a podium on the leaderboard.

### Subscriptions and pricing
| Plan | Price per month |
|---|---|
| Single Syllabus | RM59.90 |
| All Syllabus | RM99.90 |
| Each additional child (both plans) | **+RM45** |

- The amount is always calculated on the server in `api/_server/routes/subscription.ts` using `familyPriceCents()` from `api/_server/utils/family.ts`. Never trust an amount sent by the browser.
- Subscriptions last 30 days and do not auto-renew.
- Any referral credit the payer has is deducted automatically at checkout.

### Family profiles
- One **parent login** can hold several **child profiles**, each with its own grade, XP, coins, results and leaderboard place.
- A student turns their account into a family account from My Profile using "Set up child profiles". This is **one-way**.
- Child profiles are normal `User` rows with `parentId` set and a synthetic e-mail. They cannot log in.
- Picking a child on `/profiles` issues a child-scoped token. The parent token is kept in `localStorage` as `quest_parent_token` so the parent can switch back.
- Billing, referrals and family details are parent-only, enforced by `requireParentSession` in `api/_server/middleware/authMiddleware.ts`.
- Every subscription check goes through `effectiveSubscription()` in `api/_server/utils/family.ts`, which reads the parent's plan and the number of paid seats.
- API routes live in `api/_server/routes/family.ts`.

### Referral programme
- A referral counts **only when the referred family pays**.
- Rewards are **subscription credit, not cash**. Each reward is split into equal monthly instalments. The first is credited immediately and the rest are released when the member next loads the app or checks out.
- Default tiers (editable by admins):

| Paid referrals | Credit per referral | Released over |
|---|---|---|
| 1 to 25 | RM100 | 2 months |
| 26 to 100 | RM200 | 4 months |
| 101 to 150 | RM300 | 5 months |
| 151 and up | RM500 | 5 months |

- Logic lives in `api/_server/utils/referral.ts`.
- Members see everything on `/referrals`. Admins manage tiers on the **Referral Tiers** tab and see results on the **Referrals** tab.

### Admin dashboard (`/admin`)
- Tabs: Analytics, Students, Roles, Rewards, Orders, Seasons, Polls, Referrals, Referral Tiers, Papers.
- **Students** tab has **Export CSV** and **Import CSV**. Import updates existing students matched by e-mail and creates new ones, who receive a welcome e-mail with a temporary password.

### Translations
- Every user-facing string is a key in `i18n/en.ts`, `ms.ts`, `zh.ts` and `ta.ts`.
- **Add every new key to all four files**, even if the non-English text starts as English.

---

## 8. Rules and gotchas

### Database schema
- **Only make additive changes**: new models, or new fields that are optional or have a default.
- **Never rename or delete** a column or model. Production runs `db push --accept-data-loss`, so a rename silently wipes that data.
- If a destructive change is truly needed, plan it with the owner and back up the database first.
- Run `npx prisma generate --schema=api/_server/prisma/schema.prisma` after editing the schema. On Windows, stop the dev server first or it fails with an `EPERM` error.

### Money and security
- Prices, seat counts and credits are always computed on the server.
- New billing or account-level routes must use `authenticateToken` **and** `requireParentSession`.
- New subscription gates must use `effectiveSubscription()`, not `user.isSubscribed` directly, or child profiles will be treated as unsubscribed.

### Windows editing
- Keep files UTF-8. PowerShell `Get-Content` / `Set-Content` corrupts characters such as `—` and `•`. Use your editor or Node scripts instead.
- Files are checked in with CRLF line endings; git will warn about this and it is harmless.

### Serverless limits
- Every API request must finish within **60 seconds**. Quest generation already budgets about 40 seconds for AI retries.

---

## 9. Open items

- [ ] **Decide on levels:** should the dashboard level keep resetting each season, or reflect all-time XP?
- [ ] **Test on live** with a throwaway account: set up family profiles, switch between children, and confirm checkout shows RM59.90 + RM45 for two children.
- [ ] **Test referrals end to end** once a real referred family pays: instalment credited, tier shown on `/referrals`.
- [ ] **Verify quest length** on live: a generated quest has 20 questions.
- [ ] **Tidy the repo root:** move or delete the old `test-*`, `check-*`, `debug_*` files.
- [ ] **Music question bank:** currently empty in production, so music quests are fully AI-generated. `npm run seed:music` can fill it later.
- [ ] **Add automated tests**, starting with pricing (`familyPriceCents`) and referral tiers (`tierFor`).

---

## 10. Recent history

| Commit | Change |
|---|---|
| `88a81e7` | Member Refer & Earn page with tier table and how-it-works |
| `e27b1fe` | Admin Referral Tiers moved to its own tab |
| `f87ce9b` | Family pricing: +RM45 per additional child |
| `98d6377` | Family profiles with parent login and profile picker |
| `377d26c` | Admin CSV export and import of students |
| `18e9786` | Tiered referral programme paid as monthly credit |
| `93c3906` | Sign-up and login modal close button fix |
| `cea5feb` | Gemini 3 Flash with fallbacks, 20-question minimum, no repeated questions |

Run `git log` for the full history.
