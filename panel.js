(() => {
const C = window.SGS, $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => "\u20B9" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const dt = s => s ? new Date(s).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "";
const qs = o => { const p = Object.entries(o).filter(([, v]) => v !== "" && v != null && v !== false).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&"); return p ? "?" + p : ""; };
const view = $("#view"), dlg = $("#dlg");
let me, cats = [], emps = [];

async function api(path, { method = "GET", body, form } = {}) {
  const h = { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }; let b;
  if (form) b = form; else if (body) { h["Content-Type"] = "application/json"; b = JSON.stringify(body); }
  const r = await fetch(C.API + path, { method, headers: h, body: b, credentials: "include" });
  if (r.status === 204) return null;
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.message || "Something went wrong"); e.code = d.code; e.fields = d.fieldErrors; e.status = r.status; throw e; }
  return d;
}
function toast(m, bad) { const t = $("#toast"); t.textContent = m; t.className = "toast show" + (bad ? " bad" : ""); clearTimeout(toast.t); toast.t = setTimeout(() => t.className = "toast", 4000); }
const fail = e => toast(e.fields ? Object.values(e.fields).join("; ") : e.message, true);
const run = async fn => { try { return await fn(); } catch (e) { fail(e); } };
const head = (t, a = "") => `<div class="vh"><h2>${esc(t)}</h2><div class="va">${a}</div></div>`;
const tbl = (cols, rows) => `<div class="tw"><table><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr>${rows || `<tr><td colspan="${cols.length}" class="empty">Nothing to show.</td></tr>`}</table></div>`;

// ---------- generic dialog form ----------
function field(f, v) {
  const req = f.req ? " required" : "", L = esc(f.l);
  if (f.t === "checkbox") return `<label class="chk"><input type="checkbox" name="${f.n}"${(v ?? f.d) ? " checked" : ""}> ${L}</label>`;
  let i;
  if (f.t === "textarea" || f.t === "lines") i = `<textarea name="${f.n}" rows="${f.t === "lines" ? 4 : 5}"${req}>${esc(f.t === "lines" ? (v || []).join("\n") : v)}</textarea>`;
  else if (f.t === "select") i = `<select name="${f.n}"${req}>${f.blank ? '<option value="">\u2014</option>' : ""}${(typeof f.o === "function" ? f.o() : f.o).map(([a, b]) => `<option value="${esc(a)}"${String(a) === String(v ?? f.d ?? "") ? " selected" : ""}>${esc(b)}</option>`).join("")}</select>`;
  else i = `<input name="${f.n}" type="${f.t || "text"}"${f.t === "number" ? ' step="any"' : ""}${f.t === "file" ? ' accept="image/*"' : ` value="${esc(v)}"`}${f.m ? " multiple" : ""}${req}${f.max ? ` maxlength="${f.max}"` : ""}${f.t === "password" ? ' autocomplete="new-password"' : ""}>`;
  return `<label>${L}${i}${f.h ? `<small>${esc(f.h)}</small>` : ""}</label>`;
}
function read(form, fields) {
  const o = {};
  for (const f of fields) {
    const el = form.elements[f.n]; if (!el) continue;
    if (f.t === "checkbox") o[f.n] = el.checked;
    else if (f.t === "file") o[f.n] = el.files[0] || null;
    else { const v = el.value.trim();
      if (f.t === "lines") o[f.n] = v ? v.split("\n").map(s => s.trim()).filter(Boolean) : [];
      else if (f.t === "number" || f.num) o[f.n] = v === "" ? null : Number(v);
      else o[f.n] = v === "" ? null : v; }
  }
  return o;
}
const toForm = o => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) if (v != null && v !== "") fd.append(k, v instanceof File ? v : String(v)); return fd; };
function ask(title, fields, init = {}, ok = "Save", note = "") {
  return new Promise(res => {
    dlg.innerHTML = `<h3>${esc(title)}</h3>${note}<form class="form" id="df">${fields.map(f => field(f, init[f.n])).join("")}<div class="acts"><button type="button" class="btn btn-ghost" data-x>Cancel</button><button class="btn">${esc(ok)}</button></div></form>`;
    let done = false;
    $("#df").onsubmit = e => { e.preventDefault(); done = true; const v = read(e.target, fields); dlg.close(); res(v); };
    dlg.querySelector("[data-x]").onclick = () => dlg.close();
    dlg.onclose = () => { if (!done) { done = true; res(null); } };
    if (!dlg.open) dlg.showModal();
  });
}
const info = (title, html) => { dlg.innerHTML = `<div class="top"><h3>${esc(title)}</h3><button class="btn btn-ghost sm" data-x>Close</button></div>${html}`; dlg.onclose = null; dlg.querySelector("[data-x]").onclick = () => dlg.close(); if (!dlg.open) dlg.showModal(); };
const creds = (u, p) => { info("Login details", `<p>Share these with the employee. The password is shown only once.</p><div class="cred">Username: <b>${esc(u)}</b><br>Password: <b>${esc(p)}</b></div><button class="btn" id="cp">Copy</button>`);
  $("#cp").onclick = () => navigator.clipboard?.writeText(`Username: ${u}\nPassword: ${p}`).then(() => toast("Copied")); };
