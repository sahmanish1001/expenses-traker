  const ACCOUNTS = {
    "eSewa":       { color: "#3aa655", icon: "📱" },
    "Nabil Bank":  { color: "#e0473e", icon: "🏦" },
    "Kumari Bank": { color: "#8a1538", icon: "🏦" },
    "Khalti":      { color: "#5c2d91", icon: "👛" },
    "Other":       { color: "#9aa0ac", icon: "❔" },
  };
  // Keep metadata (color/icon) for these known names always available, so
  // typing "Nabil Bank" gets its familiar look — but a brand-new sign-in
  // only starts with eSewa; everything else is added by the person.
  const KNOWN_ACCOUNT_TEMPLATES = Object.keys(ACCOUNTS);
  const DEFAULT_ACCOUNTS = ["eSewa"];
  const MAX_ACCOUNTS = 6;
  let ACCOUNT_LIST = [...DEFAULT_ACCOUNTS];
  // Hidden accounts stay in ACCOUNT_LIST (data untouched) but are left out
  // of the account chips and out of "All accounts" totals/pie/list, so a
  // wallet you don't use anymore can be tucked away without deleting it.
  let HIDDEN_ACCOUNTS = [];
  function visibleAccounts(){ return ACCOUNT_LIST.filter(n => !HIDDEN_ACCOUNTS.includes(n)); }

  const CAT = {
    "Food & Drink":     { color: "#B45309", icon: "☕" },
    "Groceries":        { color: "#15803D", icon: "🧺" },
    "Transfer In":      { color: "#0F766E", icon: "↙️" },
    "Transfer Out":     { color: "#B91C1C", icon: "↗️" },
    "Bills & Payments": { color: "#1D4ED8", icon: "🧾" },
    "Wallet Top-up":    { color: "#7E22CE", icon: "📱" },
    "Shopping":         { color: "#C2410C", icon: "🛍️" },
    "Transport":        { color: "#0E7490", icon: "⛽" },
    "Rent":             { color: "#9D174D", icon: "🏠" },
    "Other":            { color: "#374151", icon: "❔" },
  };
  const DEFAULT_CATEGORIES = Object.keys(CAT);

  // Home tab is a stack of these cards; each user can reorder them from
  // Settings → Home Layout. HOME_LAYOUT holds the current order (an array
  // of section ids); the actual DOM elements live in fixed wrapper divs
  // (#homeSection<Id>) inside #homeSections so applyHomeLayout() only has
  // to move nodes around, never re-render their contents.
  const HOME_SECTIONS = [
    { id: "stats",        label: "Total & summary",  icon: "📊" },
    { id: "loans",         label: "Loan overview",    icon: "🤝" },
    { id: "budget",        label: "Budget",           icon: "🎯" },
    { id: "room",          label: "Room expenses",    icon: "🏠" },
    { id: "recurring",     label: "Recurring bills",  icon: "🔁" },
    { id: "transactions",  label: "Transactions",     icon: "🧾" },
    { id: "pie",           label: "Spending pie chart", icon: "🥧" },
    { id: "nppie",          label: "Nepali month pie chart", icon: "📆" },
  ];
  const DEFAULT_HOME_LAYOUT = HOME_SECTIONS.map(s => s.id);
  let HOME_LAYOUT = [...DEFAULT_HOME_LAYOUT];

  // Keeps a saved layout usable even if sections are ever renamed/added:
  // drops ids that no longer exist, appends any new ones at the end.
  function normalizeHomeLayout(saved){
    if (!Array.isArray(saved)) return [...DEFAULT_HOME_LAYOUT];
    const valid = saved.filter(id => DEFAULT_HOME_LAYOUT.includes(id));
    DEFAULT_HOME_LAYOUT.forEach(id => { if (!valid.includes(id)) valid.push(id); });
    return valid;
  }

  function homeSectionElId(id){
    return "homeSection" + id.charAt(0).toUpperCase() + id.slice(1);
  }

  function applyHomeLayout(){
    const container = document.getElementById("homeSections");
    if (!container) return;
    // Only touch the DOM when the order actually differs. appendChild on
    // an existing child detaches and re-inserts it, which restarts any
    // CSS animation on that node — and renderAll() calls this on every
    // data refresh, so without this guard the section entrance animation
    // would replay every time a transaction was added.
    const wanted = HOME_LAYOUT.map(homeSectionElId);
    const current = Array.from(container.children).map(el => el.id);
    if (wanted.length === current.length && wanted.every((id, i) => id === current[i])) return;
    HOME_LAYOUT.forEach(id => {
      const el = document.getElementById(homeSectionElId(id));
      if (el) container.appendChild(el);
    });
  }

  function moveHomeSection(id, dir){
    const idx = HOME_LAYOUT.indexOf(id);
    const swapIdx = idx + dir;
    if (idx === -1 || swapIdx < 0 || swapIdx >= HOME_LAYOUT.length) return;
    [HOME_LAYOUT[idx], HOME_LAYOUT[swapIdx]] = [HOME_LAYOUT[swapIdx], HOME_LAYOUT[idx]];
    applyHomeLayout();
    renderHomeLayoutManager();
    saveCurrentUser();
  }

  function resetHomeLayout(){
    HOME_LAYOUT = [...DEFAULT_HOME_LAYOUT];
    applyHomeLayout();
    renderHomeLayoutManager();
    saveCurrentUser();
    showToast("Home layout reset");
  }

  function renderHomeLayoutManager(){
    const el = document.getElementById("homeLayoutList");
    if (!el) return;
    el.innerHTML = HOME_LAYOUT.map((id, i) => {
      const sec = HOME_SECTIONS.find(s => s.id === id);
      if (!sec) return "";
      return `<div class="kh-layout-row">
        <span class="kh-layout-row-icon">${sec.icon}</span>
        <span class="kh-layout-row-label">${sec.label}</span>
        <div class="kh-layout-row-btns">
          <button class="kh-layout-btn" onclick="moveHomeSection(${attrJson(id)}, -1)" ${i === 0 ? "disabled" : ""} title="Move up">↑</button>
          <button class="kh-layout-btn" onclick="moveHomeSection(${attrJson(id)}, 1)" ${i === HOME_LAYOUT.length - 1 ? "disabled" : ""} title="Move down">↓</button>
        </div>
      </div>`;
    }).join("");
  }

  // The Room page (Balance summary / Roommates / Balances / Recent shared
  // expenses / Room rent) is reorderable the same way the Home tab is —
  // same wrapper-div + move-by-index approach as HOME_LAYOUT above, just
  // scoped to #roomSections instead of #homeSections.
  const ROOM_SECTIONS = [
    { id: "hero",       label: "Balance summary",       icon: "💰" },
    { id: "roommates",  label: "Roommates",              icon: "👥" },
    { id: "balances",   label: "Balances & settle up",   icon: "⚖️" },
    { id: "expenses",   label: "Recent shared expenses", icon: "🧾" },
    { id: "rent",       label: "Room rent",              icon: "🏠" },
  ];
  const DEFAULT_ROOM_LAYOUT = ROOM_SECTIONS.map(s => s.id);
  let ROOM_LAYOUT = [...DEFAULT_ROOM_LAYOUT];

  // First-time-user checklist ("add a wallet" / "log a transaction" /
  // "set a budget") — shown on Home until every step is done or the
  // person dismisses it. Persisted per-account (see saveCurrentUser()/
  // applyUserDataSnapshot()) so it doesn't reappear on every sign-in.
  let ONBOARDING_DISMISSED = false;

  // Guest Mode — a real, local-only session with no Google sign-in. Data
  // lives under its own localStorage key (via dataKeyFor(GUEST_EMAIL)),
  // never touches Supabase (supabaseUserId stays null, which every
  // Supabase call site already guards on), and isn't resumed on the next
  // visit (see signIn()'s persistSession option) — landing on the
  // marketing page fresh each time, while the guest's own edits are still
  // there if they choose "Try Guest Mode" again on this device.
  let isGuestMode = false;
  const GUEST_EMAIL = "guest@local.kharcha";

  function normalizeRoomLayout(saved){
    if (!Array.isArray(saved)) return [...DEFAULT_ROOM_LAYOUT];
    const valid = saved.filter(id => DEFAULT_ROOM_LAYOUT.includes(id));
    DEFAULT_ROOM_LAYOUT.forEach(id => { if (!valid.includes(id)) valid.push(id); });
    return valid;
  }

  function roomSectionElId(id){
    return "roomSection" + id.charAt(0).toUpperCase() + id.slice(1);
  }

  function applyRoomLayout(){
    const container = document.getElementById("roomSections");
    if (!container) return;
    ROOM_LAYOUT.forEach(id => {
      const el = document.getElementById(roomSectionElId(id));
      if (el) container.appendChild(el);
    });
  }

  function moveRoomSection(id, dir){
    const idx = ROOM_LAYOUT.indexOf(id);
    const swapIdx = idx + dir;
    if (idx === -1 || swapIdx < 0 || swapIdx >= ROOM_LAYOUT.length) return;
    [ROOM_LAYOUT[idx], ROOM_LAYOUT[swapIdx]] = [ROOM_LAYOUT[swapIdx], ROOM_LAYOUT[idx]];
    applyRoomLayout();
    renderRoomLayoutManager();
    saveCurrentUser();
  }

  function resetRoomLayout(){
    ROOM_LAYOUT = [...DEFAULT_ROOM_LAYOUT];
    applyRoomLayout();
    renderRoomLayoutManager();
    saveCurrentUser();
    showToast("Room layout reset");
  }

  function renderRoomLayoutManager(){
    const el = document.getElementById("roomLayoutList");
    if (!el) return;
    el.innerHTML = ROOM_LAYOUT.map((id, i) => {
      const sec = ROOM_SECTIONS.find(s => s.id === id);
      if (!sec) return "";
      return `<div class="kh-layout-row">
        <span class="kh-layout-row-icon">${sec.icon}</span>
        <span class="kh-layout-row-label">${sec.label}</span>
        <div class="kh-layout-row-btns">
          <button class="kh-layout-btn" onclick="moveRoomSection(${attrJson(id)}, -1)" ${i === 0 ? "disabled" : ""} title="Move up">↑</button>
          <button class="kh-layout-btn" onclick="moveRoomSection(${attrJson(id)}, 1)" ${i === ROOM_LAYOUT.length - 1 ? "disabled" : ""} title="Move down">↓</button>
        </div>
      </div>`;
    }).join("");
  }

  // This is only a one-time DEMO seed, offered to a brand-new user so they
  // can see what the tracker looks like with data in it. It is never
  // auto-loaded for every user — each signed-in Google account gets its own
  // empty tracker and can load the demo from the empty-state button.
  const DEMO_SEED_TRANSACTIONS = [
    { date:"2026-08-18", vendor:"ESW Transfer", category:"Transfer In", type:"in", amount:3000, account:"Nabil Bank" },
    { date:"2026-08-18", vendor:"ESW Transfer", category:"Transfer In", type:"in", amount:1000, account:"Nabil Bank" },
    { date:"2026-08-18", vendor:"Chai Town", category:"Food & Drink", type:"out", amount:35, account:"Nabil Bank" },
    { date:"2026-08-18", vendor:"Myoseen Meat Pvt. Ltd", category:"Groceries", type:"out", amount:200, account:"Nabil Bank" },
    { date:"2026-08-19", vendor:"Shree Krishna Dairy", category:"Groceries", type:"out", amount:35, account:"Nabil Bank" },
    { date:"2026-08-19", vendor:"Rudra Karki — nasta", category:"Food & Drink", type:"out", amount:100, account:"Nabil Bank" },
    { date:"2026-08-20", vendor:"Bank Transfer", category:"Transfer In", type:"in", amount:30000, account:"Nabil Bank" },
    { date:"2026-08-20", vendor:"Bank Transfer", category:"Transfer In", type:"in", amount:24000, account:"Nabil Bank" },
    { date:"2026-08-20", vendor:"Manish Kumar", category:"Transfer Out", type:"out", amount:54000, account:"Nabil Bank" },
    { date:"2026-08-20", vendor:"Bank Transfer", category:"Transfer In", type:"in", amount:11000, account:"Nabil Bank" },
    { date:"2026-08-20", vendor:"Bank Transfer", category:"Transfer In", type:"in", amount:800, account:"Nabil Bank" },
    { date:"2026-08-21", vendor:"CIPS Payment", category:"Bills & Payments", type:"out", amount:15040, account:"Nabil Bank" },
    { date:"2026-08-23", vendor:"Liza Momo House", category:"Food & Drink", type:"out", amount:170, account:"Nabil Bank" },
    { date:"2026-08-24", vendor:"ESW Transfer", category:"Transfer In", type:"in", amount:8000, account:"Nabil Bank" },
    { date:"2026-08-24", vendor:"eSewa Load", category:"Wallet Top-up", type:"out", amount:100, account:"Nabil Bank" },
    { date:"2026-08-25", vendor:"eSewa Load", category:"Wallet Top-up", type:"out", amount:5000, account:"Nabil Bank" },
    { date:"2026-08-26", vendor:"Shiddhi Ganesh Spare Parts", category:"Shopping", type:"out", amount:850, account:"Nabil Bank" },
    { date:"2026-08-26", vendor:"eSewa Load", category:"Wallet Top-up", type:"out", amount:450, account:"Nabil Bank" },
    { date:"2026-08-26", vendor:"Valley Baba Suppliers — fuel", category:"Transport", type:"out", amount:1000, account:"Nabil Bank" },
    { date:"2026-08-26", vendor:"Narendra Chatpate Pasal", category:"Food & Drink", type:"out", amount:50, account:"Nabil Bank" },
    { date:"2026-08-27", vendor:"QR Payment", category:"Other", type:"out", amount:112, account:"Nabil Bank" },
    { date:"2026-08-27", vendor:"Binayak Tarkari Pasal", category:"Groceries", type:"out", amount:50, account:"Nabil Bank" },
    { date:"2026-08-27", vendor:"Anshila Ghimire", category:"Transfer In", type:"in", amount:5000, account:"Nabil Bank" },
  ];
  const DEMO_SEED_BALANCES = { "Nabil Bank": 5608 };

  // Live state for the signed-in user — populated by loadUserData() after
  // Google sign-in, saved back to that user's own storage slot on change.
  let TRANSACTIONS = [];
  let BALANCES = {};
  let nextTxId = 1;
  let LOANS = [];
  let nextLoanId = 1;
  let loanFilter = "all"; // "all" | "lent" | "borrowed" | "emi" — "all"/"lent"/"borrowed" exclude EMI loans
  let editingLoanId = null;
  let loanFormType = "borrowed";
  let payingLoanId = null;
  let lastLoanCalc = null; // last result from the standalone EMI calculator, for "track this" 
  let BUDGETS = {}; // categoryName -> monthly limit (Rs, in whatever currency)
  let BUDGET_OVERALL = null; // number or null

  // Room expenses — shared-flat cost splitting between roommates. "Me"
  // always represents the signed-in user and can't be renamed/removed.
  // Each expense is paid by one roommate and split (equally, by default)
  // among a subset of roommates; balances are derived, not stored.
  let ROOMMATES = ["Me"];
  let ROOM_EXPENSES = []; // { id, date, desc, category, amount, paidBy, splitAmong: [names], txId? }
  let ROOM_SETTLEMENTS = []; // { id, date, from, to, amount } — a debt paydown between two roommates
  let nextRoomExpenseId = 1;
  let nextRoomSettlementId = 1;
  let activeRoomNepaliMonth = "current"; // "All", "current" (resolved to this-month on first render), or a "bsYear-bsMonth" key

  // Email-invited roommates share ONE `rooms` row in Supabase instead of
  // each keeping a private copy — currentRoomId is null for anyone who's
  // only ever added local (no-email) roommates, in which case room data
  // just lives in the personal snapshot exactly like before.
  let currentRoomId = null;
  let ROOMMATE_EMAILS = {}; // { name: email } — only set for roommates added with an invite

  // Room rent & utilities — a recurring monthly bill, distinct from
  // one-off shared expenses. One AD calendar month = one "billing cycle";
  // logging it creates a normal Rent-category ROOM_EXPENSE (so it folds
  // into the balances above too), and per-roommate paydown of THAT
  // specific bill is tracked via ROOM_SETTLEMENTS entries carrying an
  // expenseId + optional payment method, so the cycle card can show
  // "Settled via Fonepay" instead of just a net balance.
  let ROOM_RENT = { rentAmount: 0, utilitiesAmount: 0, dueDay: 1, landlordName: "", landlordPhone: "" };

  // Recurring personal bills — Netflix, wifi, gym, etc. Same BS-due-day
  // + "log this cycle" model as ROOM_RENT above, just a list of them
  // instead of one, and each logs straight to TRANSACTIONS (personal
  // spending) rather than a shared ROOM_EXPENSE. "Logged this cycle" is
  // derived by looking for a transaction tagged with recurringId in the
  // current AD month, not stored as its own flag.
  let RECURRING = []; // { id, name, category, amount, dueDay, account }
  let nextRecurringId = 1;
  let editingRecurringId = null;

  // Shared expenses scoped to the room page's own month filter. Balances
  // (who owes whom) deliberately do NOT use this — a debt someone still
  // owes doesn't stop being owed just because you've filtered the view to
  // a different month, so computeRoomBalances always looks at everything.
  // This scoping is only for the "this cycle" total and the visible list.
  function getScopedRoomExpenses(){
    if (activeRoomNepaliMonth === "All") return ROOM_EXPENSES;
    return ROOM_EXPENSES.filter(e => bsMonthKey(e.date) === activeRoomNepaliMonth);
  }
  const ROOMMATE_PALETTE = ["#0F766E","#B45309","#7E22CE","#1D4ED8","#B91C1C","#15803D","#C2410C","#0E7490","#9D174D","#4B5563"];
  function roommateColor(name){
    const idx = ROOMMATES.indexOf(name);
    return ROOMMATE_PALETTE[(idx < 0 ? 0 : idx) % ROOMMATE_PALETTE.length];
  }
  // "Me" is always the storage key for the signed-in person (so saved
  // expenses/splits stay stable even if they rename themselves), but
  // wherever we show it to the user we swap in their actual name —
  // whatever they've set under Settings → Name, falling back to their
  // Google account name, falling back to plain "Me".
  function roommateDisplayName(name){
    if (name !== "Me") return name;
    const n = (PROFILE.name && PROFILE.name.trim()) || (currentUser && currentUser.name) || "Me";
    return n.split(" ")[0];
  }

  // -----------------------------------------------------------------------
  // Shared rooms — once a roommate is added with an email, room data
  // (roommates, shared expenses, settlements, rent) moves from this user's
  // private snapshot into a single `rooms` row that every joined member
  // reads/writes. Personal data (accounts, transactions, loans, budgets)
  // never leaves the user_data table — only the fields below are shared.
  // -----------------------------------------------------------------------
  function currentRoomSnapshot(){
    return {
      roommates: ROOMMATES,
      roommateEmails: ROOMMATE_EMAILS,
      roomExpenses: ROOM_EXPENSES,
      roomSettlements: ROOM_SETTLEMENTS,
      nextRoomExpenseId,
      nextRoomSettlementId,
      roomRent: ROOM_RENT,
    };
  }

  function applyRoomSnapshot(data){
    data = data || {};
    ROOMMATES = data.roommates && data.roommates.length ? data.roommates : ["Me"];
    ROOMMATE_EMAILS = data.roommateEmails || {};
    ROOM_EXPENSES = data.roomExpenses || [];
    ROOM_SETTLEMENTS = data.roomSettlements || [];
    nextRoomExpenseId = data.nextRoomExpenseId || (ROOM_EXPENSES.length + 1);
    nextRoomSettlementId = data.nextRoomSettlementId || (ROOM_SETTLEMENTS.length + 1);
    ROOM_RENT = data.roomRent || { rentAmount: 0, utilitiesAmount: 0, dueDay: 1, landlordName: "", landlordPhone: "" };
  }

  let roomRealtimeChannel = null;
  let lastSelfRoomSaveAt = null;

  function saveRoomData(){
    if (!currentRoomId) return;
    const sb = getSb();
    if (!sb) return;
    const savedAt = new Date().toISOString();
    lastSelfRoomSaveAt = savedAt;
    sb.from("rooms").update({ data: currentRoomSnapshot(), updated_at: savedAt }).eq("id", currentRoomId)
      .then(({ error }) => { if (error) console.warn("Kharcha: room save failed —", error.message); });
  }

  function startRoomRealtimeSync(){
    const sb = getSb();
    if (!sb || !currentRoomId) return;
    stopRoomRealtimeSync();
    roomRealtimeChannel = sb
      .channel(`room_${currentRoomId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${currentRoomId}` },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          if (lastSelfRoomSaveAt && row.updated_at && row.updated_at <= lastSelfRoomSaveAt) return;
          applyRoomSnapshot(row.data);
          renderAll();
          renderRoommateManager();
          showToast("Room updated by a roommate");
        })
      .subscribe();
  }

  function stopRoomRealtimeSync(){
    const sb = getSb();
    if (sb && roomRealtimeChannel) sb.removeChannel(roomRealtimeChannel);
    roomRealtimeChannel = null;
  }

  // Checks whether this email has an unclaimed invite waiting, and if so
  // marks it joined and hands back that room's id. Called right after
  // sign-in so accepting an invite needs nothing from the person beyond
  // signing in with the email it was sent to.
  async function resolvePendingRoomInvite(email, supaUserId){
    const sb = getSb();
    if (!sb || !supaUserId) return null;
    try{
      const { data: invite, error } = await sb.from("room_members")
        .select("id, room_id").ilike("email", email).eq("status", "invited").is("user_id", null)
        .limit(1).maybeSingle();
      if (error || !invite) return null;
      await sb.from("room_members").update({ status: "joined", user_id: supaUserId }).eq("id", invite.id);
      return invite.room_id;
    }catch(e){
      console.warn("Kharcha: couldn't check for pending room invite —", e);
      return null;
    }
  }

  async function loadRoomData(roomId){
    const sb = getSb();
    if (!sb || !roomId) return;
    try{
      const { data: row, error } = await sb.from("rooms").select("data").eq("id", roomId).maybeSingle();
      if (error) throw error;
      currentRoomId = roomId;
      applyRoomSnapshot(row ? row.data : {});
      startRoomRealtimeSync();
    }catch(e){
      console.warn("Kharcha: couldn't load shared room —", e);
    }
  }

  // Turns today's local room data into a real shared room the first time
  // someone is invited by email; reuses the same shared room on every
  // invite after that (so a second invite doesn't create a second room).
  async function ensureSharedRoom(){
    if (currentRoomId) return currentRoomId;
    const sb = getSb();
    if (!sb || !supabaseUserId) throw new Error("Sign in required");
    const { data: room, error } = await sb.from("rooms")
      .insert({ name: "Room", owner_id: supabaseUserId, data: currentRoomSnapshot() })
      .select("id").single();
    if (error) throw error;
    currentRoomId = room.id;
    await sb.from("room_members").upsert(
      { room_id: currentRoomId, email: currentUser.email, name: currentUser.name, user_id: supabaseUserId, status: "joined" },
      { onConflict: "room_id,email" }
    );
    startRoomRealtimeSync();
    return currentRoomId;
  }

  async function inviteRoommateByEmail(email, name){
    const roomId = await ensureSharedRoom();
    const sb = getSb();
    const { error } = await sb.from("room_members")
      .upsert({ room_id: roomId, email, name, status: "invited" }, { onConflict: "room_id,email" });
    if (error && error.code !== "23505") throw error;

    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-room-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}`, "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({ roomId, roomName: "Room", inviteeEmail: email }),
    });
    if (!res.ok) throw new Error("Invite email failed to send");
  }

  const CURRENCY_SYMBOLS = { NPR: "Rs", INR: "₹", USD: "$", EUR: "€", GBP: "£" };
  const CURRENCY_LOCALES = { NPR: "en-IN", INR: "en-IN", USD: "en-US", EUR: "de-DE", GBP: "en-GB" };
  let PROFILE = { name: "", age: "", email: "", currency: "NPR", monthlyIncome: "" };

  let activeAccount = "All";
  let activeNepaliMonth = "current"; // "All", "current" (resolved to this-month on first render), or a "bsYear-bsMonth" key like "2083-5"
  const rs = (n) => {
    const symbol = CURRENCY_SYMBOLS[PROFILE.currency] || "Rs";
    const locale = CURRENCY_LOCALES[PROFILE.currency] || "en-IN";
    return symbol + " " + Math.round(n).toLocaleString(locale);
  };

  function fmtDate(d){
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric" });
  }

  // ---------------------------------------------------------------------
  // Loan due-date reminders — pure client-side .ics generation. No backend,
  // no API keys: the file downloads with a VALARM one day before (and one
  // on) the due date, and importing it into Google Calendar means Gmail
  // sends the reminder automatically, even after the app is closed.
  // ---------------------------------------------------------------------
  function icsEscape(str){
    return String(str)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  function addLoanReminder(id){
    const l = LOANS.find(x => x.id === id);
    if (!l || !l.dueDate) return;

    const dueYMD = l.dueDate.replace(/-/g, "");
    const verb = l.type === "lent" ? "Collect from" : "Pay";
    const amountForTitle = l.isEmi && l.emiAmount ? l.emiAmount : l.principal;
    const title = l.isEmi
      ? `EMI due: ${verb} ${l.person} — ${rs(amountForTitle)}/month`
      : `Loan due: ${verb} ${l.person} — ${rs(amountForTitle)}`;
    const descParts = [];
    if (l.isEmi){
      descParts.push(`Monthly EMI of ${rs(l.emiAmount)} ${l.type === "lent" ? `owed to you by ${l.person}` : `you owe ${l.person}`}.`);
      if (l.emiTenure){
        const remaining = Math.max(0, l.emiTenure - emiInstallmentsPaid(l));
        descParts.push(`Roughly ${remaining} of ${l.emiTenure} installments remaining.`);
      }
    } else {
      descParts.push(`${l.type === "lent" ? "Owed to you by" : "You owe"} ${l.person}: ${rs(l.principal)}.`);
    }
    if (l.notes) descParts.push(`Note: ${l.notes}`);
    descParts.push("Logged in Kharcha.");
    const desc = descParts.join(" ");

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

    // For EMI loans, repeat monthly (optionally capped at the remaining
    // installment count) so one reminder covers the whole tenure instead
    // of having to re-export a new .ics every month.
    let rrule = null;
    if (l.isEmi){
      if (l.emiTenure){
        const remaining = Math.max(1, l.emiTenure - emiInstallmentsPaid(l));
        rrule = `RRULE:FREQ=MONTHLY;COUNT=${remaining}`;
      } else {
        rrule = "RRULE:FREQ=MONTHLY";
      }
    }

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Kharcha//Loan Reminder//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${l.id}-${dtstamp}@kharcha`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${dueYMD}`,
      `DTEND;VALUE=DATE:${dueYMD}`,
      ...(rrule ? [rrule] : []),
      `SUMMARY:${icsEscape(title)}`,
      `DESCRIPTION:${icsEscape(desc)}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Payment due tomorrow",
      "TRIGGER:-P1D",
      "END:VALARM",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Payment due today",
      "TRIGGER:PT9H",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR"
    ];
    const ics = lines.join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${l.isEmi ? "emi" : "loan"}-reminder-${l.person.replace(/[^a-z0-9]+/gi, "_")}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    showToast(l.isEmi ? "Monthly EMI reminder downloaded — import it into your calendar" : "Reminder downloaded — import it into your calendar");
  }

  // Same idea as addLoanReminder above, but a daily repeating nudge to
  // just open the app and log today's spending — the one thing an
  // on-device, no-server tracker can't do on its own (a real push
  // notification would need a backend), so the phone's own calendar app
  // does the reminding instead.
  function downloadDailyLogReminder(){
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
    // A floating (no Z / no TZID) local start time, so it fires at 8pm
    // wherever the calendar app's device actually is.
    const todayLocal = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Kharcha//Daily Log Reminder//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:daily-log-${dtstamp}@kharcha`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${todayLocal}T200000`,
      `DTEND:${todayLocal}T201500`,
      "RRULE:FREQ=DAILY",
      `SUMMARY:${icsEscape("Log today's spending in Kharchā")}`,
      `DESCRIPTION:${icsEscape("A quick daily nudge so nothing slips through — takes 10 seconds to add a transaction.")}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Log today's spending",
      "TRIGGER:PT0M",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    const ics = lines.join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kharcha-daily-log-reminder.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    showToast("Daily reminder downloaded — import it into your calendar");
  }

  // ---------------------------------------------------------------------
  // Loans — track money lent to or borrowed from people, separate from
  // regular expense/income transactions. Each loan optionally mirrors its
  // principal and repayments into TRANSACTIONS (see saveLoan/saveLoanPayment)
  // so cash flow stays accurate; the linkTxId fields let us clean those up
  // again if the loan itself is deleted.
  // ---------------------------------------------------------------------
  function todayStr(){
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function daysBetween(d1, d2){
    return (new Date(d2 + "T00:00:00Z") - new Date(d1 + "T00:00:00Z")) / 86400000;
  }

  function loanPaid(loan){
    return (loan.payments || []).reduce((s, p) => s + p.amount, 0);
  }

  // Interest accrued as of `asOf` (defaults to today).
  // "flat": simple interest on the original principal for the whole
  //         elapsed period — the rate a lot of informal loans in Nepal
  //         are quoted at.
  // "reducing": interest is recalculated on the balance still outstanding
  //         after each payment, so it shrinks as the loan gets paid down
  //         — the bank-style method, and the usual source of confusion
  //         with "flat" rates that quote the same-looking % per year.
  function loanInterestAccrued(loan, asOf){
    asOf = asOf || todayStr();
    const rate = Number(loan.interestRate) || 0;
    if (!rate || !loan.interestType || loan.interestType === "none") return 0;
    if (loan.interestType === "flat"){
      const years = Math.max(0, daysBetween(loan.dateGiven, asOf) / 365);
      return loan.principal * (rate / 100) * years;
    }
    // reducing balance
    const events = [...(loan.payments || [])].sort((a, b) => a.date < b.date ? -1 : 1);
    let balance = loan.principal;
    let cursor = loan.dateGiven;
    let interestAccrued = 0;
    events.forEach(ev => {
      const yrs = Math.max(0, daysBetween(cursor, ev.date) / 365);
      const periodInterest = balance * (rate / 100) * yrs;
      interestAccrued += periodInterest;
      balance = Math.max(0, balance + periodInterest - ev.amount);
      cursor = ev.date;
    });
    const yrsToAsOf = Math.max(0, daysBetween(cursor, asOf) / 365);
    interestAccrued += balance * (rate / 100) * yrsToAsOf;
    return interestAccrued;
  }

  function loanTotals(loan){
    const paid = loanPaid(loan);
    const interest = loanInterestAccrued(loan);
    const totalOwed = loan.principal + interest;
    const outstanding = Math.max(0, totalOwed - paid);
    return { paid, interest, totalOwed, outstanding };
  }

  // Projects when an EMI loan will be fully paid off, assuming the
  // remaining installments land roughly one per month from today.
  function emiPayoffDate(loan){
    if (!loan.isEmi || !loan.emiTenure) return null;
    const remaining = loan.emiTenure - emiInstallmentsPaid(loan);
    if (remaining <= 0) return null;
    const d = new Date(todayStr() + "T00:00:00");
    d.setMonth(d.getMonth() + remaining);
    return d.toISOString().slice(0, 10);
  }

  const LOAN_STATUS_META = {
    "Pending":         { color: "#9396a8", bg: "rgba(147,150,168,.16)" },
    "Partially Paid":  { color: "#f59e0b", bg: "rgba(245,158,11,.16)" },
    "Cleared":         { color: "#22c55e", bg: "rgba(34,197,94,.16)" },
    "Overdue":         { color: "#f97316", bg: "rgba(249,115,22,.16)" },
  };

  function loanStatus(loan){
    const { outstanding } = loanTotals(loan);
    if (outstanding <= 0.5) return "Cleared";
    if (loan.dueDate && loan.dueDate < todayStr()) return "Overdue";
    return loanPaid(loan) > 0 ? "Partially Paid" : "Pending";
  }

  function netLoanPosition(scope){
    let lentOutstanding = 0, borrowedOutstanding = 0;
    LOANS.forEach(l => {
      if (scope === "emi" && !l.isEmi) return;
      if (scope === "nonEmi" && l.isEmi) return;
      const { outstanding } = loanTotals(l);
      if (l.type === "lent") lentOutstanding += outstanding;
      else borrowedOutstanding += outstanding;
    });
    return { lentOutstanding, borrowedOutstanding, net: lentOutstanding - borrowedOutstanding };
  }

  // ---------------------------------------------------------------------
  // Nepali (Bikram Sambat) calendar support.
  // Converts a worldwide/Gregorian (AD) date into the Nepali BS date so
  // spending can be grouped and viewed by Nepali month.
  //
  // Nepal's BS calendar doesn't follow a fixed formula (each month's length
  // is fixed by the official Nepali calendar and can shift by a day from
  // year to year), so this uses the well-established month-start dates that
  // hold for the current era (~2018-2035 AD / BS 2075-2091). Day-of-month
  // can occasionally be off by a day right at a month boundary in some
  // years; month and year are reliable, which is what the grouping below
  // depends on.
  // ---------------------------------------------------------------------
  const NEPALI_MONTHS = [
    { name: "Baisakh", color: "#f2a93b" },
    { name: "Jestha",  color: "#5fd1a4" },
    { name: "Asar",    color: "#ef6f6c" },
    { name: "Shrawan", color: "#7f9cf5" },
    { name: "Bhadra",  color: "#c792ea" },
    { name: "Ashwin",  color: "#e8a87c" },
    { name: "Kartik",  color: "#6ec6dc" },
    { name: "Mangsir", color: "#8fd19e" },
    { name: "Poush",   color: "#e0473e" },
    { name: "Magh",    color: "#3aa655" },
    { name: "Falgun",  color: "#b98cce" },
    { name: "Chaitra", color: "#f2c14e" },
  ];
  // [adMonth, adDay] each BS month begins on, for a BS year that starts
  // (Baisakh 1) in April of a given AD year "Y". Magh/Falgun/Chaitra fall
  // in Y+1.
  const BS_MONTH_STARTS = [
    [4, 13], [5, 14], [6, 14], [7, 16], [8, 16], [9, 17],
    [10, 17], [11, 16], [12, 15], [1, 14], [2, 12], [3, 14],
  ];

  function bsBoundariesForBaisakhYear(Y){
    // Returns the 12 month-start boundaries (as real Date objects) for the
    // BS year that begins Baisakh 1 in April of AD year Y.
    return BS_MONTH_STARTS.map(([adMonth, adDay], i) => {
      const adYear = adMonth <= 3 ? Y + 1 : Y; // Magh(10)/Falgun(11)/Chaitra(12) land in Jan-Mar of Y+1
      return {
        date: new Date(Date.UTC(adYear, adMonth - 1, adDay)),
        bsMonth: i + 1,
        bsYear: Y + 57,
      };
    });
  }

  function adToBs(dateStr){
    const d = new Date(dateStr + "T00:00:00Z");
    const adYear = d.getUTCFullYear();
    // The boundary that applies could belong to "this AD year's Baisakh"
    // or the previous one (for Jan/Feb/early-Mar dates), so build both.
    const candidates = [
      ...bsBoundariesForBaisakhYear(adYear - 1),
      ...bsBoundariesForBaisakhYear(adYear),
    ].sort((a, b) => a.date - b.date);

    let match = candidates[0];
    for (const c of candidates){
      if (c.date <= d) match = c; else break;
    }
    const dayDiff = Math.round((d - match.date) / 86400000) + 1;
    return { year: match.bsYear, month: match.bsMonth, day: dayDiff };
  }

  function bsLabel(dateStr){
    const bs = adToBs(dateStr);
    return `${NEPALI_MONTHS[bs.month - 1].name} ${bs.day}, ${bs.year}`;
  }

  // Reverse of adToBs — a BS year/month/day back to an AD "YYYY-MM-DD"
  // string. Used for anything set by a Nepali calendar day (like a rent
  // due day) that then needs real date math (countdowns, overdue checks).
  function bsToAd(bsYear, bsMonth, bsDay){
    const Y = bsYear - 57;
    const boundary = bsBoundariesForBaisakhYear(Y).find(b => b.bsMonth === bsMonth);
    if (!boundary) return todayStr();
    const d = new Date(boundary.date.getTime() + (bsDay - 1) * 86400000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  function showToast(msg){
    const t = document.getElementById("toast");
    if (msg) t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2200);
  }

  function toggleImport(){
    openPanel("import");
  }

  // ---------------------------------------------------------------------
  // "Open Claude to scan a statement" — a shareable deep link into a fresh
  // Claude chat, pre-filled with exact instructions for the JSON schema
  // this app's importer expects (see parseTxObject/importData above).
  // Claude does the reading of the photo, the vendor-name cleanup, and the
  // category guessing; the person just uploads a screenshot there and
  // pastes back whatever JSON block Claude replies with.
  // ---------------------------------------------------------------------
  const STATEMENT_IMPORT_PROMPT = [
    "I'm going to upload a photo or screenshot of a bank/wallet statement (eSewa, Khalti, or a bank app).",
    "Please read every transaction visible in the image and reply with ONLY a single JSON code block (no extra commentary) in exactly this shape:",
    "",
    '{"account":"<name of the bank or wallet, e.g. eSewa>","closingBalance":<number, if visible>,"transactions":[',
    '  {"date":"YYYY-MM-DD","vendor":"<short, clean merchant/payee name>","category":"<one of: Food & Drink, Groceries, Wallet Top-up, Bills & Payments, Transport, Shopping, Transfer In, Transfer Out, Other>","type":"in or out","amount":<positive number>}',
    "]}",
    "",
    "For each transaction: clean up the raw bank narration into a short human-readable vendor name (e.g. \"POS PURCHASE CHAI TOWN KTM NP\" -> \"Chai Town\"), and pick the single best-fitting category yourself from the list above based on the vendor and remark — don't leave category blank. Use \"type\":\"out\" for money leaving the account and \"in\" for money coming in. If a date has no year, assume the current year. Output valid JSON only, wrapped in a single ```json code block.",
  ].join("\n");

  function openClaudeForStatement(){
    const url = "https://claude.ai/new?q=" + encodeURIComponent(STATEMENT_IMPORT_PROMPT);
    window.open(url, "_blank", "noopener");
  }

  function copyStatementPrompt(){
    const status = document.getElementById("importStatus");
    const done = (ok) => {
      if (!status) return;
      status.textContent = ok ? "Prompt copied — paste it into a Claude chat, then upload your statement photo there." : "Couldn't copy automatically — long-press the button's link or copy manually.";
      status.className = ok ? "kh-import-status ok" : "kh-import-status err";
    };
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(STATEMENT_IMPORT_PROMPT).then(() => done(true)).catch(() => done(false));
    } else {
      done(false);
    }
  }

  let manualType = "out";
  let editingTxId = null;

  function toggleManualAdd(){
    if (currentPage === "loans"){
      openPanel("loanform");
    } else if (currentPage === "room"){
      openPanel("roomexpense");
    } else {
      const wasOpen = openPanelName === "manual";
      openPanel("manual");
      if (!wasOpen && !editingTxId){
        document.getElementById("panelManualTitle").textContent = "Add transaction manually";
        document.getElementById("manualSaveBtn").textContent = "Add transaction";
        setManualType("out");
      }
    }
  }

  function setManualType(type){
    manualType = type;
    document.getElementById("manualTypeOutBtn").className = "kh-manual-type-btn" + (type === "out" ? " active-out" : "");
    document.getElementById("manualTypeInBtn").className = "kh-manual-type-btn" + (type === "in" ? " active-in" : "");
    document.getElementById("manualTypeTransferBtn").className = "kh-manual-type-btn" + (type === "transfer" ? " active-transfer" : "");
    const isTransfer = type === "transfer";
    document.getElementById("manualToAccountField").style.display = isTransfer ? "" : "none";
    document.getElementById("manualCategoryField").style.display = isTransfer ? "none" : "";
    document.getElementById("manualAccountLabel").textContent = isTransfer ? "From account" : "Account";
    document.getElementById("manualVendorField").querySelector("label").textContent = isTransfer ? "Note (optional)" : "Vendor / description";
    document.getElementById("manualVendor").placeholder = isTransfer ? "e.g. Monthly savings" : "e.g. Chai Town";
  }

  function editTx(id){
    const t = TRANSACTIONS.find(x => x.id === id);
    if (!t) return;
    if (t.transferId){
      showToast("Transfers can't be edited — delete it and add a new one instead.");
      return;
    }
    openPanel("manual");
    editingTxId = id;
    setManualType(t.type);
    document.getElementById("manualVendor").value = t.vendor;
    document.getElementById("manualAmount").value = t.amount;
    document.getElementById("manualDate").value = t.date;
    populateManualForm();
    document.getElementById("manualAccount").value = t.account;
    document.getElementById("manualCategory").value = t.category;
    document.getElementById("panelManualTitle").textContent = "Edit transaction";
    document.getElementById("manualSaveBtn").textContent = "Save changes";
  }

  function populateManualForm(){
    const accSel = document.getElementById("manualAccount");
    accSel.innerHTML = ACCOUNT_LIST.map(name => `<option value="${name}"${name === activeAccount ? " selected" : ""}>${name}</option>`).join("");
    if (activeAccount === "All" && ACCOUNT_LIST.length) accSel.value = ACCOUNT_LIST[0];

    const toAccSel = document.getElementById("manualToAccount");
    toAccSel.innerHTML = ACCOUNT_LIST.map(name => `<option value="${name}">${name}</option>`).join("");
    // Default "to" to a different account than "from" so a fresh transfer
    // form doesn't start pointed at the same wallet on both sides.
    toAccSel.value = ACCOUNT_LIST.find(n => n !== accSel.value) || ACCOUNT_LIST[0];

    const catSel = document.getElementById("manualCategory");
    catSel.innerHTML = Object.keys(CAT).map(name => `<option value="${name}">${name}</option>`).join("");

    const dateEl = document.getElementById("manualDate");
    if (!dateEl.value){
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      dateEl.value = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    }
  }

  function addManualTransaction(){
    const status = document.getElementById("manualStatus");
    const isTransfer = manualType === "transfer";
    const vendor = document.getElementById("manualVendor").value.trim();
    const amount = parseAmount(document.getElementById("manualAmount").value);
    const date = document.getElementById("manualDate").value || null;
    const account = document.getElementById("manualAccount").value;
    const category = document.getElementById("manualCategory").value;

    if (!vendor && !isTransfer){
      status.textContent = "Enter a vendor or description.";
      status.className = "kh-manual-status err";
      document.getElementById("manualVendor").focus();
      return;
    }
    if (amount === null || amount <= 0){
      status.textContent = "Enter a valid amount.";
      status.className = "kh-manual-status err";
      document.getElementById("manualAmount").focus();
      return;
    }
    if (!date){
      status.textContent = "Pick a date.";
      status.className = "kh-manual-status err";
      return;
    }
    if (!account){
      status.textContent = "Pick an account.";
      status.className = "kh-manual-status err";
      return;
    }

    if (isTransfer){
      const toAccount = document.getElementById("manualToAccount").value;
      if (!toAccount || toAccount === account){
        status.textContent = "Pick two different accounts to transfer between.";
        status.className = "kh-manual-status err";
        return;
      }
      ensureAccount(account);
      ensureAccount(toAccount);
      ensureCategory("Transfer Out");
      ensureCategory("Transfer In");
      const transferId = "trf" + (nextTxId);
      const note = vendor || `${account} → ${toAccount}`;
      TRANSACTIONS.push({
        date, vendor: note, category: "Transfer Out", type: "out", amount, account,
        id: "tx" + (nextTxId++), transferId,
      });
      TRANSACTIONS.push({
        date, vendor: note, category: "Transfer In", type: "in", amount, account: toAccount,
        id: "tx" + (nextTxId++), transferId,
      });
      saveCurrentUser();
      renderAll();
      renderAccountManager();
      showToast(`Transferred ${rs(amount)} to ${toAccount}`);
      closePanel();
      return;
    }

    ensureAccount(account);
    ensureCategory(category);

    if (editingTxId){
      const t = TRANSACTIONS.find(x => x.id === editingTxId);
      if (t){
        t.date = date; t.vendor = vendor; t.category = category || "Other"; t.type = manualType; t.amount = amount; t.account = account;
      }
      editingTxId = null;
      saveCurrentUser();
      renderAll();
      renderAccountManager();
      renderCategoryManager();
      showToast(`Updated ${vendor}`);
      closePanel();
      return;
    }

    TRANSACTIONS.push({
      date, vendor, category: category || "Other", type: manualType, amount, account,
      id: "tx" + (nextTxId++),
    });
    saveCurrentUser();
    renderAll();
    renderAccountManager();
    renderCategoryManager();

    showToast(`Added ${vendor}`);
    closePanel();
  }

  // ---------------------------------------------------------------------
  // Bottom navigation + glass slide-up panels (Account / Settings / More).
  // ---------------------------------------------------------------------
  let openPanelName = null;
  let currentPage = "home";
  // Import panel has two tabs sharing one status line: "Paste JSON" (the
  // original AI-parsed-photo flow) and "Paste SMS" (regex-parsed bank/
  // wallet notification text, no AI round-trip needed).
  let importMode = "json";
  function setImportMode(mode){
    importMode = mode;
    document.getElementById("importTabJson").classList.toggle("active", mode === "json");
    document.getElementById("importTabSms").classList.toggle("active", mode === "sms");
    document.getElementById("importModeJson").style.display = mode === "json" ? "" : "none";
    document.getElementById("importModeSms").style.display = mode === "sms" ? "" : "none";
    document.getElementById("importStatus").textContent = "";
    document.getElementById("importStatus").className = "kh-import-status";
    setTimeout(() => {
      const el = document.getElementById(mode === "json" ? "importInput" : "importSmsInput");
      if (el) el.focus();
    }, 300);
  }

  const PANEL_IDS = { manual: "panelManual", import: "panelImport", loanform: "panelLoanForm", loanpay: "panelLoanPayment", roommate: "panelRoommate", roomexpense: "panelRoomExpense", rentsetup: "panelRentSetup", recurring: "panelRecurring" };

  function openPanel(name){
    if (openPanelName === name){ closePanel(); return; }
    document.querySelectorAll(".kh-panel").forEach(p => p.classList.remove("show"));
    const el = document.getElementById(PANEL_IDS[name]);
    if (!el) return;
    el.classList.add("show");
    document.getElementById("panelBackdrop").classList.add("show");
    openPanelName = name;
    setActiveNav(["loanform", "loanpay"].includes(name) ? "loans" : (["roommate", "roomexpense"].includes(name) ? "room" : name));
    if (name === "roommate"){
      document.getElementById("roommateInput").value = "";
      setTimeout(() => document.getElementById("roommateInput").focus(), 300);
    }
    if (name === "roomexpense"){
      document.getElementById("roomExpDesc").value = "";
      document.getElementById("roomExpAmount").value = "";
      renderRoomCategorySelect();
      renderRoomPaidBySelect();
      renderRoomSplitChecks();
      setTimeout(() => document.getElementById("roomExpDesc").focus(), 300);
    }
    if (name === "manual"){
      document.getElementById("manualStatus").textContent = "";
      document.getElementById("manualStatus").className = "kh-manual-status";
      editingTxId = null;
      document.getElementById("panelManualTitle").textContent = "Add transaction manually";
      document.getElementById("manualSaveBtn").textContent = "Add transaction";
      setManualType("out");
      populateManualForm();
      setTimeout(() => document.getElementById("manualVendor").focus(), 300);
    }
    if (name === "import"){
      setImportMode("json");
    }
    if (name === "loanform"){
      editingLoanId = null;
      document.getElementById("loanFormStatus").textContent = "";
      document.getElementById("loanFormStatus").className = "kh-manual-status";
      document.getElementById("loanFormTitle").textContent = "New loan";
      document.getElementById("loanSaveBtn").textContent = "Save loan";
      setLoanType("borrowed");
      document.getElementById("loanPerson").value = "";
      document.getElementById("loanPrincipal").value = "";
      document.getElementById("loanDateGiven").value = todayStr();
      document.getElementById("loanDueDate").value = "";
      document.getElementById("loanInterestRate").value = "";
      document.getElementById("loanInterestType").value = "none";
      document.getElementById("loanNotes").value = "";
      const accSel = document.getElementById("loanAccount");
      accSel.innerHTML = ACCOUNT_LIST.map(n => `<option value="${n}">${n}</option>`).join("");
      document.getElementById("loanRecordTx").checked = true;
      document.getElementById("loanRecordTx").disabled = false;
      document.getElementById("loanRecordTxLabel").textContent = "Also record as a transaction, so it shows in your cash flow charts";
      setTimeout(() => document.getElementById("loanPerson").focus(), 300);
    }
  }

  function setSettingsTab(tab){
    ["account", "appearance", "notifications", "backup", "calendar", "wallets", "categories", "layout", "roomlayout", "budgetorder", "data", "support", "about"].forEach(t => {
      document.getElementById("settingsSection" + t.charAt(0).toUpperCase() + t.slice(1)).classList.toggle("active", t === tab);
      document.getElementById("settingsTabBtn" + t.charAt(0).toUpperCase() + t.slice(1)).classList.toggle("active", t === tab);
    });
  }

  // Settings is a two-level menu: the icon-grid list (settingsMenuView) and
  // a full drill-down page per section (settingsDetailView), same idea as
  // native iOS/Android settings apps.
  function showSettingsMenu(){
    document.getElementById("settingsMenuView").classList.add("active");
    document.getElementById("settingsDetailView").classList.remove("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showSettingsDetail(tab){
    setSettingsTab(tab);
    document.getElementById("settingsMenuView").classList.remove("active");
    document.getElementById("settingsDetailView").classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------------------------------------------------------------------
  // Appearance (theme), Notifications, and Nepali Calendar display prefs.
  // These are on-device browser preferences (not per-Google-account data),
  // so they're stored directly in localStorage rather than in the synced
  // per-user snapshot.
  // ---------------------------------------------------------------------
  function setTheme(theme){
    document.documentElement.setAttribute("data-theme", theme);
    try{ localStorage.setItem("kh_theme", theme); }catch(e){}
    applyThemeUI();
  }

  function applyThemeUI(){
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const darkBtn = document.getElementById("themeOptDark");
    const lightBtn = document.getElementById("themeOptLight");
    if (darkBtn) darkBtn.classList.toggle("active", current === "dark");
    if (lightBtn) lightBtn.classList.toggle("active", current === "light");
  }

  function getNotifPref(key){
    try{ return localStorage.getItem("kh_notif_" + key) !== "0"; }catch(e){ return true; }
  }
  function setNotifPref(key, enabled){
    try{ localStorage.setItem("kh_notif_" + key, enabled ? "1" : "0"); }catch(e){}
  }

  function getCalendarBsFirst(){
    try{ return localStorage.getItem("kh_calendar_bs_first") === "1"; }catch(e){ return false; }
  }
  function setCalendarBsFirst(enabled){
    try{ localStorage.setItem("kh_calendar_bs_first", enabled ? "1" : "0"); }catch(e){}
    renderTx();
  }

  function checkAlerts(){
    if (getNotifPref("budget") && BUDGET_OVERALL){
      const overallSpent = spendThisMonth(null);
      if (overallSpent >= BUDGET_OVERALL){
        showToast(`⚠ Over your overall budget by ${rs(overallSpent - BUDGET_OVERALL)}`);
        return;
      }
    }
    if (getNotifPref("loans")){
      const today = todayStr();
      const dueSoon = LOANS.find(l => l.dueDate && loanStatus(l) !== "Cleared" && daysBetween(today, l.dueDate) <= 3);
      if (dueSoon){
        const days = Math.round(daysBetween(today, dueSoon.dueDate));
        const when = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "due today" : `due in ${days}d`;
        showToast(dueSoon.isEmi ? `⏰ EMI to ${dueSoon.person} ${when}` : `⏰ Loan with ${dueSoon.person} ${when}`);
      }
    }
  }

  function populateAppearanceNotifCalendarUI(){
    applyThemeUI();
    const budgetToggle = document.getElementById("notifBudgetToggle");
    const loansToggle = document.getElementById("notifLoansToggle");
    if (budgetToggle) budgetToggle.checked = getNotifPref("budget");
    if (loansToggle) loansToggle.checked = getNotifPref("loans");
    const calToggle = document.getElementById("calendarBsFirstToggle");
    if (calToggle) calToggle.checked = getCalendarBsFirst();
  }

  function closePanel(){
    document.querySelectorAll(".kh-panel").forEach(p => p.classList.remove("show"));
    document.getElementById("panelBackdrop").classList.remove("show");
    openPanelName = null;
    setActiveNav(currentPage);
  }

  function showPage(name){
    document.getElementById("homePage").classList.toggle("active", name === "home");
    document.getElementById("loanPage").classList.toggle("active", name === "loans");
    document.getElementById("budgetPage").classList.toggle("active", name === "budget");
    document.getElementById("roomPage").classList.toggle("active", name === "room");
    document.getElementById("recurringPage").classList.toggle("active", name === "recurring");
    document.getElementById("insightsPage").classList.toggle("active", name === "insights");
    document.getElementById("settingsPage").classList.toggle("active", name === "settings");
    document.getElementById("privacyPage").classList.toggle("active", name === "privacy");
    document.getElementById("securityPage").classList.toggle("active", name === "security");
    document.getElementById("bikramSambatPage").classList.toggle("active", name === "bikramsambat");
    document.getElementById("termsPage").classList.toggle("active", name === "terms");
    currentPage = name;
    // The dashboard's topbar (search/settings/avatar) is fixed and stays
    // visible on every page. Home and Loans are "dashboard-hosted" — they
    // render inside #desktopDashboard as kd-styled cards instead of
    // #appRoot's mobile page stretched wide; every other page still uses
    // #appRoot's own (already desktop-responsive) layout. No-op on
    // mobile, where .kh-desktop is force-hidden by CSS.
    const dashboardHostedPages = { home: "kdHomeContent", loans: "kdLoansContent" };
    Object.entries(dashboardHostedPages).forEach(([pageName, elId]) => {
      const el = document.getElementById(elId);
      if (el && currentUser) el.style.display = (name === pageName) ? "block" : "none";
    });
    document.getElementById("appRoot").classList.toggle("kh-page-open", !(name in dashboardHostedPages));
    const kdNavMap = { home: "kdNavHome", loans: "kdNavLoans", budget: "kdNavBudget", insights: "kdNavInsights", settings: "kdNavSettings" };
    document.querySelectorAll(".kd-nav-btn").forEach(b => b.classList.remove("active"));
    if (kdNavMap[name]){
      const activeBtn = document.getElementById(kdNavMap[name]);
      if (activeBtn) activeBtn.classList.add("active");
    }
    // Any normal navigation (including back to Home, which re-shows the
    // dashboard) drops the "View all" full-mobile-Home override — that
    // view is only ever entered explicitly via showFullHomePage().
    document.getElementById("appRoot").classList.remove("kh-show-full-home");
    const fab = document.getElementById("manualFab");
    if (fab){
      const label = name === "loans" ? "Add loan" : (name === "room" ? "Add shared expense" : "Add transaction manually");
      fab.title = label;
      fab.setAttribute("aria-label", label);
      fab.style.display = (name === "budget" || name === "recurring" || name === "insights" || name === "settings" || name === "privacy" || name === "security" || name === "bikramsambat" || name === "terms") ? "none" : "";
    }
  }

  function goHome(){
    closePanel();
    // A signed-out visitor only ever ends up inside #appRoot via a guest
    // legal page (see showGuestLegalPage()) — "Home" for them means the
    // landing page, not the (empty, no-account) dashboard.
    if (!currentUser){
      document.getElementById("appRoot").style.display = "none";
      document.getElementById("authScreen").style.display = "flex";
      document.getElementById("landingPage").style.display = "block";
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    showPage("home");
    setActiveNav("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showLoanPage(){
    closePanel();
    showPage("loans");
    setActiveNav("loans");
    renderLoans();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showBudgetPage(){
    closePanel();
    showPage("budget");
    setActiveNav("budget");
    renderBudgetPage();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showInsightsPage(){
    closePanel();
    showPage("insights");
    setActiveNav("insights");
    renderInsightsPage();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showSettingsPage(tab){
    closePanel();
    showPage("settings");
    setActiveNav("settings");
    populateAppearanceNotifCalendarUI();
    renderCategoryManager();
    renderAccountManager();
    renderBudgetOrderManager();
    if (tab){
      showSettingsDetail(tab);
    } else {
      showSettingsMenu();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showPrivacyPage(){
    closePanel();
    showPage("privacy");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showSecurityPage(){
    closePanel();
    showPage("security");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showBikramSambatPage(){
    closePanel();
    showPage("bikramsambat");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showTermsPage(){
    closePanel();
    showPage("terms");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setActiveNav(name, instant){
    let activeBtn = null;
    ["home", "loans", "budget", "insights", "settings"].forEach(n => {
      const btn = document.getElementById("nav" + n.charAt(0).toUpperCase() + n.slice(1));
      if (!btn) return;
      const isActive = n === name;
      btn.classList.toggle("active", isActive);
      if (isActive) activeBtn = btn;
    });
    positionNavIndicator(activeBtn, instant);
  }

  function positionNavIndicator(activeBtn, instant){
    const indicator = document.getElementById("navIndicator");
    if (!indicator || !activeBtn) return;
    if (instant){
      indicator.style.transition = "none";
      indicator.style.width = activeBtn.offsetWidth + "px";
      indicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
      requestAnimationFrame(() => { indicator.style.transition = ""; });
    } else {
      indicator.style.width = activeBtn.offsetWidth + "px";
      indicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
    }
  }

  // Keep the pill aligned if the window resizes (button widths can change
  // at different breakpoints) — skip the slide animation while doing so.
  window.addEventListener("resize", () => {
    positionNavIndicator(document.querySelector(".kh-nav-btn.active"), true);
  });

  function deleteTx(id){
    const idx = TRANSACTIONS.findIndex(t => t.id === id);
    if (idx === -1) return;
    const [removed] = TRANSACTIONS.splice(idx, 1);
    // A transfer is two linked legs (money out of one account, into
    // another) — deleting just one would leave the other account's side
    // of the transfer stranded, so both go together.
    if (removed.transferId){
      const otherIdx = TRANSACTIONS.findIndex(t => t.transferId === removed.transferId);
      if (otherIdx !== -1) TRANSACTIONS.splice(otherIdx, 1);
    }
    saveCurrentUser();
    renderAll();
    showToast(removed.transferId ? "Transfer deleted" : "Transaction deleted");
  }

  function clearAllData(){
    if (!confirm("Delete all transactions, balances, and loans? This can't be undone.")) return;
    TRANSACTIONS.length = 0;
    Object.keys(BALANCES).forEach(k => delete BALANCES[k]);
    LOANS.length = 0;
    ROOM_EXPENSES.length = 0;
    ROOM_SETTLEMENTS.length = 0;
    activeAccount = "All";
    activeNepaliMonth = "current"; // reset -> default to current month
    activeRoomNepaliMonth = "current"; // reset -> default to current month
    loanFilter = "all";
    saveCurrentUser();
    renderAll();
    showToast("All data cleared");
  }

  function buildBackupSnapshot(){
    return {
      app: "Kharcha",
      exportedAt: new Date().toISOString(),
      transactions: TRANSACTIONS,
      balances: BALANCES,
      nextTxId,
      loans: LOANS,
      nextLoanId,
      budgets: BUDGETS,
      budgetOverall: BUDGET_OVERALL,
      budgetCategoryOrder: BUDGET_CATEGORY_ORDER,
      profile: PROFILE,
      customAccounts: ACCOUNT_LIST.filter(n => !DEFAULT_ACCOUNTS.includes(n)).map(n => ({ name: n, color: ACCOUNTS[n].color, icon: ACCOUNTS[n].icon })),
      customCategories: Object.keys(CAT).filter(n => !DEFAULT_CATEGORIES.includes(n)).map(n => ({ name: n, color: CAT[n].color, icon: CAT[n].icon })),
      homeLayout: HOME_LAYOUT,
      roomLayout: ROOM_LAYOUT,
      recurring: RECURRING,
      nextRecurringId,
      hiddenAccounts: HIDDEN_ACCOUNTS,
      roommates: ROOMMATES,
      roomExpenses: ROOM_EXPENSES,
      roomSettlements: ROOM_SETTLEMENTS,
      nextRoomExpenseId,
      nextRoomSettlementId,
      roomRent: ROOM_RENT,
    };
  }

  function exportData(){
    const snapshot = buildBackupSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kharcha-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Backup downloaded");
  }

  function csvEscape(val){
    const s = String(val ?? "");
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCSV(){
    if (TRANSACTIONS.length === 0){
      showToast("No transactions to export yet");
      return;
    }
    const rows = [["Date (AD)", "Date (BS)", "Vendor", "Category", "Account", "Type", "Amount (Rs)"]];
    [...TRANSACTIONS].sort((a,b) => a.date < b.date ? -1 : 1).forEach(t => {
      rows.push([t.date, bsLabel(t.date), t.vendor, t.category, t.account, t.type === "in" ? "Money in" : "Money out", t.amount]);
    });
    const csv = rows.map(r => r.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kharcha-transactions-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("CSV downloaded");
  }

  function htmlEscape(s){
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // No PDF library — this just opens a print-formatted statement in a new
  // tab and triggers the browser's own print dialog, where "Save as PDF"
  // is a built-in destination on every platform. Keeps the app dependency
  // -free instead of pulling in a PDF-generation library for one button.
  function exportPDF(){
    if (TRANSACTIONS.length === 0){
      showToast("No transactions to export yet");
      return;
    }
    const sorted = [...TRANSACTIONS].sort((a, b) => a.date < b.date ? -1 : 1);
    const totalIn = sorted.filter(t => t.type === "in").reduce((s, t) => s + t.amount, 0);
    const totalOut = sorted.filter(t => t.type === "out").reduce((s, t) => s + t.amount, 0);
    const rowsHtml = sorted.map(t => `
      <tr>
        <td>${t.date}</td>
        <td>${bsLabel(t.date)}</td>
        <td>${htmlEscape(t.vendor)}</td>
        <td>${htmlEscape(t.category)}</td>
        <td>${htmlEscape(t.account)}</td>
        <td style="text-align:right; color:${t.type === "in" ? "#16a34a" : "#dc2626"}">${t.type === "in" ? "+" : "−"}Rs ${t.amount.toLocaleString("en-IN")}</td>
      </tr>`).join("");
    const win = window.open("", "_blank");
    if (!win){
      showToast("Your browser blocked the pop-up — allow pop-ups for this site and try again");
      return;
    }
    win.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>Kharchā statement ${new Date().toISOString().slice(0,10)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif; color:#1a1a1a; padding:28px; max-width:820px; margin:0 auto;}
  h1{font-size:20px; margin:0 0 2px;}
  .sub{color:#666; font-size:12px; margin:0 0 20px;}
  table{width:100%; border-collapse:collapse; font-size:11px;}
  th,td{padding:6px 8px; border-bottom:1px solid #ddd; text-align:left;}
  th{background:#f3f3f3;}
  .totals{margin-top:16px; font-size:13px; display:flex; gap:24px;}
  .totals b{display:block; font-size:15px;}
  .noprint{margin-top:26px; color:#888; font-size:11px;}
  @media print{ .noprint{display:none;} }
</style></head>
<body>
  <h1>Kharchā — Transaction Statement</h1>
  <p class="sub">Generated ${new Date().toLocaleDateString()} &middot; ${sorted.length} transaction${sorted.length === 1 ? "" : "s"} &middot; ${sorted[0].date} to ${sorted[sorted.length - 1].date}</p>
  <table>
    <thead><tr><th>Date (AD)</th><th>Date (BS)</th><th>Vendor</th><th>Category</th><th>Account</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="totals">
    <div>Money in<b style="color:#16a34a">Rs ${totalIn.toLocaleString("en-IN")}</b></div>
    <div>Money out<b style="color:#dc2626">Rs ${totalOut.toLocaleString("en-IN")}</b></div>
    <div>Net<b>Rs ${(totalIn - totalOut).toLocaleString("en-IN")}</b></div>
  </div>
  <p class="noprint">This tab opened your browser's print dialog automatically — choose "Save as PDF" as the destination. If it didn't open, press Ctrl/Cmd+P.</p>
  <script>window.onload = () => setTimeout(() => window.print(), 200);<\/script>
</body></html>`);
    win.document.close();
  }

  // Shared by "restore from .json file" and "restore from Google Drive" —
  // both just need to hand this a parsed snapshot object.
  function applyBackupSnapshot(data){
    resetAccountsAndCategoriesToDefault();
    (data.customAccounts || []).forEach(a => { ensureAccount(a.name); ACCOUNTS[a.name] = { color: a.color, icon: a.icon }; });
    (data.customCategories || []).forEach(c => { CAT[c.name] = { color: c.color, icon: c.icon }; });
    HOME_LAYOUT = normalizeHomeLayout(data.homeLayout);
    ROOM_LAYOUT = normalizeRoomLayout(data.roomLayout);
    RECURRING = data.recurring || [];
    nextRecurringId = data.nextRecurringId || (RECURRING.length + 1);
    HIDDEN_ACCOUNTS = data.hiddenAccounts || [];
    TRANSACTIONS = data.transactions || [];
    BALANCES = data.balances || {};
    nextTxId = data.nextTxId || (TRANSACTIONS.length + 1);
    LOANS = data.loans || [];
    nextLoanId = data.nextLoanId || (LOANS.length + 1);
    BUDGETS = data.budgets || {};
    BUDGET_OVERALL = data.budgetOverall != null ? data.budgetOverall : null;
    BUDGET_CATEGORY_ORDER = Array.isArray(data.budgetCategoryOrder) ? data.budgetCategoryOrder : null;
    ROOMMATES = data.roommates && data.roommates.length ? data.roommates : ["Me"];
    ROOM_EXPENSES = data.roomExpenses || [];
    ROOM_SETTLEMENTS = data.roomSettlements || [];
    nextRoomExpenseId = data.nextRoomExpenseId || (ROOM_EXPENSES.length + 1);
    nextRoomSettlementId = data.nextRoomSettlementId || (ROOM_SETTLEMENTS.length + 1);
    ROOM_RENT = data.roomRent || { rentAmount: 0, utilitiesAmount: 0, dueDay: 1, landlordName: "", landlordPhone: "" };
    PROFILE = data.profile || PROFILE;
    TRANSACTIONS.forEach(t => { if (t.account) ensureAccount(t.account); });
    activeAccount = "All";
    activeNepaliMonth = "current"; // reset -> default to current month
    activeRoomNepaliMonth = "current"; // reset -> default to current month
    loanFilter = "all";
    saveCurrentUser();
    renderAll();
    renderAccountManager();
    renderCategoryManager();
    renderBudgetPage();
    populateProfileForm();
  }

  function restoreDataFile(input){
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      let data;
      try { data = JSON.parse(e.target.result); }
      catch(err){ showToast("That file isn't a valid backup"); input.value = ""; return; }
      if (!data || !Array.isArray(data.transactions)){
        showToast("That file isn't a valid Kharchā backup");
        input.value = "";
        return;
      }
      if (!confirm("Restore this backup? This replaces everything currently in your tracker.")){
        input.value = "";
        return;
      }
      applyBackupSnapshot(data);
      input.value = "";
      showToast("Backup restored");
    };
    reader.readAsText(file);
  }

  // ---------------------------------------------------------------------
  // Google Drive backup — stores the exact same snapshot as the manual
  // .json backup above, but inside the signed-in user's own Google Drive,
  // in the special "appDataFolder" that only THIS app can see: it never
  // shows up in their normal My Drive, and nobody else (not even us — we
  // have no server) can read it. It's just a private JSON file that
  // travels with their Gmail account, so signing in on a new phone and
  // hitting "Restore latest" brings everything back.
  //
  // This needs a SEPARATE consent from the sign-in above: signing in only
  // proves who the person is (an ID token). Touching their Drive needs an
  // access token with the drive.appdata scope, granted via the OAuth2
  // "token client" from the same Google Identity Services script — the
  // person approves a one-time consent popup the first time they turn
  // this on.
  //
  // Setup checklist (same Google Cloud project as GOOGLE_CLIENT_ID below):
  //   1. Enable the "Google Drive API" for the project.
  //   2. On the OAuth consent screen, add the scope
  //        https://www.googleapis.com/auth/drive.appdata
  //      (a "sensitive" scope — fine while testing with your own account,
  //      but Google requires app verification before ~100+ real users can
  //      use it).
  //   3. No new client ID needed — GOOGLE_CLIENT_ID is reused as-is.
  // ---------------------------------------------------------------------
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
  const DRIVE_FILE_NAME = "kharcha-data.json";
  let driveTokenClient = null;
  let driveAccessToken = null;
  let driveTokenExpiresAt = 0; // ms epoch
  let driveAutoSyncTimer = null;

  function driveSyncEnabled(email){
    try{ return localStorage.getItem("kh_drive_enabled_" + email) === "1"; }catch(e){ return false; }
  }
  function setDriveSyncEnabled(email, on){
    try{ localStorage.setItem("kh_drive_enabled_" + email, on ? "1" : "0"); }catch(e){}
  }
  function driveFileIdFor(email){
    try{ return localStorage.getItem("kh_drive_fileid_" + email); }catch(e){ return null; }
  }
  function setDriveFileIdFor(email, id){
    try{ if (id) localStorage.setItem("kh_drive_fileid_" + email, id); }catch(e){}
  }
  function driveLastSyncFor(email){
    try{ return localStorage.getItem("kh_drive_lastsync_" + email); }catch(e){ return null; }
  }
  function setDriveLastSyncFor(email, iso){
    try{ localStorage.setItem("kh_drive_lastsync_" + email, iso); }catch(e){}
  }

  // Gets a live Drive access token, requesting/refreshing it via the
  // Google Identity Services popup when needed, then calls onReady(true|false).
  function ensureDriveToken(onReady, opts){
    opts = opts || {};
    const placeholderId = GOOGLE_CLIENT_ID.startsWith("YOUR_");
    if (placeholderId || !window.google || !google.accounts || !google.accounts.oauth2){
      if (!opts.silent) showToast("Google Drive isn't set up yet (see the GOOGLE_CLIENT_ID / Drive API setup notes in the code)");
      onReady(false);
      return;
    }
    if (driveAccessToken && Date.now() < driveTokenExpiresAt - 30000){
      onReady(true);
      return;
    }
    if (!driveTokenClient){
      driveTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPE,
        hint: currentUser ? currentUser.email : undefined,
        callback: (resp) => {
          if (resp && resp.access_token){
            driveAccessToken = resp.access_token;
            driveTokenExpiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
            onReady(true);
          } else {
            onReady(false);
          }
        },
        error_callback: () => onReady(false),
      });
    }
    // Silent (prompt:"") reuses a still-valid grant without popping a
    // dialog — used for the background auto-sync. A first-time enable, or
    // any explicit button tap, shows the normal consent prompt.
    driveTokenClient.requestAccessToken({ prompt: opts.silent ? "" : "consent" });
  }

  function driveApiFetch(url, options){
    options = options || {};
    const headers = Object.assign({ Authorization: "Bearer " + driveAccessToken }, options.headers || {});
    return fetch(url, Object.assign({}, options, { headers }));
  }

  function driveFindFile(cb){
    driveApiFetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D'${DRIVE_FILE_NAME}'&fields=files(id,modifiedTime)`)
      .then(r => r.json())
      .then(json => cb((json.files && json.files[0]) || null))
      .catch(() => cb(null));
  }

  function driveUploadSnapshot(fileId, snapshot, cb){
    const metadata = fileId ? { name: DRIVE_FILE_NAME } : { name: DRIVE_FILE_NAME, parents: ["appDataFolder"] };
    const boundary = "kharcha_" + Math.random().toString(36).slice(2);
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(snapshot)}\r\n` +
      `--${boundary}--`;
    const url = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
    driveApiFetch(url, {
      method: fileId ? "PATCH" : "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }).then(r => r.json()).then(json => cb(json && json.id ? json.id : null)).catch(() => cb(null));
  }

  function driveDownloadSnapshot(fileId, cb){
    driveApiFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`)
      .then(r => r.json())
      .then(json => cb(json))
      .catch(() => cb(null));
  }

  // silent=true suppresses toasts/popups — used for the automatic
  // background sync so routine saves don't interrupt the person.
  function driveBackupNow(silent){
    if (!currentUser) return;
    ensureDriveToken((ok) => {
      if (!ok){ if (!silent) showToast("Couldn't connect to Google Drive"); return; }
      const email = currentUser.email;
      driveFindFile((file) => {
        const fileId = (file && file.id) || driveFileIdFor(email);
        driveUploadSnapshot(fileId, buildBackupSnapshot(), (newId) => {
          const savedId = newId || fileId;
          if (savedId){
            setDriveFileIdFor(email, savedId);
            setDriveLastSyncFor(email, new Date().toISOString());
            renderDriveSyncStatus();
            if (!silent) showToast("Backed up to Google Drive");
          } else if (!silent){
            showToast("Backup to Drive failed — try again");
          }
        });
      });
    }, { silent });
  }

  function driveRestoreNow(){
    if (!currentUser) return;
    ensureDriveToken((ok) => {
      if (!ok){ showToast("Couldn't connect to Google Drive"); return; }
      driveFindFile((file) => {
        if (!file){ showToast("No Drive backup found yet — back up first"); return; }
        driveDownloadSnapshot(file.id, (data) => {
          if (!data || !Array.isArray(data.transactions)){
            showToast("The Drive backup looks corrupted");
            return;
          }
          if (!confirm("Restore your latest Google Drive backup? This replaces everything currently in your tracker.")) return;
          applyBackupSnapshot(data);
          setDriveFileIdFor(currentUser.email, file.id);
          setDriveLastSyncFor(currentUser.email, new Date().toISOString());
          renderDriveSyncStatus();
          showToast("Restored from Google Drive");
        });
      });
    });
  }

  function toggleDriveSync(enabled){
    if (!currentUser) return;
    if (enabled){
      ensureDriveToken((ok) => {
        if (!ok){
          const t = document.getElementById("driveSyncToggle");
          if (t) t.checked = false;
          showToast("Couldn't enable — Google Drive permission wasn't granted");
          return;
        }
        setDriveSyncEnabled(currentUser.email, true);
        renderDriveSyncStatus();
        driveBackupNow(true);
      });
    } else {
      setDriveSyncEnabled(currentUser.email, false);
      renderDriveSyncStatus();
    }
  }

  function renderDriveSyncStatus(){
    if (!currentUser) return;
    const on = driveSyncEnabled(currentUser.email);
    const toggle = document.getElementById("driveSyncToggle");
    if (toggle) toggle.checked = on;
    const btns = document.getElementById("driveSyncButtons");
    if (btns) btns.style.display = on ? "flex" : "none";
    const statusEl = document.getElementById("driveSyncStatus");
    if (statusEl){
      if (!on){ statusEl.textContent = "Off — your data stays only on this device unless you back up manually."; }
      else {
        const last = driveLastSyncFor(currentUser.email);
        statusEl.textContent = last ? `Last synced ${new Date(last).toLocaleString()}` : "On — syncing shortly…";
      }
    }
  }

  // Debounced so a burst of local saves (e.g. importing many statement
  // rows) triggers one Drive upload a few seconds later, not one per row.
  function scheduleDriveAutoSync(){
    if (!currentUser || !driveSyncEnabled(currentUser.email)) return;
    clearTimeout(driveAutoSyncTimer);
    driveAutoSyncTimer = setTimeout(() => driveBackupNow(true), 4000);
  }

  const PALETTE = ["#B45309","#0F766E","#B91C1C","#1D4ED8","#7E22CE","#C2410C","#0E7490","#15803D","#BE185D","#4D7C0F"];
  let paletteIdx = 0;
  function nextColor(){ return PALETTE[(paletteIdx++) % PALETTE.length]; }

  function accountIcon(name){
    const n = String(name).toLowerCase();
    if (/esewa|khalti|wallet|pay/.test(n)) return "👛";
    if (/bank|finance/.test(n)) return "🏦";
    if (/cash/.test(n)) return "💵";
    if (/card|credit|debit/.test(n)) return "💳";
    return "👛";
  }

  function ensureAccount(name){
    if (!ACCOUNTS[name]) {
      ACCOUNTS[name] = { color: nextColor(), icon: accountIcon(name) };
    }
    if (!ACCOUNT_LIST.includes(name)) {
      ACCOUNT_LIST.push(name);
    }
  }
  function categoryIcon(name){
    const n = String(name).toLowerCase();
    if (/food|drink|dining|restaurant|cafe|chai|momo|snack/.test(n)) return "🍽️";
    if (/grocer|vegetable|tarkari|household/.test(n)) return "🧺";
    if (/mobile|internet|phone|telecom|ntc|ncell|data|wifi/.test(n)) return "📱";
    if (/transport|fuel|petrol|taxi|bus|ride/.test(n)) return "⛽";
    if (/shopping|purchase|clothes|fashion/.test(n)) return "🛍️";
    if (/bill|payment|electric|water|rent/.test(n)) return "🧾";
    if (/education|school|college|course|book/.test(n)) return "📚";
    if (/health|medicine|medical|hospital|pharmacy/.test(n)) return "💊";
    if (/entertainment|movie|cinema|game/.test(n)) return "🎬";
    if (/salary|income|earning/.test(n)) return "💰";
    if (/transfer/.test(n)) return name.toLowerCase().includes("in") ? "↙️" : "↗️";
    if (/loan|karja|udhaaro|udharo/.test(n)) return "🤝";
    return "🏷️";
  }

  function ensureCategory(name){
    if (!CAT[name]) {
      CAT[name] = { color: nextColor(), icon: categoryIcon(name) };
    }
  }

  // ---------------------------------------------------------------------
  // Per-account (Google sign-in) data isolation.
  // Everything the tracker holds — transactions, balances, and any custom
  // accounts/categories — is saved under a storage key scoped to the
  // signed-in user's email, so different Google accounts on this browser
  // never see each other's data.
  //
  // Note: this keeps each person's data private on THIS browser/device.
  // For data that syncs across devices for the same person, the app would
  // need a real backend (e.g. Firebase, or your own server) to store this
  // per-user data server-side instead of in localStorage — this file alone
  // can't do that.
  // ---------------------------------------------------------------------
  const dataKeyFor = (email) => `kharcha_userdata_${email}`;

  function resetAccountsAndCategoriesToDefault(){
    Object.keys(ACCOUNTS).forEach(k => { if (!KNOWN_ACCOUNT_TEMPLATES.includes(k)) delete ACCOUNTS[k]; });
    ACCOUNT_LIST = [...DEFAULT_ACCOUNTS];
    HIDDEN_ACCOUNTS = [];
    Object.keys(CAT).forEach(k => { if (!DEFAULT_CATEGORIES.includes(k)) delete CAT[k]; });
    HOME_LAYOUT = [...DEFAULT_HOME_LAYOUT];
    ROOM_LAYOUT = [...DEFAULT_ROOM_LAYOUT];
    ROOMMATES = ["Me"];
    ROOMMATE_EMAILS = {};
    ROOM_EXPENSES = [];
    ROOM_SETTLEMENTS = [];
    ROOM_RENT = { rentAmount: 0, utilitiesAmount: 0, dueDay: 1, landlordName: "", landlordPhone: "" };
    RECURRING = [];
    stopRoomRealtimeSync();
    currentRoomId = null;
  }

  function saveCurrentUser(){
    if (!currentUser) return;
    const snapshot = {
      transactions: TRANSACTIONS,
      balances: BALANCES,
      nextTxId,
      loans: LOANS,
      nextLoanId,
      budgets: BUDGETS,
      budgetOverall: BUDGET_OVERALL,
      budgetCategoryOrder: BUDGET_CATEGORY_ORDER,
      profile: PROFILE,
      customAccounts: ACCOUNT_LIST.filter(n => !DEFAULT_ACCOUNTS.includes(n)).map(n => ({ name: n, color: ACCOUNTS[n].color, icon: ACCOUNTS[n].icon })),
      customCategories: Object.keys(CAT).filter(n => !DEFAULT_CATEGORIES.includes(n)).map(n => ({ name: n, color: CAT[n].color, icon: CAT[n].icon })),
      homeLayout: HOME_LAYOUT,
      roomLayout: ROOM_LAYOUT,
      recurring: RECURRING,
      nextRecurringId,
      hiddenAccounts: HIDDEN_ACCOUNTS,
      roommates: ROOMMATES,
      roomExpenses: ROOM_EXPENSES,
      roomSettlements: ROOM_SETTLEMENTS,
      nextRoomExpenseId,
      nextRoomSettlementId,
      roomRent: ROOM_RENT,
      roomId: currentRoomId,
      onboardingDismissed: ONBOARDING_DISMISSED,
    };
    try{ localStorage.setItem(dataKeyFor(currentUser.email), JSON.stringify(snapshot)); }catch(e){}
    scheduleDriveAutoSync();

    // Fire-and-forget, same "best effort" contract as the localStorage
    // write above — callers never awaited this before and still don't
    // have to; a failed cloud save just means this device's copy (saved
    // above) is what's current until the next successful save.
    const sb = getSb();
    if (sb && supabaseUserId){
      const savedAt = new Date().toISOString();
      // Remember this device made the change at this instant, so the
      // real-time listener below can tell "this is just an echo of my
      // own save" apart from "another device changed something" and
      // skip re-applying (and re-rendering / toasting about) its own edit.
      lastSelfSaveAt = savedAt;
      sb.from("user_data")
        .upsert({ id: supabaseUserId, email: currentUser.email, data: snapshot, updated_at: savedAt })
        .then(({ error }) => { if (error) console.warn("Kharcha: Supabase save failed —", error.message); });
    }
    // Any room-related field (roommates, shared expenses, settlements,
    // rent) also needs to land in the shared `rooms` row once we're in a
    // real shared room — every existing call site that already calls
    // saveCurrentUser() after touching those fields gets this for free.
    if (currentRoomId) saveRoomData();
  }

  // Applies a loaded (or live-synced) snapshot object to in-memory app
  // state. Shared by the initial loadUserData() below and by the
  // real-time subscription further down, so a change to one field's
  // restore logic can't drift out of sync with the other.
  function applyUserDataSnapshot(data, email){
    resetAccountsAndCategoriesToDefault();
    if (data){
      (data.customAccounts || []).forEach(a => { ensureAccount(a.name); ACCOUNTS[a.name] = { color: a.color, icon: a.icon }; });
      (data.customCategories || []).forEach(c => { CAT[c.name] = { color: c.color, icon: c.icon }; });
      HOME_LAYOUT = normalizeHomeLayout(data.homeLayout);
      ROOM_LAYOUT = normalizeRoomLayout(data.roomLayout);
      RECURRING = data.recurring || [];
      nextRecurringId = data.nextRecurringId || (RECURRING.length + 1);
      HIDDEN_ACCOUNTS = data.hiddenAccounts || [];
      TRANSACTIONS = data.transactions || [];
      BALANCES = data.balances || {};
      nextTxId = data.nextTxId || 1;
      LOANS = data.loans || [];
      nextLoanId = data.nextLoanId || 1;
      BUDGETS = data.budgets || {};
      BUDGET_OVERALL = data.budgetOverall != null ? data.budgetOverall : null;
      BUDGET_CATEGORY_ORDER = Array.isArray(data.budgetCategoryOrder) ? data.budgetCategoryOrder : null;
      ROOMMATES = data.roommates && data.roommates.length ? data.roommates : ["Me"];
      ROOM_EXPENSES = data.roomExpenses || [];
      ROOM_SETTLEMENTS = data.roomSettlements || [];
      nextRoomExpenseId = data.nextRoomExpenseId || (ROOM_EXPENSES.length + 1);
      nextRoomSettlementId = data.nextRoomSettlementId || (ROOM_SETTLEMENTS.length + 1);
      ROOM_RENT = data.roomRent || { rentAmount: 0, utilitiesAmount: 0, dueDay: 1, landlordName: "", landlordPhone: "" };
      // The fields above are just the local fallback — if this account
      // belongs to a real shared room, loadUserData() overwrites them
      // right after this with the shared copy from the `rooms` table.
      currentRoomId = data.roomId || null;
      ONBOARDING_DISMISSED = !!data.onboardingDismissed;
      PROFILE = data.profile || { name: currentUser ? currentUser.name : "", age: "", email, currency: "NPR", monthlyIncome: "" };
      // Make sure every account any saved transaction refers to is present
      // in the wallet list — covers older saved data from before wallets
      // were user-managed.
      TRANSACTIONS.forEach(t => { if (t.account) ensureAccount(t.account); });
    } else {
      TRANSACTIONS = [];
      BALANCES = {};
      nextTxId = 1;
      LOANS = [];
      nextLoanId = 1;
      BUDGETS = {};
      BUDGET_OVERALL = null;
      BUDGET_CATEGORY_ORDER = null;
      ONBOARDING_DISMISSED = false;
      PROFILE = { name: currentUser ? currentUser.name : "", age: "", email, currency: "NPR", monthlyIncome: "" };
    }
    populateProfileForm();
  }

  async function loadUserData(email){
    let data = null;

    const sb = getSb();
    if (sb && supabaseUserId){
      try{
        const { data: row, error } = await sb.from("user_data").select("data").eq("id", supabaseUserId).maybeSingle();
        if (error) throw error;
        if (row) data = row.data;
      }catch(e){
        console.warn("Kharcha: couldn't load from Supabase — falling back to this device's saved copy.", e);
      }
    }
    if (!data){
      try{ data = JSON.parse(localStorage.getItem(dataKeyFor(email))); }catch(e){}
    }

    activeAccount = "All";
    activeNepaliMonth = "current"; // reset -> default to current month
    activeRoomNepaliMonth = "current"; // reset -> default to current month
    loanFilter = "all";

    applyUserDataSnapshot(data, email);
    if (currentRoomId) await loadRoomData(currentRoomId);

    document.getElementById("demoNote").innerHTML = data
      ? "Welcome back — this is your private tracker. Use \"＋ Import\" to add more statement rows."
      : 'New account — nothing here yet. Use "＋ Import" to paste in statement rows, or <button class="kh-np-filter-clear" style="display:inline" onclick="loadDemoData()">load a demo dataset</button> to see how it looks.';
  }

  function populateProfileForm(){
    document.getElementById("profileName").value = PROFILE.name || "";
    document.getElementById("profileAge").value = PROFILE.age || "";
    document.getElementById("profileEmail").value = PROFILE.email || "";
    document.getElementById("profileCurrency").value = PROFILE.currency || "NPR";
    document.getElementById("profileIncome").value = PROFILE.monthlyIncome || "";
    document.getElementById("profileSavedNote").textContent = "";
  }

  function saveProfile(){
    PROFILE = {
      name: document.getElementById("profileName").value.trim(),
      age: document.getElementById("profileAge").value.trim(),
      email: document.getElementById("profileEmail").value.trim(),
      currency: document.getElementById("profileCurrency").value,
      monthlyIncome: document.getElementById("profileIncome").value.trim(),
    };
    saveCurrentUser();
    renderAll(); // currency symbol may have changed — refresh every amount on screen
    const note = document.getElementById("profileSavedNote");
    note.textContent = "Saved.";
    setTimeout(() => { if (note.textContent === "Saved.") note.textContent = ""; }, 2500);
  }

  function loadDemoData(){
    TRANSACTIONS = JSON.parse(JSON.stringify(DEMO_SEED_TRANSACTIONS));
    nextTxId = 1;
    TRANSACTIONS.forEach(t => { t.id = "tx" + (nextTxId++); });
    BALANCES = { ...DEMO_SEED_BALANCES };
    document.getElementById("demoNote").textContent = "Demo data loaded — this is only visible to you, delete it any time with the 🗑 button.";
    saveCurrentUser();
    renderAll();
  }

  // A separate, distinct sample dataset for Guest Mode — deliberately not
  // the same DEMO_SEED_TRANSACTIONS used by "load a demo dataset" in
  // Settings, so a guest sees their own fictional-but-realistic month
  // rather than the developer's own test data. Covers every dashboard
  // card (wallets, loans incl. one EMI, a budget, recurring bills, and a
  // shared room) so Guest Mode actually shows off the whole app.
  const GUEST_SEED_TRANSACTIONS = [
    { date:"2026-08-01", vendor:"Tech Solutions Pvt Ltd — Salary", category:"Transfer In", type:"in", amount:45000, account:"Global IME Bank" },
    { date:"2026-08-02", vendor:"Room Rent to Landlord", category:"Rent", type:"out", amount:12000, account:"Global IME Bank" },
    { date:"2026-08-02", vendor:"WorldLink Internet", category:"Bills & Payments", type:"out", amount:1700, account:"eSewa" },
    { date:"2026-08-03", vendor:"Bhatbhateni Supermarket", category:"Groceries", type:"out", amount:2350, account:"Global IME Bank" },
    { date:"2026-08-04", vendor:"Himalayan Java Coffee", category:"Food & Drink", type:"out", amount:420, account:"eSewa" },
    { date:"2026-08-05", vendor:"Sajha Yatayat Bus Pass", category:"Transport", type:"out", amount:600, account:"eSewa" },
    { date:"2026-08-06", vendor:"NTC Mobile Recharge", category:"Bills & Payments", type:"out", amount:500, account:"eSewa" },
    { date:"2026-08-07", vendor:"Daraz Order — Shoes", category:"Shopping", type:"out", amount:2800, account:"Global IME Bank" },
    { date:"2026-08-09", vendor:"Freelance Payment — Upwork", category:"Transfer In", type:"in", amount:8000, account:"Global IME Bank" },
    { date:"2026-08-10", vendor:"Wai Wai Corner", category:"Food & Drink", type:"out", amount:180, account:"eSewa" },
    { date:"2026-08-12", vendor:"Foodmandu Delivery", category:"Food & Drink", type:"out", amount:850, account:"eSewa" },
    { date:"2026-08-14", vendor:"Local Tarkari Pasal", category:"Groceries", type:"out", amount:960, account:"Global IME Bank" },
    { date:"2026-08-16", vendor:"Gym Membership", category:"Bills & Payments", type:"out", amount:2000, account:"Global IME Bank" },
    { date:"2026-08-18", vendor:"eSewa Top-up", category:"Wallet Top-up", type:"out", amount:1000, account:"Global IME Bank" },
    { date:"2026-08-20", vendor:"Petrol — Sajha Fuel Depot", category:"Transport", type:"out", amount:1500, account:"eSewa" },
    { date:"2026-08-22", vendor:"Movie Night — QFX Cinemas", category:"Food & Drink", type:"out", amount:750, account:"eSewa" },
    { date:"2026-08-25", vendor:"Bhatbhateni Supermarket", category:"Groceries", type:"out", amount:1780, account:"Global IME Bank" },
    { date:"2026-08-27", vendor:"Sister — Dashain Gift", category:"Transfer Out", type:"out", amount:3000, account:"Global IME Bank" },
  ];
  const GUEST_SEED_BALANCES = { "eSewa": 2450, "Global IME Bank": 28500 };

  async function startGuestMode(){
    isGuestMode = true;
    const guestUser = { name: "Guest", email: GUEST_EMAIL, picture: "" };
    await signIn(guestUser, { persistSession: false });
    // Only seed on the very first visit to Guest Mode on this device —
    // if they've been here before (and maybe edited things), loadUserData()
    // inside signIn() already restored that instead.
    if (!TRANSACTIONS.length && ACCOUNT_LIST.length <= 1 && !LOANS.length){
      TRANSACTIONS = JSON.parse(JSON.stringify(GUEST_SEED_TRANSACTIONS));
      nextTxId = 1;
      TRANSACTIONS.forEach(t => { t.id = "tx" + (nextTxId++); });
      BALANCES = { ...GUEST_SEED_BALANCES };
      ensureAccount("Global IME Bank");
      LOANS = [
        { id: "loan1", person: "Roommate Sabin", type: "lent", principal: 3000, dateGiven: "2026-08-05", payments: [], isEmi: false },
        { id: "loan2", person: "Bank EMI — Laptop", type: "borrowed", principal: 80000, dateGiven: "2026-04-01", payments: [], isEmi: true, emiAmount: 7500, emiTenure: 12, interestRate: 14, interestType: "flat", dueDate: "2026-09-05" },
      ];
      nextLoanId = 3;
      BUDGET_OVERALL = 35000;
      RECURRING = [
        { id: "rec1", name: "WorldLink Internet", category: "Bills & Payments", amount: 1700, dueDay: 2, account: "eSewa" },
        { id: "rec2", name: "Gym Membership", category: "Bills & Payments", amount: 2000, dueDay: 16, account: "Global IME Bank" },
      ];
      nextRecurringId = 3;
      ROOMMATES = ["Me", "Sabin", "Prakriti"];
      ROOM_EXPENSES = [
        { id: "rx1", date: "2026-08-02", desc: "Shared groceries", category: "Groceries", amount: 1800, paidBy: "Me", splitAmong: ["Me", "Sabin", "Prakriti"] },
        { id: "rx2", date: "2026-08-15", desc: "WiFi router replacement", category: "Bills & Payments", amount: 3600, paidBy: "Sabin", splitAmong: ["Me", "Sabin", "Prakriti"] },
      ];
      nextRoomExpenseId = 3;
      saveCurrentUser();
      renderAll();
    }
    document.getElementById("demoNote").innerHTML = "🎭 You're in Guest Mode — this sample data lives only in this browser. Sign in with Google any time to keep your own data permanently.";
    showToast("Guest Mode — your changes stay on this device only");
  }

  function addCategory(){
    const input = document.getElementById("categoryInput");
    const name = input.value.trim();
    if (!name) return;
    if (CAT[name]){
      showToast("Category already exists");
      input.focus();
      return;
    }
    ensureCategory(name);
    saveCurrentUser();
    input.value = "";
    renderCategoryManager();
    showToast(`Added ${name}`);
  }

  // Renaming is allowed even for default categories (Food & Drink, Groceries,
  // etc.) — being "default" only protects a category from deletion, not from
  // being renamed to whatever the person actually calls it. "Other" is the
  // one exception: it's used throughout the app as the fallback category
  // (e.g. when another category is removed, or when nothing else matches),
  // so renaming it away would leave that fallback logic pointing at a
  // category that no longer exists.
  function renameCategory(oldName){
    if (oldName === "Other"){
      showToast('"Other" can\'t be renamed — it\'s used as the fallback category.');
      return;
    }
    const input = prompt(`Rename "${oldName}" to:`, oldName);
    if (input === null) return;
    const newName = input.trim();
    if (!newName || newName === oldName) return;
    if (CAT[newName]){
      showToast(`"${newName}" already exists`);
      return;
    }

    CAT[newName] = CAT[oldName];
    delete CAT[oldName];
    TRANSACTIONS.forEach(t => { if (t.category === oldName) t.category = newName; });
    if (BUDGETS[oldName] !== undefined){
      BUDGETS[newName] = BUDGETS[oldName];
      delete BUDGETS[oldName];
    }
    const idx = DEFAULT_CATEGORIES.indexOf(oldName);
    if (idx !== -1) DEFAULT_CATEGORIES[idx] = newName;

    saveCurrentUser();
    renderAll();
    renderCategoryManager();
    showToast(`Renamed to ${newName}`);
  }

  function removeCategory(name){
    if (DEFAULT_CATEGORIES.includes(name)){
      showToast("Default categories can't be removed");
      return;
    }
    const used = TRANSACTIONS.some(t => t.category === name);
    if (used){
      if (!confirm(`"${name}" is used by existing transactions. Remove it and move those transactions to Other?`)) return;
      TRANSACTIONS.forEach(t => { if (t.category === name) t.category = "Other"; });
    }
    delete CAT[name];
    saveCurrentUser();
    renderAll();
    showToast(`Removed ${name}`);
  }

  function renderCategoryManager(){
    const el = document.getElementById("categoryList");
    if (!el) return;
    el.innerHTML = Object.keys(CAT).map(name => {
      const isDefault = DEFAULT_CATEGORIES.includes(name);
      const canRename = name !== "Other";
      return `<span class="kh-cat-tag-vibrant" style="background:${CAT[name].color}">
        <span>${CAT[name].icon}</span>
        ${name}
        ${canRename ? `<button class="kh-cat-edit-v" onclick="renameCategory(${attrJson(name)})" title="Rename">✎</button>` : ""}
        ${isDefault ? "" : `<button class="kh-cat-remove-v" onclick="removeCategory(${attrJson(name)})" title="Remove">✕</button>`}
      </span>`;
    }).join("");
  }

  function addAccountManual(){
    const input = document.getElementById("accountInput");
    const name = input.value.trim();
    if (!name) return;
    if (ACCOUNT_LIST.includes(name)){
      showToast("That account is already in your list");
      input.focus();
      return;
    }
    if (ACCOUNT_LIST.length >= MAX_ACCOUNTS){
      showToast(`You can have up to ${MAX_ACCOUNTS} accounts`);
      return;
    }
    ensureAccount(name);
    saveCurrentUser();
    input.value = "";
    renderAccountManager();
    renderAll();
    showToast(`Added ${name}`);
  }

  function removeAccountManual(name){
    if (DEFAULT_ACCOUNTS.includes(name)){
      showToast("eSewa is your default account and can't be removed");
      return;
    }
    const used = TRANSACTIONS.some(t => t.account === name);
    if (used){
      if (!confirm(`"${name}" has transactions on it. Remove it from your wallet list anyway? The transactions stay, just without this filter.`)) return;
    }
    delete ACCOUNTS[name];
    ACCOUNT_LIST = ACCOUNT_LIST.filter(n => n !== name);
    if (activeAccount === name) activeAccount = "All";
    saveCurrentUser();
    renderAccountManager();
    renderAll();
    showToast(`Removed ${name}`);
  }

  function toggleAccountHidden(name){
    if (HIDDEN_ACCOUNTS.includes(name)){
      HIDDEN_ACCOUNTS = HIDDEN_ACCOUNTS.filter(n => n !== name);
      showToast(`${name} is visible again`);
    } else {
      HIDDEN_ACCOUNTS.push(name);
      if (activeAccount === name) activeAccount = "All";
      showToast(`${name} hidden — its data is safe, just tucked away`);
    }
    saveCurrentUser();
    renderAccountManager();
    renderAll();
  }

  function renderAccountManager(){
    const el = document.getElementById("accountList");
    const countEl = document.getElementById("accountCount");
    if (!el) return;
    el.innerHTML = ACCOUNT_LIST.map(name => {
      const isDefault = DEFAULT_ACCOUNTS.includes(name);
      const isHidden = HIDDEN_ACCOUNTS.includes(name);
      const meta = ACCOUNTS[name] || { color: "#9aa0ac", icon: "👛" };
      return `<span class="kh-cat-tag" style="${isHidden ? "opacity:.55" : ""}">
        <span class="kh-cat-dot" style="width:7px;height:7px;border-radius:50%;background:${meta.color}"></span>
        ${meta.icon} ${name}${isHidden ? " (hidden)" : ""}
        <button class="kh-cat-remove" onclick="toggleAccountHidden(${attrJson(name)})" title="${isHidden ? "Unhide" : "Hide"}">${isHidden ? "👁️" : "🙈"}</button>
        ${isDefault ? "" : `<button class="kh-cat-remove" onclick="removeAccountManual(${attrJson(name)})" title="Remove">✕</button>`}
      </span>`;
    }).join("");
    if (countEl) countEl.textContent = `${ACCOUNT_LIST.length} of ${MAX_ACCOUNTS} used`;
    const addBtn = document.getElementById("accountAddBtn");
    if (addBtn) addBtn.disabled = ACCOUNT_LIST.length >= MAX_ACCOUNTS;
  }

  function parseAmount(val){
    if (val === null || val === undefined || val === "") return null;
    const cleaned = String(val).replace(/[^0-9.\-]/g, "");
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : Math.abs(n);
  }

  function normalizeDate(str){
    if (!str) return null;
    str = String(str).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  // Reads one transaction object and normalizes it into {date, vendor, category, type, amount}.
  // Tolerates a few different key names/shapes so JSON pasted from different statement photos still works.
  // Guesses a category from a shop name / bank remark / narration string —
  // used when the JSON import doesn't supply an explicit category, so a
  // raw statement remark like "POS PURCHASE CHAI TOWN KTM NP" still lands
  // somewhere sensible instead of always falling into "Other". Falls back
  // to a direction-based default (Transfer In/Out) when nothing matches,
  // since an unrecognized remark is more likely a transfer than "Other".
  function guessCategoryFromText(text, type){
    const n = String(text || "").toLowerCase();
    if (/chai|coffee|cafe|restaurant|dining|momo|nasta|snack|hotel|bakery|sweet/.test(n)) return "Food & Drink";
    if (/grocer|vegetable|tarkari|kirana|dairy|meat|fruit|provision/.test(n)) return "Groceries";
    if (/esewa\s*load|khalti\s*load|wallet\s*top|top[- ]?up|recharge|mobile\s*banking\s*load/.test(n)) return "Wallet Top-up";
    if (/electric|water\s*bill|ntc\b|ncell|internet|wifi|rent\b|utility|insurance|bill\s*payment|school\s*fee|tuition/.test(n)) return "Bills & Payments";
    if (/fuel|petrol|diesel|\btaxi\b|\bbus\b|\bride\b|transport|parking|pathao|indrive/.test(n)) return "Transport";
    if (/shopping|mart\b|store\b|clothes|fashion|electronics|pasal|garment|footwear/.test(n)) return "Shopping";
    if (/transfer|remit|fund\s*transfer|payment\s*received|ach\b|cips\b|connectips/.test(n)) return type === "in" ? "Transfer In" : "Transfer Out";
    return type === "in" ? "Transfer In" : "Transfer Out";
  }

  // Does a raw amount value/string carry an explicit negative sign?
  // Used to infer debit vs credit when there's no separate type/dr/cr field —
  // e.g. Claude (or a bank export) writing {"amount": "-500"} or {"amount": -500}.
  function amountLooksNegative(val){
    if (typeof val === "number") return val < 0;
    return /^\s*-|\(\s*-?\d/.test(String(val == null ? "" : val));
  }

  // Reads one transaction object and normalizes it into {date, vendor, category, type, amount}.
  // Tolerates a wide range of key names/shapes so JSON pasted from different statement
  // photos — or different AI phrasing of the same schema — still works.
  function parseTxObject(tx, i, errors){
    if (!tx || typeof tx !== "object"){ errors.push(`Item ${i+1}: not a valid entry`); return null; }

    const date = normalizeDate(
      tx.date || tx.dateTime || tx.datetime || tx.txnDate || tx.transactionDate || tx.time
    );
    if (!date){ errors.push(`Item ${i+1}: bad or missing date`); return null; }

    const vendor = tx.vendor || tx.description || tx.desc || tx.merchant ||
      tx.narration || tx.payee || tx.remarks || tx.remark || tx.title || tx.name;
    if (!vendor){ errors.push(`Item ${i+1}: missing vendor/description`); return null; }

    let type = null, amount = null;
    if (tx.type){
      const t = String(tx.type).toLowerCase();
      type = (t === "in" || t === "credit" || t === "cr" || t === "+" || t === "income" || t === "deposit") ? "in" : "out";
      amount = parseAmount(tx.amount != null ? tx.amount : (tx.value != null ? tx.value : tx.total));
    } else if (tx.dr !== undefined || tx.cr !== undefined || tx.debit !== undefined || tx.credit !== undefined){
      const dr = parseAmount(tx.dr !== undefined ? tx.dr : tx.debit);
      const cr = parseAmount(tx.cr !== undefined ? tx.cr : tx.credit);
      if (cr){ type = "in"; amount = cr; }
      else { type = "out"; amount = dr; }
    } else {
      const rawAmount = tx.amount != null ? tx.amount : (tx.value != null ? tx.value : tx.total);
      amount = parseAmount(rawAmount);
      type = amountLooksNegative(rawAmount) ? "out" : "in";
    }

    if (amount === null || amount === 0){ errors.push(`Item ${i+1} (${vendor}): missing/bad amount`); return null; }

    // Trust an explicit category (e.g. one Claude already worked out from
    // the statement photo); only guess from the remark/vendor when it's
    // genuinely missing.
    const category = tx.category || tx.categoryGuess || guessCategoryFromText(vendor, type);

    return { date, vendor, category, type, amount };
  }

  // Pulls a transactions array out of whatever shape the pasted JSON has —
  // {"transactions":[...]}, {"items":[...]}, {"entries":[...]}, a nested
  // {"statement":{...}}/{"data":{...}} wrapper, or a bare top-level array.
  function findTransactionsArray(data){
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") return null;
    const keys = ["transactions", "items", "entries", "rows", "records"];
    for (const k of keys){ if (Array.isArray(data[k])) return data[k]; }
    for (const wrapKey of ["statement", "data", "result"]){
      if (data[wrapKey] && typeof data[wrapKey] === "object"){
        const nested = findTransactionsArray(data[wrapKey]);
        if (nested) return nested;
      }
    }
    return null;
  }

  function findAccountName(data){
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const name = data.account || data.accountName || data.wallet || data.bank || data.source;
    if (name) return String(name);
    for (const wrapKey of ["statement", "data", "result"]){
      if (data[wrapKey] && typeof data[wrapKey] === "object"){
        const nested = findAccountName(data[wrapKey]);
        if (nested) return nested;
      }
    }
    return null;
  }

  function findClosingBalance(data){
    if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
    const bal = data.closingBalance !== undefined ? data.closingBalance
      : (data.balance !== undefined ? data.balance : data.availableBalance);
    if (bal !== undefined) return bal;
    for (const wrapKey of ["statement", "data", "result"]){
      if (data[wrapKey] && typeof data[wrapKey] === "object"){
        const nested = findClosingBalance(data[wrapKey]);
        if (nested !== undefined) return nested;
      }
    }
    return undefined;
  }

  function importData(){
    const raw = document.getElementById("importInput").value.trim();
    const status = document.getElementById("importStatus");

    if (!raw){
      status.textContent = "Paste the JSON block first.";
      status.className = "kh-import-status err";
      return;
    }

    let data;
    try {
      // Tolerate a reply that includes prose or ```json fences around the
      // block, not just a bare JSON object — Claude sometimes wraps it.
      let cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```\s*$/,"").trim();
      const first = cleaned.search(/[\{\[]/);
      if (first > 0) cleaned = cleaned.slice(first);
      data = JSON.parse(cleaned);
    } catch (e) {
      status.textContent = "That doesn't look like valid JSON — make sure you copied the whole block, including the { and } at each end.";
      status.className = "kh-import-status err";
      return;
    }

    const txArray = findTransactionsArray(data);
    let account = findAccountName(data);

    if (!txArray || !txArray.length){
      status.textContent = 'No transactions found — the JSON needs a "transactions" array with at least one entry.';
      status.className = "kh-import-status err";
      return;
    }
    if (!account){
      // Fall back rather than fail outright — an AI reply that forgot the
      // account name shouldn't block the whole import.
      account = "Imported";
    }
    ensureAccount(account);

    let added = 0, errors = [];
    txArray.forEach((tx, i) => {
      const parsed = parseTxObject(tx, i, errors);
      if (!parsed) return;
      ensureCategory(parsed.category);
      TRANSACTIONS.push({ ...parsed, account, id: "tx" + (nextTxId++) });
      added++;
    });

    let balanceSet = false;
    const rawBalance = findClosingBalance(data);
    if (rawBalance !== undefined){
      const bal = parseAmount(rawBalance);
      if (bal !== null){ BALANCES[account] = bal; balanceSet = true; }
    }

    saveCurrentUser();
    renderAll();
    renderCategoryManager();
    renderAccountManager();

    if (added || balanceSet){
      let msg = [];
      if (added) msg.push(`${added} transaction${added === 1 ? "" : "s"} into ${account}`);
      if (balanceSet) msg.push("balance updated");
      if (errors.length) msg.push(`${errors.length} skipped`);
      showToast(`Imported ${msg.join(", ")}`);
      status.textContent = errors.length ? `Imported, but skipped: ${errors.join(" · ")}` : "";
      status.className = errors.length ? "kh-import-status err" : "kh-import-status";
      document.getElementById("importInput").value = "";
      if (!errors.length) closePanel();
    } else {
      status.textContent = errors.length ? `Nothing imported — ${errors.join(" · ")}` : "Nothing to import.";
      status.className = "kh-import-status err";
    }
  }

  // ---------------------------------------------------------------------
  // "Paste SMS" import — pure client-side regex parsing of eSewa/Khalti/
  // bank transaction notification texts. No AI round-trip, no network
  // call: everything below runs entirely in the browser.
  // ---------------------------------------------------------------------

  // Known Nepali bank/wallet names we can recognize inside SMS text and
  // map to a friendly account name. First match wins, so more specific
  // patterns (e.g. "nic asia") come before generic ones.
  const SMS_ACCOUNT_PATTERNS = [
    [/e-?sewa/i, "eSewa"],
    [/khalti/i, "Khalti"],
    [/nic\s*asia/i, "NIC Asia Bank"],
    [/global\s*ime/i, "Global IME Bank"],
    [/machhapuchhre/i, "Machhapuchhre Bank"],
    [/siddhartha/i, "Siddhartha Bank"],
    [/standard\s*chartered/i, "Standard Chartered"],
    [/himalayan/i, "Himalayan Bank"],
    [/everest/i, "Everest Bank"],
    [/prime\s*commercial/i, "Prime Commercial Bank"],
    [/citizens/i, "Citizens Bank"],
    [/sanima/i, "Sanima Bank"],
    [/nepal\s*investment/i, "Nepal Investment Mega Bank"],
    [/rastriya\s*banijya/i, "Rastriya Banijya Bank"],
    [/agricultural?\s*development/i, "Agricultural Development Bank"],
    [/nepal\s*sbi/i, "Nepal SBI Bank"],
    [/prabhu/i, "Prabhu Bank"],
    [/sunrise/i, "Sunrise Bank"],
    [/laxmi/i, "Laxmi Sunrise Bank"],
    [/\bnmb\b/i, "NMB Bank"],
    [/nabil/i, "Nabil Bank"],
    [/kumari/i, "Kumari Bank"],
  ];

  const SMS_OUT_WORDS = /debit(?:ed)?|deduct(?:ed)?|\bsent\b|\bpaid\b|purchase[d]?|withdraw(?:n|al)?|\bspent\b|payment\s+of|charged/i;
  const SMS_IN_WORDS = /credit(?:ed)?|received|deposit(?:ed)?|\badded\b|top[- ]?up|refund(?:ed)?/i;
  const SMS_BALANCE_RE = /(?:avl\.?\s*bal(?:ance)?|available\s*balance|current\s*balance|closing\s*bal(?:ance)?|balance\s*is|\bbal\.?)\s*:?\s*(?:is)?\s*(?:rs\.?|npr|nrs\.?)?\s*\.?\s*([\d,]+(?:\.\d{1,2})?)/i;
  const SMS_VENDOR_STOP = "(?=\\s*(?:[.,]|\\bon\\b|\\bavl\\b|\\bavailable\\b|\\bbal\\b|\\bbalance\\b|\\bfor\\b|\\bat\\b|\\bto\\b|\\bref\\b|\\btxn\\b|$))";
  const SMS_MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };

  function smsFindAmounts(text){
    const re = /(?:rs\.?|npr|nrs\.?)\s*\.?\s*([\d,]+(?:\.\d{1,2})?)/gi;
    const out = [];
    let m;
    while ((m = re.exec(text))) out.push(parseFloat(m[1].replace(/,/g, "")));
    return out;
  }

  function smsDetectDirection(text){
    const outM = SMS_OUT_WORDS.exec(text);
    const inM = SMS_IN_WORDS.exec(text);
    if (outM && inM) return outM.index <= inM.index ? "out" : "in";
    if (outM) return "out";
    if (inM) return "in";
    return null;
  }

  function smsDetectBalance(text){
    const m = SMS_BALANCE_RE.exec(text);
    return m ? parseFloat(m[1].replace(/,/g, "")) : null;
  }

  function smsDetectDate(text){
    let m = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
    if (m){
      let d = +m[1], mo = +m[2], y = +m[3];
      if (y < 100) y += 2000;
      if (mo > 12 && d <= 12){ const t = d; d = mo; mo = t; }
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31){
        const pad = (n) => String(n).padStart(2, "0");
        return `${y}-${pad(mo)}-${pad(d)}`;
      }
    }
    m = text.match(/\b(\d{1,2})[\s\-]([A-Za-z]{3,9})[\s\-,]*(\d{2,4})?\b/);
    if (m){
      const mon = SMS_MONTHS[m[2].slice(0, 3).toLowerCase()];
      if (mon){
        let y = m[3] ? +m[3] : new Date().getFullYear();
        if (y < 100) y += 2000;
        const pad = (n) => String(n).padStart(2, "0");
        return `${y}-${pad(mon)}-${pad(+m[1])}`;
      }
    }
    return null;
  }

  // "for"/"to X" usually names the merchant or recipient; "from" after a
  // debit usually just names the person's own account/wallet, and "to"
  // after a credit is the same trap in reverse — so which preposition to
  // trust first depends on whether money left or arrived.
  function smsDetectVendor(text, direction){
    const order = direction === "out" ? ["for", "to", "at", "by", "from"] : ["from", "for", "by", "at", "to"];
    for (const kw of order){
      const re = new RegExp("\\b" + kw + "\\s+([A-Za-z0-9&.,'\\/\\- ]{2,40}?)" + SMS_VENDOR_STOP, "i");
      const m = re.exec(text);
      if (!m) continue;
      const v = m[1].trim().replace(/\s{2,}/g, " ");
      if (v.length >= 2 && !/^your\b/i.test(v) && !/\baccount\b$/i.test(v)) return v;
    }
    return direction === "in" ? "SMS transfer received" : "SMS transaction";
  }

  function smsDetectAccount(text){
    for (const [re, name] of SMS_ACCOUNT_PATTERNS){ if (re.test(text)) return name; }
    return "Other";
  }

  // Splits pasted text into one chunk per SMS. Prefers blank-line-separated
  // paragraphs (how most apps paste multi-message selections); falls back
  // to one message per line if there's no blank line in the paste.
  function splitSmsBlocks(raw){
    let blocks = raw.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    if (blocks.length <= 1){
      const lines = raw.split(/\n/).map((s) => s.trim()).filter(Boolean);
      if (lines.length > 1) blocks = lines;
    }
    if (!blocks.length && raw.trim()) blocks = [raw.trim()];
    return blocks;
  }

  // Reads one SMS message and normalizes it into the same shape parseTxObject
  // produces, plus a detected account name and an optional balance reading.
  function parseSmsBlock(text, i, errors){
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return null;

    const amounts = smsFindAmounts(clean);
    if (!amounts.length){ errors.push(`Message ${i + 1}: couldn't find a Rs./NPR amount`); return null; }

    const direction = smsDetectDirection(clean);
    if (!direction){ errors.push(`Message ${i + 1}: couldn't tell if money was sent or received`); return null; }

    const balance = smsDetectBalance(clean);
    let amount = amounts[0];
    if (balance !== null && amounts.length > 1){
      const nonBalance = amounts.find((a) => a !== balance);
      if (nonBalance !== undefined) amount = nonBalance;
    }
    if (!amount){ errors.push(`Message ${i + 1}: missing/bad amount`); return null; }

    const date = smsDetectDate(clean) || todayStr();
    const vendor = smsDetectVendor(clean, direction);
    const account = smsDetectAccount(clean);
    const category = guessCategoryFromText(vendor, direction);

    return { date, vendor, category, type: direction, amount, account, balance };
  }

  function importSms(){
    const raw = document.getElementById("importSmsInput").value.trim();
    const status = document.getElementById("importStatus");

    if (!raw){
      status.textContent = "Paste one or more SMS messages first.";
      status.className = "kh-import-status err";
      return;
    }

    const blocks = splitSmsBlocks(raw);
    const errors = [];
    const balancesByAccount = {};
    let added = 0;

    blocks.forEach((block, i) => {
      const parsed = parseSmsBlock(block, i, errors);
      if (!parsed) return;
      ensureAccount(parsed.account);
      ensureCategory(parsed.category);
      TRANSACTIONS.push({
        date: parsed.date, vendor: parsed.vendor, category: parsed.category,
        type: parsed.type, amount: parsed.amount, account: parsed.account,
        id: "tx" + (nextTxId++),
      });
      added++;
      if (parsed.balance !== null) balancesByAccount[parsed.account] = parsed.balance;
    });

    const balanceAccounts = Object.keys(balancesByAccount);
    balanceAccounts.forEach((acc) => { BALANCES[acc] = balancesByAccount[acc]; });

    if (added){
      saveCurrentUser();
      renderAll();
      renderCategoryManager();
      renderAccountManager();
      const msg = [`${added} transaction${added === 1 ? "" : "s"}`];
      if (balanceAccounts.length) msg.push(`balance updated for ${balanceAccounts.length} account${balanceAccounts.length === 1 ? "" : "s"}`);
      showToast(`Imported ${msg.join(", ")}`);
      document.getElementById("importSmsInput").value = "";
      closePanel();
    } else {
      status.textContent = errors.length ? errors.join(" · ") : "Couldn't parse any messages.";
      status.className = "kh-import-status err";
    }
  }

  function renderChips(){
    const el = document.getElementById("chips");
    el.innerHTML = "";
    const allBtn = document.createElement("button");
    allBtn.className = "kh-chip" + (activeAccount === "All" ? " active" : "");
    allBtn.style.background = activeAccount === "All" ? "var(--accent)" : "";
    allBtn.textContent = "All accounts";
    allBtn.onclick = () => { activeAccount = "All"; renderAll(); };
    el.appendChild(allBtn);

    visibleAccounts().forEach(name => {
      const meta = ACCOUNTS[name];
      const has = TRANSACTIONS.some(t => t.account === name);
      const btn = document.createElement("button");
      btn.className = "kh-chip" + (activeAccount === name ? " active" : "");
      btn.style.background = activeAccount === name ? meta.color : "";
      btn.innerHTML = `<span class="kh-chip-dot" style="background:${meta.color}; opacity:${has ? 1 : 0.35}"></span>${name}`;
      btn.onclick = () => { activeAccount = name; renderAll(); };
      el.appendChild(btn);
    });

    if (HIDDEN_ACCOUNTS.length){
      const hiddenBtn = document.createElement("button");
      hiddenBtn.className = "kh-chip";
      hiddenBtn.style.color = "var(--dim)";
      hiddenBtn.textContent = `${HIDDEN_ACCOUNTS.length} hidden`;
      hiddenBtn.title = "Manage hidden accounts in Settings → Wallets";
      hiddenBtn.onclick = () => { showSettingsPage("wallets"); };
      el.appendChild(hiddenBtn);
    }

    if (ACCOUNT_LIST.length < MAX_ACCOUNTS){
      const addBtn = document.createElement("button");
      addBtn.className = "kh-chip-add";
      addBtn.title = "Add account";
      addBtn.textContent = "＋";
      addBtn.onclick = quickAddAccount;
      el.appendChild(addBtn);
    }
  }

  function quickAddAccount(){
    const name = (prompt("Add an account (e.g. Nabil Bank, Khalti, Cash):") || "").trim();
    if (!name) return;
    if (ACCOUNT_LIST.includes(name)){
      showToast("That account is already in your list");
      return;
    }
    if (ACCOUNT_LIST.length >= MAX_ACCOUNTS){
      showToast(`You can have up to ${MAX_ACCOUNTS} accounts`);
      return;
    }
    ensureAccount(name);
    saveCurrentUser();
    renderAccountManager();
    renderAll();
    showToast(`Added ${name}`);
  }

  function bsMonthKey(dateStr){
    const bs = adToBs(dateStr);
    return `${bs.year}-${bs.month}`;
  }

  function currentBsMonthKey(){
    return bsMonthKey(todayStr());
  }

  function getScoped(){
    if (activeAccount !== "All" && HIDDEN_ACCOUNTS.includes(activeAccount)) activeAccount = "All";
    let list = activeAccount === "All"
      ? TRANSACTIONS.filter(t => !HIDDEN_ACCOUNTS.includes(t.account))
      : TRANSACTIONS.filter(t => t.account === activeAccount);
    if (activeNepaliMonth !== "All") list = list.filter(t => bsMonthKey(t.date) === activeNepaliMonth);
    return list;
  }

  function setNepaliMonthFilter(key){
    activeNepaliMonth = key;
    renderAll();
  }

  function renderNepaliMonthFilter(){
    const el = document.getElementById("npMonthFilter");
    if (!el) return;
    // Every BS month present in the data, plus the current month (so it's
    // always selectable as the default even before any transactions exist
    // in it), in chronological order.
    const seen = new Map();
    const todayBs = adToBs(todayStr());
    seen.set(`${todayBs.year}-${todayBs.month}`, { y: todayBs.year, m: todayBs.month, label: `${NEPALI_MONTHS[todayBs.month - 1].name} ${todayBs.year}` });
    TRANSACTIONS.forEach(t => {
      const bs = adToBs(t.date);
      const key = `${bs.year}-${bs.month}`;
      if (!seen.has(key)) seen.set(key, { y: bs.year, m: bs.month, label: `${NEPALI_MONTHS[bs.month - 1].name} ${bs.year}` });
    });
    const months = [...seen.values()].sort((a, b) => (a.y - b.y) || (a.m - b.m));
    el.innerHTML = `<option value="All">All months</option>` +
      months.map(mo => `<option value="${mo.y}-${mo.m}">${mo.label}</option>`).join("");
    el.value = (activeNepaliMonth === "All" || months.some(mo => `${mo.y}-${mo.m}` === activeNepaliMonth))
      ? activeNepaliMonth
      : currentBsMonthKey();
    activeNepaliMonth = el.value;
    const filterEl = document.getElementById("npFilterHome");
    if (filterEl) filterEl.classList.toggle("kh-np-filter-active", activeNepaliMonth !== "All");
  }

  function renderStats(){
    const scoped = getScoped();
    const totalIn = scoped.filter(t => t.type === "in").reduce((s,t)=>s+t.amount,0);
    const totalOut = scoped.filter(t => t.type === "out").reduce((s,t)=>s+t.amount,0);
    const net = totalIn - totalOut;
    const netLabel = activeAccount === "All" ? "Net (all accounts)" : "Money left";
    const arrowDown = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4v16M6 14l6 6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const arrowUp = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 20V4M6 10l6-6 6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    // Rendered with the final text already in place (so there's never a
    // flash of an empty card), then animateAmount() takes over the digits.
    let html = `
      <div class="kh-stat kh-stat-icon">
        <div class="kh-stat-icon-circle" style="background:color-mix(in srgb, var(--in) 16%, transparent); color:var(--in)">${arrowDown}</div>
        <div><div class="kh-stat-head">Money in</div><div class="kh-stat-amt" id="statInAmt">${rs(totalIn)}</div></div>
      </div>
      <div class="kh-stat kh-stat-icon">
        <div class="kh-stat-icon-circle" style="background:color-mix(in srgb, var(--out) 16%, transparent); color:var(--out)">${arrowUp}</div>
        <div><div class="kh-stat-head">Money out</div><div class="kh-stat-amt" id="statOutAmt">${rs(totalOut)}</div></div>
      </div>
      <div class="kh-stat"><div class="kh-stat-head">${netLabel}</div><div class="kh-stat-amt" id="statNetAmt" style="color:${net >= 0 ? "var(--in)" : "var(--out)"}">${net >= 0 ? "" : "−"}${rs(Math.abs(net))}</div></div>`;
    document.getElementById("stats").innerHTML = html;
    const unsigned = v => rs(Math.max(0, v));
    animateAmount(document.getElementById("statInAmt"), "statIn", totalIn, unsigned);
    animateAmount(document.getElementById("statOutAmt"), "statOut", totalOut, unsigned);
    animateAmount(document.getElementById("statNetAmt"), "statNet", net, v => (v < 0 ? "−" : "") + rs(Math.abs(v)));
  }

  function renderPie(){
    // Always broken down by category, scoped to whichever account + Nepali
    // month filters are active — this is the "where did it go" chart, so
    // category is more useful here than account (the account chips already
    // show account-level totals). Per-account breakdown moved to Insights.
    document.getElementById("pieTitle").textContent = activeAccount === "All"
      ? "Spending by category"
      : "Spending by category — " + activeAccount;
    const m = {};
    getScoped().filter(t => t.type === "out").forEach(t => m[t.category] = (m[t.category]||0) + t.amount);
    const data = Object.entries(m).map(([name,value]) => ({ name, value, color: CAT[name]?.color || "#9aa0ac" }))
      .sort((a,b)=>b.value-a.value);

    const body = document.getElementById("pieBody");
    if (data.length === 0){
      body.innerHTML = `<div class="kh-pie-empty">No spending recorded here yet.</div>`;
      return;
    }
    const total = data.reduce((s,d)=>s+d.value,0) || 1;
    let angle = 0;
    const stops = data.map(d => {
      const start = angle;
      const deg = (d.value/total) * 360;
      angle += deg;
      return `${d.color} ${start}deg ${angle}deg`;
    }).join(", ");

    let html = `<div class="kh-pie-wrap"><div class="kh-pie" style="background:conic-gradient(${stops})"><div class="kh-pie-center"><span class="kh-pie-center-label">Top</span><span class="kh-pie-center-value">${data[0].name}</span></div></div></div><div class="kh-legend">`;
    data.forEach(d => {
      html += `<div class="kh-legend-row">
        <span class="kh-legend-dot" style="background:${d.color}"></span>
        <span class="kh-legend-name">${d.name}</span>
        <span class="kh-legend-amt">${rs(d.value)}</span>
        <span class="kh-legend-pct">${Math.round((d.value/total)*100)}%</span>
      </div>`;
    });
    html += `</div>`;
    body.innerHTML = html;
  }

  function renderNepaliPie(){
    // Always across ALL accounts/transactions, regardless of the active
    // account filter — this chart answers "where did the money go, by
    // Nepali month" for everything in the tracker.
    const totals = {}; // "2083-5" -> amount
    TRANSACTIONS.filter(t => t.type === "out" && !HIDDEN_ACCOUNTS.includes(t.account)).forEach(t => {
      const bs = adToBs(t.date);
      const key = `${bs.year}-${bs.month}`;
      totals[key] = (totals[key] || 0) + t.amount;
    });

    const body = document.getElementById("npPieBody");
    const keys = Object.keys(totals);
    if (keys.length === 0){
      body.innerHTML = `<div class="kh-pie-empty">No spending recorded yet.</div>`;
      return;
    }

    const data = keys
      .map(key => {
        const [y, m] = key.split("-").map(Number);
        const meta = NEPALI_MONTHS[m - 1];
        return { name: `${meta.name} ${y}`, value: totals[key], color: meta.color, y, m };
      })
      .sort((a, b) => (a.y - b.y) || (a.m - b.m)); // chronological, Baisakh -> Chaitra

    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    let angle = 0;
    const stops = data.map(d => {
      const start = angle;
      const deg = (d.value / total) * 360;
      angle += deg;
      return `${d.color} ${start}deg ${angle}deg`;
    }).join(", ");

    let html = `<div class="kh-pie-wrap"><div class="kh-pie" style="background:conic-gradient(${stops})"><div class="kh-pie-center"><span class="kh-pie-center-label">Top</span><span class="kh-pie-center-value">${data[0].name.split(" ")[0]}</span></div></div></div><div class="kh-legend">`;
    data.forEach(d => {
      const key = `${d.y}-${d.m}`;
      const isActive = activeNepaliMonth === key;
      html += `<div class="kh-legend-row clickable${isActive ? " active" : ""}" onclick="setNepaliMonthFilter('${key}')" title="Filter transactions to this month">
        <span class="kh-legend-dot" style="background:${d.color}"></span>
        <span class="kh-legend-name">${d.name}</span>
        <span class="kh-legend-amt">${rs(d.value)}</span>
        <span class="kh-legend-pct">${Math.round((d.value / total) * 100)}%</span>
      </div>`;
    });
    html += `</div>`;
    if (activeNepaliMonth !== "All"){
      html += `<button class="kh-np-filter-clear" onclick="setNepaliMonthFilter('All')">✕ Clear month filter</button>`;
    }
    body.innerHTML = html;
  }

  let txSearchQuery = "";
  function setTxSearch(val){
    txSearchQuery = val.trim().toLowerCase();
    renderTx();
  }

  function renderTx(){
    let scoped = getScoped();
    const el = document.getElementById("txList");
    if (scoped.length === 0){
      el.innerHTML = `<div class="kh-empty">No statements yet for this account.</div>`;
      return;
    }
    if (txSearchQuery){
      scoped = scoped.filter(t =>
        t.vendor.toLowerCase().includes(txSearchQuery) || t.category.toLowerCase().includes(txSearchQuery));
      if (scoped.length === 0){
        el.innerHTML = `<div class="kh-empty">No transactions match "${txSearchQuery}".</div>`;
        return;
      }
    }
    const groups = {};
    [...scoped].sort((a,b) => a.date < b.date ? 1 : -1).forEach(t => {
      groups[t.date] = groups[t.date] || [];
      groups[t.date].push(t);
    });

    let html = "";
    Object.entries(groups).forEach(([day, rows]) => {
      html += `<div class="kh-day">
        <div class="kh-day-label">${getCalendarBsFirst()
            ? `${bsLabel(day)} BS <span class="kh-day-np">· ${fmtDate(day)}</span>`
            : `${fmtDate(day)} <span class="kh-day-np">· ${bsLabel(day)} BS</span>`}<div class="kh-day-line"></div></div>
        <div class="kh-card">`;
      rows.forEach(t => {
        const meta = CAT[t.category] || CAT.Other;
        const sub = activeAccount === "All" ? `${t.account} · ${t.category}` : t.category;
        html += `<div class="kh-row">
          <div class="kh-row-icon" style="background:${meta.color}">${meta.icon}</div>
          <div class="kh-row-mid">
            <div class="kh-row-vendor">${t.vendor}</div>
            <div class="kh-row-cat">${sub}</div>
          </div>
          <div class="kh-row-amt" style="color:${t.type === "in" ? "var(--in)" : "var(--out)"}">${t.type === "in" ? "+" : "−"}${rs(t.amount)}</div>
          <button class="kh-row-del" onclick="editTx('${t.id}')" title="Edit">✎</button>
          <button class="kh-row-del" onclick="deleteTx('${t.id}')" title="Delete">✕</button>
        </div>`;
      });
      html += `</div></div>`;
    });
    el.innerHTML = html;
  }

  // ---------------------------------------------------------------------
  // Loans — panel rendering & form handlers.
  // ---------------------------------------------------------------------
  function setLoanFilter(f){
    loanFilter = f;
    renderLoans();
  }

  function renderLoans(){
    document.querySelectorAll("#loanFilterChips .kh-loan-chip").forEach(b => b.classList.toggle("active", b.dataset.f === loanFilter));

    // The summary card reflects whichever bucket is selected — Loan totals
    // and EMI totals are kept apart rather than blended into one number.
    const summaryScope = loanFilter === "emi" ? "emi" : "nonEmi";
    const pos = netLoanPosition(summaryScope);
    const summaryLabelEl = document.getElementById("loanSummaryScopeLabel");
    if (summaryLabelEl) summaryLabelEl.textContent = summaryScope === "emi" ? "Showing EMI loans" : "Showing regular loans";
    document.getElementById("loanSummaryLent").textContent = rs(pos.lentOutstanding);
    document.getElementById("loanSummaryBorrowed").textContent = rs(pos.borrowedOutstanding);
    const netEl = document.getElementById("loanSummaryNet");
    netEl.textContent = (pos.net >= 0 ? "+" : "−") + rs(Math.abs(pos.net));
    netEl.style.color = pos.net >= 0 ? "var(--in)" : "var(--out)";

    const today = todayStr();
    const activeEmis = LOANS.filter(l => l.isEmi && l.emiAmount && loanStatus(l) !== "Cleared");
    const outflowEl = document.getElementById("emiOutflowBanner");
    if (activeEmis.length){
      const totalMonthly = activeEmis.reduce((s, l) => s + l.emiAmount, 0);
      outflowEl.innerHTML = `<div class="kh-emi-outflow">💸 <b>${rs(totalMonthly)}</b>/month committed across ${activeEmis.length} EMI${activeEmis.length === 1 ? "" : "s"}</div>`;
    } else {
      outflowEl.innerHTML = "";
    }

    const dueSoon = LOANS.filter(l => {
      if (!l.dueDate || loanStatus(l) === "Cleared") return false;
      const days = daysBetween(today, l.dueDate);
      return days <= 7;
    });
    const alertEl = document.getElementById("loanAlert");
    if (dueSoon.length){
      alertEl.innerHTML = `<div class="kh-loan-alert">
        <div>⚠ ${dueSoon.length} loan${dueSoon.length === 1 ? "" : "s"} due soon</div>
        ${dueSoon.map(l => {
          const days = Math.round(daysBetween(today, l.dueDate));
          const when = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "due today" : `due in ${days}d`;
          return `<div class="kh-loan-alert-row">
            <span>${l.isEmi ? "EMI: " : ""}${l.person} (${when})</span>
            ${l.isEmi && l.emiAmount ? `<button type="button" class="kh-loan-btn" style="padding:4px 10px; font-size:11px;" onclick="quickPayEmi('${l.id}')">⚡ Pay ${rs(l.emiAmount)}</button>` : ""}
          </div>`;
        }).join("")}
      </div>`;
    } else {
      alertEl.innerHTML = "";
    }

    const list = LOANS.filter(l => {
      if (loanFilter === "emi") return !!l.isEmi;
      if (l.isEmi) return false; // EMIs only show under the dedicated EMI filter
      if (loanFilter === "lent" || loanFilter === "borrowed") return l.type === loanFilter;
      return true; // "all" — all regular (non-EMI) loans
    });
    const el = document.getElementById("loanList");
    if (!list.length){
      el.innerHTML = `<div class="kh-empty">No loans here yet. Tap "＋ New loan" to track one.</div>`;
      renderDesktopLoansPage();
      return;
    }
    el.innerHTML = [...list].sort((a, b) => (a.dueDate || "9999-99") < (b.dueDate || "9999-99") ? -1 : 1).map(l => {
      const { paid, interest, outstanding } = loanTotals(l);
      const status = loanStatus(l);
      const meta = LOAN_STATUS_META[status];
      const typeLabel = l.type === "lent" ? "Owed to me" : "I owe";
      const typeColor = l.type === "lent" ? "var(--in)" : "var(--out)";
      const paidCount = emiInstallmentsPaid(l);
      const emiMeta = l.isEmi
        ? `${paidCount ? ` · ${Math.min(paidCount, l.emiTenure || paidCount)}${l.emiTenure ? `/${l.emiTenure}` : ""} paid` : ""}${l.dueDate && status !== "Cleared" ? ` · Next ${fmtDate(l.dueDate)}` : ""}`
        : "";
      const emiProgressPct = l.isEmi && l.emiTenure ? Math.min(100, (paidCount / l.emiTenure) * 100) : null;
      const payoff = status !== "Cleared" ? emiPayoffDate(l) : null;
      return `<div class="kh-loan-card${l.isEmi ? " kh-emi-card" : ""}">
        <div class="kh-loan-card-top">
          <div>
            <div class="kh-loan-person">${l.person}</div>
            <div class="kh-loan-type" style="color:${typeColor}">${typeLabel}${l.isEmi ? ` <span class="kh-loan-badge" style="color:#059669;background:rgba(16,185,129,.16); margin-left:4px;">EMI</span>` : ""}</div>
          </div>
          <span class="kh-loan-badge" style="color:${meta.color};background:${meta.bg}">${status}</span>
        </div>
        ${l.isEmi ? `
          <div class="kh-emi-headline">
            <span class="kh-emi-headline-label">Monthly payment</span>
            <span class="kh-emi-headline-amt">${rs(l.emiAmount)}<span style="font-size:11px; color:var(--dim); font-weight:500;">/mo</span></span>
          </div>
          <div class="kh-budget-bar-track" style="margin-top:8px;"><div class="kh-budget-bar-fill" style="width:${emiProgressPct !== null ? emiProgressPct : 0}%; background:${status === "Cleared" ? "var(--in)" : "var(--accent)"};"></div></div>
        ` : ""}
        <div class="kh-loan-amounts">
          <div><span class="kh-loan-amt-label">Principal</span><span class="kh-loan-amt-val">${rs(l.principal)}</span></div>
          ${interest > 0.5 ? `<div><span class="kh-loan-amt-label">Interest so far</span><span class="kh-loan-amt-val">${rs(interest)}</span></div>` : `<div></div>`}
          <div><span class="kh-loan-amt-label">Paid</span><span class="kh-loan-amt-val">${rs(paid)}</span></div>
          <div><span class="kh-loan-amt-label">Outstanding</span><span class="kh-loan-amt-val" style="color:${outstanding > 0.5 ? typeColor : "var(--in)"}">${rs(outstanding)}</span></div>
        </div>
        <div class="kh-loan-meta">Given ${fmtDate(l.dateGiven)}${!l.isEmi && l.dueDate ? ` · Due ${fmtDate(l.dueDate)}` : ""}${l.interestRate ? ` · ${l.interestRate}% ${l.interestType}` : ""}${emiMeta}${payoff ? ` · Payoff ~${fmtDate(payoff)}` : ""}</div>
        ${l.notes ? `<div class="kh-loan-notes">${l.notes}</div>` : ""}
        <div class="kh-loan-actions">
          ${l.isEmi && outstanding > 0.5 ? `<button type="button" class="kh-loan-btn" style="background:var(--accent); color:#ffffff; border-color:transparent;" onclick="quickPayEmi('${l.id}')">⚡ Quick pay ${rs(l.emiAmount)}</button>` : ""}
          ${outstanding > 0.5 ? `<button type="button" class="kh-loan-btn" onclick="openLoanPayment('${l.id}')">＋ Log payment</button>` : ""}
          ${l.dueDate && status !== "Cleared" ? `<button type="button" class="kh-loan-btn" onclick="addLoanReminder('${l.id}')">📅 ${l.isEmi ? "Add monthly reminder" : "Add reminder"}</button>` : ""}
          <button type="button" class="kh-loan-btn" onclick="openLoanForm('${l.id}')">✎ Edit</button>
          <button type="button" class="kh-loan-btn kh-loan-btn-danger" onclick="deleteLoanUI('${l.id}')">✕ Delete</button>
        </div>
      </div>`;
    }).join("");

    renderDesktopLoansPage();
  }

  // Desktop-only Loans view (#kdLoansContent) — same data/filter state
  // (LOANS, loanFilter, netLoanPosition()) and same action functions
  // (openLoanForm/quickPayEmi/openLoanPayment/addLoanReminder/
  // deleteLoanUI) as the mobile page above, just laid out as kd-styled
  // glass cards instead of a mobile page stretched wide. Called at the
  // end of renderLoans() so every mutation path keeps both in sync
  // without needing its own call sites.
  function renderDesktopLoansPage(){
    const root = document.getElementById("kdLoansContent");
    if (!root) return;

    const summaryScope = loanFilter === "emi" ? "emi" : "nonEmi";
    const pos = netLoanPosition(summaryScope);
    const scopeLabelEl = document.getElementById("kdLoanScopeLabel");
    if (scopeLabelEl) scopeLabelEl.textContent = summaryScope === "emi" ? "Showing EMI loans" : "Showing regular loans";

    const statsEl = document.getElementById("kdLoanStatsRow");
    if (statsEl){
      statsEl.innerHTML = `
        <div class="kd-stat kd-glass">
          <div class="kd-stat-top"><span class="kd-stat-label">Owed to you</span><span class="kd-stat-icon" style="background:rgba(75,226,119,.14); color:var(--kd-primary)">↙</span></div>
          <div class="kd-stat-amt" style="color:var(--kd-primary)">${rs(pos.lentOutstanding)}</div>
        </div>
        <div class="kd-stat kd-glass">
          <div class="kd-stat-top"><span class="kd-stat-label">You owe</span><span class="kd-stat-icon" style="background:rgba(255,107,107,.14); color:var(--kd-danger)">↗</span></div>
          <div class="kd-stat-amt" style="color:var(--kd-danger)">${rs(pos.borrowedOutstanding)}</div>
        </div>
        <div class="kd-stat kd-glass">
          <div class="kd-stat-top"><span class="kd-stat-label">Net position</span><span class="kd-stat-icon" style="background:rgba(124,208,255,.14); color:var(--kd-tertiary)">Σ</span></div>
          <div class="kd-stat-amt" style="color:${pos.net>=0?"var(--kd-primary)":"var(--kd-danger)"}">${pos.net>=0?"+":"−"}${rs(Math.abs(pos.net))}</div>
        </div>
      `;
    }

    const bannersEl = document.getElementById("kdLoanBanners");
    if (bannersEl){
      const today = todayStr();
      const activeEmis = LOANS.filter(l => l.isEmi && l.emiAmount && loanStatus(l) !== "Cleared");
      const dueSoon = LOANS.filter(l => {
        if (!l.dueDate || loanStatus(l) === "Cleared") return false;
        return daysBetween(today, l.dueDate) <= 7;
      });
      let html = "";
      if (activeEmis.length){
        const totalMonthly = activeEmis.reduce((s, l) => s + l.emiAmount, 0);
        html += `<div class="kd-card kd-glass" style="margin-bottom:12px; padding:14px 18px; display:flex; align-items:center; gap:10px; border-color:var(--kd-border-hi);">💸 <b>${rs(totalMonthly)}</b>&nbsp;/month committed across ${activeEmis.length} EMI${activeEmis.length===1?"":"s"}</div>`;
      }
      if (dueSoon.length){
        html += `<div class="kd-card kd-glass" style="margin-bottom:12px; padding:14px 18px; border-color:rgba(255,107,107,.35);">
          <div style="font-weight:700; margin-bottom:8px; color:var(--kd-danger);">⚠ ${dueSoon.length} loan${dueSoon.length===1?"":"s"} due soon</div>
          ${dueSoon.map(l => {
            const days = Math.round(daysBetween(today, l.dueDate));
            const when = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "due today" : `due in ${days}d`;
            return `<div class="kd-mini-row" style="padding:6px 0;">
              <div style="flex:1;">${l.isEmi ? "EMI: " : ""}${l.person} <span style="color:var(--kd-dim);">(${when})</span></div>
              ${l.isEmi && l.emiAmount ? `<button type="button" class="kd-btn kd-btn-primary" style="padding:5px 12px; font-size:11.5px;" onclick="quickPayEmi('${l.id}')">⚡ Pay ${rs(l.emiAmount)}</button>` : ""}
            </div>`;
          }).join("")}
        </div>`;
      }
      bannersEl.innerHTML = html;
    }

    const filtersEl = document.getElementById("kdLoanFilters");
    if (filtersEl){
      const filters = [["all","All"],["lent","Owed to me"],["borrowed","I owe"],["emi","EMI"]];
      filtersEl.innerHTML = filters.map(([f,label]) =>
        `<button type="button" class="${loanFilter===f?"active":""}" onclick="setLoanFilter('${f}')">${label}</button>`
      ).join("");
    }

    const listEl = document.getElementById("kdLoansList");
    if (listEl){
      const list = LOANS.filter(l => {
        if (loanFilter === "emi") return !!l.isEmi;
        if (l.isEmi) return false;
        if (loanFilter === "lent" || loanFilter === "borrowed") return l.type === loanFilter;
        return true;
      });
      if (!list.length){
        listEl.innerHTML = `<div class="kd-empty">No loans here yet. Use "＋ New loan" above to track one.</div>`;
      } else {
        listEl.innerHTML = [...list].sort((a, b) => (a.dueDate || "9999-99") < (b.dueDate || "9999-99") ? -1 : 1).map(l => {
          const { paid, interest, outstanding } = loanTotals(l);
          const status = loanStatus(l);
          const meta = LOAN_STATUS_META[status];
          const typeLabel = l.type === "lent" ? "Owed to me" : "I owe";
          const typeColor = l.type === "lent" ? "var(--kd-primary)" : "var(--kd-danger)";
          const paidCount = emiInstallmentsPaid(l);
          const emiMeta = l.isEmi
            ? `${paidCount ? ` · ${Math.min(paidCount, l.emiTenure || paidCount)}${l.emiTenure ? `/${l.emiTenure}` : ""} paid` : ""}${l.dueDate && status !== "Cleared" ? ` · Next ${fmtDate(l.dueDate)}` : ""}`
            : "";
          const emiProgressPct = l.isEmi && l.emiTenure ? Math.min(100, (paidCount / l.emiTenure) * 100) : null;
          const payoff = status !== "Cleared" ? emiPayoffDate(l) : null;
          return `<div class="kd-card kd-loan-card">
            <div class="kd-card-head" style="margin-bottom:10px;">
              <div>
                <div style="font-weight:700; font-size:14.5px;">${l.person}</div>
                <div style="font-size:12px; color:${typeColor};">${typeLabel}${l.isEmi ? ` <span class="kd-pill kd-pill-jade" style="margin-left:4px;">EMI</span>` : ""}</div>
              </div>
              <span class="kd-pill" style="color:${meta.color}; background:${meta.bg};">${status}</span>
            </div>
            ${l.isEmi ? `
              <div class="kd-mini-row" style="border-bottom:none; padding-top:0;"><div style="flex:1; color:var(--kd-dim); font-size:12px;">Monthly payment</div><b>${rs(l.emiAmount)}<span style="font-size:11px; color:var(--kd-dim); font-weight:500;">/mo</span></b></div>
              <div class="kd-budget-track" style="margin:0 0 10px;"><div class="kd-budget-fill" style="width:${emiProgressPct!==null?emiProgressPct:0}%; background:${status==="Cleared"?"var(--kd-primary)":"var(--kd-secondary)"};"></div></div>
            ` : ""}
            <div class="kd-mini-row" style="border-bottom:none; padding:4px 0;"><div style="flex:1; color:var(--kd-dim); font-size:12px;">Principal</div><span>${rs(l.principal)}</span></div>
            ${interest > 0.5 ? `<div class="kd-mini-row" style="border-bottom:none; padding:4px 0;"><div style="flex:1; color:var(--kd-dim); font-size:12px;">Interest so far</div><span>${rs(interest)}</span></div>` : ""}
            <div class="kd-mini-row" style="border-bottom:none; padding:4px 0;"><div style="flex:1; color:var(--kd-dim); font-size:12px;">Paid</div><span>${rs(paid)}</span></div>
            <div class="kd-mini-row" style="border-bottom:none; padding:4px 0 10px;"><div style="flex:1; color:var(--kd-dim); font-size:12px;">Outstanding</div><span style="color:${outstanding>0.5?typeColor:"var(--kd-primary)"}; font-weight:700;">${rs(outstanding)}</span></div>
            <div style="font-size:11px; color:var(--kd-dim); margin-bottom:10px;">Given ${fmtDate(l.dateGiven)}${!l.isEmi && l.dueDate ? ` · Due ${fmtDate(l.dueDate)}` : ""}${l.interestRate ? ` · ${l.interestRate}% ${l.interestType}` : ""}${emiMeta}${payoff ? ` · Payoff ~${fmtDate(payoff)}` : ""}</div>
            ${l.notes ? `<div style="font-size:12px; color:var(--kd-dim); margin-bottom:10px; font-style:italic;">${l.notes}</div>` : ""}
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
              ${l.isEmi && outstanding > 0.5 ? `<button type="button" class="kd-btn kd-btn-primary" style="padding:6px 12px; font-size:11.5px;" onclick="quickPayEmi('${l.id}')">⚡ Quick pay</button>` : ""}
              ${outstanding > 0.5 ? `<button type="button" class="kd-chip-btn" onclick="openLoanPayment('${l.id}')">＋ Log payment</button>` : ""}
              ${l.dueDate && status !== "Cleared" ? `<button type="button" class="kd-chip-btn" onclick="addLoanReminder('${l.id}')">📅 Reminder</button>` : ""}
              <button type="button" class="kd-chip-btn" onclick="openLoanForm('${l.id}')">✎ Edit</button>
              <button type="button" class="kd-chip-btn" style="color:var(--kd-danger);" onclick="deleteLoanUI('${l.id}')">✕ Delete</button>
            </div>
          </div>`;
        }).join("");
      }
    }
  }

  function renderLoanDashCard(){
    const el = document.getElementById("loanDashCard");
    if (!el) return;
    if (!LOANS.length){
      el.innerHTML = `<div class="kh-loan-dash-empty">No loans tracked yet. <button type="button" class="kh-np-filter-clear" style="display:inline" onclick="showLoanPage()">Track a loan →</button></div>`;
      return;
    }
    const loanPos = netLoanPosition("nonEmi");
    const loanNetColor = loanPos.net >= 0 ? "var(--in)" : "var(--out)";
    const hasLoans = LOANS.some(l => !l.isEmi);
    const emiLoans = LOANS.filter(l => l.isEmi);
    const emiOutstanding = emiLoans.reduce((s, l) => s + loanTotals(l).outstanding, 0);
    const activeEmis = emiLoans.filter(l => l.emiAmount && loanStatus(l) !== "Cleared");
    const emiMonthly = activeEmis.reduce((s, l) => s + l.emiAmount, 0);

    el.innerHTML = `
      <div class="kh-loan-dash-top">
        <span class="kh-loan-dash-title">Net loan position</span>
        <button type="button" class="kh-loan-dash-link" onclick="showLoanPage()">View all →</button>
      </div>
      ${hasLoans ? `
        <div class="kh-loan-dash-section-label">Loans</div>
        <div class="kh-loan-dash-row">
          <div><span class="kh-loan-dash-label">Owed to you</span><span class="kh-loan-dash-val" style="color:var(--in)">${rs(loanPos.lentOutstanding)}</span></div>
          <div><span class="kh-loan-dash-label">You owe</span><span class="kh-loan-dash-val" style="color:var(--out)">${rs(loanPos.borrowedOutstanding)}</span></div>
          <div><span class="kh-loan-dash-label">Net</span><span class="kh-loan-dash-val" style="color:${loanNetColor}">${loanPos.net >= 0 ? "+" : "−"}${rs(Math.abs(loanPos.net))}</span></div>
        </div>
      ` : ""}
      ${emiLoans.length ? `
        <div class="kh-loan-dash-section-label" style="margin-top:${hasLoans ? "12px" : "0"};">EMI</div>
        <div class="kh-loan-dash-row">
          <div><span class="kh-loan-dash-label">Outstanding</span><span class="kh-loan-dash-val" style="color:var(--out)">${rs(emiOutstanding)}</span></div>
          <div><span class="kh-loan-dash-label">Per month</span><span class="kh-loan-dash-val" style="color:var(--accent)">${rs(emiMonthly)}</span></div>
          <div><span class="kh-loan-dash-label">Active EMIs</span><span class="kh-loan-dash-val">${activeEmis.length}</span></div>
        </div>
      ` : ""}
    `;
  }

  function setLoanType(t){
    loanFormType = t;
    document.getElementById("loanTypeBorrowedBtn").className = "kh-manual-type-btn" + (t === "borrowed" ? " active-out" : "");
    document.getElementById("loanTypeLentBtn").className = "kh-manual-type-btn" + (t === "lent" ? " active-in" : "");
  }

  function toggleEmiFields(){
    const on = document.getElementById("loanIsEmi").checked;
    document.getElementById("loanEmiAmountField").style.display = on ? "flex" : "none";
    document.getElementById("loanEmiTenureField").style.display = on ? "flex" : "none";
    document.getElementById("loanEmiHint").style.display = on ? "block" : "none";
    document.getElementById("loanDueDateLabel").textContent = on ? "Next EMI due date" : "Due date (optional)";
    document.getElementById("loanEmiToggleRow").classList.toggle("kh-emi-on", on);
    const titleEl = document.getElementById("loanFormTitle");
    const isEditing = !!editingLoanId;
    titleEl.textContent = (isEditing ? "Edit " : "New ") + (on ? "EMI" : "loan");
    // New EMIs default to NOT recording the principal as a transaction —
    // an EMI is usually a bank loan already disbursed earlier, unlike a
    // fresh informal loan where the money is changing hands right now.
    // Editing an existing loan has its own locked/unlocked logic already,
    // so this only applies while creating a brand-new one.
    const recordTxEl = document.getElementById("loanRecordTx");
    if (!isEditing && !recordTxEl.disabled){
      recordTxEl.checked = !on;
      document.getElementById("loanRecordTxLabel").textContent = on
        ? "Also record the loan amount as a transaction (leave unchecked if the money was already disbursed earlier)"
        : "Also record as a transaction, so it shows in your cash flow charts";
    }
    if (on) autoCalcLoanEmi(); else updateEmiPastPreview();
  }

  // Computes the monthly EMI straight from Amount + Interest % + Interest
  // type + Total installments, the same math as the standalone calculator —
  // so filling in a loan doesn't require jumping over to the calculator
  // and copying numbers across by hand. Only fires once tenure is set;
  // typing directly into the EMI field afterward is still respected until
  // one of these source fields changes again.
  function autoCalcLoanEmi(){
    if (!document.getElementById("loanIsEmi").checked) return;
    const P = parseAmount(document.getElementById("loanPrincipal").value);
    const n = parseInt(document.getElementById("loanEmiTenure").value, 10);
    if (!P || !n){ updateEmiPastPreview(); return; }
    const annualRate = parseAmount(document.getElementById("loanInterestRate").value) || 0;
    const type = document.getElementById("loanInterestType").value;
    let emi;
    if (type === "reducing"){
      const r = annualRate / 12 / 100;
      emi = r === 0 ? P / n : P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    } else if (type === "flat"){
      const totalInterest = P * (annualRate / 100) * (n / 12);
      emi = (P + totalInterest) / n;
    } else {
      emi = P / n;
    }
    document.getElementById("loanEmiAmount").value = Math.round(emi);
    updateEmiPastPreview();
  }

  // If the EMI's start date is in the past, shows how many installments
  // would already be due by today and offers to mark them paid — defaults
  // to checked, since a real ongoing EMI almost always has been. Only
  // applies while creating a brand-new loan; editing one relies on its
  // actual logged payment history instead.
  function updateEmiPastPreview(){
    const box = document.getElementById("loanEmiPastPaymentsBox");
    if (editingLoanId || !document.getElementById("loanIsEmi").checked){
      box.style.display = "none";
      return;
    }
    const dateGiven = document.getElementById("loanDateGiven").value;
    const emiAmount = parseAmount(document.getElementById("loanEmiAmount").value);
    const emiTenureVal = document.getElementById("loanEmiTenure").value;
    const emiTenure = emiTenureVal ? parseInt(emiTenureVal, 10) : null;
    if (!dateGiven || !emiAmount){ box.style.display = "none"; return; }
    let elapsed = monthsElapsed(dateGiven, todayStr());
    if (emiTenure) elapsed = Math.min(elapsed, emiTenure);
    if (elapsed <= 0){ box.style.display = "none"; return; }

    const wasHidden = box.style.display === "none" || !box.style.display;
    document.getElementById("loanEmiPastPaymentsText").textContent =
      `This loan started ${elapsed} month${elapsed === 1 ? "" : "s"} ago — that's ${rs(elapsed * emiAmount)} already due by now.`;
    box.style.display = "block";
    if (wasHidden) document.getElementById("loanEmiMarkPastPaid").checked = true;
  }

  // Bulk-logs installments for months that have already elapsed before an
  // EMI loan was even entered into the tracker. Deliberately doesn't touch
  // loan.dueDate the way a normal payment does — the person already told
  // us the real next due date when filling in the form.
  function markPastEmiPaid(loan, count, account, recordTx){
    for (let i = 1; i <= count; i++){
      const d = new Date(loan.dateGiven + "T00:00:00");
      d.setMonth(d.getMonth() + i);
      const payDate = d.toISOString().slice(0, 10);
      const payment = { id: "pay" + Math.random().toString(36).slice(2, 9), date: payDate, amount: loan.emiAmount, note: "Marked as already paid", linkTxId: null };
      if (recordTx && account){
        ensureCategory("Loan");
        const txType = loan.type === "borrowed" ? "out" : "in";
        const vendor = loan.type === "borrowed" ? `Loan repayment to ${loan.person}` : `Loan repayment from ${loan.person}`;
        const tx = { date: payDate, vendor, category: "Loan", type: txType, amount: loan.emiAmount, account, id: "tx" + (nextTxId++) };
        TRANSACTIONS.push(tx);
        payment.linkTxId = tx.id;
      }
      loan.payments.push(payment);
    }
  }

  // Moves an EMI loan's due date forward by one month after an installment
  // is paid, so the app always shows and reminds about the *next* payment
  // rather than the one that was just cleared.
  function advanceEmiDueDate(loan){
    if (!loan.dueDate) return;
    const d = new Date(loan.dueDate + "T00:00:00");
    d.setMonth(d.getMonth() + 1);
    loan.dueDate = d.toISOString().slice(0, 10);
  }

  function emiInstallmentsPaid(loan){
    return (loan.payments || []).length;
  }

  function openLoanForm(id, forceEmi){
    openPanel("loanform"); // resets the form to a blank "new loan" state
    editingLoanId = null;
    document.getElementById("loanIsEmi").checked = !!forceEmi;
    document.getElementById("loanEmiAmount").value = "";
    document.getElementById("loanEmiTenure").value = "";
    document.getElementById("loanEmiMarkPastPaid").checked = true;
    toggleEmiFields();
    if (!id) return;
    const l = LOANS.find(x => x.id === id);
    if (!l) return;
    editingLoanId = id;
    setLoanType(l.type);
    document.getElementById("loanPerson").value = l.person;
    document.getElementById("loanPrincipal").value = l.principal;
    document.getElementById("loanDateGiven").value = l.dateGiven;
    document.getElementById("loanDueDate").value = l.dueDate || "";
    document.getElementById("loanInterestRate").value = l.interestRate || "";
    document.getElementById("loanInterestType").value = l.interestType || "none";
    document.getElementById("loanNotes").value = l.notes || "";
    document.getElementById("loanIsEmi").checked = !!l.isEmi;
    document.getElementById("loanEmiAmount").value = l.emiAmount || "";
    document.getElementById("loanEmiTenure").value = l.emiTenure || "";
    toggleEmiFields();
    const accSel = document.getElementById("loanAccount");
    accSel.value = l.account || ACCOUNT_LIST[0];
    // Editing changes the loan record itself, not the transaction already
    // recorded for it — re-checking this would double count the amount.
    // But if this loan was never linked to a transaction (e.g. it predates
    // this feature, or recording it was skipped/failed originally), let
    // the person add that missing income/expense entry now.
    if (l.linkTxId){
      document.getElementById("loanRecordTx").checked = false;
      document.getElementById("loanRecordTx").disabled = true;
      document.getElementById("loanRecordTxLabel").textContent = "Also record as a transaction, so it shows in your cash flow charts";
    } else {
      document.getElementById("loanRecordTx").checked = true;
      document.getElementById("loanRecordTx").disabled = false;
      document.getElementById("loanRecordTxLabel").textContent = "This loan isn't in your cash flow charts yet — check to add it now";
    }
    document.getElementById("loanSaveBtn").textContent = "Save changes";
  }

  function saveLoan(){
    const status = document.getElementById("loanFormStatus");
    const person = document.getElementById("loanPerson").value.trim();
    const principal = parseAmount(document.getElementById("loanPrincipal").value);
    const dateGiven = document.getElementById("loanDateGiven").value || null;
    const dueDate = document.getElementById("loanDueDate").value || null;
    const interestRate = document.getElementById("loanInterestRate").value ? parseAmount(document.getElementById("loanInterestRate").value) : 0;
    const interestType = document.getElementById("loanInterestType").value;
    const notes = document.getElementById("loanNotes").value.trim();
    const account = document.getElementById("loanAccount").value;
    const recordTx = document.getElementById("loanRecordTx").checked;
    const isEmi = document.getElementById("loanIsEmi").checked;
    const emiAmount = isEmi ? parseAmount(document.getElementById("loanEmiAmount").value) : null;
    const emiTenure = isEmi && document.getElementById("loanEmiTenure").value ? parseInt(document.getElementById("loanEmiTenure").value, 10) : null;

    if (!person){ status.textContent = "Enter a person's name."; status.className = "kh-manual-status err"; return; }
    if (principal === null || principal <= 0){ status.textContent = "Enter a valid amount."; status.className = "kh-manual-status err"; return; }
    if (!dateGiven){ status.textContent = "Pick the date given."; status.className = "kh-manual-status err"; return; }
    if (isEmi && (!emiAmount || emiAmount <= 0)){ status.textContent = "Enter the monthly EMI amount."; status.className = "kh-manual-status err"; return; }
    if (isEmi && !dueDate){ status.textContent = "Pick the next EMI due date."; status.className = "kh-manual-status err"; return; }

    if (editingLoanId){
      const l = LOANS.find(x => x.id === editingLoanId);
      if (l){
        Object.assign(l, { person, principal, dateGiven, dueDate, interestRate, interestType, notes, account, isEmi, emiAmount, emiTenure });
        // This loan predates being linked to a transaction (or that step
        // was skipped) — the checkbox is only enabled in that situation,
        // so if it's checked now, add the missing entry.
        if (recordTx && !l.linkTxId){
          const acct = account || ACCOUNT_LIST[0];
          ensureCategory("Loan");
          const txType = l.type === "borrowed" ? "in" : "out";
          const vendor = l.type === "borrowed" ? `Loan from ${person}` : `Loan to ${person}`;
          const tx = { date: dateGiven, vendor, category: "Loan", type: txType, amount: principal, account: acct, id: "tx" + (nextTxId++) };
          TRANSACTIONS.push(tx);
          l.linkTxId = tx.id;
          l.account = acct;
        }
      }
      showToast(`Updated loan with ${person}`);
    } else {
      const loan = {
        id: "loan" + (nextLoanId++), type: loanFormType, person, principal, dateGiven, dueDate,
        interestRate, interestType, notes, account, payments: [], linkTxId: null,
        isEmi, emiAmount, emiTenure,
      };
      if (recordTx){
        const acct = account || ACCOUNT_LIST[0];
        ensureCategory("Loan");
        const txType = loanFormType === "borrowed" ? "in" : "out";
        const vendor = loanFormType === "borrowed" ? `Loan from ${person}` : `Loan to ${person}`;
        const tx = { date: dateGiven, vendor, category: "Loan", type: txType, amount: principal, account: acct, id: "tx" + (nextTxId++) };
        TRANSACTIONS.push(tx);
        loan.linkTxId = tx.id;
        loan.account = acct;
      }
      LOANS.push(loan);

      let pastPaidCount = 0;
      if (isEmi && document.getElementById("loanEmiMarkPastPaid").checked){
        let elapsed = monthsElapsed(dateGiven, todayStr());
        if (emiTenure) elapsed = Math.min(elapsed, emiTenure);
        if (elapsed > 0){
          markPastEmiPaid(loan, elapsed, account || ACCOUNT_LIST[0], recordTx);
          pastPaidCount = elapsed;
        }
      }
      showToast(pastPaidCount
        ? `Added loan with ${person} — marked ${pastPaidCount} past installment${pastPaidCount === 1 ? "" : "s"} as paid`
        : `Added loan with ${person}`);
    }

    saveCurrentUser();
    renderAll();
    showLoanPage();
  }

  function deleteLoanUI(id){
    const l = LOANS.find(x => x.id === id);
    if (!l) return;
    if (!confirm(`Delete the loan with ${l.person}? This also removes any transactions recorded for it.`)) return;
    const linkedIds = [l.linkTxId, ...(l.payments || []).map(p => p.linkTxId)].filter(Boolean);
    if (linkedIds.length) TRANSACTIONS = TRANSACTIONS.filter(t => !linkedIds.includes(t.id));
    LOANS = LOANS.filter(x => x.id !== id);
    saveCurrentUser();
    renderAll();
    renderLoans();
    showToast(`Deleted loan with ${l.person}`);
  }

  function openLoanPayment(id){
    const l = LOANS.find(x => x.id === id);
    if (!l) return;
    payingLoanId = id;
    const { outstanding } = loanTotals(l);
    document.getElementById("loanPaymentContext").textContent = `${l.person} · ${l.type === "lent" ? "owes you" : "you owe"} ${rs(outstanding)} outstanding.`;
    document.getElementById("loanPaymentAmount").value = l.isEmi && l.emiAmount ? l.emiAmount : "";
    document.getElementById("loanPaymentDate").value = todayStr();
    document.getElementById("loanPaymentNote").value = "";
    const accSel = document.getElementById("loanPaymentAccount");
    accSel.innerHTML = ACCOUNT_LIST.map(n => `<option value="${n}">${n}</option>`).join("");
    accSel.value = l.account || ACCOUNT_LIST[0];
    document.getElementById("loanPaymentRecordTx").checked = true;
    document.getElementById("loanPaymentStatus").textContent = "";
    document.getElementById("loanPaymentStatus").className = "kh-manual-status";
    openPanel("loanpay");
  }

  // Shared by the payment form and the one-tap "quick pay" button, so both
  // paths log a payment, optionally record the matching transaction, and
  // advance an EMI's due date the same way.
  function applyLoanPayment(loan, amount, date, note, account, recordTx){
    const payment = { id: "pay" + Math.random().toString(36).slice(2, 9), date, amount, note: note || "", linkTxId: null };
    if (recordTx && account){
      ensureCategory("Loan");
      const txType = loan.type === "borrowed" ? "out" : "in";
      const vendor = loan.type === "borrowed" ? `Loan repayment to ${loan.person}` : `Loan repayment from ${loan.person}`;
      const tx = { date, vendor, category: "Loan", type: txType, amount, account, id: "tx" + (nextTxId++) };
      TRANSACTIONS.push(tx);
      payment.linkTxId = tx.id;
    }
    loan.payments = loan.payments || [];
    loan.payments.push(payment);

    let toastMsg = `Logged ${rs(amount)} payment`;
    if (loan.isEmi){
      advanceEmiDueDate(loan);
      const paidCount = emiInstallmentsPaid(loan);
      if (loan.emiTenure && paidCount >= loan.emiTenure){
        toastMsg = `Logged ${rs(amount)} — that's all ${loan.emiTenure} EMIs done! 🎉`;
      } else {
        toastMsg = `Logged ${rs(amount)} — next EMI due ${fmtDate(loan.dueDate)}`;
      }
    }
    return toastMsg;
  }

  // One-tap EMI payment: logs this month's exact EMI amount today, to the
  // loan's usual account, no form to fill in — for when nothing about this
  // month's payment differs from the plan.
  function quickPayEmi(id){
    const l = LOANS.find(x => x.id === id);
    if (!l || !l.isEmi || !l.emiAmount) return;
    const account = l.account || ACCOUNT_LIST[0];
    const toastMsg = applyLoanPayment(l, l.emiAmount, todayStr(), "Quick pay", account, true);
    saveCurrentUser();
    renderAll();
    showToast(toastMsg);
  }

  function saveLoanPayment(){
    const status = document.getElementById("loanPaymentStatus");
    const l = LOANS.find(x => x.id === payingLoanId);
    if (!l){ status.textContent = "Loan not found."; status.className = "kh-manual-status err"; return; }
    const amount = parseAmount(document.getElementById("loanPaymentAmount").value);
    const date = document.getElementById("loanPaymentDate").value || null;
    const account = document.getElementById("loanPaymentAccount").value;
    const note = document.getElementById("loanPaymentNote").value.trim();
    const recordTx = document.getElementById("loanPaymentRecordTx").checked;

    if (amount === null || amount <= 0){ status.textContent = "Enter a valid amount."; status.className = "kh-manual-status err"; return; }
    if (!date){ status.textContent = "Pick a date."; status.className = "kh-manual-status err"; return; }

    const toastMsg = applyLoanPayment(l, amount, date, note, account, recordTx);
    saveCurrentUser();
    renderAll();
    showToast(toastMsg);
    showLoanPage();
  }

  function toggleLoanCalc(){
    const el = document.getElementById("loanCalc");
    el.style.display = el.style.display === "none" ? "block" : "none";
    if (el.style.display === "block"){
      const dateEl = document.getElementById("calcStartDate");
      if (!dateEl.value) dateEl.value = todayStr();
      runLoanCalc();
    }
  }

  function monthsElapsed(startStr, endStr){
    const start = new Date(startStr + "T00:00:00");
    const end = new Date(endStr + "T00:00:00");
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (end.getDate() < start.getDate()) months -= 1;
    return Math.max(0, months);
  }

  function runLoanCalc(){
    const P = parseAmount(document.getElementById("calcPrincipal").value) || 0;
    const annualRate = parseAmount(document.getElementById("calcRate").value) || 0;
    const n = parseInt(document.getElementById("calcTenure").value, 10) || 0;
    const type = document.getElementById("calcType").value;
    const startDate = document.getElementById("calcStartDate").value || todayStr();
    const resEl = document.getElementById("loanCalcResult");
    const saveBtn = document.getElementById("loanCalcSaveBtn");
    if (!P || !n){
      resEl.innerHTML = `<div class="kh-empty">Enter the loan amount and tenure.</div>`;
      saveBtn.style.display = "none";
      lastLoanCalc = null;
      return;
    }

    let emi, totalPayment, totalInterest;
    const r = annualRate / 12 / 100;
    if (type === "reducing"){
      emi = r === 0 ? P / n : P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
      totalPayment = emi * n;
      totalInterest = totalPayment - P;
    } else {
      totalInterest = P * (annualRate / 100) * (n / 12);
      totalPayment = P + totalInterest;
      emi = totalPayment / n;
    }

    let html = `
      <div class="kh-loan-amounts">
        <div><span class="kh-loan-amt-label">Monthly payment</span><span class="kh-loan-amt-val">${rs(emi)}</span></div>
        <div><span class="kh-loan-amt-label">Total interest</span><span class="kh-loan-amt-val">${rs(totalInterest)}</span></div>
        <div><span class="kh-loan-amt-label">Total payment</span><span class="kh-loan-amt-val">${rs(totalPayment)}</span></div>
      </div>
    `;

    // If the first payment was in the past, show how far into the loan
    // today actually is — not just the fresh, day-one numbers above.
    const elapsed = monthsElapsed(startDate, todayStr());
    if (elapsed > 0){
      const paymentsMade = Math.min(elapsed, n);
      let remainingBalance;
      if (paymentsMade >= n){
        remainingBalance = 0;
      } else if (type === "reducing"){
        remainingBalance = r === 0
          ? P - emi * paymentsMade
          : P * (Math.pow(1 + r, n) - Math.pow(1 + r, paymentsMade)) / (Math.pow(1 + r, n) - 1);
      } else {
        remainingBalance = totalPayment - emi * paymentsMade;
      }
      const paidSoFar = emi * paymentsMade;
      html += paymentsMade >= n
        ? `<div class="kh-cat-hint" style="margin-top:10px; color:var(--in);">This loan's tenure is already up as of today — it should be fully paid off.</div>`
        : `<div class="kh-loan-amounts" style="margin-top:2px;">
            <div><span class="kh-loan-amt-label">Payments made</span><span class="kh-loan-amt-val">${paymentsMade} of ${n}</span></div>
            <div><span class="kh-loan-amt-label">Paid so far</span><span class="kh-loan-amt-val">${rs(paidSoFar)}</span></div>
            <div><span class="kh-loan-amt-label">Balance remaining</span><span class="kh-loan-amt-val">${rs(Math.max(0, remainingBalance))}</span></div>
          </div>`;
    }

    resEl.innerHTML = html;
    lastLoanCalc = { principal: P, annualRate, tenure: n, type, emi, startDate, elapsed: Math.min(elapsed, n) };
    saveBtn.style.display = "flex";
  }

  // Carries the last EMI-calculator result into the loan form so the user
  // can turn a "what would my EMI be" calculation directly into a tracked,
  // recurring-reminder loan without retyping the numbers.
  function saveCalcAsEmiLoan(){
    if (!lastLoanCalc) return;
    openLoanForm();
    setLoanType("borrowed");
    document.getElementById("loanPrincipal").value = Math.round(lastLoanCalc.principal);
    document.getElementById("loanDateGiven").value = lastLoanCalc.startDate || todayStr();
    const next = new Date((lastLoanCalc.startDate || todayStr()) + "T00:00:00");
    next.setMonth(next.getMonth() + (lastLoanCalc.elapsed || 0) + 1);
    document.getElementById("loanDueDate").value = next.toISOString().slice(0, 10);
    document.getElementById("loanInterestRate").value = lastLoanCalc.annualRate || "";
    document.getElementById("loanInterestType").value = lastLoanCalc.type === "reducing" ? "reducing" : "flat";
    document.getElementById("loanNotes").value = "EMI loan set up from the calculator";
    document.getElementById("loanIsEmi").checked = true;
    toggleEmiFields();
    document.getElementById("loanEmiAmount").value = Math.round(lastLoanCalc.emi);
    document.getElementById("loanEmiTenure").value = lastLoanCalc.tenure;
    document.getElementById("loanPerson").focus();
    showToast(lastLoanCalc.elapsed
      ? `Set up with ${lastLoanCalc.elapsed} payment(s) already accounted for — fill in who it's with`
      : "Fill in who it's with, then save to start monthly reminders");
  }

  // ---------------------------------------------------------------------
  // Budget — a monthly limit overall and/or per category, checked against
  // spending in the current Nepali (BS) month, matching how the rest of
  // the app already groups things by BS month.
  // ---------------------------------------------------------------------
  function currentBsMonthKey(){
    return bsMonthKey(new Date().toISOString().slice(0,10));
  }

  function currentBsMonthLabel(){
    const bs = adToBs(new Date().toISOString().slice(0,10));
    return `${NEPALI_MONTHS[bs.month - 1].name} ${bs.year}`;
  }

  // Shifts a BS year/month by `delta` months (can be negative), wrapping the
  // year correctly. Only used for bucketing transactions by month, so exact
  // day counts per BS month don't matter here.
  function shiftBsMonth(year, month, delta){
    const total = (year * 12 + (month - 1)) + delta;
    return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 };
  }

  function spendForMonthKey(key, category){
    return TRANSACTIONS
      .filter(t => t.type === "out" && !HIDDEN_ACCOUNTS.includes(t.account) && bsMonthKey(t.date) === key && (category ? t.category === category : true))
      .reduce((s,t) => s + t.amount, 0);
  }

  function spendThisMonth(category){
    return spendForMonthKey(currentBsMonthKey(), category);
  }

  function budgetBarColor(spent, limit){
    if (!limit || limit <= 0) return "var(--dim)";
    const pct = spent / limit;
    if (pct >= 1) return "var(--out)";
    if (pct >= 0.7) return "var(--accent)";
    return "var(--in)";
  }

  function setOverallBudget(){
    const val = parseFloat(document.getElementById("budgetOverallInput").value);
    if (!val || val <= 0){ showToast("Enter an amount first"); return; }
    BUDGET_OVERALL = val;
    saveCurrentUser();
    renderBudgetPage();
    renderBudgetDashCard();
    showToast("Overall budget saved");
  }

  function useIncomeAsBudget(){
    const income = parseFloat(PROFILE.monthlyIncome);
    if (!income || income <= 0){
      showToast("Add your Monthly Income in Settings → Account first");
      return;
    }
    BUDGET_OVERALL = income;
    document.getElementById("budgetOverallInput").value = income;
    saveCurrentUser();
    renderBudgetPage();
    renderBudgetDashCard();
    showToast("Using your monthly income as the overall budget");
  }

  function setCategoryBudget(name){
    const input = document.getElementById("budgetCatInput_" + cssSafe(name));
    const val = parseFloat(input.value);
    if (!val || val <= 0){ showToast("Enter an amount first"); return; }
    BUDGETS[name] = val;
    saveCurrentUser();
    renderBudgetPage();
    showToast(`Limit set for ${name}`);
  }

  function clearCategoryBudget(name){
    delete BUDGETS[name];
    saveCurrentUser();
    renderBudgetPage();
  }

  function cssSafe(s){
    return String(s).replace(/[^a-zA-Z0-9]/g, "_");
  }

  // JSON.stringify() always wraps a string in literal double quotes, which
  // breaks it out of a double-quoted HTML attribute (onclick="fn(\"x\")"
  // gets cut off at that inner quote — the attribute silently ends early
  // and the button does nothing). HTML-escape the JSON text before it goes
  // into an attribute so the browser un-escapes it back to the exact JS
  // source when the handler runs.
  function attrJson(v){
    return JSON.stringify(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }

  // null = auto-sort categories by this month's spend (most -> least);
  // an array = the user's own manual order, set from Settings -> Budget
  // Order. Persisted the same way as HOME_LAYOUT.
  let BUDGET_CATEGORY_ORDER = null;

  // How far into the *current Nepali (BS) month* today is, reusing the
  // same BS_MONTH_STARTS boundaries adToBs() is built on. Returns null if
  // it somehow can't be resolved (shouldn't normally happen).
  function bsMonthProgress(){
    const todayD = new Date(todayStr() + "T00:00:00Z");
    const adYear = todayD.getUTCFullYear();
    const candidates = [
      ...bsBoundariesForBaisakhYear(adYear - 1),
      ...bsBoundariesForBaisakhYear(adYear),
      ...bsBoundariesForBaisakhYear(adYear + 1),
    ].sort((a, b) => a.date - b.date);
    let idx = -1;
    for (let i = 0; i < candidates.length; i++){
      if (candidates[i].date <= todayD) idx = i; else break;
    }
    if (idx === -1 || idx + 1 >= candidates.length) return null;
    const start = candidates[idx].date, end = candidates[idx + 1].date;
    const daysTotal = Math.max(1, Math.round((end - start) / 86400000));
    const daysElapsed = Math.min(daysTotal, Math.round((todayD - start) / 86400000) + 1);
    return { daysElapsed, daysTotal };
  }

  // Renders the "day X of Y" pacing bar plus a projected month-end total,
  // based on the overall budget only (per-category pacing would get noisy
  // fast with small limits).
  function renderBudgetPace(spent, limit){
    const prog = bsMonthProgress();
    if (!limit || limit <= 0 || !prog) return "";
    const spentPct = Math.min(100, (spent / limit) * 100);
    const pacePct = Math.min(100, (prog.daysElapsed / prog.daysTotal) * 100);
    const projected = prog.daysElapsed > 0 ? (spent / prog.daysElapsed) * prog.daysTotal : spent;
    const overProjected = projected > limit;
    const aheadOfPace = spentPct <= pacePct;
    const noteColor = overProjected ? "var(--out)" : (aheadOfPace ? "var(--in)" : "var(--accent)");
    const noteText = overProjected
      ? `At this pace you'll spend ${rs(projected)} by month end — ${rs(projected - limit)} over your limit.`
      : `At this pace you'll finish around ${rs(projected)}, under your ${rs(limit)} limit.`;
    return `
      <div class="kh-budget-pace">
        <div class="kh-budget-pace-row">
          <span>Day ${prog.daysElapsed} of ${prog.daysTotal}</span>
          <span>${Math.round(spentPct)}% of budget used</span>
        </div>
        <div class="kh-budget-pace-track">
          <div class="kh-budget-pace-fill" style="width:${spentPct}%; background:${noteColor};"></div>
          <div class="kh-budget-pace-marker" style="left:${pacePct}%;"></div>
        </div>
        <div class="kh-budget-pace-note" style="color:${noteColor};">${noteText}</div>
      </div>`;
  }

  // Resolves the category name list to render on the Budget page, in the
  // right order — auto (this month's spend, highest first) or manual
  // (BUDGET_CATEGORY_ORDER, with any newly-added categories appended at
  // the end so nothing silently disappears from the list).
  function getOrderedCategoryNames(){
    const all = Object.keys(CAT);
    if (!BUDGET_CATEGORY_ORDER){
      return [...all].sort((a, b) => spendThisMonth(b) - spendThisMonth(a));
    }
    const valid = BUDGET_CATEGORY_ORDER.filter(n => all.includes(n));
    all.forEach(n => { if (!valid.includes(n)) valid.push(n); });
    BUDGET_CATEGORY_ORDER = valid;
    return valid;
  }

  function toggleBudgetAutoSort(){
    BUDGET_CATEGORY_ORDER = BUDGET_CATEGORY_ORDER ? null : getOrderedCategoryNames();
    saveCurrentUser();
    renderBudgetPage();
    renderBudgetOrderManager();
  }

  function moveBudgetCategory(name, dir){
    if (!BUDGET_CATEGORY_ORDER) return;
    const idx = BUDGET_CATEGORY_ORDER.indexOf(name);
    const swapIdx = idx + dir;
    if (idx === -1 || swapIdx < 0 || swapIdx >= BUDGET_CATEGORY_ORDER.length) return;
    [BUDGET_CATEGORY_ORDER[idx], BUDGET_CATEGORY_ORDER[swapIdx]] = [BUDGET_CATEGORY_ORDER[swapIdx], BUDGET_CATEGORY_ORDER[idx]];
    saveCurrentUser();
    renderBudgetOrderManager();
    renderBudgetPage();
  }

  function renderBudgetOrderManager(){
    const el = document.getElementById("budgetOrderList");
    const toggleBtn = document.getElementById("budgetSortToggle");
    if (!el || !toggleBtn) return;
    toggleBtn.textContent = BUDGET_CATEGORY_ORDER ? "↕ Manual order (tap to switch to auto)" : "🔥 Auto: most spent first (tap for manual)";
    toggleBtn.classList.toggle("active", !!BUDGET_CATEGORY_ORDER);
    if (!BUDGET_CATEGORY_ORDER){
      el.innerHTML = `<p class="kh-cat-hint" style="margin:8px 0 0;">Categories are ordered by this month's spending, highest first. Switch to manual to set a fixed order instead.</p>`;
      return;
    }
    const names = getOrderedCategoryNames();
    el.innerHTML = names.map((name, i) => {
      const meta = CAT[name] || CAT.Other;
      return `<div class="kh-layout-row">
        <span class="kh-layout-row-icon">${meta.icon}</span>
        <span class="kh-layout-row-label">${name}</span>
        <div class="kh-layout-row-btns">
          <button class="kh-layout-btn" onclick="moveBudgetCategory(${attrJson(name)}, -1)" ${i === 0 ? "disabled" : ""} title="Move up">↑</button>
          <button class="kh-layout-btn" onclick="moveBudgetCategory(${attrJson(name)}, 1)" ${i === names.length - 1 ? "disabled" : ""} title="Move down">↓</button>
        </div>
      </div>`;
    }).join("");
  }

  function renderBudgetPage(){
    const monthLabelEl = document.getElementById("budgetMonthLabel");
    if (monthLabelEl) monthLabelEl.textContent = currentBsMonthLabel() + " BS";

    const overallSpent = spendThisMonth(null);
    document.getElementById("budgetOverallAmt").textContent =
      BUDGET_OVERALL ? `${rs(overallSpent)} / ${rs(BUDGET_OVERALL)}` : rs(overallSpent);
    const overallBar = document.getElementById("budgetOverallBar");
    const overallPct = BUDGET_OVERALL ? Math.min(100, (overallSpent / BUDGET_OVERALL) * 100) : 0;
    overallBar.style.width = overallPct + "%";
    overallBar.style.background = budgetBarColor(overallSpent, BUDGET_OVERALL);
    document.getElementById("budgetOverallInput").value = BUDGET_OVERALL || "";
    const warnEl = document.getElementById("budgetOverallWarn");
    if (BUDGET_OVERALL && overallSpent >= BUDGET_OVERALL){
      warnEl.innerHTML = `<div class="kh-budget-warn" style="color:var(--out)">Over your overall budget by ${rs(overallSpent - BUDGET_OVERALL)}</div>`;
    } else if (BUDGET_OVERALL && overallSpent / BUDGET_OVERALL >= 0.7){
      warnEl.innerHTML = `<div class="kh-budget-warn" style="color:var(--accent)">Getting close — ${rs(BUDGET_OVERALL - overallSpent)} left this month</div>`;
    } else {
      warnEl.innerHTML = "";
    }
    const paceEl = document.getElementById("budgetPaceWrap");
    if (paceEl) paceEl.innerHTML = BUDGET_OVERALL ? renderBudgetPace(overallSpent, BUDGET_OVERALL) : "";

    const quickToggle = document.getElementById("budgetSortToggleQuick");
    if (quickToggle){
      quickToggle.textContent = BUDGET_CATEGORY_ORDER ? "↕ Manual order" : "🔥 Most spent first";
      quickToggle.classList.toggle("active", !!BUDGET_CATEGORY_ORDER);
    }

    const listEl = document.getElementById("budgetCatList");
    const cats = getOrderedCategoryNames();
    if (!cats.length){
      listEl.innerHTML = `<div class="kh-empty">No categories yet.</div>`;
      return;
    }
    listEl.innerHTML = cats.map(name => {
      const meta = CAT[name];
      const spent = spendThisMonth(name);
      const limit = BUDGETS[name];
      const pct = limit ? Math.min(100, (spent / limit) * 100) : 0;
      const color = budgetBarColor(spent, limit);
      const amtText = limit ? `${rs(spent)} / ${rs(limit)}` : `${rs(spent)} spent · no limit set`;
      const safe = cssSafe(name);
      return `<div class="kh-budget-row">
        <div class="kh-budget-row-top">
          <span class="kh-budget-row-icon" style="background:${meta.color}">${meta.icon}</span>
          <span class="kh-budget-row-name">${name}</span>
          <span class="kh-budget-row-amt">${amtText}</span>
        </div>
        <div class="kh-budget-bar-track"><div class="kh-budget-bar-fill" style="width:${limit ? pct : 0}%; background:${color};"></div></div>
        <div class="kh-budget-row-set">
          <input id="budgetCatInput_${safe}" type="number" min="0" step="any" placeholder="${limit ? "Update limit" : "Set a monthly limit"}" value="${limit || ""}" />
          <button type="button" class="kh-loan-btn" onclick="setCategoryBudget(${attrJson(name)})">Save</button>
          ${limit ? `<button type="button" class="kh-loan-btn kh-loan-btn-danger" onclick="clearCategoryBudget(${attrJson(name)})">Clear</button>` : ""}
        </div>
      </div>`;
    }).join("");
  }

  function renderBudgetDashCard(){
    const el = document.getElementById("budgetDashCard");
    if (!el) return;
    if (!BUDGET_OVERALL && !Object.keys(BUDGETS).length){
      el.innerHTML = `<div class="kh-loan-dash-empty">No budget set yet. <button type="button" class="kh-np-filter-clear" style="display:inline" onclick="showBudgetPage()">Set a budget →</button></div>`;
      return;
    }
    const spent = spendThisMonth(null);
    const color = budgetBarColor(spent, BUDGET_OVERALL);
    const amtText = BUDGET_OVERALL ? `${rs(spent)} / ${rs(BUDGET_OVERALL)}` : `${rs(spent)} spent this month`;
    const pct = BUDGET_OVERALL ? Math.min(100, (spent / BUDGET_OVERALL) * 100) : 0;
    el.innerHTML = `
      <div class="kh-loan-dash-top">
        <span class="kh-loan-dash-title">${currentBsMonthLabel()} budget</span>
        <button type="button" class="kh-loan-dash-link" onclick="showBudgetPage()">View all →</button>
      </div>
      <div style="margin-top:10px; font-family:'Plus Jakarta Sans',sans-serif; font-size:15px; font-weight:700;">${amtText}</div>
      <div class="kh-budget-bar-track"><div class="kh-budget-bar-fill" style="width:${pct}%; background:${color};"></div></div>
    `;
  }

  // ---------------------------------------------------------------------
  // Room expenses — shared-flat cost splitting.
  // Balances are always derived from ROOM_EXPENSES + ROOM_SETTLEMENTS
  // rather than stored, so they can never drift out of sync with the log.
  // ---------------------------------------------------------------------
  function computeRoomBalances(){
    const net = {};
    ROOMMATES.forEach(n => { net[n] = 0; });
    ROOM_EXPENSES.forEach(e => {
      const participants = (e.splitAmong && e.splitAmong.length)
        ? e.splitAmong.filter(n => ROOMMATES.includes(n))
        : ROOMMATES.slice();
      if (!participants.length) return;
      const share = e.amount / participants.length;
      participants.forEach(p => { net[p] = (net[p] || 0) - share; });
      net[e.paidBy] = (net[e.paidBy] || 0) + e.amount;
    });
    ROOM_SETTLEMENTS.forEach(s => {
      net[s.from] = (net[s.from] || 0) + s.amount;
      net[s.to] = (net[s.to] || 0) - s.amount;
    });
    return net;
  }

  // Greedily matches the biggest creditor against the biggest debtor each
  // round, which minimizes the number of settle-up transactions needed —
  // the same trick Splitwise uses instead of listing every pairwise debt.
  function simplifyRoomDebts(net){
    const creditors = [], debtors = [];
    Object.entries(net).forEach(([name, amt]) => {
      if (amt > 0.5) creditors.push({ name, amt });
      else if (amt < -0.5) debtors.push({ name, amt: -amt });
    });
    creditors.sort((a, b) => b.amt - a.amt);
    debtors.sort((a, b) => b.amt - a.amt);
    const settlements = [];
    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length){
      const c = creditors[ci], d = debtors[di];
      const amt = Math.min(c.amt, d.amt);
      settlements.push({ from: d.name, to: c.name, amount: amt });
      c.amt -= amt; d.amt -= amt;
      if (c.amt < 0.5) ci++;
      if (d.amt < 0.5) di++;
    }
    return settlements;
  }

  function renderRoomDashCard(){
    const el = document.getElementById("roomDashCard");
    if (!el) return;
    if (ROOMMATES.length < 2 && !ROOM_EXPENSES.length){
      el.innerHTML = `<div class="kh-loan-dash-empty">No room expenses tracked yet. <button type="button" class="kh-np-filter-clear" style="display:inline" onclick="showRoomPage()">Set up your room →</button></div>`;
      return;
    }
    const mine = computeRoomBalances()["Me"] || 0;
    const color = mine > 0.5 ? "var(--in)" : mine < -0.5 ? "var(--amber)" : "var(--dim)";
    const label = mine > 0.5 ? `You're owed ${rs(mine)}` : mine < -0.5 ? `You owe ${rs(-mine)}` : "You're all settled up";
    // Surface the same rent due date shown on the Room page, so it's
    // visible from Home without having to drill in.
    let dueHtml = "";
    if (ROOM_RENT.rentAmount){
      const dueDate = currentRentDueDate();
      const daysLeft = Math.round(daysBetween(todayStr(), dueDate));
      const duePillClass = daysLeft < 0 ? "kh-pill-amber" : daysLeft <= 5 ? "kh-pill-amber" : "kh-pill-dim";
      const dueLabel = daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Due today" : `Due in ${daysLeft}d`;
      dueHtml = `
        <div style="display:flex; align-items:center; gap:6px; margin-top:8px;">
          <span class="kh-pill ${duePillClass}">Rent · ${dueLabel}</span>
          <span class="kh-room-hero-sub" style="margin:0;">${bsLabel(dueDate)}</span>
        </div>
      `;
    }
    el.innerHTML = `
      <div class="kh-loan-dash-top">
        <span class="kh-loan-dash-title">Room expenses</span>
        <button type="button" class="kh-loan-dash-link" onclick="showRoomPage()">Manage →</button>
      </div>
      <div style="margin-top:10px; font-family:'Plus Jakarta Sans',sans-serif; font-size:15px; font-weight:700; color:${color}">${label}</div>
      ${dueHtml}
    `;
  }

  function renderRoommateManager(){
    const el = document.getElementById("roommateList");
    if (!el) return;
    el.innerHTML = ROOMMATES.map(name => {
      const isMe = name === "Me";
      const invited = !isMe && ROOMMATE_EMAILS[name];
      return `<div class="kh-roommate-card">
        ${!isMe ? `<button class="kh-roommate-remove" onclick="removeRoommate(${attrJson(name)})" title="Remove">✕</button>` : ""}
        <div class="kh-roommate-avatar${isMe ? " me" : ""}" style="background:${roommateColor(name)}">${isMe ? "🙋" : name.charAt(0).toUpperCase()}</div>
        <span class="kh-roommate-name">${roommateDisplayName(name)}${invited ? " ✉️" : ""}</span>
      </div>`;
    }).join("") + `<button type="button" class="kh-roommate-add-card" onclick="openPanel('roommate')" title="Add roommate">
      <div class="kh-roommate-avatar">＋</div>
      <span class="kh-roommate-name">Add</span>
    </button>`;
    renderRoomPaidBySelect();
    renderRoomSplitChecks();
  }

  function addRoommate(){
    const input = document.getElementById("roommateInput");
    const emailInput = document.getElementById("roommateEmailInput");
    const name = input.value.trim();
    const email = emailInput ? emailInput.value.trim() : "";
    if (!name) return;
    if (ROOMMATES.includes(name)){ showToast("Already added"); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showToast("That email doesn't look right"); return; }

    ROOMMATES.push(name);
    if (email) ROOMMATE_EMAILS[name] = email;
    input.value = "";
    if (emailInput) emailInput.value = "";
    renderRoommateManager();
    renderRoomBalances();
    closePanel();

    if (email){
      showToast(`Adding ${name} & sending invite…`);
      inviteRoommateByEmail(email, name)
        .then(() => { saveCurrentUser(); showToast(`Invited ${name} at ${email}`); })
        .catch(e => {
          console.warn("Kharcha: invite failed —", e);
          saveCurrentUser();
          showToast(`Added ${name}, but the invite email failed to send`);
        });
    } else {
      saveCurrentUser();
      showToast(`Added ${name}`);
    }
  }

  function removeRoommate(name){
    if (name === "Me") return;
    const net = computeRoomBalances();
    if (Math.abs(net[name] || 0) > 0.5){
      showToast(`Settle up with ${name} before removing them`);
      return;
    }
    const used = ROOM_EXPENSES.some(e => e.paidBy === name || (e.splitAmong || []).includes(name));
    if (used){
      showToast(`${name} is on past shared expenses — can't remove`);
      return;
    }
    ROOMMATES = ROOMMATES.filter(n => n !== name);
    delete ROOMMATE_EMAILS[name];
    saveCurrentUser();
    renderRoommateManager();
    renderRoomBalances();
  }

  function renderRoomPaidBySelect(){
    const sel = document.getElementById("roomExpPaidBy");
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = ROOMMATES.map(n => `<option value="${n}">${roommateDisplayName(n)}</option>`).join("");
    sel.value = ROOMMATES.includes(prev) ? prev : ROOMMATES[0];
    renderRoomLogToggle();
  }

  function renderRoomCategorySelect(){
    const sel = document.getElementById("roomExpCategory");
    if (!sel) return;
    const prev = sel.value;
    const names = Object.keys(CAT);
    sel.innerHTML = names.map(n => `<option value="${n}">${CAT[n].icon} ${n}</option>`).join("");
    sel.value = names.includes(prev) ? prev : (names.includes("Rent") ? "Rent" : names[0]);
  }

  // Whoever paid is excluded from this list — they're always in the split
  // automatically (that's their own share), so only the people who'd owe
  // the payer something need to be picked here. Preserves whatever the
  // person already checked/unchecked when the list re-renders (e.g. after
  // adding a roommate), instead of silently resetting everyone to checked.
  function renderRoomSplitChecks(){
    const el = document.getElementById("roomSplitChecks");
    const paidBySel = document.getElementById("roomExpPaidBy");
    if (!el || !paidBySel) return;
    const others = ROOMMATES.filter(n => n !== paidBySel.value);
    if (!others.length){
      el.innerHTML = `<p class="kh-cat-hint" style="margin:0;">Add another roommate above to split this with.</p>`;
      return;
    }
    const checked = {};
    el.querySelectorAll("input[type=checkbox]").forEach(cb => { checked[cb.value] = cb.checked; });
    el.innerHTML = others.map(n => `
      <label class="kh-cat-tag" style="cursor:pointer;">
        <input type="checkbox" value="${n}" ${(checked[n] !== undefined ? checked[n] : true) ? "checked" : ""} style="margin:0;" />
        ${roommateDisplayName(n)}
      </label>
    `).join("");
  }

  function renderRoomLogToggle(){
    const wrap = document.getElementById("roomLogToggleWrap");
    const paidBySel = document.getElementById("roomExpPaidBy");
    if (!wrap || !paidBySel) return;
    if (paidBySel.value !== "Me"){ wrap.innerHTML = ""; return; }
    wrap.innerHTML = `
      <label class="kh-cat-hint" style="display:flex; align-items:center; gap:8px; margin:10px 0 0; cursor:pointer;">
        <input type="checkbox" id="roomLogAsTx" checked style="margin:0;" />
        Also log this as my own expense, from
      </label>
      <select id="roomLogAccount" class="kh-cat-input" style="margin-top:6px; width:100%;">
        ${visibleAccounts().map(a => `<option value="${a}">${a}</option>`).join("")}
      </select>
    `;
  }

  function addRoomExpense(){
    const desc = document.getElementById("roomExpDesc").value.trim();
    const amount = parseFloat(document.getElementById("roomExpAmount").value);
    const category = document.getElementById("roomExpCategory").value || "Other";
    const paidBy = document.getElementById("roomExpPaidBy").value;
    const others = Array.from(document.querySelectorAll("#roomSplitChecks input:checked")).map(cb => cb.value);
    if (!paidBy){ showToast("Add a roommate first"); return; }
    if (!desc || !amount || amount <= 0){ showToast("Enter a description and amount"); return; }
    if (!others.length){ showToast("Pick at least one other roommate to split with"); return; }
    const splitAmong = [paidBy, ...others];
    ensureCategory(category);

    const logAsTx = paidBy === "Me" && document.getElementById("roomLogAsTx") && document.getElementById("roomLogAsTx").checked;
    let txId = null;
    if (logAsTx){
      const account = document.getElementById("roomLogAccount").value;
      txId = "tx" + (nextTxId++);
      TRANSACTIONS.push({ date: todayStr(), vendor: desc, category, type: "out", amount, account, id: txId });
    }
    ROOM_EXPENSES.unshift({ id: "rx" + (nextRoomExpenseId++), date: todayStr(), desc, category, amount, paidBy, splitAmong, txId });

    document.getElementById("roomExpDesc").value = "";
    document.getElementById("roomExpAmount").value = "";
    saveCurrentUser();
    renderRoomExpenseList();
    renderRoomBalances();
    renderRoomDashCard();
    if (logAsTx) renderAll();
    closePanel();
    showToast("Shared expense added");
  }

  function renderRoomExpenseList(){
    const el = document.getElementById("roomExpenseList");
    if (!el) return;
    const scoped = getScopedRoomExpenses();
    if (!scoped.length){
      el.innerHTML = `<div class="kh-empty">${ROOM_EXPENSES.length ? "No shared expenses in this month." : "No shared expenses logged yet."}</div>`;
      return;
    }
    el.innerHTML = scoped.map(e => {
      const meta = CAT[e.category] || CAT.Other;
      const otherSplitters = e.splitAmong.filter(n => n !== e.paidBy);
      const otherRoommates = ROOMMATES.filter(n => n !== e.paidBy);
      const splitLabel = otherSplitters.length && otherSplitters.length === otherRoommates.length ? "everyone else" : otherSplitters.map(roommateDisplayName).join(", ");
      return `<div class="kh-row">
        <div class="kh-row-icon" style="background:${meta.color}">${meta.icon}</div>
        <div class="kh-row-mid">
          <div class="kh-row-vendor">${e.desc}</div>
          <div class="kh-row-cat">Paid by ${roommateDisplayName(e.paidBy)} · split with ${splitLabel}</div>
        </div>
        <div class="kh-row-amt" style="color:var(--out)">${rs(e.amount)}</div>
        <button class="kh-row-del" onclick="deleteRoomExpense(${attrJson(e.id)})" title="Delete">✕</button>
      </div>`;
    }).join("");
  }

  function deleteRoomExpense(id){
    const idx = ROOM_EXPENSES.findIndex(e => e.id === id);
    if (idx === -1) return;
    const [removed] = ROOM_EXPENSES.splice(idx, 1);
    if (removed.txId){
      const txIdx = TRANSACTIONS.findIndex(t => t.id === removed.txId);
      if (txIdx !== -1) TRANSACTIONS.splice(txIdx, 1);
    }
    saveCurrentUser();
    renderRoomExpenseList();
    renderRoomBalances();
    renderRoomDashCard();
    if (removed.txId) renderAll();
    showToast("Removed");
  }

  function markRoomSettled(from, to, amount){
    ROOM_SETTLEMENTS.push({ id: "rs" + (nextRoomSettlementId++), date: todayStr(), from, to, amount });
    saveCurrentUser();
    renderRoomBalances();
    renderRoomDashCard();
    showToast(`Marked ${rs(amount)} settled between ${from} and ${to}`);
  }

  function renderRoomBalances(){
    const el = document.getElementById("roomBalances");
    if (!el) return;
    if (ROOMMATES.length < 2){
      el.innerHTML = `<div class="kh-empty">Add at least one roommate above to start splitting costs.</div>`;
      renderRoomHero(null);
      renderRoomRentCard();
      return;
    }
    const net = computeRoomBalances();
    const rows = ROOMMATES.map(name => {
      const amt = net[name] || 0;
      const pillClass = amt > 0.5 ? "kh-pill-jade" : amt < -0.5 ? "kh-pill-amber" : "kh-pill-dim";
      const label = amt > 0.5 ? `owed ${rs(amt)}` : amt < -0.5 ? `owes ${rs(-amt)}` : "settled up";
      return `<div class="kh-budget-row">
        <div class="kh-budget-row-top">
          <span class="kh-budget-row-icon" style="background:${roommateColor(name)}">${name.charAt(0).toUpperCase()}</span>
          <span class="kh-budget-row-name">${roommateDisplayName(name)}</span>
          <span class="kh-pill ${pillClass}">${label}</span>
        </div>
      </div>`;
    }).join("");
    renderRoomHero(net);
    renderRoomRentCard();
    const settlements = simplifyRoomDebts(net);
    const settleHtml = settlements.length ? `
      <p class="kh-cat-hint" style="margin:14px 2px 8px;">Settle up</p>
      ${settlements.map(s => `
        <div class="kh-budget-row">
          <div class="kh-budget-row-top">
            <span class="kh-budget-row-name">${roommateDisplayName(s.from)} → ${roommateDisplayName(s.to)}</span>
            <span class="kh-budget-row-amt">${rs(s.amount)}</span>
          </div>
          <div class="kh-budget-row-set">
            <button type="button" class="kh-loan-btn" style="width:100%; justify-content:center;" onclick="markRoomSettled(${attrJson(s.from)}, ${attrJson(s.to)}, ${s.amount})">Mark settled</button>
          </div>
        </div>
      `).join("")}
    ` : `<p class="kh-cat-hint" style="margin:14px 2px 0;">Everyone's settled up. 🎉</p>`;
    el.innerHTML = rows + settleHtml;
  }

  // ---------------------------------------------------------------------
  // Room rent & utilities — a recurring monthly bill on top of the
  // general shared-expense log above. One AD calendar month = one
  // billing cycle; "Log this month's rent" writes a normal Rent-category
  // ROOM_EXPENSE (so it's included in the balances/hero above too), and
  // this card additionally tracks, per roommate, whether THEIR share of
  // that specific bill has been paid — via ROOM_SETTLEMENTS entries that
  // carry an expenseId + payment method, not just a running net balance.
  // ---------------------------------------------------------------------
  function rentCycleKey(dateStr){ return String(dateStr).slice(0, 7); } // "YYYY-MM"
  function currentRentCycleKey(){ return rentCycleKey(todayStr()); }

  // The due day is a Nepali-calendar day (e.g. "1 Bhadra"), not an AD
  // day-of-month — rent is a Nepali-calendar-driven bill here. Resolves
  // against the CURRENT BS month first; once that date has passed, it
  // rolls forward to the same day in the NEXT BS month, so the target
  // date keeps moving forward on its own instead of going stale/overdue
  // forever once a cycle's due date has come and gone.
  function currentRentDueDate(){
    const day = Math.min(Math.max(1, parseInt(ROOM_RENT.dueDay, 10) || 1), 32);
    const todayBs = adToBs(todayStr());
    let due = bsToAd(todayBs.year, todayBs.month, day);
    if (due < todayStr()){
      const next = shiftBsMonth(todayBs.year, todayBs.month, 1);
      due = bsToAd(next.year, next.month, day);
    }
    return due;
  }

  function currentRentExpense(){
    const key = currentRentCycleKey();
    return ROOM_EXPENSES.find(e => e.category === "Rent" && rentCycleKey(e.date) === key) || null;
  }

  function openRentSetup(){
    document.getElementById("rentAmountInput").value = ROOM_RENT.rentAmount || "";
    document.getElementById("rentUtilitiesInput").value = ROOM_RENT.utilitiesAmount || "";
    document.getElementById("rentDueDayInput").value = ROOM_RENT.dueDay || 1;
    document.getElementById("rentLandlordName").value = ROOM_RENT.landlordName || "";
    document.getElementById("rentLandlordPhone").value = ROOM_RENT.landlordPhone || "";
    openPanel("rentsetup");
  }

  function saveRentSetup(){
    const rentAmount = parseFloat(document.getElementById("rentAmountInput").value) || 0;
    const utilitiesAmount = parseFloat(document.getElementById("rentUtilitiesInput").value) || 0;
    const dueDay = Math.min(Math.max(1, parseInt(document.getElementById("rentDueDayInput").value, 10) || 1), 32);
    if (!rentAmount){
      showToast("Enter a rent amount");
      return;
    }
    ROOM_RENT = {
      rentAmount, utilitiesAmount, dueDay,
      landlordName: document.getElementById("rentLandlordName").value.trim(),
      landlordPhone: document.getElementById("rentLandlordPhone").value.trim(),
    };
    saveCurrentUser();
    renderRoomRentCard();
    closePanel();
    showToast("Room rent saved");
  }

  // One tap: logs the flat total (rent + utilities) as a Rent shared
  // expense for this cycle, split equally among everyone, paid by
  // whoever the "Who paid the landlord?" select is set to.
  function logMonthlyRent(){
    if (currentRentExpense()){
      showToast("This month's rent is already logged below");
      return;
    }
    if (ROOMMATES.length < 2){
      showToast("Add at least one roommate first");
      return;
    }
    const total = (ROOM_RENT.rentAmount || 0) + (ROOM_RENT.utilitiesAmount || 0);
    if (!total){
      openRentSetup();
      return;
    }
    const payerSel = document.getElementById("rentPayerSelect");
    const paidBy = (payerSel && ROOMMATES.includes(payerSel.value)) ? payerSel.value : "Me";
    const others = ROOMMATES.filter(n => n !== paidBy);
    const desc = ROOM_RENT.utilitiesAmount ? "Room rent & utilities" : "Room rent";
    ensureCategory("Rent");

    let txId = null;
    if (paidBy === "Me"){
      const account = visibleAccounts()[0];
      if (account){
        txId = "tx" + (nextTxId++);
        TRANSACTIONS.push({ date: todayStr(), vendor: desc, category: "Rent", type: "out", amount: total, account, id: txId });
      }
    }
    ROOM_EXPENSES.unshift({ id: "rx" + (nextRoomExpenseId++), date: todayStr(), desc, category: "Rent", amount: total, paidBy, splitAmong: [paidBy, ...others], txId });
    saveCurrentUser();
    renderRoomExpenseList();
    renderRoomBalances();
    renderRoomDashCard();
    if (txId) renderAll();
    showToast(`Logged ${rs(total)} for ${roommateDisplayName(paidBy)}`);
  }

  // A roommate's share of THIS cycle's rent bill can be marked paid on
  // its own — separate from the general "Mark settled" flow above —
  // because it's common for a housemate to pay their landlord or the
  // payer directly (cash, Fonepay, etc.) outside the app; this just
  // records that it happened, with an optional note on how.
  function markRentSharePaid(roommate){
    const expense = currentRentExpense();
    if (!expense) return;
    const share = expense.amount / expense.splitAmong.length;
    const method = prompt(`How did ${roommateDisplayName(roommate)} pay their ${rs(share)} share?`, "Cash");
    if (method === null) return;
    ROOM_SETTLEMENTS.push({
      id: "rs" + (nextRoomSettlementId++), date: todayStr(),
      from: roommate, to: expense.paidBy, amount: share,
      method: method.trim() || "Cash", expenseId: expense.id,
    });
    saveCurrentUser();
    renderRoomBalances();
    renderRoomDashCard();
    showToast(`Marked ${roommateDisplayName(roommate)}'s rent share paid`);
  }

  // No messaging backend to send a real notification to a roommate, so
  // this hands the person a ready-to-send reminder instead — through the
  // OS share sheet on mobile, or the clipboard everywhere else.
  function nudgeRoommate(roommate, share){
    const msg = `Hey ${roommateDisplayName(roommate)} — friendly reminder: your room rent share of ${rs(share)} for ${currentBsMonthLabel()} is still pending. Thanks!`;
    if (navigator.share){
      navigator.share({ text: msg }).catch(() => {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(msg)
        .then(() => showToast(`Reminder copied — paste it to ${roommateDisplayName(roommate)}`))
        .catch(() => showToast(msg));
      return;
    }
    showToast(msg);
  }

  function renderRoomRentCard(){
    const el = document.getElementById("roomRentCard");
    if (!el) return;

    if (!ROOM_RENT.rentAmount){
      el.innerHTML = `
        <p class="kh-room-hero-label">Room rent</p>
        <p class="kh-room-hero-sub" style="margin-top:6px;">Set up your monthly rent & utilities once, and this card will split it, track the due date, and show who's paid.</p>
        <button type="button" class="kh-manual-btn" style="margin-top:12px;" onclick="openRentSetup()">＋ Set up room rent</button>
      `;
      return;
    }

    const total = ROOM_RENT.rentAmount + (ROOM_RENT.utilitiesAmount || 0);
    const dueDate = currentRentDueDate();
    const daysLeft = Math.round(daysBetween(todayStr(), dueDate));
    const duePillClass = daysLeft < 0 ? "kh-pill-amber" : daysLeft <= 5 ? "kh-pill-amber" : "kh-pill-dim";
    const dueLabel = daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Due today" : `Due in ${daysLeft}d`;
    const expense = currentRentExpense();
    const shareCount = expense ? expense.splitAmong.length : Math.max(ROOMMATES.length, 1);
    // Once this cycle's rent is logged, shares must be derived from that
    // expense's actual amount — not from ROOM_RENT's current settings,
    // which may have been edited since (e.g. rent went up next cycle).
    // Otherwise the per-person "share" shown here drifts out of sync with
    // what markRentSharePaid() records and what computeRoomBalances() uses,
    // so the displayed amounts (and "settled" totals) stop matching reality.
    const yourShare = expense ? (expense.amount / shareCount) : (total / shareCount);

    const landlordHtml = ROOM_RENT.landlordName ? `
      <div class="kh-landlord-card">
        <div class="kh-roommate-avatar" style="width:44px;height:44px;font-size:15px;background:#4B5563">${ROOM_RENT.landlordName.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase()}</div>
        <div class="kh-landlord-info">
          <p class="kh-landlord-name">${ROOM_RENT.landlordName}</p>
          <p class="kh-landlord-role">Flat owner / landlord</p>
        </div>
        <div class="kh-landlord-actions">
          ${ROOM_RENT.landlordPhone ? `<a class="kh-landlord-call" href="tel:${ROOM_RENT.landlordPhone}" title="Call">📞 Call</a>` : ""}
        </div>
      </div>
    ` : "";

    let bodyHtml;
    if (!expense){
      bodyHtml = `
        <div class="kh-rent-share-grid">
          <div><p class="kh-rent-share-label">Your share (1/${shareCount})</p><p class="kh-rent-share-val">${rs(yourShare)}</p></div>
          <div><p class="kh-rent-share-label">Target date</p><p class="kh-rent-share-val">${bsLabel(dueDate)}</p></div>
        </div>
        ${landlordHtml}
        ${ROOMMATES.length > 1 ? `
          <p class="kh-cat-hint" style="margin:14px 0 4px;">Who paid the landlord?</p>
          <select id="rentPayerSelect" class="kh-cat-input" style="width:100%;">
            ${ROOMMATES.map(n => `<option value="${n}">${roommateDisplayName(n)}</option>`).join("")}
          </select>
        ` : ""}
        <button type="button" class="kh-manual-btn" style="width:100%; justify-content:center; margin-top:12px;" onclick="logMonthlyRent()">＋ Log this month's rent</button>
      `;
    } else {
      const rows = expense.splitAmong.map(name => {
        const isPayer = name === expense.paidBy;
        const settlement = !isPayer ? ROOM_SETTLEMENTS.find(s => s.expenseId === expense.id && s.from === name) : null;
        const badge = isPayer
          ? `<span class="kh-pill kh-pill-jade">Payer</span>`
          : settlement ? `<span class="kh-pill kh-pill-jade">Settled ✓</span>` : `<span class="kh-pill kh-pill-amber">Unpaid</span>`;
        const sub = isPayer
          ? `Paid full bill (${rs(expense.amount)})`
          : settlement ? `Paid via ${settlement.method} on ${bsLabel(settlement.date)}`
          : name === "Me" ? "You owe your room share" : "Owes their room share";
        const amtLabel = isPayer ? "Self covered" : rs(yourShare);
        const actions = (isPayer || settlement) ? "" : name === "Me" ? `
          <div class="kh-rent-person-actions">
            <button type="button" class="kh-rent-paid-btn" onclick="markRentSharePaid('Me')">✓ I've paid</button>
          </div>
        ` : `
          <div class="kh-rent-person-actions">
            <button type="button" class="kh-rent-nudge-btn" onclick="nudgeRoommate(${attrJson(name)}, ${yourShare})">🔔 Nudge</button>
            <button type="button" class="kh-rent-paid-btn" onclick="markRentSharePaid(${attrJson(name)})">✓ Mark paid</button>
          </div>
        `;
        return `<div class="kh-budget-row">
          <div class="kh-budget-row-top">
            <span class="kh-budget-row-icon" style="background:${roommateColor(name)}">${name.charAt(0).toUpperCase()}</span>
            <span class="kh-budget-row-name">${roommateDisplayName(name)}</span>
            ${badge}
          </div>
          <div class="kh-rent-person-sub">${sub} · <b style="color:var(--text)">${amtLabel}</b></div>
          ${actions}
        </div>`;
      }).join("");
      bodyHtml = `
        <div class="kh-rent-share-grid">
          <div><p class="kh-rent-share-label">Your share (1/${shareCount})</p><p class="kh-rent-share-val">${rs(yourShare)}</p></div>
          <div><p class="kh-rent-share-label">Target date</p><p class="kh-rent-share-val">${bsLabel(dueDate)}</p></div>
        </div>
        ${landlordHtml}
        <div class="kh-rent-splits-top">
          <p class="kh-cat-title" style="margin:0;">Roommate splits</p>
          <span class="kh-pill kh-pill-dim">${shareCount} people</span>
        </div>
        ${rows}
      `;
    }

    el.innerHTML = `
      <div class="kh-rent-card-top">
        <p class="kh-room-hero-label">Current billing cycle</p>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="kh-pill ${duePillClass}">${dueLabel}</span>
          <button type="button" class="kh-rent-edit-btn" onclick="openRentSetup()" title="Edit rent, utilities, due date & landlord details">✎ Edit</button>
        </div>
      </div>
      <p class="kh-room-hero-label" style="margin-top:8px; text-transform:none; font-weight:600;">Total flat rent & utilities</p>
      <p class="kh-rent-card-amt">${rs(total)}</p>
      ${bodyHtml}
    `;
  }

  function setRoomNepaliMonthFilter(key){
    activeRoomNepaliMonth = key;
    renderRoomNepaliMonthFilter();
    renderRoomExpenseList();
    renderRoomBalances();
  }

  function renderRoomNepaliMonthFilter(){
    const el = document.getElementById("roomNpMonthFilter");
    if (!el) return;
    const seen = new Map();
    const todayBs = adToBs(todayStr());
    seen.set(`${todayBs.year}-${todayBs.month}`, { y: todayBs.year, m: todayBs.month, label: `${NEPALI_MONTHS[todayBs.month - 1].name} ${todayBs.year}` });
    ROOM_EXPENSES.forEach(e => {
      const bs = adToBs(e.date);
      const key = `${bs.year}-${bs.month}`;
      if (!seen.has(key)) seen.set(key, { y: bs.year, m: bs.month, label: `${NEPALI_MONTHS[bs.month - 1].name} ${bs.year}` });
    });
    const months = [...seen.values()].sort((a, b) => (a.y - b.y) || (a.m - b.m));
    el.innerHTML = `<option value="All">All months</option>` +
      months.map(mo => `<option value="${mo.y}-${mo.m}">${mo.label}</option>`).join("");
    el.value = (activeRoomNepaliMonth === "All" || months.some(mo => `${mo.y}-${mo.m}` === activeRoomNepaliMonth))
      ? activeRoomNepaliMonth
      : currentBsMonthKey();
    activeRoomNepaliMonth = el.value;
  }

  function renderRoomHero(net){
    const el = document.getElementById("roomHeroCard");
    if (!el) return;
    if (!net){
      el.innerHTML = `<p class="kh-room-hero-label">Your room balance</p><p class="kh-room-hero-amt" style="color:var(--dim)">—</p><p class="kh-room-hero-sub">Add roommates to start splitting shared costs</p>`;
      return;
    }
    const totalShared = getScopedRoomExpenses().reduce((s, e) => s + e.amount, 0);
    const mine = net["Me"] || 0;
    const pillClass = mine > 0.5 ? "kh-pill-jade" : mine < -0.5 ? "kh-pill-amber" : "kh-pill-dim";
    const label = mine > 0.5 ? `You're owed ${rs(mine)}` : mine < -0.5 ? `You owe ${rs(-mine)}` : "You're settled up";
    el.innerHTML = `
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
        <p class="kh-room-hero-label">Total shared this cycle</p>
        <span class="kh-pill ${pillClass}">${label}</span>
      </div>
      <p class="kh-room-hero-amt">${rs(totalShared)}</p>
      <p class="kh-room-hero-sub">Split across ${ROOMMATES.length} roommate${ROOMMATES.length === 1 ? "" : "s"}</p>
    `;
  }

  function showRoomPage(){
    closePanel();
    showPage("room");
    applyRoomLayout();
    renderRoommateManager();
    renderRoomCategorySelect();
    renderRoomNepaliMonthFilter();
    renderRoomExpenseList();
    renderRoomBalances();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------------------------------------------------------------------
  // Recurring bills — Netflix, wifi, gym, etc. Reuses the exact BS-due-day
  // rollover math ROOM_RENT uses (self-contained here rather than shared,
  // so editing one can't accidentally break the other), but each item
  // logs straight into TRANSACTIONS as a normal personal expense instead
  // of a shared ROOM_EXPENSE.
  // ---------------------------------------------------------------------
  function recurringCycleKey(dateStr){ return String(dateStr).slice(0, 7); } // "YYYY-MM"
  function currentRecurringCycleKey(){ return recurringCycleKey(todayStr()); }

  function recurringDueDate(dueDay){
    const day = Math.min(Math.max(1, parseInt(dueDay, 10) || 1), 32);
    const todayBs = adToBs(todayStr());
    let due = bsToAd(todayBs.year, todayBs.month, day);
    if (due < todayStr()){
      const next = shiftBsMonth(todayBs.year, todayBs.month, 1);
      due = bsToAd(next.year, next.month, day);
    }
    return due;
  }

  function recurringLoggedTx(item){
    const key = currentRecurringCycleKey();
    return TRANSACTIONS.find(t => t.recurringId === item.id && recurringCycleKey(t.date) === key) || null;
  }

  function renderRecurringCategorySelect(){
    const sel = document.getElementById("recurringCategory");
    if (!sel) return;
    const prev = sel.value;
    const names = Object.keys(CAT);
    sel.innerHTML = names.map(n => `<option value="${n}">${CAT[n].icon} ${n}</option>`).join("");
    sel.value = names.includes(prev) ? prev : names[0];
  }

  function renderRecurringAccountSelect(){
    const sel = document.getElementById("recurringAccount");
    if (!sel) return;
    const prev = sel.value;
    const accounts = visibleAccounts();
    sel.innerHTML = accounts.map(a => `<option value="${a}">${a}</option>`).join("");
    if (accounts.includes(prev)) sel.value = prev;
  }

  function openRecurringForm(id){
    editingRecurringId = id || null;
    const item = id ? RECURRING.find(r => r.id === id) : null;
    renderRecurringCategorySelect();
    renderRecurringAccountSelect();
    document.getElementById("recurringName").value = item ? item.name : "";
    document.getElementById("recurringAmount").value = item ? item.amount : "";
    document.getElementById("recurringDueDay").value = item ? item.dueDay : 1;
    if (item){
      document.getElementById("recurringCategory").value = item.category;
      document.getElementById("recurringAccount").value = item.account;
    }
    document.getElementById("panelRecurringTitle").textContent = item ? "Edit recurring bill" : "Add recurring bill";
    document.getElementById("recurringSaveBtn").textContent = item ? "Save changes" : "Add recurring bill";
    openPanel("recurring");
  }

  function saveRecurringForm(){
    const name = document.getElementById("recurringName").value.trim();
    const amount = parseFloat(document.getElementById("recurringAmount").value);
    const category = document.getElementById("recurringCategory").value || "Other";
    const account = document.getElementById("recurringAccount").value;
    const dueDay = Math.min(Math.max(1, parseInt(document.getElementById("recurringDueDay").value, 10) || 1), 32);
    if (!name){ showToast("Enter a name"); return; }
    if (!amount || amount <= 0){ showToast("Enter a valid amount"); return; }
    if (!account){ showToast("Add an account first"); return; }
    ensureCategory(category);
    ensureAccount(account);
    if (editingRecurringId){
      const item = RECURRING.find(r => r.id === editingRecurringId);
      if (item) Object.assign(item, { name, amount, category, account, dueDay });
    } else {
      RECURRING.push({ id: "rc" + (nextRecurringId++), name, amount, category, account, dueDay });
    }
    editingRecurringId = null;
    saveCurrentUser();
    renderRecurringList();
    renderRecurringDashCard();
    closePanel();
    showToast("Saved");
  }

  function deleteRecurringItem(id){
    RECURRING = RECURRING.filter(r => r.id !== id);
    saveCurrentUser();
    renderRecurringList();
    renderRecurringDashCard();
    showToast("Removed — past logged transactions for it are kept");
  }

  function logRecurringItem(id){
    const item = RECURRING.find(r => r.id === id);
    if (!item) return;
    if (recurringLoggedTx(item)){ showToast("Already logged this month"); return; }
    ensureCategory(item.category);
    ensureAccount(item.account);
    const txId = "tx" + (nextTxId++);
    TRANSACTIONS.push({ date: todayStr(), vendor: item.name, category: item.category, type: "out", amount: item.amount, account: item.account, id: txId, recurringId: item.id });
    saveCurrentUser();
    renderRecurringList();
    renderRecurringDashCard();
    renderAll();
    showToast(`Logged ${rs(item.amount)} for ${item.name}`);
  }

  function renderRecurringList(){
    const el = document.getElementById("recurringList");
    if (!el) return;
    if (!RECURRING.length){
      el.innerHTML = `<div class="kh-empty">No recurring bills yet. Add Netflix, wifi, gym — whatever repeats every month.</div>`;
      return;
    }
    el.innerHTML = RECURRING.map(item => {
      const meta = CAT[item.category] || CAT.Other;
      const due = recurringDueDate(item.dueDay);
      const daysLeft = Math.round(daysBetween(todayStr(), due));
      const duePillClass = daysLeft <= 3 ? "kh-pill-amber" : "kh-pill-dim";
      const dueLabel = daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Due today" : `Due in ${daysLeft}d`;
      const logged = recurringLoggedTx(item);
      return `<div class="kh-budget-row">
        <div class="kh-budget-row-top">
          <span class="kh-budget-row-icon" style="background:${meta.color}">${meta.icon}</span>
          <span class="kh-budget-row-name">${item.name}</span>
          <span class="kh-budget-row-amt">${rs(item.amount)}</span>
        </div>
        <div class="kh-recurring-sub">${bsLabel(due)} <span class="kh-pill ${duePillClass}">${dueLabel}</span></div>
        <div class="kh-recurring-actions">
          ${logged ? `<span class="kh-pill kh-pill-jade">✓ Logged this month</span>` : `<button type="button" class="kh-rent-paid-btn" onclick="logRecurringItem(${attrJson(item.id)})">＋ Log this month's ${item.name}</button>`}
          <div style="display:flex; gap:6px;">
            <button type="button" class="kh-row-del" onclick="openRecurringForm(${attrJson(item.id)})" title="Edit">✎</button>
            <button type="button" class="kh-row-del" onclick="deleteRecurringItem(${attrJson(item.id)})" title="Delete">✕</button>
          </div>
        </div>
      </div>`;
    }).join("");
  }

  function renderRecurringDashCard(){
    const el = document.getElementById("recurringDashCard");
    if (!el) return;
    if (!RECURRING.length){
      el.innerHTML = `<div class="kh-loan-dash-empty">No recurring bills tracked yet. <button type="button" class="kh-np-filter-clear" style="display:inline" onclick="showRecurringPage()">Add subscriptions &amp; bills →</button></div>`;
      return;
    }
    const totalMonthly = RECURRING.reduce((s, r) => s + r.amount, 0);
    const unlogged = RECURRING.filter(r => !recurringLoggedTx(r));
    el.innerHTML = `
      <div class="kh-loan-dash-top">
        <span class="kh-loan-dash-title">Recurring bills</span>
        <button type="button" class="kh-loan-dash-link" onclick="showRecurringPage()">View all →</button>
      </div>
      <div style="margin-top:10px; font-family:'Plus Jakarta Sans',sans-serif; font-size:15px; font-weight:700;">${rs(totalMonthly)}/month</div>
      <div style="margin-top:4px; font-size:12px; color:var(--dim);">${unlogged.length ? `${unlogged.length} not logged yet this month` : "All logged for this month ✓"}</div>
    `;
  }

  function showRecurringPage(){
    closePanel();
    showPage("recurring");
    renderRecurringList();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderInsightsPage(){
    const cur = adToBs(new Date().toISOString().slice(0,10));
    const curKey = `${cur.year}-${cur.month}`;
    const prev = shiftBsMonth(cur.year, cur.month, -1);
    const prevKey = `${prev.year}-${prev.month}`;
    const curSpend = spendForMonthKey(curKey);
    const prevSpend = spendForMonthKey(prevKey);

    document.getElementById("momCurLabel").textContent = NEPALI_MONTHS[cur.month - 1].name + " " + cur.year;
    document.getElementById("momPrevLabel").textContent = NEPALI_MONTHS[prev.month - 1].name + " " + prev.year;
    document.getElementById("momCurAmt").textContent = rs(curSpend);
    document.getElementById("momPrevAmt").textContent = rs(prevSpend);

    const deltaEl = document.getElementById("momDelta");
    if (prevSpend === 0){
      deltaEl.innerHTML = curSpend === 0
        ? `<div class="kh-mom-delta" style="color:var(--dim)">No spending recorded yet</div>`
        : `<div class="kh-mom-delta" style="color:var(--dim)">No spending last month to compare against</div>`;
    } else {
      const pctChange = ((curSpend - prevSpend) / prevSpend) * 100;
      const up = pctChange > 0;
      const color = Math.abs(pctChange) < 1 ? "var(--dim)" : (up ? "var(--out)" : "var(--in)");
      const arrow = Math.abs(pctChange) < 1 ? "→" : (up ? "↑" : "↓");
      deltaEl.innerHTML = `<div class="kh-mom-delta" style="color:${color}">${arrow} ${Math.abs(pctChange).toFixed(0)}% ${up ? "more" : "less"} than last month</div>`;
    }

    // Last 6 real BS months, oldest to newest, so trends don't skip months
    // that happen to have no transactions.
    const months = [];
    for (let i = 5; i >= 0; i--){
      const m = shiftBsMonth(cur.year, cur.month, -i);
      const key = `${m.year}-${m.month}`;
      months.push({ key, label: NEPALI_MONTHS[m.month - 1].name.slice(0,3) + " " + String(m.year).slice(-2), amt: spendForMonthKey(key) });
    }
    const maxAmt = Math.max(1, ...months.map(m => m.amt));
    document.getElementById("trendChart").innerHTML = months.map(m => `
      <div class="kh-trend-col">
        <div class="kh-trend-amt">${m.amt > 0 ? rs(m.amt) : ""}</div>
        <div class="kh-trend-bar" style="height:${Math.max(2, (m.amt / maxAmt) * 100)}%; background:${m.key === curKey ? "var(--accent)" : "var(--surface2)"};"></div>
        <div class="kh-trend-label">${m.label}</div>
      </div>
    `).join("");

    // Biggest categories this month.
    const catTotals = {};
    TRANSACTIONS.filter(t => t.type === "out" && !HIDDEN_ACCOUNTS.includes(t.account) && bsMonthKey(t.date) === curKey)
      .forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });
    const catAllRanked = Object.entries(catTotals).sort((a,b) => b[1] - a[1]);
    const catGrandTotal = catAllRanked.reduce((s,[,v]) => s + v, 0) || 1;
    const catRanked = catAllRanked.slice(0, 6);

    const pieEl = document.getElementById("topCategoriesPie");
    if (!catAllRanked.length){
      pieEl.innerHTML = "";
    } else {
      // Top 5 slices, with anything beyond that folded into "Other" so the
      // pie stays readable even with a long tail of small categories.
      const top5 = catAllRanked.slice(0, 5).map(([name, value]) => ({ name, value, color: CAT[name]?.color || "#9aa0ac" }));
      const otherTotal = catAllRanked.slice(5).reduce((s,[,v]) => s + v, 0);
      const pieData = otherTotal > 0 ? [...top5, { name: "Other", value: otherTotal, color: "#9aa0ac" }] : top5;
      let angle = 0;
      const stops = pieData.map(d => {
        const start = angle;
        angle += (d.value / catGrandTotal) * 360;
        return `${d.color} ${start}deg ${angle}deg`;
      }).join(", ");
      pieEl.innerHTML = `
        <div class="kh-pie-wrap"><div class="kh-pie" style="width:150px; height:150px; background:conic-gradient(${stops})"></div></div>
        <div class="kh-legend">
          ${pieData.map(d => `
            <div class="kh-legend-row">
              <span class="kh-legend-dot" style="background:${d.color}"></span>
              <span class="kh-legend-name">${d.name}</span>
              <span class="kh-legend-amt">${rs(d.value)}</span>
              <span class="kh-legend-pct">${Math.round((d.value / catGrandTotal) * 100)}%</span>
            </div>
          `).join("")}
        </div>
      `;
    }

    const catEl = document.getElementById("topCategories");
    catEl.innerHTML = catRanked.length ? catRanked.map(([name, amt], i) => `
      <div class="kh-rank-row">
        <span class="kh-rank-num">${i + 1}</span>
        <div class="kh-rank-mid">
          <div class="kh-rank-name">${name}</div>
          <div class="kh-rank-sub">${Math.round((amt / catGrandTotal) * 100)}% of this month's spending</div>
        </div>
        <span class="kh-rank-amt">${rs(amt)}</span>
      </div>
    `).join("") : `<div class="kh-empty">No spending recorded this month yet.</div>`;

    // Top vendors, all time.
    const vendorTotals = {};
    TRANSACTIONS.filter(t => t.type === "out" && !HIDDEN_ACCOUNTS.includes(t.account))
      .forEach(t => {
        if (!vendorTotals[t.vendor]) vendorTotals[t.vendor] = { amt: 0, count: 0 };
        vendorTotals[t.vendor].amt += t.amount;
        vendorTotals[t.vendor].count += 1;
      });
    const vendorRanked = Object.entries(vendorTotals).sort((a,b) => b[1].amt - a[1].amt).slice(0, 6);
    const vendorEl = document.getElementById("topVendors");
    vendorEl.innerHTML = vendorRanked.length ? vendorRanked.map(([name, v], i) => `
      <div class="kh-rank-row">
        <span class="kh-rank-num">${i + 1}</span>
        <div class="kh-rank-mid">
          <div class="kh-rank-name">${name}</div>
          <div class="kh-rank-sub">${v.count} transaction${v.count === 1 ? "" : "s"}</div>
        </div>
        <span class="kh-rank-amt">${rs(v.amt)}</span>
      </div>
    `).join("") : `<div class="kh-empty">No transactions recorded yet.</div>`;
  }


  // Plain stroke-line icons (matching the rest of the app's iconography)
  // instead of the 👁/🙈 emoji, which render inconsistently across
  // platforms and look out of place next to the app's other SVG icons.
  const ICON_EYE = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>`;
  const ICON_EYE_OFF = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M9.4 5.4A10.9 10.9 0 0 1 12 5c7 0 10.5 7 10.5 7a13.9 13.9 0 0 1-3.15 3.9M6.5 6.6C3.6 8.4 1.5 12 1.5 12s3.5 7 10.5 7a10.6 10.6 0 0 0 3.4-.56" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  function getBalanceHidden(){
    try{ return localStorage.getItem("kh_balance_hidden") === "1"; }catch(e){ return false; }
  }
  function toggleBalanceVisibility(){
    const hidden = !getBalanceHidden();
    try{ localStorage.setItem("kh_balance_hidden", hidden ? "1" : "0"); }catch(e){}
    renderBalanceCard();
  }

  // Count-up/down number animation, shared by the Total Balance figure and
  // the Money in / Money out / Net stat cards.
  //
  // Previous values live in a keyed store (PREV_AMOUNTS) rather than on
  // the element: renderStats() rebuilds its cards via innerHTML on every
  // render, so an element-level property would be lost each time and the
  // number would re-count from zero on every refresh. Keying by a stable
  // name means a re-render animates from whatever was last shown to the
  // new value (a small, quiet delta), while the very first render — no
  // previous value yet — counts up from 0, which is the moment the effect
  // is actually expected. `format` turns a raw number into display text,
  // so signed/unsigned variants don't need separate copies of this.
  const PREV_AMOUNTS = {};
  const AMOUNT_ANIM_FRAMES = {};
  const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function cancelAmountAnimation(key){
    if (AMOUNT_ANIM_FRAMES[key]) cancelAnimationFrame(AMOUNT_ANIM_FRAMES[key]);
    AMOUNT_ANIM_FRAMES[key] = null;
  }

  function animateAmount(el, key, to, format){
    const from = PREV_AMOUNTS[key] != null ? PREV_AMOUNTS[key] : 0;
    cancelAmountAnimation(key);
    PREV_AMOUNTS[key] = to;
    if (REDUCED_MOTION || Math.abs(to - from) < 1){
      el.textContent = format(to);
      return;
    }
    const duration = 750;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic — fast start, gentle settle
      el.textContent = format(from + (to - from) * eased);
      if (t < 1){
        AMOUNT_ANIM_FRAMES[key] = requestAnimationFrame(step);
      } else {
        el.textContent = format(to);
        AMOUNT_ANIM_FRAMES[key] = null;
      }
    };
    AMOUNT_ANIM_FRAMES[key] = requestAnimationFrame(step);
  }

  function renderBalanceCard(){
    const labelEl = document.getElementById("balanceLabel");
    const amtEl = document.getElementById("balanceAmt");
    const trendEl = document.getElementById("balanceTrend");
    const eyeBtn = document.getElementById("balanceEyeBtn");
    if (!labelEl || !amtEl) return;
    let amount;
    // The "this month" trend only makes sense against the true, unfiltered
    // total — a scoped view (one account, or a picked Nepali month) already
    // shows its own Money in/out/net in the stats cards right below, so
    // showing a second, differently-scoped number here would just confuse.
    let showTrend = false;
    let trendAmount = 0;
    // Always derive the figure from actual transactions (money in − money
    // out), never from a stale imported/SMS-parsed BALANCES[] snapshot —
    // that snapshot stops updating the moment the user logs a new entry,
    // so showing it here would drift away from what's actually left.
    const scoped = getScoped();
    const totalIn = scoped.filter(t => t.type === "in").reduce((s,t)=>s+t.amount,0);
    const totalOut = scoped.filter(t => t.type === "out").reduce((s,t)=>s+t.amount,0);
    amount = totalIn - totalOut;
    labelEl.textContent = activeAccount !== "All" ? `${activeAccount} Balance` : "Total Balance";
    if (activeAccount === "All" && activeNepaliMonth === "All"){
      showTrend = true;
      const curKey = currentBsMonthKey();
      const monthTx = TRANSACTIONS.filter(t => !HIDDEN_ACCOUNTS.includes(t.account) && bsMonthKey(t.date) === curKey);
      trendAmount = monthTx.filter(t => t.type === "in").reduce((s,t)=>s+t.amount,0)
        - monthTx.filter(t => t.type === "out").reduce((s,t)=>s+t.amount,0);
    }

    const hidden = getBalanceHidden();
    if (hidden){
      cancelAmountAnimation("balance");
      amtEl.textContent = "Rs ••••••";
    } else {
      animateAmount(amtEl, "balance", amount, v => (v < 0 ? "− " : "") + rs(Math.abs(v)));
    }
    amtEl.classList.toggle("kh-balance-amt-masked", hidden);
    if (eyeBtn) eyeBtn.innerHTML = hidden ? ICON_EYE_OFF : ICON_EYE;

    if (trendEl){
      if (showTrend && !hidden){
        const pillClass = trendAmount > 0 ? "kh-pill-jade" : trendAmount < 0 ? "kh-pill-amber" : "kh-pill-dim";
        const arrow = trendAmount > 0 ? "▲" : trendAmount < 0 ? "▼" : "•";
        trendEl.innerHTML = `<span class="kh-pill ${pillClass}">${arrow} ${rs(Math.abs(trendAmount))} this month</span>`;
        trendEl.style.display = "";
      } else {
        trendEl.style.display = "none";
      }
    }
  }

  // ---------------------------------------------------------------------
  // First-time-user checklist — shown on Home (mobile and desktop) until
  // every step is done or it's dismissed. "Done" is derived straight from
  // real state (ACCOUNT_LIST/TRANSACTIONS/BUDGET_*) rather than tracked
  // separately, so it can never drift out of sync with what the person
  // has actually done.
  // ---------------------------------------------------------------------
  function getOnboardingSteps(){
    return [
      {
        id: "wallet", icon: "👛", label: "Add a wallet",
        hint: "Track more than one account — bank, eSewa, Khalti, cash.",
        done: ACCOUNT_LIST.length > 1,
        action: "quickAddAccount()",
      },
      {
        id: "transaction", icon: "🧾", label: "Log a transaction",
        hint: "Add your first expense or income to start your ledger.",
        done: TRANSACTIONS.length > 0,
        action: "toggleManualAdd()",
      },
      {
        id: "budget", icon: "🎯", label: "Set a budget",
        hint: "Give yourself a monthly spending limit to track against.",
        done: BUDGET_OVERALL != null || Object.keys(BUDGETS).length > 0,
        action: "showBudgetPage()",
      },
    ];
  }

  function dismissOnboarding(){
    ONBOARDING_DISMISSED = true;
    saveCurrentUser();
    renderOnboardingCard();
  }

  function renderOnboardingCard(){
    const steps = getOnboardingSteps();
    const allDone = steps.every(s => s.done);
    const show = currentUser && !ONBOARDING_DISMISSED && !allDone;
    const doneCount = steps.filter(s => s.done).length;

    const mobileEl = document.getElementById("onboardingCard");
    if (mobileEl){
      mobileEl.innerHTML = !show ? "" : `
        <div class="kh-onboarding-card">
          <button type="button" class="kh-onboarding-close" onclick="dismissOnboarding()" aria-label="Dismiss">✕</button>
          <div class="kh-onboarding-head">
            <p class="kh-onboarding-title">Get started with Kharchā</p>
            <p class="kh-onboarding-sub">${doneCount}/${steps.length} done</p>
          </div>
          ${steps.map(s => `
            <button type="button" class="kh-onboarding-row${s.done ? " done" : ""}" ${s.done ? "disabled" : `onclick="${s.action}"`}>
              <span class="kh-onboarding-check">${s.done ? "✓" : s.icon}</span>
              <span class="kh-onboarding-mid">
                <span class="kh-onboarding-label">${s.label}</span>
                <span class="kh-onboarding-hint">${s.hint}</span>
              </span>
              ${s.done ? "" : `<span class="kh-onboarding-arrow">→</span>`}
            </button>
          `).join("")}
        </div>
      `;
    }

    const desktopEl = document.getElementById("kdOnboardingCard");
    if (desktopEl){
      desktopEl.innerHTML = !show ? "" : `
        <div class="kd-card kd-glass" style="margin-bottom:20px; position:relative;">
          <button type="button" class="kd-icon-btn" style="position:absolute; top:16px; right:16px;" onclick="dismissOnboarding()" aria-label="Dismiss">✕</button>
          <div class="kd-card-head" style="margin-bottom:14px;">
            <h2>👋 Get started with Kharchā</h2>
            <span class="kd-badge">${doneCount}/${steps.length} done</span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px,1fr)); gap:12px;">
            ${steps.map(s => `
              <button type="button" class="kd-mini-row" style="border-radius:12px; background:var(--kd-surface-solid); border:1px solid var(--kd-border); padding:14px; text-align:left; cursor:${s.done ? "default" : "pointer"}; align-items:flex-start;" ${s.done ? "disabled" : `onclick="${s.action}"`}>
                <span style="font-size:18px; flex-shrink:0;">${s.done ? "✅" : s.icon}</span>
                <span style="flex:1; min-width:0;">
                  <div style="font-weight:700; font-size:13.5px; ${s.done ? "text-decoration:line-through; color:var(--kd-dim);" : ""}">${s.label}</div>
                  <div style="font-size:11.5px; color:var(--kd-dim); margin-top:2px;">${s.hint}</div>
                </span>
              </button>
            `).join("")}
          </div>
        </div>
      `;
    }
  }

  function renderAll(){
    applyHomeLayout();
    renderOnboardingCard();
    renderChips();
    renderNepaliMonthFilter();
    renderBalanceCard();
    renderStats();
    renderPie();
    renderNepaliPie();
    renderTx();
    renderLoanDashCard();
    renderBudgetDashCard();
    renderRoomDashCard();
    renderRecurringDashCard();
    renderHomeLayoutManager();
    renderRoomLayoutManager();
    renderDesktopDashboard();
  }

  // ---------------------------------------------------------------------
  // Desktop dashboard ("Luminous Ledger" redesign) — a parallel, desktop-
  // only view of the exact same live state (TRANSACTIONS/BALANCES/LOANS/
  // BUDGETS/RECURRING/ROOMMATES) the mobile app renders. It never owns any
  // data itself — every card here just reads the same globals/helpers the
  // mobile cards use, so there is nothing to keep in sync by hand. Shown/
  // hidden purely by CSS media query (see .kh-desktop rules), so calling
  // this when the viewport is mobile is harmless — it just renders into
  // hidden DOM.
  // ---------------------------------------------------------------------
  function syncDesktopSearch(q){
    txSearchQuery = (q || "").trim().toLowerCase();
    renderTx();
    renderDesktopDashboard();
  }

  let desktopLedgerCategory = "All";
  function setDesktopLedgerCategory(cat){
    desktopLedgerCategory = cat;
    renderDesktopDashboard();
  }

  // "View all" opens a real page, same pattern as every other "Open →"
  // card (Room/Loans/Budget/Recurring) — not an in-place expansion. The
  // full mobile Home view already has everything that belongs on a "see
  // everything" page (total balance, stats, pie charts, the complete
  // ledger, and the room/loan/budget/recurring cards), so it's reused
  // as-is rather than building a second copy of all of that.
  function showFullHomePage(){
    closePanel();
    const kdHomeContentEl = document.getElementById("kdHomeContent");
    if (kdHomeContentEl) kdHomeContentEl.style.display = "none";
    const appRootEl = document.getElementById("appRoot");
    appRootEl.classList.add("kh-page-open", "kh-show-full-home");
    document.getElementById("homePage").classList.add("active");
    currentPage = "home";
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderDesktopDashboard(){
    const root = document.getElementById("desktopDashboard");
    if (!root) return;

    const bsMonthEl = document.getElementById("kdBsMonth");
    if (bsMonthEl) bsMonthEl.textContent = currentBsMonthLabel();

    // Keep the topbar's own nav highlighted in sync with currentPage on
    // every render, not just on navigation — covers the very first paint
    // (Home is active by default before showPage() ever runs).
    const kdNavMap = { home: "kdNavHome", loans: "kdNavLoans", budget: "kdNavBudget", insights: "kdNavInsights", settings: "kdNavSettings" };
    document.querySelectorAll(".kd-nav-btn").forEach(b => b.classList.remove("active"));
    if (kdNavMap[currentPage]){
      const activeNavBtn = document.getElementById(kdNavMap[currentPage]);
      if (activeNavBtn) activeNavBtn.classList.add("active");
    }

    const avatarEl = document.getElementById("kdAvatar");
    const avatarImgEl = document.getElementById("kdAvatarImg");
    const avatarFallbackEl = document.getElementById("kdAvatarFallback");
    if (avatarEl && currentUser){
      avatarEl.title = currentUser.name || currentUser.email || "";
      const initial = (currentUser.name || currentUser.email || "?").trim()[0].toUpperCase();
      if (avatarFallbackEl) avatarFallbackEl.textContent = initial;
      if (avatarImgEl){
        if (currentUser.picture){
          avatarImgEl.referrerPolicy = "no-referrer";
          avatarImgEl.onerror = () => { avatarImgEl.style.display = "none"; if (avatarFallbackEl) avatarFallbackEl.style.display = ""; };
          if (avatarImgEl.src !== currentUser.picture) avatarImgEl.src = currentUser.picture;
          avatarImgEl.style.display = "";
          if (avatarFallbackEl) avatarFallbackEl.style.display = "none";
        } else {
          avatarImgEl.style.display = "none";
          if (avatarFallbackEl) avatarFallbackEl.style.display = "";
        }
      }
    }

    // Wallet chips — same accounts/colors/balances as the mobile chips bar.
    const walletsEl = document.getElementById("kdWalletChips");
    if (walletsEl){
      let html = `<button type="button" class="kd-wallet-chip${activeAccount === "All" ? " active" : ""}" onclick="activeAccount='All'; renderAll();">All accounts</button>`;
      visibleAccounts().forEach(name => {
        const meta = ACCOUNTS[name];
        const bal = BALANCES[name] || 0;
        html += `<button type="button" class="kd-wallet-chip${activeAccount === name ? " active" : ""}" onclick="activeAccount='${name.replace(/'/g,"\\'")}'; renderAll();">
          <span class="kd-wallet-dot" style="background:${meta.color}"></span>${name}
          <span class="kd-wallet-amt">${rs(bal)}</span>
        </button>`;
      });
      walletsEl.innerHTML = html;
    }

    // Stat row — money in / out / net, same figures as the mobile stat cards.
    const scoped = getScoped();
    const totalIn = scoped.filter(t => t.type === "in").reduce((s,t)=>s+t.amount,0);
    const totalOut = scoped.filter(t => t.type === "out").reduce((s,t)=>s+t.amount,0);
    const net = totalIn - totalOut;
    const totalBalance = Object.values(BALANCES).reduce((s,v)=>s+v,0);
    const statsEl = document.getElementById("kdStatsRow");
    if (statsEl){
      statsEl.innerHTML = `
        <div class="kd-stat kd-glass">
          <div class="kd-stat-top"><span class="kd-stat-label">Total balance</span><span class="kd-stat-icon" style="background:rgba(124,208,255,.14); color:var(--kd-tertiary)">💰</span></div>
          <div class="kd-stat-amt">${rs(totalBalance)}</div>
          <div class="kd-stat-sub">Across ${visibleAccounts().length} wallet${visibleAccounts().length===1?"":"s"}</div>
        </div>
        <div class="kd-stat kd-glass">
          <div class="kd-stat-top"><span class="kd-stat-label">Money in</span><span class="kd-stat-icon" style="background:rgba(75,226,119,.14); color:var(--kd-primary)">↙</span></div>
          <div class="kd-stat-amt" style="color:var(--kd-primary)">${rs(totalIn)}</div>
          <div class="kd-stat-sub">${currentBsMonthLabel()}</div>
        </div>
        <div class="kd-stat kd-glass">
          <div class="kd-stat-top"><span class="kd-stat-label">Money out</span><span class="kd-stat-icon" style="background:rgba(255,107,107,.14); color:var(--kd-danger)">↗</span></div>
          <div class="kd-stat-amt" style="color:var(--kd-danger)">${rs(totalOut)}</div>
          <div class="kd-stat-sub">${currentBsMonthLabel()}</div>
        </div>
        <div class="kd-stat kd-glass">
          <div class="kd-stat-top"><span class="kd-stat-label">Net</span><span class="kd-stat-icon" style="background:rgba(255,202,69,.14); color:var(--kd-secondary)">Σ</span></div>
          <div class="kd-stat-amt" style="color:${net>=0?"var(--kd-primary)":"var(--kd-danger)"}">${net>=0?"":"−"}${rs(Math.abs(net))}</div>
          <div class="kd-stat-sub">${activeAccount === "All" ? "All accounts" : activeAccount}</div>
        </div>`;
    }

    // Ledger category filter chips — a horizontally-scrollable row (same
    // "slide to see more" pattern as the mobile account chips) so it works
    // whether there are 3 categories or 10, instead of wrapping or
    // squeezing everything into view at once.
    const filtersEl = document.getElementById("kdLedgerFilters");
    if (filtersEl){
      const catsInScope = [...new Set(scoped.map(t => t.category))];
      filtersEl.innerHTML = [`All (${scoped.length})`, ...catsInScope].map((label, i) => {
        const cat = i === 0 ? "All" : label;
        const active = desktopLedgerCategory === cat;
        return `<button type="button" class="${active ? "active" : ""}" onclick="setDesktopLedgerCategory('${cat.replace(/'/g,"\\'")}')">${label}</button>`;
      }).join("");
    }

    // Ledger — a short preview (5 rows) with a "Showing X of Y" footer,
    // same as the reference design. "View all" doesn't expand this card;
    // it opens the full Home page instead — see showFullHomePage().
    const ledgerEl = document.getElementById("kdLedgerList");
    const ledgerFooterEl = document.getElementById("kdLedgerFooter");
    if (ledgerEl){
      let list = [...scoped].sort((a,b) => a.date < b.date ? 1 : -1);
      if (desktopLedgerCategory !== "All") list = list.filter(t => t.category === desktopLedgerCategory);
      if (txSearchQuery) list = list.filter(t => t.vendor.toLowerCase().includes(txSearchQuery) || t.category.toLowerCase().includes(txSearchQuery));
      const total = list.length;
      const PREVIEW_COUNT = 5;
      const visible = list.slice(0, PREVIEW_COUNT);
      if (!list.length){
        ledgerEl.innerHTML = `<div class="kd-empty">No transactions yet.</div>`;
      } else {
        const groups = {};
        visible.forEach(t => { (groups[t.date] = groups[t.date] || []).push(t); });
        ledgerEl.innerHTML = Object.entries(groups).map(([day, rows]) => `
          <div class="kd-ledger-day">${fmtDate(day)}</div>
          ${rows.map(t => {
            const meta = CAT[t.category] || CAT.Other;
            return `<div class="kd-row" onclick="editTx('${t.id}')">
              <div class="kd-row-icon" style="background:color-mix(in srgb, ${meta.color} 22%, transparent); color:${meta.color}">${meta.icon}</div>
              <div class="kd-row-mid">
                <div class="kd-row-vendor">${t.vendor}</div>
                <div class="kd-row-sub">${t.account} · ${t.category}</div>
              </div>
              <div class="kd-row-amt" style="color:${t.type==="in"?"var(--kd-primary)":"var(--kd-text)"}">${t.type==="in"?"+":"−"}${rs(t.amount)}</div>
            </div>`;
          }).join("")}
        `).join("");
      }
      if (ledgerFooterEl){
        ledgerFooterEl.innerHTML = total > PREVIEW_COUNT ? `<span>Showing ${visible.length} of ${total} items</span>` : "";
      }
    }

    // Room card — reuse computeRoomBalances(), same net figures as mobile.
    const roomEl = document.getElementById("kdRoomCard");
    if (roomEl){
      if (typeof ROOMMATES === "undefined" || ROOMMATES.length <= 1){
        roomEl.innerHTML = `<div class="kd-empty">No room set up yet. <button type="button" class="kd-link" onclick="showRoomPage()">Set up Room →</button></div>`;
      } else {
        const net = computeRoomBalances();
        const colors = ["#4be277","#ffca45","#7cd0ff","#ff9f6b","#c792ea","#6bd9c8"];
        roomEl.innerHTML = Object.entries(net).map(([name, amt], i) => `
          <div class="kd-mini-row">
            <div class="kd-mini-avatar" style="background:${colors[i % colors.length]}">${name[0].toUpperCase()}</div>
            <div style="flex:1; min-width:0;">
              <div class="kd-mini-name">${name}</div>
              <div class="kd-mini-sub">${Math.abs(amt) < 0.5 ? "Settled up" : (amt > 0 ? "Owed to them" : "They owe")}</div>
            </div>
            <span class="kd-pill ${amt >= 0 ? "kd-pill-jade" : "kd-pill-amber"}">${amt>=0?"":"−"}${rs(Math.abs(amt))}</span>
          </div>`).join("");
      }
    }

    // Loan card — reuse netLoanPosition(), same numbers as mobile summary.
    // Also surfaces active EMI commitments (outstanding/per-month/count),
    // same as renderLoanDashCard() on mobile — this used to only show the
    // non-EMI net, so an active EMI was invisible on the desktop Home.
    const loanEl = document.getElementById("kdLoanCard");
    if (loanEl){
      const pos = netLoanPosition("nonEmi");
      const hasLoans = LOANS.some(l => !l.isEmi);
      const emiLoans = LOANS.filter(l => l.isEmi);
      const emiOutstanding = emiLoans.reduce((s, l) => s + loanTotals(l).outstanding, 0);
      const activeEmis = emiLoans.filter(l => l.emiAmount && loanStatus(l) !== "Cleared");
      const emiMonthly = activeEmis.reduce((s, l) => s + l.emiAmount, 0);
      if (!LOANS.length){
        loanEl.innerHTML = `<div class="kd-empty">No active loans. <button type="button" class="kd-link" onclick="showLoanPage()">Track a loan →</button></div>`;
      } else {
        loanEl.innerHTML = `
          ${hasLoans ? `
            <div class="kd-mini-row"><div style="flex:1;"><div class="kd-mini-name">Lent out</div></div><span class="kd-pill kd-pill-jade">${rs(pos.lentOutstanding)}</span></div>
            <div class="kd-mini-row"><div style="flex:1;"><div class="kd-mini-name">Borrowed</div></div><span class="kd-pill kd-pill-amber">${rs(pos.borrowedOutstanding)}</span></div>
            <div class="kd-mini-row"${emiLoans.length ? "" : ` style="border-bottom:none;"`}><div style="flex:1;"><div class="kd-mini-name">Net</div></div><span class="kd-pill ${pos.net>=0?"kd-pill-jade":"kd-pill-amber"}">${pos.net>=0?"":"−"}${rs(Math.abs(pos.net))}</span></div>
          ` : ""}
          ${emiLoans.length ? `
            <div class="kd-mini-row" style="padding-top:10px;"><div style="flex:1;"><div class="kd-mini-name">EMI outstanding</div></div><span class="kd-pill kd-pill-amber">${rs(emiOutstanding)}</span></div>
            <div class="kd-mini-row"><div style="flex:1;"><div class="kd-mini-name">EMI per month</div></div><span class="kd-pill kd-pill-jade">${rs(emiMonthly)}</span></div>
            <div class="kd-mini-row" style="border-bottom:none;"><div style="flex:1;"><div class="kd-mini-name">Active EMIs</div></div><span class="kd-pill kd-pill-jade">${activeEmis.length}</span></div>
          ` : ""}
        `;
      }
    }

    // Recurring bills card.
    const recEl = document.getElementById("kdRecurringCard");
    if (recEl){
      if (!RECURRING.length){
        recEl.innerHTML = `<div class="kd-empty">No recurring bills tracked. <button type="button" class="kd-link" onclick="showRecurringPage()">Add one →</button></div>`;
      } else {
        const totalMonthly = RECURRING.reduce((s, r) => s + r.amount, 0);
        recEl.innerHTML = `<div class="kd-mini-row" style="border-bottom:none;"><div style="flex:1;"><div class="kd-mini-name">Monthly total</div><div class="kd-mini-sub">${RECURRING.length} bill${RECURRING.length===1?"":"s"}</div></div><span class="kd-pill kd-pill-amber">${rs(totalMonthly)}</span></div>`;
      }
    }

    // Category breakdown — an actual donut (conic-gradient, same technique
    // the mobile pie chart uses) with a legend underneath, instead of a
    // plain list, so it reads at a glance the way the mockup's chart does.
    const catEl = document.getElementById("kdCategoryCard");
    if (catEl){
      const byCat = {};
      scoped.filter(t => t.type === "out").forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
      const entries = Object.entries(byCat).sort((a,b) => b[1]-a[1]);
      if (!entries.length){
        catEl.innerHTML = `<div class="kd-empty">No spending yet this period.</div>`;
      } else {
        const total = entries.reduce((s,[,v])=>s+v,0);
        let angle = 0;
        const stops = entries.map(([cat, amt]) => {
          const meta = CAT[cat] || CAT.Other;
          const start = angle;
          angle += (amt / total) * 360;
          return `${meta.color} ${start}deg ${angle}deg`;
        }).join(", ");
        catEl.innerHTML = `
          <div class="kd-donut-wrap">
            <div class="kd-donut" style="background:conic-gradient(${stops})">
              <div class="kd-donut-center">
                <span style="font-size:10px; color:var(--kd-dim);">Top</span>
                <b>${entries[0][0]}</b>
              </div>
            </div>
          </div>
          ${entries.slice(0, 6).map(([cat, amt]) => {
            const meta = CAT[cat] || CAT.Other;
            const pct = total ? Math.round((amt/total)*100) : 0;
            return `<div class="kd-legend-row">
              <div class="kd-legend-left"><span class="kd-wallet-dot" style="background:${meta.color}"></span><span>${cat}</span></div>
              <span style="color:var(--kd-dim);">${pct}% · ${rs(amt)}</span>
            </div>`;
          }).join("")}
        `;
      }
    }

    // Budget card.
    const budgetEl = document.getElementById("kdBudgetCard");
    if (budgetEl){
      if (!BUDGET_OVERALL && !Object.keys(BUDGETS).length){
        budgetEl.innerHTML = `<div class="kd-empty">No budget set. <button type="button" class="kd-link" onclick="showBudgetPage()">Set a budget →</button></div>`;
      } else {
        const spent = spendThisMonth(null);
        const pct = BUDGET_OVERALL ? Math.min(100, (spent / BUDGET_OVERALL) * 100) : 0;
        budgetEl.innerHTML = `
          <div class="kd-mini-row" style="border-bottom:none;"><div style="flex:1;"><div class="kd-mini-name">${currentBsMonthLabel()}</div><div class="kd-mini-sub">${BUDGET_OVERALL ? `${rs(spent)} / ${rs(BUDGET_OVERALL)}` : `${rs(spent)} spent`}</div></div></div>
          <div class="kd-budget-track"><div class="kd-budget-fill" style="width:${pct}%; background:${pct>=100?"var(--kd-danger)":pct>=80?"var(--kd-secondary)":"var(--kd-primary)"}"></div></div>
        `;
      }
    }
  }

  // ---------------------------------------------------------------------
  // Google sign-in.
  //
  // ⚠️ To make sign-in actually work you must:
  //   1. Create an OAuth Client ID (type "Web application") in the Google
  //      Cloud Console → APIs & Services → Credentials.
  //   2. Add the exact URL(s) this page will be served from (e.g.
  //      https://yourapp.example.com) under "Authorized JavaScript origins".
  //      Google Sign-In will NOT work if you just open this file locally
  //      (file://) — it has to be served over http/https.
  //   3. Paste that Client ID into GOOGLE_CLIENT_ID below.
  //
  // Sign-in proves who the user is; their data is now backed by Supabase
  // (see the block right below), synced across devices/browsers for the
  // same Google account. A per-device copy still lives in localStorage
  // too (see saveCurrentUser/loadUserData above) as an offline fallback
  // and for the brief moment before the first Supabase round-trip lands.
  // ---------------------------------------------------------------------
  const GOOGLE_CLIENT_ID = "207990075260-58efvs88f4j4fucnrolk1c4q6ufoc9b3.apps.googleusercontent.com";
  const CURRENT_USER_KEY = "kharcha_current_user";
  let currentUser = null;

  // ---------------------------------------------------------------------
  // Supabase — real backend storage + auth, layered underneath the same
  // Google Sign-In flow above. The Google ID token from handleCredentialResponse
  // is handed straight to Supabase Auth (signInWithIdToken) instead of a
  // separate login screen, which gives us a real auth.uid() for Row Level
  // Security. localStorage stays as an offline/fallback cache — every
  // save/load below tries Supabase first and falls back to it.
  //
  // Admin access needs no extra code here: browsing/editing every user's
  // row is just the Supabase dashboard's own Table Editor (Project →
  // Table Editor → user_data), since the dashboard uses your project's
  // service role and isn't subject to the RLS policies below.
  // ---------------------------------------------------------------------
  const SUPABASE_URL = "https://xmigqaikyvjrxpzgdkmv.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtaWdxYWlreXZqcnhwemdka212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MzkxNDIsImV4cCI6MjEwNDAxNTE0Mn0.O_6OJcyYHoCtBMjUJKzmM7ZCeXn_Q4FDPAfPNbhQcEc";
  let sbClient = null;
  // Lazy + guarded rather than initialized at load time, because the
  // Supabase script tag is async/defer (like the Google one above it) —
  // it may not have finished loading yet wherever this first gets called.
  function getSb(){
    if (sbClient) return sbClient;
    if (window.supabase && window.supabase.createClient){
      sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return sbClient;
  }
  let supabaseUserId = null; // auth.uid() once signed in through Supabase; null = local-only mode (offline, or Supabase unreachable)
  let realtimeChannel = null;
  let lastSelfSaveAt = null;

  // Live sync — any other device signed into the same account gets its
  // update pushed here instead of waiting for its next sign-in. Skips
  // echoes of a save THIS device just made (compares against
  // lastSelfSaveAt, set right before each upsert in saveCurrentUser)
  // so a save doesn't immediately re-render itself and pop a toast.
  function startRealtimeSync(){
    const sb = getSb();
    if (!sb || !supabaseUserId) return;
    stopRealtimeSync();
    realtimeChannel = sb
      .channel(`user_data_${supabaseUserId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_data", filter: `id=eq.${supabaseUserId}` },
        (payload) => {
          const row = payload.new;
          if (!row || !row.data) return;
          if (lastSelfSaveAt && row.updated_at && row.updated_at <= lastSelfSaveAt) return;
          applyUserDataSnapshot(row.data, currentUser.email);
          renderAll();
          renderCategoryManager();
          renderAccountManager();
          showToast("Synced from another device");
        })
      .subscribe();
  }

  function stopRealtimeSync(){
    const sb = getSb();
    if (sb && realtimeChannel) sb.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  // Builds the account-panel avatar with real DOM nodes (not an innerHTML
  // string) so nothing breaks on names/URLs containing quotes, and falls
  // back to an initials circle if the Google photo URL fails to load —
  // which usually means an ad blocker / privacy extension in the browser
  // is blocking requests to googleusercontent.com, not a bug in the app.
  function renderAccountAvatar(user){
    const info = document.getElementById("accountPanelInfo");
    if (!info) return;
    info.innerHTML = "";
    const initials = (user.name || user.email || "?").trim().charAt(0).toUpperCase();

    const makeFallback = () => {
      const div = document.createElement("div");
      div.className = "kh-account-avatar-lg kh-account-avatar-fallback";
      div.textContent = initials;
      return div;
    };

    if (user.picture){
      const img = document.createElement("img");
      img.className = "kh-account-avatar-lg";
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.onerror = () => {
        console.warn("Kharcha: profile photo failed to load (likely blocked by an ad blocker / privacy extension) —", user.picture);
        img.replaceWith(makeFallback());
      };
      img.src = user.picture;
      info.appendChild(img);
    } else {
      info.appendChild(makeFallback());
    }

    const textWrap = document.createElement("div");
    const nameEl = document.createElement("div");
    nameEl.className = "kh-account-panel-name";
    nameEl.textContent = user.name || "";
    const emailEl = document.createElement("div");
    emailEl.className = "kh-account-panel-email";
    emailEl.textContent = user.email || "";
    textWrap.appendChild(nameEl);
    textWrap.appendChild(emailEl);
    info.appendChild(textWrap);
  }

  function decodeJwt(token){
    const payload = token.split(".")[1];
    const json = decodeURIComponent(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
      .split("").map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""));
    return JSON.parse(json);
  }

  async function handleCredentialResponse(response){
    const claims = decodeJwt(response.credential);
    const user = { email: claims.email, name: claims.name || claims.email, picture: claims.picture || "" };

    const sb = getSb();
    if (sb){
      try{
        const { data, error } = await sb.auth.signInWithIdToken({ provider: "google", token: response.credential });
        if (error) throw error;
        supabaseUserId = data.user.id;
      }catch(e){
        console.warn("Kharcha: Supabase sign-in failed — continuing in local-only (this device) mode.", e);
        supabaseUserId = null;
      }
    }
    await signIn(user);
  }

  async function signIn(user, { persistSession = true } = {}){
    currentUser = user;
    if (persistSession){
      try{ localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user)); }catch(e){}
    }

    document.getElementById("authScreen").style.display = "none";
    document.getElementById("landingPage").style.display = "none";
    document.getElementById("appRoot").style.display = "block";
    document.getElementById("desktopDashboard").style.display = "block";
    setActiveNav(currentPage, true);
    renderAccountAvatar(user);
    document.getElementById("guestBadgeMobile").style.display = isGuestMode ? "inline" : "none";
    document.getElementById("guestBadgeDesktop").style.display = isGuestMode ? "inline-flex" : "none";

    const headerImg = document.getElementById("headerAvatarImg");
    const headerFallback = document.getElementById("headerAvatarFallback");
    if (user.picture){
      headerImg.referrerPolicy = "no-referrer";
      headerImg.onerror = () => {
        console.warn("Kharcha: header avatar image failed to load —", user.picture);
        headerImg.style.display = "none";
        headerFallback.style.display = "block";
      };
      headerImg.src = user.picture;
      headerImg.style.display = "block";
      headerFallback.style.display = "none";
    } else {
      headerImg.style.display = "none";
      headerFallback.style.display = "block";
    }

    const firstName = (user.name || user.email.split("@")[0]).split(" ")[0];
    document.getElementById("welcomeGreeting").innerHTML = `Welcome, <strong>${firstName}</strong>`;

    await loadUserData(user.email);

    // If someone invited this email to a room, join it now — covers both
    // a brand-new sign-in and someone who was invited after they'd
    // already signed up once before.
    try{
      const pendingRoomId = await resolvePendingRoomInvite(user.email, supabaseUserId);
      if (pendingRoomId && pendingRoomId !== currentRoomId){
        await loadRoomData(pendingRoomId);
        saveCurrentUser();
        showToast("Joined a shared room");
      }
    }catch(e){ console.warn("Kharcha: pending invite check failed —", e); }

    renderAll();
    renderCategoryManager();
    renderAccountManager();
    renderDriveSyncStatus();
    startRealtimeSync();
    setTimeout(checkAlerts, 600);
  }

  function signOut(){
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    stopRealtimeSync();
    stopRoomRealtimeSync();
    currentRoomId = null;
    isGuestMode = false;
    const sb = getSb();
    if (sb) sb.auth.signOut().catch(() => {});
    supabaseUserId = null;
    currentUser = null;
    driveAccessToken = null;
    driveTokenExpiresAt = 0;
    driveTokenClient = null;
    clearTimeout(driveAutoSyncTimer);
    try{ localStorage.removeItem(CURRENT_USER_KEY); }catch(e){}
    closePanel();
    document.getElementById("appRoot").style.display = "none";
    document.getElementById("desktopDashboard").style.display = "none";
    document.getElementById("authScreen").style.display = "flex";
    document.getElementById("landingPage").style.display = "block";
  }

  // Lets a signed-out visitor read a legal page (from the landing page
  // footer) without going through sign-in. Reuses #appRoot's own
  // Privacy/Security/Terms pages (already built for the signed-in
  // Settings flow) rather than duplicating that content — goHome() below
  // routes "← Back" on those pages back to the landing page instead of
  // the (empty, signed-out) dashboard.
  function showGuestLegalPage(name){
    document.getElementById("landingPage").style.display = "none";
    document.getElementById("authScreen").style.display = "none";
    document.getElementById("appRoot").style.display = "block";
    showPage(name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Populates the landing page's "live preview" mock panel from the same
  // DEMO_SEED_TRANSACTIONS/DEMO_SEED_BALANCES used for the in-app "load
  // demo data" button — real, consistent sample numbers instead of
  // hand-typed marketing copy that could drift out of sync. Runs once,
  // independent of sign-in state (the panel is just illustrative).
  function renderLandingPreview(){
    const balanceEl = document.getElementById("klPvBalance");
    if (!balanceEl) return;
    const totalBalance = Object.values(DEMO_SEED_BALANCES).reduce((s, v) => s + v, 0);
    const totalIn = DEMO_SEED_TRANSACTIONS.filter(t => t.type === "in").reduce((s, t) => s + t.amount, 0);
    const totalOut = DEMO_SEED_TRANSACTIONS.filter(t => t.type === "out").reduce((s, t) => s + t.amount, 0);
    balanceEl.textContent = rs(totalBalance);
    document.getElementById("klPvIn").textContent = rs(totalIn);
    document.getElementById("klPvOut").textContent = rs(totalOut);
    const net = totalIn - totalOut;
    document.getElementById("klPvNet").textContent = (net >= 0 ? "+" : "−") + rs(Math.abs(net));

    const byCat = {};
    DEMO_SEED_TRANSACTIONS.filter(t => t.type === "out").forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
    const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const catTotal = Object.values(byCat).reduce((s, v) => s + v, 0);
    document.getElementById("klPvCats").innerHTML = entries.map(([cat, amt]) => {
      const meta = CAT[cat] || CAT.Other;
      const pct = catTotal ? Math.round((amt / catTotal) * 100) : 0;
      return `<div class="kl-preview-cat-row"><span class="kl-dot" style="background:${meta.color}"></span><span>${cat}</span><b>${rs(amt)} (${pct}%)</b></div>`;
    }).join("");

    document.getElementById("klPvWallets").innerHTML = Object.keys(DEMO_SEED_BALANCES).map(name => {
      const meta = ACCOUNTS[name] || ACCOUNTS.Other;
      return `<div class="kl-preview-wallet"><span class="kl-dot" style="background:${meta.color}"></span>${name} <b>${rs(DEMO_SEED_BALANCES[name])}</b></div>`;
    }).join("");
  }

  async function initAuth(){
    // Resuming an already-signed-in session must NOT depend on Google's
    // sign-in script having loaded/initialized successfully — third-party
    // scripts like GSI are more likely to misbehave inside an iOS "Add to
    // Home Screen" standalone web app (different storage/network context
    // than a regular Safari tab), and a failure there used to abort this
    // whole function before it ever checked for an existing session —
    // forcing a fresh sign-in on every single open even with a perfectly
    // valid saved one. So this always runs first, independent of GSI.
    let resumed = false;
    const sb = getSb();
    if (sb){
      try{
        const { data: { session } } = await sb.auth.getSession();
        if (session && session.user){
          supabaseUserId = session.user.id;
          const meta = session.user.user_metadata || {};
          await signIn({
            email: session.user.email,
            name: meta.full_name || meta.name || session.user.email,
            picture: meta.avatar_url || meta.picture || "",
          });
          resumed = true;
        }
      }catch(e){
        console.warn("Kharcha: Supabase session check failed — falling back to local sign-in.", e);
      }
    }
    if (!resumed){
      try{
        const saved = JSON.parse(localStorage.getItem(CURRENT_USER_KEY));
        if (saved && saved.email) await signIn(saved);
      }catch(e){}
    }

    // Google's own sign-in button/One Tap — kept separate and defensively
    // wrapped so any failure here (script blocked, unsupported in this
    // webview, etc.) can never affect the session-resume logic above.
    try{
      const placeholderId = GOOGLE_CLIENT_ID.startsWith("YOUR_");
      if (placeholderId || !window.google || !google.accounts || !google.accounts.id){
        document.getElementById("authFallbackNote").innerHTML = placeholderId
          ? "Google Sign-In isn't configured yet — set GOOGLE_CLIENT_ID near the bottom of the script (see the comment above it for setup steps)."
          : "Couldn't load Google Sign-In (are you offline, or is this opened as a local file instead of served over https?).";
        return;
      }
      google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredentialResponse });
      // Still render the button even when already resumed, so it's ready
      // and working the moment someone signs out — but never fire the
      // floating One Tap prompt in that case. It's Google's own overlay,
      // injected straight into <body> regardless of our own auth screen
      // being hidden, so with a session already resumed it would show up
      // as a stray, badly-positioned popup on top of the app the person
      // is already using — not sitting where a real sign-in prompt should.
      google.accounts.id.renderButton(document.getElementById("gSignInDiv"), { theme: "filled_black", size: "large", shape: "pill" });
      // Same button, rendered again into the desktop landing page's three
      // CTA spots (header, hero, bottom banner) — Google's button has to
      // be the real thing (an iframe) for the click to actually authorize
      // anything, so these can't just be styled to *look* like it.
      ["gSignInDivLandingHeader", "gSignInDivLandingHero", "gSignInDivLandingCta"].forEach(id => {
        const el = document.getElementById(id);
        if (el) google.accounts.id.renderButton(el, { theme: "filled_black", size: id === "gSignInDivLandingHeader" ? "medium" : "large", shape: "pill", text: "continue_with" });
      });
      if (!resumed) google.accounts.id.prompt(); // One Tap, only when we actually need a sign-in
    }catch(e){
      console.warn("Kharcha: Google Sign-In failed to initialize — the app still works if you already have a saved session.", e);
    }
  }

  // Scroll-reveal for Home/Room sections (nav cards, room summary, pie
  // chart, etc.) — each .kh-home-section fades/slides in as it enters the
  // viewport, and resets so it can play again the next time it's scrolled
  // past, in either direction. One shared observer for every such section,
  // set up once since the section containers themselves are static (only
  // their inner HTML gets rebuilt on re-render).
  function setupScrollReveal(){
    const sections = document.querySelectorAll(".kh-home-section");
    if (!sections.length) return;
    if (!("IntersectionObserver" in window) || REDUCED_MOTION){
      sections.forEach(el => el.classList.add("kh-inview"));
      return;
    }
    // A gentle stagger (capped, so a long page doesn't end up with a
    // multi-second tail) makes sections that enter together — e.g. several
    // already visible on first load — settle in one after another instead
    // of all snapping at once, which reads as noticeably smoother. That
    // delay is only meant for that shared first moment, though: once a
    // section has revealed itself for the first time, its delay is reset
    // to 0 so later, one-at-a-time scroll reveals (which the transactions
    // list — being further down the page — mostly gets) fire immediately
    // instead of lagging behind everything above it every single time.
    sections.forEach((el, i) => {
      el.style.transitionDelay = Math.min(i * 70, 280) + "ms";
      el.addEventListener("transitionend", function clearDelay(){
        el.style.transitionDelay = "0ms";
        el.removeEventListener("transitionend", clearDelay);
      }, { once: true });
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        entry.target.classList.toggle("kh-inview", entry.isIntersecting);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -60px 0px" });
    sections.forEach(el => io.observe(el));
  }
  setupScrollReveal();
  renderLandingPreview();

  window.addEventListener("load", () => setTimeout(initAuth, 150)); // give the GSI script a moment to load

  // Splash screen: show the animated mark briefly, then reveal the auth/app screen beneath it.
  window.addEventListener("load", () => {
    setTimeout(() => {
      const splash = document.getElementById("splashScreen");
      splash.classList.add("hide");
      setTimeout(() => { splash.style.display = "none"; }, 500);
    }, 1300);
  });
