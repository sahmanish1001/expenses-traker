import { useState, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  Coffee,
  ShoppingBasket,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  Smartphone,
  ShoppingBag,
  Fuel,
  HelpCircle,
  Landmark,
  Wallet,
  Upload,
  Loader2,
  X,
} from "lucide-react";

const ACCOUNTS = {
  eSewa: { color: "#3aa655", icon: Smartphone },
  "Nabil Bank": { color: "#e0473e", icon: Landmark },
  "Kumari Bank": { color: "#8a1538", icon: Landmark },
  Khalti: { color: "#5c2d91", icon: Wallet },
  Other: { color: "#9aa0ac", icon: HelpCircle },
};
const ACCOUNT_LIST = Object.keys(ACCOUNTS);

const CAT = {
  "Food & Drink": { color: "#f2a93b", icon: Coffee },
  Groceries: { color: "#8fd19e", icon: ShoppingBasket },
  "Transfer In": { color: "#5fd1a4", icon: ArrowDownLeft },
  "Transfer Out": { color: "#ef6f6c", icon: ArrowUpRight },
  "Bills & Payments": { color: "#7f9cf5", icon: Receipt },
  "Wallet Top-up": { color: "#c792ea", icon: Smartphone },
  Shopping: { color: "#e8a87c", icon: ShoppingBag },
  Transport: { color: "#6ec6dc", icon: Fuel },
  Other: { color: "#9aa0ac", icon: HelpCircle },
};

const STORE_KEY = "kharcha:data";
const rs = (n) => "Rs " + Math.round(n).toLocaleString("en-IN");

const PROMPT = `This image is a screenshot of a bank or digital wallet transaction statement from Nepal (could be eSewa, Nabil Bank, Kumari Bank, Khalti, or another provider). Extract the data and respond with ONLY raw JSON, no markdown fences, no commentary, in exactly this shape:
{"account":"eSewa"|"Nabil Bank"|"Kumari Bank"|"Khalti"|"Other","closingBalance":number|null,"transactions":[{"date":"YYYY-MM-DD","vendor":"short readable name of who was paid or who paid","category":"Food & Drink"|"Groceries"|"Transport"|"Bills & Payments"|"Wallet Top-up"|"Shopping"|"Transfer In"|"Transfer Out"|"Other","type":"in"|"out","amount":number}]}
Identify the account from any bank/wallet name, logo, or header text visible in the image (default to "Other" only if truly unclear). Do not include the Opening Balance or Closing Balance rows as transactions, but do set closingBalance from the closing balance row if one is shown, else null. Amounts must be plain numbers, no commas or currency symbols.`;