const pager = (box, d, go) => { box.innerHTML = d.totalPages > 1 ? `<button class="btn btn-ghost sm" ${d.page < 1 ? "disabled" : ""} data-p="${d.page - 1}">Previous</button><span>Page ${d.page + 1} of ${d.totalPages}</span><button class="btn btn-ghost sm" ${d.page + 1 >= d.totalPages ? "disabled" : ""} data-p="${d.page + 1}">Next</button>` : ""; box.onclick = e => { const b = e.target.closest("[data-p]"); if (b) go(+b.dataset.p); }; };
const catOpts = () => cats.map(c => [c.id, c.name]);
const loadCats = async () => { cats = await api("/api/admin/categories").catch(() => api("/api/public/categories")).catch(() => []); };

// ---------- generic CRUD resources ----------
const T = (n, l, o = {}) => ({ n, l, ...o });
const R = {
  services: { t: "Services", list: "/api/admin/services", base: "/api/admin/services", create: "/api/admin/services", json: true, imgs: true,
    title: x => x.title, sub: x => x.shortDescription, thumb: x => x.images?.[0]?.thumbUrl, badges: x => [x.active ? "" : "Hidden", x.featured ? "Featured" : ""],
    fields: [T("title", "Title", { req: 1, max: 150 }), T("shortDescription", "Short description", { max: 300 }), T("description", "Full description", { t: "textarea" }), T("iconClass", "Icon class", { h: "Letters, digits, space, - and _" }),
      T("warranty", "Warranty", { max: 150 }), T("priceNote", "Price note", { max: 120 }), T("features", "Features", { t: "lines", h: "One per line, up to 20" }), T("metaTitle", "SEO title", { max: 160 }), T("metaDescription", "SEO description", { max: 300 }),
      T("displayOrder", "Display order", { t: "number" }), T("featured", "Featured", { t: "checkbox" }), T("active", "Visible on website", { t: "checkbox", d: 1 })] },
  projects: { t: "Projects", list: "/api/public/projects", paged: 1, base: "/api/admin/projects", create: "/api/admin/projects", rep: { p: "/image", n: "image", l: "Replace image" },
    title: x => x.title, sub: x => [x.category?.name, x.status, x.location, x.clientName].filter(Boolean).join(" \u2022 "), thumb: x => x.thumbUrl, badges: x => [x.featured ? "Featured" : ""],
    fields: [T("title", "Title", { req: 1, max: 200 }), T("description", "Description", { t: "textarea" }), T("categoryId", "Category", { t: "select", o: catOpts, req: 1, num: 1 }), T("location", "Location", { max: 150 }), T("clientName", "Client name", { max: 150 }),
      T("startedYear", "Started year", { t: "number", req: 1 }), T("completedYear", "Completed year", { t: "number" }), T("status", "Status", { t: "select", o: [["ONGOING", "Ongoing"], ["COMPLETED", "Completed"]], req: 1 }),
      T("areaSqFt", "Area (sq ft)", { t: "number" }), T("featured", "Featured", { t: "checkbox" }), T("image", "Image", { t: "file" })] },
  gallery: { t: "Gallery", list: "/api/admin/gallery", paged: 1, base: "/api/admin/gallery", create: "/api/gallery", rep: { p: "/image", n: "image", l: "Replace image" },
    title: x => x.title, sub: x => [x.category?.name, x.uploadedBy && "by " + x.uploadedBy].filter(Boolean).join(" \u2022 "), thumb: x => x.thumbUrl, badges: () => [],
    fields: [T("title", "Title", { req: 1, max: 200 }), T("description", "Description", { t: "textarea" }), T("socialLink", "Social media link", { t: "url", h: "Optional, http(s) only" }), T("categoryId", "Category", { t: "select", o: catOpts, req: 1, num: 1 }), T("image", "Image", { t: "file", req: 1 })] },
  tools: { t: "Tools", list: "/api/admin/tools", base: "/api/admin/tools", create: "/api/admin/tools", rep: { p: "/image", n: "image", l: "Replace image" },
    title: x => x.title, sub: x => x.description, thumb: x => x.thumbUrl, badges: x => [x.active ? "" : "Hidden"],
    fields: [T("title", "Title", { req: 1, max: 150 }), T("description", "Description", { t: "textarea" }), T("toolLink", "Link", { t: "url" }), T("displayOrder", "Display order", { t: "number" }), T("active", "Visible on website", { t: "checkbox", d: 1 }), T("image", "Image", { t: "file", req: 1 })] },
  clients: { t: "Clients", list: "/api/admin/clients", base: "/api/admin/clients", create: "/api/admin/clients", rep: { p: "/logo", n: "logo", l: "Replace logo" },
    title: x => x.name, sub: x => x.websiteUrl, thumb: x => x.logoUrl, badges: x => [x.active ? "" : "Hidden"],
    fields: [T("name", "Client name", { req: 1, max: 150 }), T("websiteUrl", "Website", { t: "url" }), T("displayOrder", "Display order", { t: "number" }), T("active", "Visible on website", { t: "checkbox", d: 1 }), T("logo", "Logo", { t: "file" })] },
  contact: { t: "Contact details", list: "/api/admin/contact", base: "/api/admin/contact", create: "/api/admin/contact", json: 1,
    title: x => x.type + (x.label ? " \u2014 " + x.label : ""), sub: x => x.value, badges: x => [x.active ? "" : "Hidden"],
    fields: [T("type", "Type", { t: "select", req: 1, o: ["PHONE", "EMAIL", "ADDRESS", "WHATSAPP", "TELEGRAM", "SMS", "WORKING_HOURS", "MAP_URL"].map(x => [x, x.replace("_", " ")]) }), T("label", "Label", { max: 100 }),
      T("value", "Value", { req: 1, max: 500, h: "Phone like +91 81254 43453, email address, or a map link starting with https://" }), T("displayOrder", "Display order", { t: "number" }), T("active", "Visible on website", { t: "checkbox", d: 1 })] },
  categories: { t: "Categories", list: "/api/admin/categories", base: "/api/admin/categories", create: "/api/admin/categories", json: 1, onChange: loadCats,
    title: x => x.name, sub: x => x.slug, badges: x => [x.active ? "" : "Disabled"],
    fields: [T("name", "Name", { req: 1, max: 60 }), T("displayOrder", "Display order", { t: "number" }), T("active", "Active", { t: "checkbox", d: 1 })] }
};

