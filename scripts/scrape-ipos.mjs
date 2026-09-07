// Scrapes ShareSansar's homepage IPO table and upserts the rows into
// Supabase's public `ipos` table, which the app reads from directly (see
// loadSharedIpos() in public/main.js). Runs on a schedule via
// .github/workflows/scrape-ipos.yml.
//
// The table lives in a static, server-rendered <div id="eipo"> block on
// https://www.sharesansar.com/ — a plain fetch + cheerio parse is enough,
// no headless browser needed. If ShareSansar changes that markup this
// script will just find zero rows and log it rather than writing garbage.
import * as cheerio from "cheerio";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

// Nothing scientific — just enough to label a sector on the calendar
// without a second data source. Falls back to null (shown as "—" in the app).
const SECTOR_KEYWORDS = [
  ["Hydropower", /hydropower|hydro\b/i],
  ["Microfinance", /microfinance|laghubitta/i],
  ["Life Insurance", /life insurance/i],
  ["Non-Life Insurance", /general insurance|non-?life insurance/i],
  ["Commercial Bank", /\bbank\b/i],
  ["Finance", /\bfinance\b/i],
  ["Manufacturing", /paints|industries|cement|foods?\b/i],
  ["Hospitality", /resort|hotel/i],
];
function guessSector(company) {
  const hit = SECTOR_KEYWORDS.find(([, re]) => re.test(company));
  return hit ? hit[0] : null;
}

async function main() {
  const res = await fetch("https://www.sharesansar.com/", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; KharchaIpoBot/1.0; +https://expenses-traker-olive.vercel.app/)" },
  });
  if (!res.ok) throw new Error(`ShareSansar fetch failed: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const rows = [];
  $("#eipo table tbody tr").each((_, tr) => {
    const cells = $(tr).find("td");
    if (cells.length < 9) return; // S.N., Symbol, Company, Units, Price, Open, Close, Status, View
    const symbol = $(cells[1]).text().trim();
    const company = $(cells[2]).text().trim();
    const units = parseFloat($(cells[3]).text().replace(/,/g, "")) || null;
    const price = parseFloat($(cells[4]).text().replace(/,/g, "")) || null;
    const openDate = $(cells[5]).text().trim();
    const closeDate = $(cells[6]).text().trim();
    const sourceUrl = $(cells[8]).find("a").first().attr("href") || null;
    if (!symbol || !company || !/^\d{4}-\d{2}-\d{2}$/.test(openDate) || !/^\d{4}-\d{2}-\d{2}$/.test(closeDate)) return;
    rows.push({
      id: `ss-${symbol.toLowerCase()}`,
      company,
      sector: guessSector(company),
      price,
      units_offered: units,
      open_date: openDate,
      close_date: closeDate,
      source: "sharesansar",
      source_url: sourceUrl,
      updated_at: new Date().toISOString(),
    });
  });

  if (!rows.length) {
    console.log("No IPO rows found — ShareSansar's markup may have changed. Nothing written.");
    return;
  }

  const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/ipos?on_conflict=id`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });
  if (!upsertRes.ok) {
    throw new Error(`Supabase upsert failed: ${upsertRes.status} ${await upsertRes.text()}`);
  }
  console.log(`Upserted ${rows.length} IPO row(s): ${rows.map((r) => r.company).join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
