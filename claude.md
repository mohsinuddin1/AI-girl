# PureScan AI — Codebase Context

> **Last updated:** 2026-03-24
> Product ingredient safety scanner (food + cosmetics) — React Native / Expo 54 / Supabase

---

## 1. Identity & Stack

| Layer | Tech | Version |
|-------|------|---------|
| Framework | React Native + Expo (managed) | RN 0.81.5, Expo ~54 |
| Language | JavaScript (no TypeScript in client, TS in Edge Functions) | — |
| State | Zustand 5 (single `useStore.js`) | — |
| Navigation | React Navigation 7 (bottom tabs + native stack) | — |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) | supabase-js 2 |
| Payments | RevenueCat (`react-native-purchases` 9) | — |
| Analytics | PostHog (`posthog-react-native` 4) | — |
| Error Tracking | Sentry (`@sentry/react-native` 7) | — |
| AI Provider | Groq API (Llama 4 Scout 17B vision model) | — |
| Font | Inter (Google Fonts via `@expo-google-fonts/inter`) | — |
| Animations | `react-native-reanimated` 4 | — |
| Icons | `@expo/vector-icons` (Ionicons) + `lucide-react-native` | — |
| Charts | `react-native-gifted-charts` 1.4 | — |

**Bundle ID:** `com.purescanai.app`  
**EAS Project ID:** `19807809-797a-4216-a728-0a8463f1d495`  
**Owner:** `mohsinuddin321`

---

## 2. Project Structure

```
PureScanAI/
├── App.js                          # Root: Sentry.wrap → GestureHandler → SafeArea → PostHog → AuthProvider → AppNavigator
├── index.js                        # Entry point (registerRootComponent)
├── app.json                        # Expo config (plugins, permissions, splash)
├── eas.json                        # EAS Build profiles (dev, preview, production)
├── .env                            # Env vars (Supabase, RevenueCat, PostHog, Sentry)
├── package.json                    # Dependencies
│
├── src/
│   ├── components/
│   │   ├── AnalyzingOverlay.js      # Full-screen AI analysis animation overlay
│   │   ├── GradeBadge.js            # A-E colored grade pill
│   │   ├── LoadingSpinner.js        # Centered spinner with optional message
│   │   ├── OfflineBanner.js         # Network status banner
│   │   └── ToxicityBar.js           # Horizontal score bar (0-100)
│   │
│   ├── features/auth/
│   │   └── AuthProvider.js          # Auth context: Google Sign-In, email auth, Supabase session, RevenueCat init
│   │
│   ├── hooks/
│   │   ├── useNetworkStatus.js      # NetInfo hook
│   │   └── useTheme.js              # Theme hook (currently forced light)
│   │
│   ├── lib/
│   │   ├── supabase.js              # Supabase client init (AsyncStorage session)
│   │   ├── purchases.js             # RevenueCat: init, purchase, restore, sync is_pro to Supabase
│   │   └── posthog.js               # PostHog analytics (safe wrapper, gated by env var)
│   │
│   ├── navigation/
│   │   └── AppNavigator.js          # Tab nav (Home/History/Settings) + Stack (Scan/Result/Paywall/Account/etc.)
│   │                                # Custom glassmorphic tab bar with animated FAB scan button
│   │
│   ├── screens/
│   │   ├── OnboardingScreen.js      # Auth + health preferences onboarding
│   │   ├── HomeScreen.js            # Dashboard: greeting, stats, XP, calendar, recent scans
│   │   ├── ScanScreen.js            # Camera: category select → barcode/ingredient mode → capture/upload → analyze
│   │   ├── ResultScreen.js          # 3-tab result view: Overview (health scores, concerns) / Ingredients / Macros
│   │   ├── HistoryScreen.js         # Paginated scan history (FlashList)
│   │   ├── SettingsScreen.js        # Profile, preferences, about
│   │   ├── PaywallScreen.js         # Subscription: annual ($39.99) / monthly ($8.99), RevenueCat
│   │   ├── AccountScreen.js         # Account details, delete account
│   │   ├── HealthPreferencesScreen.js # Edit diseases/allergies/goals
│   │   ├── NotificationsScreen.js   # Notification preferences toggles
│   │   ├── PrivacySecurityScreen.js # Privacy & security info
│   │   └── HelpSupportScreen.js     # FAQ, support contact
│   │
│   ├── store/
│   │   └── useStore.js              # Zustand store (715 lines) — THE state brain
│   │
│   ├── theme/
│   │   └── index.js                 # Design tokens: Colors, Fonts, Spacing, Radii, Shadows, grade helpers
│   │
│   └── utils/
│       ├── levelInfo.js             # XP → level name (Beginner→Master, 5 tiers)
│       ├── notifications.js         # Push token registration, local scheduling, Supabase sync
│       ├── responsive.js            # scale/verticalScale/moderateScale helpers
│       └── reviewPrompt.js          # Native app review prompt (after 3rd scan)
│
├── supabase/
│   ├── functions/
│   │   ├── analyze-scan8/index.ts   # IMAGE scan edge function (Groq Vision API)
│   │   ├── scan-barcode8/index.ts   # BARCODE scan edge function (OFF API + Groq text)
│   │   ├── analyze-scan6.js         # Legacy image scan (kept for reference)
│   │   └── send-push-notification/  # Push notification sender
│   │
│   ├── migration-v3-accuracy.sql    # Schema: health_preferences, macros, summary columns
│   ├── migration-v4-notifications.sql # Schema: push_tokens, notification_preferences
│   └── migration-v5-barcode-cache.sql # Schema: barcode_cache table
│
├── assets/                          # App icons, splash images
├── android/                         # Native Android project
└── plugins/                         # Custom Expo config plugins
```