async function crud(key, page = 0) {
  const s = R[key];
  view.innerHTML = head(s.t, '<button class="btn" id="add">Add new</button>') + '<div class="list" id="lst"><p class="empty">Loading\u2026</p></div><div class="pager" id="pg"></div>';
  $("#add").onclick = () => edit(key, null, page);
  const d = await run(() => api(s.list + (s.paged ? `?size=20&page=${page}` : "")));
  if (!d) return;
  const items = s.paged ? d.content : d, lst = $("#lst");
  lst.innerHTML = items.length ? items.map((x, i) => { const th = s.thumb?.(x);
    return `<div class="row-i glass"><div class="th">${th ? `<img loading="lazy" src="${esc(th)}" alt="">` : ""}</div><div class="tx"><b>${esc(s.title(x))}</b><small>${esc(s.sub(x) || "")}</small><span>${s.badges(x).filter(Boolean).map(b => `<span class="badge">${esc(b)}</span>`).join("")}</span></div>
    <div class="ac">${s.imgs ? `<button class="btn btn-ghost sm" data-i="${i}">Images</button>` : ""}<button class="btn btn-ghost sm" data-e="${i}">Edit</button><button class="btn btn-ghost sm danger" data-d="${i}">Delete</button></div></div>`; }).join("") : '<p class="empty">Nothing here yet. Use "Add new".</p>';
  lst.onclick = async e => { const b = e.target.closest("button"); if (!b) return; const ds = b.dataset;
    if (ds.e) edit(key, items[ds.e], page);
    if (ds.i) svcImages(items[ds.i].id);
    if (ds.d && confirm(`Delete "${s.title(items[ds.d])}"? This cannot be undone.`)) { await run(async () => { await api(`${s.base}/${items[ds.d].id}`, { method: "DELETE" }); toast("Deleted"); s.onChange?.(); crud(key, page); }); } };
  if (s.paged) pager($("#pg"), d, p => crud(key, p));
}
async function edit(key, item, page) {
  const s = R[key]; if (s.fields.some(f => f.o === catOpts) && !cats.length) await loadCats();
  let fl = item ? s.fields.filter(f => f.t !== "file") : s.fields;
  if (item && s.rep) fl = [...fl, T("_rep", s.rep.l, { t: "file" })];
  const v = await ask(item ? "Edit " + s.t.toLowerCase() : "Add to " + s.t.toLowerCase(), fl, item ? { ...item, categoryId: item.category?.id } : {});
  if (!v) return;
  await run(async () => {
    if (item) { const rep = v._rep; delete v._rep; await api(`${s.base}/${item.id}`, { method: "PUT", body: v });
      if (rep) { const fd = new FormData(); fd.append(s.rep.n, rep); await api(`${s.base}/${item.id}${s.rep.p}`, { method: "PUT", form: fd }); } }
    else if (s.json) await api(s.create, { method: "POST", body: v });
    else await api(s.create, { method: "POST", form: toForm(v) });
    toast("Saved"); s.onChange?.(); crud(key, page);
  });
}
async function svcImages(id) {
  const s = await run(() => api(`/api/admin/services/${id}`)); if (!s) return;
  info("Images: " + s.title, `<div class="imgs">${s.images.map((im, i) => `<figure><img src="${esc(im.thumbUrl)}" alt=""><div><button data-m="${i},-1" aria-label="Move earlier">\u25C0</button><button data-m="${i},1" aria-label="Move later">\u25B6</button><button data-x2="${im.id}" aria-label="Delete">\u2715</button></div></figure>`).join("") || '<p class="empty">No images yet.</p>'}</div>
    <form class="form" id="up"><label>Add images (max 8 in total)<input type="file" name="images" accept="image/*" multiple required></label><button class="btn">Upload</button></form>`);
  dlg.querySelector(".imgs").onclick = async e => { const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.x2) { await run(() => api(`/api/admin/services/${id}/images/${b.dataset.x2}`, { method: "DELETE" })); svcImages(id); }
    if (b.dataset.m) { const [i, d] = b.dataset.m.split(",").map(Number), ids = s.images.map(x => x.id), j = i + d; if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]]; await run(() => api(`/api/admin/services/${id}/images/order`, { method: "PUT", body: { imageIds: ids } })); svcImages(id); } };
  $("#up").onsubmit = async e => { e.preventDefault(); await run(async () => { await api(`/api/admin/services/${id}/images`, { method: "POST", form: new FormData(e.target) }); toast("Uploaded"); svcImages(id); }); };
}