async function extractFromImage(base64, mimeType) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });
  const data = await res.json();
  const block = data.content?.find((b) => b.type === "text");
  if (!block) throw new Error("empty response");
  const clean = block.text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export default function KharchaMultiAccount() {
  const [store, setStore] = useState({ transactions: [], balances: {} });
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [activeAccount, setActiveAccount] = useState("All");
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORE_KEY, false);
        if (res?.value) setStore(JSON.parse(res.value));
      } catch (e) {
        // no saved data yet
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = async (next) => {
    setStore(next);
    try {
      await window.storage.set(STORE_KEY, JSON.stringify(next), false);
    } catch (e) {
      // best-effort; keep working in-memory even if save fails
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = () => reject(new Error("could not read file"));
        r.readAsDataURL(file);
      });
      const parsed = await extractFromImage(base64, file.type || "image/jpeg");
      const account = ACCOUNTS[parsed.account] ? parsed.account : "Other";
      const stamp = Date.now();
      const newTx = (parsed.transactions || []).map((t, i) => ({
        ...t,
        id: `${stamp}-${i}`,
        account,
      }));
      const next = {
        transactions: [...store.transactions, ...newTx],
        balances:
          parsed.closingBalance != null
            ? { ...store.balances, [account]: parsed.closingBalance }
            : store.balances,
      };
      await persist(next);
      setActiveAccount(account);
      setToast(`Added ${newTx.length} transaction${newTx.length === 1 ? "" : "s"} to ${account}`);
      setTimeout(() => setToast(null), 3500);
    } catch (err) {
      setError("Couldn't read that statement. Try a clearer or less cropped photo.");
    } finally {
      setUploading(false);
    }
  };

  const scoped =
    activeAccount === "All"
      ? store.transactions
      : store.transactions.filter((t) => t.account === activeAccount);

  const totalIn = scoped.filter((t) => t.type === "in").reduce((s, t) => s + t.amount, 0);
  const totalOut = scoped.filter((t) => t.type === "out").reduce((s, t) => s + t.amount, 0);

  let pieData = [];
  if (activeAccount === "All") {
    const m = {};
    store.transactions
      .filter((t) => t.type === "out")
      .forEach((t) => (m[t.account] = (m[t.account] || 0) + t.amount));
    pieData = Object.entries(m)
      .map(([name, value]) => ({ name, value, color: ACCOUNTS[name]?.color || "#9aa0ac" }))
      .sort((a, b) => b.value - a.value);
  } else {
    const m = {};
    scoped
      .filter((t) => t.type === "out")
      .forEach((t) => (m[t.category] = (m[t.category] || 0) + t.amount));
    pieData = Object.entries(m)
      .map(([name, value]) => ({ name, value, color: CAT[name]?.color || "#9aa0ac" }))
      .sort((a, b) => b.value - a.value);
  }
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0) || 1;

  const grouped = (() => {
    const m = {};
    [...scoped]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .forEach((t) => {
        m[t.date] = m[t.date] || [];
        m[t.date].push(t);
      });
    return Object.entries(m);
  })();

  const fmtDate = (d) => {
    try {
      return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="kh-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
        .kh-app{
          --bg:#12141c; --surface:#191c27; --surface2:#20232f; --border:rgba(255,255,255,.08);
          --text:#f2f0ea; --dim:#9396a8; --accent:#f2a93b; --in:#5fd1a4; --out:#ef6f6c;
          background:var(--bg); color:var(--text); font-family:'Inter',sans-serif;
          min-height:100%; padding:20px 16px 40px; max-width:480px; margin:0 auto;
          -webkit-font-smoothing:antialiased; position:relative;
        }
        .kh-app *{box-sizing:border-box;}
        .kh-top{display:flex; justify-content:space-between; align-items:flex-start; gap:10px;}
        .kh-eyebrow{font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--dim); margin:0 0 2px;}
        .kh-title{font-family:'Space Grotesk',sans-serif; font-size:24px; font-weight:700; margin:0;}
        .kh-upload-btn{display:flex; align-items:center; gap:6px; background:var(--accent); color:#1a1400; border:none; border-radius:12px; padding:9px 13px; font-size:12.5px; font-weight:600; cursor:pointer; white-space:nowrap; font-family:inherit;}
        .kh-upload-btn:disabled{opacity:.6; cursor:default;}
        .kh-error{margin-top:12px; font-size:12.5px; color:var(--out); background:rgba(239,111,108,.1); border:1px solid rgba(239,111,108,.3); border-radius:10px; padding:9px 12px;}
        .kh-toast{position:sticky; top:8px; z-index:5; margin-top:10px; font-size:12.5px; color:var(--in); background:rgba(95,209,164,.12); border:1px solid rgba(95,209,164,.3); border-radius:10px; padding:9px 12px; display:flex; justify-content:space-between; align-items:center; gap:8px;}
        .kh-toast button{background:none; border:none; color:var(--in); cursor:pointer; display:flex;}
        .kh-chips{display:flex; gap:8px; overflow-x:auto; margin-top:16px; padding-bottom:2px;}
        .kh-chip{display:flex; align-items:center; gap:6px; flex-shrink:0; padding:7px 12px; border-radius:999px; border:1px solid var(--border); background:var(--surface); font-size:12.5px; font-weight:500; color:var(--dim); cursor:pointer; font-family:inherit;}
        .kh-chip.active{color:#12141c; border-color:transparent;}
        .kh-chip-dot{width:7px; height:7px; border-radius:50%;}
        .kh-stats{display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;}
        .kh-stat{flex:1; min-width:100px; background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:12px 14px;}
        .kh-stat-head{font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:var(--dim);}
        .kh-stat-amt{font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:700; margin-top:6px;}
        .kh-pie-card{margin-top:16px; background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:14px;}
        .kh-pie-title{font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:var(--dim); margin:0 0 6px;}
        .kh-pie-empty{font-size:13px; color:var(--dim); padding:20px 4px; text-align:center;}
        .kh-legend{margin-top:6px;}
        .kh-legend-row{display:flex; align-items:center; gap:8px; padding:6px 0;}
        .kh-legend-dot{width:9px; height:9px; border-radius:50%; flex-shrink:0;}
        .kh-legend-name{flex:1; font-size:12.5px;}
        .kh-legend-amt{font-family:'Space Grotesk',sans-serif; font-size:12.5px; font-weight:600;}
        .kh-legend-pct{font-size:11px; color:var(--dim); width:34px; text-align:right;}
        .kh-section-title{font-size:12px; text-transform:uppercase; letter-spacing:.1em; color:var(--dim); margin:24px 0 10px;}
        .kh-empty{font-size:13.5px; color:var(--dim); background:var(--surface); border:1px dashed var(--border); border-radius:14px; padding:22px 16px; text-align:center; line-height:1.5;}
        .kh-day{margin-bottom:16px;}
        .kh-day-label{display:flex; align-items:center; gap:8px; font-size:11px; color:var(--dim); text-transform:uppercase; letter-spacing:.08em; margin-bottom:6px;}
        .kh-day-line{flex:1; height:1px; background:repeating-linear-gradient(to right, var(--border) 0 4px, transparent 4px 8px);}
        .kh-card{background:var(--surface); border:1px solid var(--border); border-radius:14px; overflow:hidden;}
        .kh-row{display:flex; align-items:center; gap:10px; padding:11px 14px; border-bottom:1px dashed var(--border);}
        .kh-row:last-child{border-bottom:none;}
        .kh-row-icon{width:30px; height:30px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0;}
        .kh-row-mid{flex:1; min-width:0;}
        .kh-row-vendor{font-size:13.5px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
        .kh-row-cat{font-size:11px; color:var(--dim); margin-top:1px;}
        .kh-row-amt{font-family:'Space Grotesk',sans-serif; font-size:13.5px; font-weight:600; flex-shrink:0;}
        .kh-spin{animation:kh-spin 1s linear infinite;}
        @keyframes kh-spin{to{transform:rotate(360deg);}}
      `}</style>

      <div className="kh-top">
        <div>
          <p className="kh-eyebrow">Multi-wallet tracker</p>
          <h1 className="kh-title">Kharchā</h1>
        </div>
        <button className="kh-upload-btn" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 size={14} className="kh-spin" /> : <Upload size={14} />}
          {uploading ? "Reading…" : "Add statement"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
      </div>

      {error && <div className="kh-error">{error}</div>}
      {toast && (
        <div className="kh-toast">
          {toast}
          <button onClick={() => setToast(null)}><X size={13} /></button>
        </div>
      )}

      <div className="kh-chips">
        <button
          className={`kh-chip${activeAccount === "All" ? " active" : ""}`}
          style={activeAccount === "All" ? { background: "var(--accent)" } : {}}
          onClick={() => setActiveAccount("All")}
        >
          All accounts
        </button>
        {ACCOUNT_LIST.map((name) => {
          const meta = ACCOUNTS[name];
          const has = store.transactions.some((t) => t.account === name);
          return (
            <button
              key={name}
              className={`kh-chip${activeAccount === name ? " active" : ""}`}
              style={activeAccount === name ? { background: meta.color } : {}}
              onClick={() => setActiveAccount(name)}
            >
              <span className="kh-chip-dot" style={{ background: meta.color, opacity: has ? 1 : 0.35 }} />
              {name}
            </button>
          );
        })}
      </div>

      {loaded && store.transactions.length === 0 ? (
        <div className="kh-empty" style={{ marginTop: 18 }}>
          No statements yet. Tap <b>Add statement</b> and upload a screenshot from eSewa, Nabil,
          Kumari, or Khalti — transactions get sorted into the right account automatically.
        </div>
      ) : (
        <>
          <div className="kh-stats">
            <div className="kh-stat">
              <div className="kh-stat-head">Money in</div>
              <div className="kh-stat-amt" style={{ color: "var(--in)" }}>{rs(totalIn)}</div>
            </div>
            <div className="kh-stat">
              <div className="kh-stat-head">Money out</div>
              <div className="kh-stat-amt" style={{ color: "var(--out)" }}>{rs(totalOut)}</div>
            </div>
            {activeAccount !== "All" && store.balances[activeAccount] != null && (
              <div className="kh-stat">
                <div className="kh-stat-head">Last balance</div>
                <div className="kh-stat-amt">{rs(store.balances[activeAccount])}</div>
              </div>
            )}
          </div>

          <div className="kh-pie-card">
            <p className="kh-pie-title">
              {activeAccount === "All" ? "Spending by account" : `Spending by category — ${activeAccount}`}
            </p>
            {pieData.length === 0 ? (
              <div className="kh-pie-empty">No spending recorded here yet.</div>
            ) : (
              <>
                <div style={{ height: 190 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="85%"
                        paddingAngle={2}
                        stroke="none"
                      >
                        {pieData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#20232f", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, fontSize: 12 }}
                        formatter={(v, n) => [rs(v), n]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="kh-legend">
                  {pieData.map((d) => (
                    <div className="kh-legend-row" key={d.name}>
                      <span className="kh-legend-dot" style={{ background: d.color }} />
                      <span className="kh-legend-name">{d.name}</span>
                      <span className="kh-legend-amt">{rs(d.value)}</span>
                      <span className="kh-legend-pct">{Math.round((d.value / pieTotal) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <p className="kh-section-title">Transactions</p>
          {grouped.map(([day, rows]) => (
            <div className="kh-day" key={day}>
              <div className="kh-day-label">
                {fmtDate(day)}
                <div className="kh-day-line" />
              </div>
              <div className="kh-card">
                {rows.map((t) => {
                  const meta = CAT[t.category] || CAT.Other;
                  const Icon = meta.icon;
                  return (
                    <div className="kh-row" key={t.id}>
                      <div className="kh-row-icon" style={{ background: meta.color + "26" }}>
                        <Icon size={14} color={meta.color} />
                      </div>
                      <div className="kh-row-mid">
                        <div className="kh-row-vendor">{t.vendor}</div>
                        <div className="kh-row-cat">
                          {activeAccount === "All" ? `${t.account} · ${t.category}` : t.category}
                        </div>
                      </div>
                      <div className="kh-row-amt" style={{ color: t.type === "in" ? "var(--in)" : "var(--out)" }}>
                        {t.type === "in" ? "+" : "−"}{rs(t.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