---

## 3. Core Flows

### 3.1 Authentication Flow
```
OnboardingScreen → Google Sign-In (or email) → Supabase signInWithIdToken
  → AuthProvider.onAuthStateChange fires
    → setUser/setSession → fetchProfile (upsert to users table)
    → initPurchasesBackground (RevenueCat login + checkAndSyncProStatus)
    → PostHog identify
```
- Google Sign-In uses `@react-native-google-signin/google-signin`
- Auth state managed in Zustand (`user`, `session`, `profile`)
- `TOKEN_REFRESH_FAILED` event → auto sign out
- Safety timeout: 3s max auth wait

### 3.2 Barcode Scan Flow (processScan in useStore.js L312-598)
```
ScanScreen (barcode mode, auto-detect via CameraView)
  → handleBarcodeScanned → processScan(barcode, category, navigation)
    Phase 1: Instant OpenFoodFacts/OpenBeautyFacts API fetch
      → Extract ingredients, macros, nutriscore, novaGroup, allergens, additives
      → Show partialResult immediately, navigate to ResultScreen
    Phase 2: Background AI analysis via scan-barcode8 edge function
      → Sends: barcode, category, clientData (OFF data), healthPreferences
      → Edge function: rate limit check → barcode_cache lookup → Groq LLM call
      → Returns: scored ingredients, harmful_chemicals, healthScores, grade
    Phase 3: Merge AI result with partialResult, save scan, update XP/streak
```

### 3.3 Ingredient Image Scan Flow (handleAnalyze in ScanScreen.js L313-398)
```
ScanScreen (ingredient mode, manual capture or gallery)
  → Upload image to Supabase Storage (product-scans bucket)
  → Call analyze-scan8 edge function with imageBase64
    → Groq Vision API (Llama 4 Scout 17B) analyzes ingredient label
    → Position-weighted toxicity scoring + personalization layer
  → Save scan, navigate to ResultScreen
```

### 3.4 Scoring Engine (in edge functions)
- **3-layer grading:**
  1. Base toxicity from ingredient risk levels (position-weighted)
  2. Personalization penalties/bonuses (allergens, diseases, goals)
  3. Grade thresholds: A(≤15) B(≤35) C(≤55) D(≤75) E(>75)