// ---------- dashboard ----------
async function dash() {
  view.innerHTML = head("Overview") + '<div class="stats" id="st"></div>';
  const s = await run(() => api("/api/admin/dashboard")); if (!s) return;
  const L = [["galleryImages", "Gallery images", "gallery"], ["projects", "Projects", "projects"], ["services", "Services", "services"], ["tools", "Tools", "tools"], ["clients", "Clients", "clients"], ["employees", "Employees", "employees"], ["newInquiries", "New enquiries", "inquiries"], ["bankEntries", "Bank entries", "bank"]];
  $("#st").innerHTML = L.map(([k, l, r]) => `<a class="stat glass" href="#${r}"><b>${s[k]}</b><span>${l}</span></a>`).join("");
}

// ---------- employees ----------
const STATE = { ACTIVE: ["Active", "good"], SUSPENDED_TEMPORARY: ["Suspended (temporary)", "bad"], SUSPENDED_PERMANENT: ["Suspended (permanent)", "bad"] };
async function employees() {
  view.innerHTML = head("Employees", '<button class="btn" id="add">Add employee</button>') + `<div class="filters"><label>Search<input id="q" type="search" placeholder="Name or username"></label><label>State<select id="sf"><option value="">All</option><option value="ACTIVE">Active</option><option value="SUSPENDED_TEMPORARY">Suspended (temporary)</option><option value="SUSPENDED_PERMANENT">Suspended (permanent)</option></select></label></div><div class="list" id="lst"></div>`;
  let items = [];
  const load = async () => { items = await run(() => api("/api/admin/employees" + qs({ q: $("#q").value.trim(), state: $("#sf").value }))) || []; emps = items;
    $("#lst").innerHTML = items.length ? items.map((u, i) => { const [sl, sc] = STATE[u.state];
      return `<div class="row-i glass"><div class="tx"><b>${esc(u.fullName)}</b><small>@${esc(u.username)}${u.phone ? " \u2022 " + esc(u.phone) : ""} \u2022 last login ${esc(dt(u.lastLoginAt) || "never")}</small>
      <span><span class="badge ${sc}">${sl}</span>${u.state === "SUSPENDED_TEMPORARY" ? `<span class="badge">until ${esc(dt(u.suspendedUntil))}</span>` : ""}${u.uploadPermissionActive ? `<span class="badge good">Can upload until ${esc(dt(u.uploadPermissionUntil))}</span>` : ""}${u.mustChangePassword ? '<span class="badge">Must change password</span>' : ""}</span>${u.suspensionReason ? `<small>Reason: ${esc(u.suspensionReason)}</small>` : ""}</div>
      <div class="ac"><button class="btn btn-ghost sm" data-a="bank" data-i="${i}">Bank</button><button class="btn btn-ghost sm" data-a="edit" data-i="${i}">Edit</button>
      ${u.state === "ACTIVE" ? `<button class="btn btn-ghost sm danger" data-a="susp" data-i="${i}">Suspend</button>` : `<button class="btn btn-ghost sm" data-a="unsusp" data-i="${i}">Lift suspension</button>`}
      <button class="btn btn-ghost sm" data-a="reset" data-i="${i}">Reset password</button>${u.uploadPermissionActive ? `<button class="btn btn-ghost sm" data-a="revoke" data-i="${i}">Withdraw upload</button>` : `<button class="btn btn-ghost sm" data-a="grant" data-i="${i}">Allow upload</button>`}</div></div>`; }).join("") : '<p class="empty">No employees found.</p>'; };
  await load(); let t; $("#q").oninput = () => { clearTimeout(t); t = setTimeout(load, 350); }; $("#sf").onchange = load;
  $("#add").onclick = async () => { const v = await ask("Add employee", [T("username", "Username", { req: 1, max: 30, h: "4-30 characters: letters, digits, . _ -" }), T("fullName", "Full name", { req: 1, max: 100 }), T("phone", "Phone", { max: 30 }),
      T("password", "Password", { t: "text", h: "Leave empty to generate one automatically (min 8 characters if you type one)" }), T("mustChangePassword", "Employee must change password at first login", { t: "checkbox", d: 1 })], {}, "Create");
    if (!v) return; const r = await run(() => api("/api/admin/employees", { method: "POST", body: v })); if (r) { creds(r.employee.username, r.generatedPassword || v.password); load(); } };
  $("#lst").onclick = async e => { const b = e.target.closest("button"); if (!b) return; const u = items[b.dataset.i], a = b.dataset.a, id = u.id; let v;
    if (a === "bank") { bankFilter.employeeId = id; location.hash = "#bank"; }
    if (a === "edit") { v = await ask("Edit employee", [T("fullName", "Full name", { req: 1, max: 100 }), T("phone", "Phone", { max: 30 })], u); if (v) await run(() => api(`/api/admin/employees/${id}`, { method: "PUT", body: v })).then(() => (toast("Saved"), load())); }
    if (a === "susp") { v = await ask("Suspend " + u.fullName, [T("type", "Type", { t: "select", o: [["TEMPORARY", "Temporary"], ["PERMANENT", "Permanent"]], req: 1 }), T("days", "Days (temporary)", { t: "number" }), T("untilDate", "Or until date (temporary)", { t: "date" }), T("reason", "Reason", { max: 255 })], {}, "Suspend", "<p class='meta'>For a temporary suspension fill either days or a date, not both. The employee is signed out immediately.</p>");
      if (v) await run(() => api(`/api/admin/employees/${id}/suspend`, { method: "POST", body: v })).then(() => (toast("Suspended"), load())); }
    if (a === "unsusp") await run(() => api(`/api/admin/employees/${id}/unsuspend`, { method: "POST" })).then(() => (toast("Suspension lifted"), load()));
    if (a === "reset") { v = await ask("Reset password", [T("username", "Type the username to confirm", { req: 1, h: "Account: " + u.username }), T("newPassword", "New password", { h: "Leave empty to generate one" })], {}, "Reset");
      if (v) { const r = await run(() => api("/api/admin/employees/reset-password", { method: "POST", body: v })); if (r) creds(r.username, r.temporaryPassword); load(); } }
    if (a === "grant") { v = await ask("Allow gallery uploads", [T("hours", "For how many hours", { t: "number", h: "1-720" }), T("untilDate", "Or until date", { t: "date" })], {}, "Allow", "<p class='meta'>Fill exactly one of the two.</p>");
      if (v) await run(() => api(`/api/admin/employees/${id}/upload-permission`, { method: "POST", body: v })).then(() => (toast("Permission granted"), load())); }
    if (a === "revoke") await run(() => api(`/api/admin/employees/${id}/upload-permission`, { method: "DELETE" })).then(() => (toast("Permission withdrawn"), load())); };
}

