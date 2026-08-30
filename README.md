# Kharchā (खर्चा)

**Every rupee, tracked — without the spreadsheet.**

Kharchā is a fast, no-fuss personal expense tracker that runs entirely in
your browser. It's a single HTML file — no backend, no build step, no ads —
built for anyone tracking spending, wallets, and loans in NPR against the
Nepali (Bikram Sambat) calendar.

![Version](https://img.shields.io/badge/version-1.1.0-informational)
![No backend](https://img.shields.io/badge/backend-none-lightgrey)
![Made with](https://img.shields.io/badge/made%20with-HTML%20·%20CSS%20·%20JS-orange)

---

## Features

- **Quick entry** — log a transaction in seconds, or import a batch at once.
- **Paste SMS** — paste eSewa, Khalti, or bank SMS notification text and it's
  parsed into transactions automatically (amount, date, merchant, and
  account are all picked out client-side, no network call).
- **Paste JSON import** — upload a statement photo to Claude in a separate
  chat, paste back the JSON it returns, and it's imported in one go.
- **Smart categorization** — categories can be added, renamed, or removed —
  even the built-in ones. Any import that doesn't specify a category gets
  one guessed from the shop name / bank remark automatically.
- **Home layout** — reorder the Home screen's sections (Total, Loans,
  Budget, Transactions, and both pie charts) from Settings, however you
  actually use the app. Saved per account.
- **Loans & EMI** — track money lent or borrowed, with a built-in EMI
  calculator and recurring monthly payment reminders.
- **Budgets** — set an overall or per-category monthly budget and see how
  you're tracking against it.
- **Nepali calendar** — every date you enter (AD) auto-converts to Bikram
  Sambat (BS), with a BS month filter on the Home tab.
- **Light & dark themes** — switch anytime; the app remembers your choice.
- **Local-first & private** — all data lives in `localStorage`, scoped to
  your signed-in Google account. Nothing is ever sent to a server.
- **Backup & restore** — export/import a full JSON backup, or export
  transactions to CSV, anytime from Settings → Backup & Sync.

## Getting started

Kharchā is a single `index.html` file — there's nothing to install or build.

1. **Serve the file over HTTP(S).** Google Sign-In will not work opened
   directly as a `file://` URL — it has to be served (e.g. `npx serve`,
   GitHub Pages, Netlify, or any static host).
2. **Set up Google Sign-In** (required — each Google account gets its own
   private tracker on the device):
   - Create an OAuth Client ID of type **Web application** in the
     [Google Cloud Console](https://console.cloud.google.com/) → APIs &
     Services → Credentials.
   - Add the exact URL(s) you'll serve the app from under **Authorized
     JavaScript origins**.
   - Paste that Client ID into the `GOOGLE_CLIENT_ID` constant near the
     bottom of the `<script>` in `index.html`.
3. Open the page, sign in, and you're in your own private tracker. Use
   **"🎲 Load demo dataset"** (Settings → Data) to see the app populated
   with sample data before adding your own.

## Data & privacy

Everything — transactions, balances, loans, budgets, categories, wallets,
profile — is stored **only in your browser's `localStorage`**, keyed by
your signed-in Google email. There is no server component, so:

- Nothing you enter (including pasted SMS text) ever leaves your device.
- Switching browsers or devices starts fresh unless you export a backup
  from Settings → Backup & Sync and restore it on the new device.
- Clearing your browser's site data deletes your tracker permanently unless
  you've exported a backup first.

## Tech stack

Plain HTML, CSS, and JavaScript — no framework, no bundler, no
dependencies beyond Google's Sign-In script. Typeface: Inter & Space
Grotesk.

## Feedback & contributing

This is a personal project maintained by its developer (see below). Bug
reports and feature ideas are welcome — open an issue or reach out
directly.

## Developer

**Manish Kumar Sah**
[sah.manish868@gmail.com](mailto:sah.manish868@gmail.com)

---

*Made with care for anyone tracking their kharchā, one rupee at a time.*