- **Risk levels:** `high | moderate | low | negligible`
- **Poison override set:** Lead, asbestos, formaldehyde, etc. → force `high`
- **Health scores:** 3 categories (allergies, conditions, goals), 0-100 each

### 3.5 Rate Limiting
- **Free users:** 3 scans/day
- **Pro users:** 40/day, 150/week, 520/month
- Server-enforced via `increment_scan_usage` RPC + `scan_usage` table
- Crash refund: if edge function errors, scan credit is returned
- Tester bypass: `tester@medicalgpt.ai` gets unlimited scans

### 3.6 Subscription Flow
```
PaywallScreen → RevenueCat getOfferings → purchasePackage
  → RevenueCat validates → syncProStatus to Supabase (users.is_pro)
  → checkAndSyncProStatus on every app launch
```
- Plans: Annual $39.99 (3-day trial) / Monthly $8.99
- Entitlement key: `pro`
- Restore purchases supported

---

## 4. Database Schema (Supabase Postgres)

### `users` table
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (PK, FK→auth.users) | User ID |
| email | TEXT | User email |
| is_pro | BOOL | Subscription status |
| daily_scans | INT | Scans today (legacy, migrating to scan_usage) |
| last_scan_date | DATE | Last scan date |
| current_streak | INT | Consecutive scan days |
| level_xp | INT | Gamification XP (10 per scan) |
| health_preferences | JSONB | `{diseases:[], allergies:[], goals:[]}` |
| notification_preferences | JSONB | Notification toggle states |
| created_at | TIMESTAMPTZ | Account creation |

### `scans` table
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (PK) | Scan ID |
| user_id | UUID (FK→users) | Owner |
| image_url | TEXT | Scan photo URL (Supabase Storage) |
| product_name | TEXT | Product name |
| ingredients | JSONB | Full AI analysis array |
| harmful_chemicals | JSONB | High/moderate risk subset |
| grade | TEXT | A-E safety grade |
| score | INT | 0-100 toxicity score |
| scan_type | TEXT | food/cosmetics |
| method | TEXT | barcode/ingredient |
| nutriscore | TEXT | Nutri-Score grade (a-e) |
| nova_group | INT | NOVA processing level (1-4) |
| macros | JSONB | {calories, protein, carbs, fats, sugar, etc.} |
| nutrient_levels | JSONB | {fat, salt, sugar, saturated-fat} levels |
| health_scores | JSONB | [{category, score, note}] |
| allergens | TEXT[] | Product allergens |
| additives | TEXT[] | Product additives |
| created_at | TIMESTAMPTZ | Scan timestamp |

### `scan_usage` table (rate limiting)
| Column | Purpose |
|--------|---------|
| user_id | FK→users |
| daily_scans, weekly_scans, monthly_scans | Rolling counters |
| last_daily_reset, last_weekly_reset, last_monthly_reset | Reset timestamps |

### `barcode_cache` table
| Column | Purpose |
|--------|---------|
| barcode (PK) | EAN/UPC code |
| ai_result | Cached AI analysis (no personalization) |
| macros, nutri_grade, nova_group, allergens, additives | Precomputed open data |
| hit_count | Cache hit counter |

### `push_tokens` table
| Column | Purpose |
|--------|---------|
| user_id + expo_push_token | Composite unique |
| platform | ios/android |

### Key RPC functions
- `increment_scan_usage(p_user_id)` — Atomic scan counter increment with rate limit check
- `get_scan_usage(p_user_id)` — Return current usage counters (auto-resets expired periods)

---

## 5. Edge Functions (Deno/TypeScript)

### `analyze-scan8` (Image Scans)
- **Trigger:** `supabase.functions.invoke('analyze-scan8', { body: { imageBase64, category, healthPreferences } })`
- **AI Model:** `meta-llama/llama-4-scout-17b-16e-instruct` (Groq Vision)
- **Flow:** Auth → Rate limit → Build personalized prompt → Groq Vision call (retry + JSON recovery) → Position-weighted scoring → Poison override → Health scores → Response
- **Prompt structure:** Clinical toxicologist role, risk classification (high/moderate/low/negligible), personalization rules with emoji prefixes (✅ beneficial, 🚨 allergy), regulatory citations
- **Crash refund:** On error, decrements scan_usage counters