// ---------- bank ----------
const bankFilter = { employeeId: "", from: "", to: "", includeDeleted: false };
async function adminBank(page = 0) {
  if (!emps.length) emps = await api("/api/admin/employees").catch(() => []);
  const f = bankFilter;
  view.innerHTML = head("Employee bank") + `<form class="filters" id="bf"><label>Employee<select name="employeeId"><option value="">Everyone</option>${emps.map(u => `<option value="${u.id}"${String(u.id) === String(f.employeeId) ? " selected" : ""}>${esc(u.fullName)} (@${esc(u.username)})</option>`).join("")}</select></label>
    <label>From<input type="date" name="from" value="${esc(f.from)}"></label><label>To<input type="date" name="to" value="${esc(f.to)}"></label><label class="chk"><input type="checkbox" name="includeDeleted"${f.includeDeleted ? " checked" : ""}> Show deleted</label><button class="btn sm">Apply</button></form><div id="ov"></div><div id="en"></div><div class="pager" id="pg"></div>`;
  $("#bf").onsubmit = e => { e.preventDefault(); const d = new FormData(e.target); Object.assign(f, { employeeId: d.get("employeeId"), from: d.get("from"), to: d.get("to"), includeDeleted: d.has("includeDeleted") }); adminBank(0); };
  const [ov, en] = await Promise.all([run(() => api("/api/admin/bank/overview" + qs({ from: f.from, to: f.to }))), run(() => api("/api/admin/bank" + qs({ ...f, page, size: 30 })))]);
  if (ov) $("#ov").innerHTML = `<div class="stats"><div class="stat glass"><b>${money(ov.grandTotal)}</b><span>Total in range</span></div></div>` +
    tbl(["Employee", "Entries", "Total"], ov.employees.map(x => `<tr><td>${esc(x.fullName)} <small>@${esc(x.username)}</small></td><td>${x.entries}</td><td class="r">${money(x.total)}</td></tr>`).join("")).replace("<th>Total", '<th class="r">Total') +
    tbl(["Date", "Entries", "Total"], ov.days.map(x => `<tr><td>${esc(x.date)}</td><td>${x.entries}</td><td class="r">${money(x.total)}</td></tr>`).join("")).replace("<th>Total", '<th class="r">Total');
  if (!en) return;
  $("#en").innerHTML = "<h3>Entries</h3>" + tbl(["Date", "Employee", "Note", "Amount", ""], en.content.map(x => `<tr class="${x.deleted ? "del" : ""}"><td>${esc(x.entryDate)}<br><small>${esc(dt(x.createdAt))}</small></td><td>${esc(x.employeeFullName)}</td><td>${esc(x.note || "")}${x.deleted ? `<br><small>Deleted: ${esc(x.deleteReason || "")}</small>` : ""}</td><td class="r">${money(x.amount)}</td>
    <td><button class="btn btn-ghost sm" data-h="${x.id}">History</button> ${x.deleted ? `<button class="btn btn-ghost sm" data-r="${x.id}">Restore</button>` : `<button class="btn btn-ghost sm" data-e="${x.id}">Edit</button> <button class="btn btn-ghost sm danger" data-d="${x.id}">Delete</button>`}</td></tr>`).join("")).replace("<th>Amount", '<th class="r">Amount');
  pager($("#pg"), en, adminBank);
  $("#en").onclick = async e => { const b = e.target.closest("button"); if (!b) return; const ds = b.dataset, row = en.content.find(x => String(x.id) === (ds.e || ds.d || ds.r || ds.h)), reason = [T("reason", "Reason (required, kept in the history)", { req: 1, max: 255 })];
    if (ds.h) { const h = await run(() => api(`/api/admin/bank/${ds.h}/history`)); if (h) info("Entry history", tbl(["When", "Action", "By", "Change", "Reason"], h.map(x => `<tr><td>${esc(dt(x.actedAt))}</td><td>${esc(x.action)}</td><td>${esc(x.actedBy || "")}</td><td>${x.oldAmount != null ? money(x.oldAmount) + " \u2192 " : ""}${x.newAmount != null ? money(x.newAmount) : ""}</td><td>${esc(x.reason || "")}</td></tr>`).join(""))); }
    if (ds.e) { const v = await ask("Edit entry", [T("amount", "Amount", { t: "number", req: 1 }), T("note", "Note", { max: 255 }), ...reason], row); if (v) await run(() => api(`/api/admin/bank/${ds.e}`, { method: "PUT", body: v })).then(() => (toast("Entry updated"), adminBank(page))); }
    if (ds.d) { const v = await ask("Delete entry", reason, {}, "Delete", "<p class='meta'>The entry is hidden, not erased. It stays in the history and can be restored.</p>"); if (v) await run(() => api(`/api/admin/bank/${ds.d}${qs({ reason: v.reason })}`, { method: "DELETE" })).then(() => (toast("Entry deleted"), adminBank(page))); }
    if (ds.r) { const v = await ask("Restore entry", reason, {}, "Restore"); if (v) await run(() => api(`/api/admin/bank/${ds.r}/restore${qs({ reason: v.reason })}`, { method: "POST" })).then(() => (toast("Entry restored"), adminBank(page))); } };
}
const myF = { from: "", to: "" };
async function myBank(page = 0) {
  view.innerHTML = head("My bank") + `<form class="form glass" id="af" style="padding:1.2rem;margin-bottom:1rem"><div class="row"><label>Amount<input name="amount" type="number" step="0.01" min="0.01" required inputmode="decimal"></label><label>Note<input name="note" maxlength="255"></label></div><button class="btn">Add entry</button><small>Date and time are set automatically. Entries cannot be changed after saving.</small></form>
    <form class="filters" id="ff"><label>From<input type="date" name="from" value="${esc(myF.from)}"></label><label>To<input type="date" name="to" value="${esc(myF.to)}"></label><button class="btn sm">Filter</button></form><div id="sm"></div><div id="en"></div><div class="pager" id="pg"></div>`;
  $("#af").onsubmit = async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); await run(() => api("/api/employee/bank", { method: "POST", body: { amount: Number(d.amount), note: d.note || null } })).then(() => (toast("Entry added"), myBank(0))); };
  $("#ff").onsubmit = e => { e.preventDefault(); const d = new FormData(e.target); myF.from = d.get("from"); myF.to = d.get("to"); myBank(0); };
  const [s, l] = await Promise.all([run(() => api("/api/employee/bank/summary" + qs(myF))), run(() => api("/api/employee/bank" + qs({ ...myF, page, size: 30 })))]);
  if (s) $("#sm").innerHTML = `<div class="stats"><div class="stat glass"><b>${money(s.grandTotal)}</b><span>All-time total</span></div><div class="stat glass"><b>${money(s.rangeTotal)}</b><span>Total in range (${s.rangeEntries} entries)</span></div></div>` + tbl(["Date", "Entries", "Total"], s.days.map(x => `<tr><td>${esc(x.date)}</td><td>${x.entries}</td><td class="r">${money(x.total)}</td></tr>`).join("")).replace("<th>Total", '<th class="r">Total');
  if (l) { $("#en").innerHTML = "<h3>Entries</h3>" + tbl(["Date", "Note", "Amount"], l.content.map(x => `<tr><td>${esc(x.entryDate)}<br><small>${esc(dt(x.createdAt))}</small></td><td>${esc(x.note || "")}</td><td class="r">${money(x.amount)}</td></tr>`).join("")).replace("<th>Amount", '<th class="r">Amount'); pager($("#pg"), l, myBank); }
}

