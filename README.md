# Kharchā — Expense Tracker

**Kharchā** (खर्चा — "expense" in Hindi/Nepali) is a fast, no-fuss personal
expense tracker that runs entirely in your browser. No servers, no sign-up
walls, no ads — just a single HTML file that tracks where your money goes.

![Theme](https://img.shields.io/badge/theme-light%20%2F%20dark-informational)
![Storage](https://img.shields.io/badge/storage-local--first-brightgreen)
![Type](https://img.shields.io/badge/type-single--file%20PWA-blueviolet)

---

## ✨ Features

- **Quick entry** — log an income or expense in a few taps via the manual
  entry sheet, or import a batch of transactions at once.
- **Category tracking** — organize spending into custom categories, with a
  breakdown pie chart so you can see where your money actually goes.
- **Loan / IOU tracker** — keep tabs on money lent or borrowed, with a
  built-in loan/EMI calculator.
- **Insights & budget views** — dedicated pages for budget planning and
  spending insights, separate from your day-to-day log.
- **Light & dark themes** — switch anytime; the app remembers your choice.
- **Demo dataset** — load sample data instantly to explore the app before
  committing your own numbers.
- **Installable (PWA)** — add it to your home screen on mobile or desktop
  for an app-like experience, complete with splash screen and icons.
- **Local-first storage** — your data is saved in the browser's
  `localStorage`, scoped per account, so it stays on your device.

## 🖱️ Using the app

1. Open `index.html` in any modern browser (or visit the hosted version, if
   deployed).
2. Tap the **+** floating action button to add a transaction manually, or
   use the import flow to paste in several transactions at once.
3. Use the bottom navigation bar to switch between **Home**, **Loans**,
   **Budget**, **Insights**, and **Settings**.
4. Head to **Settings → Load demo dataset** if you just want to poke around
   with sample data first.
5. Toggle **light/dark** theme and notification preferences from Settings.

## 🗂️ Project structure

This is a **single-file app** — everything (HTML, CSS, and JavaScript) lives
in `index.html`. There's no build step and no dependencies to install.

```
index.html   → the entire app (markup + styles + logic)
```

## 💾 Data & privacy

- All transaction data is stored **locally in your browser**
  (`localStorage`), keyed per signed-in user — nothing is sent to a server.
- Clearing your browser data or switching browsers/devices will not carry
  your data over unless you export/import it manually.
- Because there's no backend, this is best suited for personal, single-device
  use rather than multi-device sync out of the box.

## 🎨 Customization

Colors, spacing, and other design tokens are defined as CSS custom
properties near the top of the stylesheet (`--bg`, `--accent`, `--in`,
`--out`, etc.), with separate palettes for dark and light themes — tweak
those to restyle the whole app.

## 🛣️ Roadmap ideas

- Cloud sync across devices
- CSV/spreadsheet export
- Recurring transaction support
- Multi-currency support

## 📄 License

Add your preferred license here (e.g., MIT).

## 🙏 Credits

Built with vanilla HTML/CSS/JS. Font: [Inter](https://fonts.google.com/specimen/Inter).