### `scan-barcode8` (Barcode Scans)
- **Trigger:** `supabase.functions.invoke('scan-barcode8', { body: { barcode, category, clientData, healthPreferences } })`
- **Flow:** Auth → Rate limit → barcode_cache check → OpenFoodFacts/OpenBeautyFacts API (if no clientData) → Groq LLM text call → Scoring → Cache result → Response
- **Caching:** Stores non-personalized AI result in `barcode_cache`, re-personalizes on hits
- **Model routing:** Uses smaller/faster models for simple scans

### `send-push-notification`
- **Trigger:** Supabase webhook or manual
- **Flow:** Fetch push_tokens → Send via Expo Push API

---

## 6. State Management (useStore.js — 715 lines)

### State shape:
```js
{
  // Auth
  user, profile, session, loading,
  // Scan
  scanResult, isAnalyzing, scanHistory, scanHistoryByDate, scanHistoryHasMore, scanHistoryLoading,
  // UI
  hasSeenOnboarding,
  // Notifications
  notificationPrefs, expoPushToken,
  // Health
  healthPreferences  // {diseases:[], allergies:[], goals:[]}
}
```

### Key actions:
- `fetchProfile(userId)` — Fetch or create user profile, sync health prefs, get scan_usage
- `processScan(barcode, category, navigation)` — Full barcode scan orchestration (3-phase)
- `saveScan(scanData)` — Insert to scans table
- `incrementScan()` — Update streak, XP, refresh usage
- `canScan()` / `getRemainingScans()` — Rate limit checks (client-side)
- `setHealthPreferences(prefs)` — Save to AsyncStorage + Supabase
- `signOut()` — Clear state, PostHog reset, Supabase sign out

---

## 7. Design System (theme/index.js)

- **Theme:** Light only (hardcoded `isDark = false`)
- **Primary color:** `#0f172a` (Dark Slate)
- **Accent:** `#0ea5e9` (Trust Blue)
- **Gold/CTA:** `#e8a838` → `#f0c060` gradient
- **Grade colors:** A=#10b981, B=#84cc16, C=#eab308, D=#f97316, E=#ef4444
- **Tab bar:** Glassmorphic (BlurView + transparent white), floating FAB scan button
- **Radii:** sm=8, md=12, card=20, button=14, xl=24, pill=9999
- **Shadows:** 5 levels (soft → fab)
- **Animations:** Reanimated everywhere (FadeInDown, spring, shared values)

---

## 8. Navigation Structure

```
AppNavigator (NativeStack)
├── [Unauthenticated]
│   └── OnboardingScreen
└── [Authenticated]
    ├── Tabs (BottomTab — custom glassmorphic tab bar)
    │   ├── Home → HomeScreen
    │   ├── History → HistoryScreen (label: "Collections")
    │   └── Settings → SettingsScreen
    ├── Scan (fullScreenModal, slide_from_bottom)
    ├── Result (card, slide_from_right)
    ├── Paywall (modal, slide_from_bottom)
    ├── Account
    ├── Notifications
    ├── HealthPreferences
    ├── PrivacySecurity
    └── HelpSupport
```

---

## 9. Environment Variables

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | RevenueCat iOS API key |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | RevenueCat Android API key |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth web client ID |
| `EXPO_PUBLIC_POSTHOG_KEY` | PostHog project API key |
| `EXPO_PUBLIC_POSTHOG_HOST` | PostHog host URL |
| `EXPO_PUBLIC_POSTHOG_ENABLED` | Feature flag to enable PostHog |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN |
| `SENTRY_AUTH_TOKEN` | Sentry auth token |
| Edge function secrets: `GROQ_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

---

## 10. External APIs

| API | Usage | Called From |
|-----|-------|-------------|
| OpenFoodFacts (`world.openfoodfacts.org/api/v2`) | Food product data by barcode | Client (processScan) + edge function |
| OpenBeautyFacts (`world.openbeautyfacts.org/api/v2`) | Cosmetic product data by barcode | Client (processScan) + edge function |
| Groq (`api.groq.com/openai/v1/chat/completions`) | AI ingredient analysis (vision + text) | Edge functions only |
| RevenueCat | Subscription management | Client (purchases.js) |
| Expo Push Service | Push notifications | Edge function (send-push-notification) |

---

## 11. Build & Deploy

```bash
# Development
npx expo start                    # Dev server
npx expo run:android              # Run on Android device