// ---------- enquiries, audit, upload, password ----------
async function inquiries(page = 0, status = "") {
  view.innerHTML = head("Enquiries") + `<div class="filters"><label>Status<select id="sf">${["", "NEW", "CONTACTED", "CLOSED"].map(s => `<option value="${s}"${s === status ? " selected" : ""}>${s || "All"}</option>`).join("")}</select></label></div><div class="list" id="lst"></div><div class="pager" id="pg"></div>`;
  $("#sf").onchange = e => inquiries(0, e.target.value);
  const d = await run(() => api("/api/admin/inquiries" + qs({ status, page, size: 15 }))); if (!d) return;
  $("#lst").innerHTML = d.content.length ? d.content.map(x => `<div class="row-i glass"><div class="tx"><b>${esc(x.name)}</b><small>${x.phone ? `<a href="tel:${esc(x.phone.replace(/[^\d+]/g, ""))}">${esc(x.phone)}</a>` : ""} ${x.email ? `<a href="mailto:${esc(x.email)}">${esc(x.email)}</a>` : ""} \u2022 ${esc(dt(x.createdAt))}${x.serviceInterest ? " \u2022 " + esc(x.serviceInterest) : ""}</small><p>${esc(x.message)}</p></div>
    <div class="ac"><select data-s="${x.id}" aria-label="Status">${["NEW", "CONTACTED", "CLOSED"].map(s => `<option${s === x.status ? " selected" : ""}>${s}</option>`).join("")}</select><button class="btn btn-ghost sm danger" data-d="${x.id}">Delete</button></div></div>`).join("") : '<p class="empty">No enquiries.</p>';
  $("#lst").onchange = async e => { if (e.target.dataset.s) await run(() => api(`/api/admin/inquiries/${e.target.dataset.s}/status`, { method: "PATCH", body: { status: e.target.value } })).then(() => toast("Status updated")); };
  $("#lst").onclick = async e => { const b = e.target.closest("[data-d]"); if (b && confirm("Delete this enquiry?")) await run(() => api(`/api/admin/inquiries/${b.dataset.d}`, { method: "DELETE" })).then(() => inquiries(page, status)); };
  pager($("#pg"), d, p => inquiries(p, status));
}
async function audit(page = 0, type = "") {
  view.innerHTML = head("Activity log") + `<div class="filters"><label>Type<select id="tf">${["", "User", "Category", "ServiceItem", "Project", "GalleryImage", "Tool", "Client", "CompanyContact", "BankEntry", "Inquiry"].map(s => `<option value="${s}"${s === type ? " selected" : ""}>${s || "All"}</option>`).join("")}</select></label></div><div id="lst"></div><div class="pager" id="pg"></div>`;
  $("#tf").onchange = e => audit(0, e.target.value);
  const d = await run(() => api("/api/admin/audit" + qs({ entityType: type, page, size: 40 }))); if (!d) return;
  $("#lst").innerHTML = tbl(["When", "Who", "Action", "Details"], d.content.map(x => `<tr><td>${esc(dt(x.createdAt))}</td><td>${esc(x.actorUsername || "")}</td><td>${esc(x.action)}</td><td>${esc(x.details || "")}</td></tr>`).join(""));
  pager($("#pg"), d, p => audit(p, type));
}
async function upload() {
  if (!cats.length) await loadCats();
  view.innerHTML = head("Upload to gallery") + '<form class="form glass" id="uf" style="padding:1.4rem"></form>';
  const fl = R.gallery.fields; $("#uf").innerHTML = fl.map(f => field(f)).join("") + '<button class="btn">Upload</button>';
  $("#uf").onsubmit = async e => { e.preventDefault(); const v = read(e.target, fl); await run(() => api("/api/gallery", { method: "POST", form: toForm(v) })).then(r => { if (r) { toast("Uploaded"); e.target.reset(); } }); };
}
function password(forced) {
  view.innerHTML = head(forced ? "Set a new password" : "Change password") + (forced ? "<p class='sub'>You must choose a new password before you can continue.</p>" : "") + '<form class="form glass" id="pf" style="padding:1.4rem;max-width:460px"><label>Current password<input name="currentPassword" type="password" required autocomplete="current-password"></label><label>New password<input name="newPassword" type="password" minlength="8" maxlength="72" required autocomplete="new-password"><small>At least 8 characters</small></label><button class="btn">Change password</button></form>';
  $("#pf").onsubmit = async e => { e.preventDefault(); const r = await run(() => api("/api/auth/change-password", { method: "POST", body: Object.fromEntries(new FormData(e.target)) })); if (r) { me = r; toast("Password changed"); start(); } };
}

