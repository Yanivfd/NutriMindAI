# NutriMind

Low-friction weight-loss app for Android: a weekly meal plan built to your calorie target,
a shopping list, a weekly treat budget and weight tracking. Hebrew (RTL) and English, with
kosher and mehadrin menus (meat/dairy separation, wait hours, prepare-ahead Shabbat meals).

- **App:** Expo SDK 57 (React Native), expo-router, NativeWind, TanStack Query, Zustand.
- **Backend:** Supabase (Postgres with row-level security, Auth with email codes, Edge Function).
- **Planner:** the `generate-weekly-menu` Edge Function asks Gemini to pick recipes; code enforces
  every rule, sizes portions and builds the grocery list. If Gemini is unavailable, the same rules
  build the plan without AI.

The full build plan and design notes are in [`PLAN.md`](PLAN.md).

## Prerequisites

- Node.js 20 or newer (developed on Node 24)
- Docker Desktop (runs the local Supabase stack)
- Android Studio with an Android emulator
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) (optional; without
  it every week uses the rule-based planner)

## First-time setup

```bash
npm install

# App settings (public values only)
cp .env.example .env

# Edge Function secrets: put your Gemini key in GEMINI_API_KEY
cp supabase/functions/.env.example supabase/functions/.env

# Start the local backend (first run downloads Docker images)
npx supabase start -x realtime,storage-api,imgproxy,logflare,vector,supavisor
```

The start command prints a `PUBLISHABLE_KEY`. Put it in `.env` as `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
Keep `EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321`; that address is how the Android emulator
reaches your PC. On a physical phone, use your PC's LAN IP instead.

The database schema and the 10 seed recipes are applied automatically on first start.
To wipe local data and start fresh: `npx supabase db reset`.

## Running the app

1. Start the Android emulator from Android Studio.
2. Run `npx expo start --go` and press `a`.
3. Sign in with any email address. Local Supabase does not send real emails: open
   [Mailpit](http://127.0.0.1:54324) and copy the 6-digit code.

Use `--go` (Expo Go) for day-to-day work. Ads are switched off in Expo Go; to see them you need a
development build (below).

## Useful commands and addresses

| What | Command / URL |
|---|---|
| Lint | `npm run lint` |
| Typecheck (app, functions, tests) | `npm run typecheck` |
| All tests | `npm test` |
| Health check | `npx expo-doctor` |
| Stop / start the backend | `npx supabase stop` / the start command above |
| Supabase Studio (browse tables) | http://127.0.0.1:54323 |
| Mailpit (sign-in codes) | http://127.0.0.1:54324 |
| Edge Function logs | `docker logs -f supabase_edge_runtime_nutrimind` |

**After changing `supabase/functions/.env`, restart the backend** (`npx supabase stop`, then start).
The functions only read that file when the stack starts.

## Gemini models

`GEMINI_MODEL` (default `gemini-3.8-flash`) is tried first, then the backups in
`GEMINI_FALLBACK_MODELS` (default `gemini-3.7-flash,gemini-3.5-flash,gemini-flash-latest`). Each
model gets one attempt, within about 40 seconds in total. Free-tier keys allow only about 20
requests per day per model, which is fine for development. Use a paid key for real users.

Only calorie targets, meal times and the recipe catalog are sent to Gemini: no name, age, weight
or other personal data.

## Development build (needed for ads)

AdMob is a native module that Expo Go does not include. One-time setup in **PowerShell**, then
restart Cursor/your terminals so they see the new variables:

```powershell
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
setx JAVA_HOME "C:\Program Files\Android\Android Studio\jbr"
```

Then `npx expo run:android` builds and installs the app on the emulator. After that,
`npx expo start` (without `--go`) serves the development build. Debug builds always show
Google's test ads.

## Project layout

```
src/app/            Screens (expo-router): login, onboarding, (tabs)/, recipe/[id], settings
src/components/     MealCard, CalorieRing, WeightChart, ProfileForm, pickers, Rubik Text, shared UI
src/services/       Supabase client, auth, data hooks (menuApi), ads
src/lib/            i18n, theme colours/fonts, calorie maths (tdee), form validation, formatting
assets/             App icon, splash image, recipes/ photos
src/store/          Zustand stores: language, grocery ticks, selected week
src/locales/        he.json, en.json
supabase/migrations Database schema and security rules
supabase/seed.sql   Recipe catalog
supabase/functions  generate-weekly-menu Edge Function and shared planner code (_shared)
supabase/templates  Sign-in email (he/en)
```

## Going live checklist

1. **Hosted Supabase project:** create it, then `npx supabase link`, `npx supabase db push` and
   `npx supabase functions deploy generate-weekly-menu`. Load the recipes from `supabase/seed.sql`.
2. **Secrets:** `npx supabase secrets set GEMINI_API_KEY=... GEMINI_MODEL=gemini-3.8-flash`, using a
   **paid** Gemini key (free-tier limits are too low, and free-tier prompts may be used by Google).
3. **Sign-in emails:** configure an SMTP provider (Auth > SMTP settings) and paste
   `supabase/templates/otp_code.html` into both the Magic Link and Confirm signup templates. Without
   the template, users get a link instead of a code and cannot sign in.
4. **App settings:** set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the hosted
   project, and the real AdMob unit IDs in `.env`.
5. **AdMob:** replace the test `androidAppId` in `app.json` with your AdMob app ID.
6. **Store listing:** a privacy policy and Google Play Data safety form (the app stores health
   data: weight, calorie targets, eating habits), plus store screenshots and a feature graphic.
   The app icon, splash screen and recipe photos in `assets/` are AI-generated; replace them
   if you want professional artwork.
7. **Release build:** a signed Android build, with EAS (`npx eas-cli@latest build -p android`) or
   locally.

## Known limitations

- `npm audit` reports issues in Expo's build and developer tools (CLI code signing, file watchers,
  an iOS project tool). None of them ships in the app; they will be resolved by future Expo SDK
  upgrades. Do not run `npm audit fix --force`, which breaks the SDK.
- The rewarded ad for an extra meal swap is deferred until meal swapping exists.
- Recipe photos are bundled in `assets/recipes/` and keyed by recipe id in
  `src/lib/recipeImages.ts`. A new recipe without a photo shows an icon until one is added there.
- The new app icon, splash screen and app name only appear in a development or release build;
  Expo Go always shows its own.
- The "No 'iosAppId' was provided" warning is expected: the app is Android-only for now.