# EAS Build
eas build --profile development   # Dev client (internal)
eas build --profile preview       # APK for testing
eas build --profile production    # Production build (auto-increment version)

# EAS Submit
eas submit --profile production   # Submit to stores

# Supabase Edge Functions
supabase functions deploy analyze-scan8
supabase functions deploy scan-barcode8
supabase functions deploy send-push-notification
```

---

## 12. Known Architecture Decisions

1. **No TypeScript on client** — All frontend is `.js` (edge functions are `.ts`)
2. **Single Zustand store** — All state in one file (`useStore.js`), no slices
3. **Client-side OFF fetch** — OpenFoodFacts is called from client first for instant UI, then edge function does AI analysis
4. **Health prefs forwarding** — Client sends `healthPreferences` in edge function body to skip DB lookup
5. **3-phase barcode scan** — Instant partial → background AI → merge and update
6. **Crash refund** — Edge functions decrement scan counter on failure
7. **barcode_cache** — Global cache (not per-user), personalization layered on top
8. **Force light theme** — `isDark = false` hardcoded in theme
9. **RevenueCat non-blocking** — Purchase init runs in background after auth, never delays login
10. **Poison override set** — Hardcoded list of dangerous substances that force `high` risk regardless of AI output

---

## 13. Gamification System

| Level | Name | XP Range | Emoji |
|-------|------|----------|-------|
| 1 | Beginner | 0-49 | 🌱 |
| 2 | Explorer | 50-149 | 🔍 |
| 3 | Detective | 150-299 | 🕵️ |
| 4 | Expert | 300-499 | ⚡ |
| 5 | Master | 500+ | 👑 |

- **10 XP per scan** (incrementScan updates users.level_xp)
- **Streaks:** Consecutive days scanning (current_streak column)
- **Total scans:** `Math.floor(level_xp / 10)`

---

## 14. AI Prompt Architecture

The AI prompt system uses a clinical toxicologist persona:

- **Risk classification:** Strict 4-tier (high/moderate/low/negligible) with regulatory backing
- **Position weighting:** Top 20% = full weight, middle 30% = 70%, bottom 50% = 30%
- **Personalization:** Patient-specific notes (12-18 words) with emoji prefixes:
  - `✅` = beneficial for their condition/goal
  - `🚨` = allergy trigger
  - No prefix = harmful ingredient note
- **Regulatory citations:** FDA, EU, WHO, IARC classifications embedded in notes
- **JSON output schema:** Strict schema with productName, ingredients[], harmfulChemicals[], healthScores[], macros, cosmeticRisks
- **JSON recovery:** Multiple fallback strategies for malformed AI output

---

## 15. Key File Quick Reference

| Need to change... | Edit this file |
|-------------------|----------------|
| App root / providers | `App.js` |
| Any screen | `src/screens/[ScreenName].js` |
| Navigation routes | `src/navigation/AppNavigator.js` |
| Global state / scan logic | `src/store/useStore.js` |
| Auth logic | `src/features/auth/AuthProvider.js` |
| Design tokens / colors | `src/theme/index.js` |
| Supabase client | `src/lib/supabase.js` |
| Purchase logic | `src/lib/purchases.js` |
| Analytics | `src/lib/posthog.js` |
| Image scan AI | `supabase/functions/analyze-scan8/index.ts` |
| Barcode scan AI | `supabase/functions/scan-barcode8/index.ts` |
| Push notifications | `src/utils/notifications.js` |
| DB schema | `supabase/migration-v*.sql` |
| Build config | `eas.json`, `app.json` |
| Env vars | `.env` |