// ---------- shell ----------
const ADMIN = [["dash", "Overview", dash], ["employees", "Employees", employees], ["bank", "Bank", () => adminBank()], ["services", "Services", () => crud("services")], ["projects", "Projects", () => crud("projects")], ["gallery", "Gallery", () => crud("gallery")], ["tools", "Tools", () => crud("tools")], ["clients", "Clients", () => crud("clients")], ["contact", "Contact details", () => crud("contact")], ["categories", "Categories", () => crud("categories")], ["inquiries", "Enquiries", () => inquiries()], ["audit", "Activity log", () => audit()], ["password", "Password", () => password()]];
const staff = () => [["bank", "My bank", () => myBank()], ...(me.canUploadImages ? [["upload", "Upload to gallery", upload]] : []), ["password", "Password", () => password()]];
function route() {
  const menu = me.role === "ADMIN" ? ADMIN : staff(), id = location.hash.slice(1), cur = menu.find(m => m[0] === id) || menu[0];
  $("#side").innerHTML = menu.map(m => `<a href="#${m[0]}" class="${m[0] === cur[0] ? "on" : ""}">${m[1]}</a>`).join("");
  $("#side").classList.remove("open"); $("#burger").setAttribute("aria-expanded", false); window.scrollTo(0, 0);
  Promise.resolve(cur[2]()).catch(fail);
}
function start() {
  $("#who").textContent = me.fullName;
  if (me.mustChangePassword) { $("#side").innerHTML = ""; password(true); return; }
  if (me.role === "ADMIN") loadCats();
  route();
}
$("#logoImg").src = C.LOGO;
$("#burger").onclick = () => { const o = !$("#side").classList.contains("open"); $("#side").classList.toggle("open", o); $("#burger").setAttribute("aria-expanded", o); };
$("#logout").onclick = async () => { await api("/api/auth/logout", { method: "POST" }).catch(() => {}); location.href = "index.html"; };
addEventListener("hashchange", () => me && !me.mustChangePassword && route());
api("/api/auth/me").then(u => { me = u; start(); }).catch(() => { view.innerHTML = '<div class="glass" style="padding:2rem;border-radius:18px"><h3>Please sign in</h3><p class="sub">Your session has ended or you are not signed in.</p><a class="btn" href="index.html">Go to login</a></div>'; });
})();
