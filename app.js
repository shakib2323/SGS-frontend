(() => {
const C = window.SGS, $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safe = u => /^https?:\/\//i.test(u || "") ? u : "#";
  //newly added 
  const asset = u => {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;

  const base = C.API.replace(/\/+$/, "");
  const path = String(u).replace(/^\/+/, "");

  return path.startsWith("files/")
    ? `${base}/${path}`
    : `${base}/files/${path}`;
};
const money = n => "\u20B9" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const WRAP = { "X-Requested-With": "XMLHttpRequest" };

// async function api(path, { method = "GET", body, form } = {}) {
//   const h = { Accept: "application/json", ...WRAP };
//   let b;
//   if (form) b = form; else if (body) { h["Content-Type"] = "application/json"; b = JSON.stringify(body); }
//   const r = await fetch(C.API + path, { method, headers: h, body: b, credentials: "include" });
//   if (r.status === 204) return null;
//   const d = await r.json().catch(() => ({}));
//   if (!r.ok) { const e = new Error(d.message || "Something went wrong"); e.code = d.code; e.fields = d.fieldErrors; throw e; }
//   return d;
// }
  
async function api(path, { method = "GET", body, form } = {}) {
  const h = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest"
  };

  let b;
  if (form) {
    b = form;
  } else if (body) {
    h["Content-Type"] = "application/json";
    b = JSON.stringify(body);
  }

  let r;

  try {
    r = await fetch(C.API + path, {
      method,
      headers: h,
      body: b,
      credentials: "include",
      signal: AbortSignal.timeout(30000)
    });
  } catch (e) {
    if (e.name === "TimeoutError") {
      throw new Error("The server did not respond within 30 seconds. Please check the backend on Render.");
    }

    throw new Error(
      "Could not connect to the backend. Check Render status and browser Network errors."
    );
  }

  if (r.status === 204) return null;

  const d = await r.json().catch(() => ({}));

  if (!r.ok) {
    const e = new Error(d.message || `Request failed (${r.status})`);
    e.code = d.code;
    e.fields = d.fieldErrors;
    throw e;
  }

  return d;
}

const load = (path, fn, box) => api("/api/public" + path).then(fn).catch(() => { if (box) box.innerHTML = '<p class="empty">Content is not available right now.</p>'; });

// ---- header ----
$("#logoImg").src = C.LOGO;
 $("#coName").textContent = C.COMPANY; $("#year").textContent = "\u00A9 " + new Date().getFullYear();
const burger = $("#burger"), nav = $("#nav");
const toggle = o => { nav.classList.toggle("open", o); burger.setAttribute("aria-expanded", o); };
burger.onclick = () => toggle(!nav.classList.contains("open"));
nav.onclick = e => { if (e.target.tagName === "A") toggle(false); };
addEventListener("keydown", e => e.key === "Escape" && toggle(false));

// ---- hero slider (swipe via scroll-snap + autoplay) ----
const sl = $("#slides"), dots = $("#dots");
sl.innerHTML = C.HERO.map((s, i) => `<a class="slide" href="${esc(s.link || "#")}" ${i ? 'aria-hidden="true" tabindex="-1"' : ""}>
  <img src="${esc(s.image)}" alt="${esc(s.title)}" ${i ? 'loading="lazy"' : ""} draggable="false" onerror="this.style.display='none'">
  <div class="cap glass"><h1>${esc(s.title)}</h1><p>${esc(s.text)}</p></div></a>`).join("");
dots.innerHTML = C.HERO.map((_, i) => `<button aria-label="Slide ${i + 1}"></button>`).join("");
let cur = 0, timer, hold = false;
const go = i => { cur = (i + C.HERO.length) % C.HERO.length; sl.scrollTo({ left: cur * sl.clientWidth, behavior: "smooth" }); };
const mark = () => { cur = Math.round(sl.scrollLeft / sl.clientWidth); [...dots.children].forEach((d, i) => d.classList.toggle("on", i === cur)); };
sl.addEventListener("scroll", () => requestAnimationFrame(mark), { passive: true }); mark();
dots.onclick = e => { const i = [...dots.children].indexOf(e.target); if (i > -1) go(i); };
$("#prev").onclick = () => go(cur - 1); $("#next").onclick = () => go(cur + 1);
const play = () => { clearInterval(timer); if (!matchMedia("(prefers-reduced-motion:reduce)").matches) timer = setInterval(() => !hold && !document.hidden && go(cur + 1), 5000); };
["pointerdown", "touchstart", "mouseenter", "focusin"].forEach(e => sl.addEventListener(e, () => hold = true, { passive: true }));
["pointerup", "touchend", "mouseleave", "focusout"].forEach(e => sl.addEventListener(e, () => { hold = false; play(); }, { passive: true }));
addEventListener("resize", () => sl.scrollTo({ left: cur * sl.clientWidth })); play();

// ---- services ----
load("/services", list => {
  $("#servicesGrid").innerHTML = list.length ? list.map(s => {
    const im = s.images?.[0];
    return `<article class="card"><div class="im">${im ? `<img
  loading="lazy"
  src="${esc(asset(x.thumbUrl || x.imageUrl))}"
  alt="${esc(x.title)}"
>` : ""}</div><div class="bd">
      <h3>${esc(s.title)}</h3><p>${esc(s.shortDescription)}</p>
      ${s.features?.length ? `<ul class="feat">${s.features.slice(0, 4).map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
      ${s.warranty ? `<span class="tag">${esc(s.warranty)}</span>` : ""}${s.priceNote ? `<span class="meta">${esc(s.priceNote)}</span>` : ""}</div></article>`;
  }).join("") : '<p class="empty">Services will appear here soon.</p>';
  $("#svcSel").innerHTML += list.map(s => `<option>${esc(s.title)}</option>`).join("");
}, $("#servicesGrid"));

// ---- categories shared by projects + gallery ----
const state = { proj: { cat: "", page: 0 }, gal: { cat: "", q: "", page: 0 } };
function chips(box, cats, st, reload) {
  box.innerHTML = [{ slug: "", name: "All" }, ...cats].map(c => `<button data-s="${esc(c.slug)}" class="${c.slug === st.cat ? "on" : ""}">${esc(c.name)}</button>`).join("");
  box.onclick = e => { const b = e.target.closest("button"); if (!b) return; st.cat = b.dataset.s; st.page = 0; chips(box, cats, st, reload); reload(); };
}
const qs = o => Object.entries(o).filter(([, v]) => v !== "" && v != null).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");

// ---- projects ----
function loadProjects(append) {
  const g = $("#projGrid");
  api("/api/public/projects?" + qs({ category: state.proj.cat, page: state.proj.page, size: 9 })).then(p => {
    const html = p.content.map(x => `<article class="card"><div class="im">${x.imageUrl ? `<img loading="lazy" src="${esc(x.thumbUrl || x.imageUrl)}" alt="${esc(x.title)}">` : ""}</div><div class="bd">
      <span class="tag">${esc(x.status === "ONGOING" ? "Ongoing" : "Completed")}${x.category ? " \u2022 " + esc(x.category.name) : ""}</span>
      <h3>${esc(x.title)}</h3><p>${esc((x.description || "").slice(0, 140))}</p>
      <span class="meta">${[x.location, x.clientName, x.areaSqFt ? x.areaSqFt.toLocaleString("en-IN") + " sq ft" : "", x.completedYear || x.startedYear].filter(Boolean).map(esc).join(" \u2022 ")}</span></div></article>`).join("");
    g.innerHTML = append ? g.innerHTML + html : (html || '<p class="empty">No projects in this category yet.</p>');
    $("#projMore").hidden = p.page + 1 >= p.totalPages;
  }).catch(() => g.innerHTML = '<p class="empty">Content is not available right now.</p>');
}
$("#projMore").onclick = () => { state.proj.page++; loadProjects(true); };

// ---- gallery ----
let galItems = [];
function loadGallery(append) {
  const g = $("#galGrid");
  api("/api/public/gallery?" + qs({ category: state.gal.cat, q: state.gal.q, page: state.gal.page, size: 18 })).then(p => {
    if (!append) galItems = [];
    const start = galItems.length; galItems.push(...p.content);
    const html = p.content.map((x, i) => `<figure data-i="${start + i}">
    // <img loading="lazy" src="${esc(x.thumbUrl || x.imageUrl)}" alt="${esc(x.title)}">
    <img
  loading="lazy"
  src="${esc(asset(x.thumbUrl || x.imageUrl))}"
  alt="${esc(x.title)}"
>
    <figcaption class="glass">${esc(x.title)}</figcaption></figure>`).join("");
    g.innerHTML = append ? g.innerHTML + html : (html || '<p class="empty">No images found.</p>');
    $("#galMore").hidden = p.page + 1 >= p.totalPages;
  }).catch(() => g.innerHTML = '<p class="empty">Content is not available right now.</p>');
}
$("#galMore").onclick = () => { state.gal.page++; loadGallery(true); };
let qt; $("#galQ").oninput = e => { clearTimeout(qt); qt = setTimeout(() => { state.gal.q = e.target.value.trim(); state.gal.page = 0; loadGallery(); }, 350); };
const lb = $("#lb");
$("#galGrid").onclick = e => {
  const f = e.target.closest("figure"); if (!f) return; const x = galItems[+f.dataset.i];
  lb.querySelector("img").src = x.imageUrl; lb.querySelector("img").alt = x.title;
  lb.querySelector(".cap").innerHTML = `<b>${esc(x.title)}</b>${x.description ? "<br>" + esc(x.description) : ""}${x.socialLink ? `<br><a href="${esc(safe(x.socialLink))}" target="_blank" rel="noopener noreferrer"><u>View on social media</u></a>` : ""}`;
  lb.hidden = false;
};
lb.onclick = e => { if (e.target === lb || e.target.className === "x") lb.hidden = true; };
addEventListener("keydown", e => e.key === "Escape" && (lb.hidden = true));

load("/categories", cats => {
  chips($("#projChips"), cats, state.proj, () => loadProjects());
  chips($("#galChips"), cats, state.gal, () => loadGallery());
});
loadProjects(); loadGallery();

// ---- tools, clients, contact ----
load("/tools", list => {
  $("#toolsGrid").innerHTML = list.length ? list.map(t => {
    const inner = `<div class="im"><img loading="lazy" src="${esc(t.thumbUrl || t.imageUrl)}" alt="${esc(t.title)}"></div><div class="bd"><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p></div>`;
    return t.toolLink ? `<a class="card" href="${esc(safe(t.toolLink))}" target="_blank" rel="noopener noreferrer">${inner}</a>` : `<article class="card">${inner}</article>`;
  }).join("") : '<p class="empty">Tools will appear here soon.</p>';
}, $("#toolsGrid"));
load("/clients", list => {
  $("#clientsGrid").innerHTML = list.map(c => {
    const i = c.logoUrl ? `<img loading="lazy" src="${esc(c.logoUrl)}" alt="${esc(c.name)}">` : esc(c.name);
    return c.websiteUrl ? `<a href="${esc(safe(c.websiteUrl))}" target="_blank" rel="noopener noreferrer">${i}</a>` : `<div>${i}</div>`;
  }).join("");
}, $("#clientsGrid"));
const LABEL = { PHONE: "Phone", EMAIL: "Email", ADDRESS: "Address", WHATSAPP: "WhatsApp", TELEGRAM: "Telegram", SMS: "SMS", WORKING_HOURS: "Working hours", MAP_URL: "Map" };
const clean = v => v.replace(/[^\d+]/g, "");
load("/contact", list => {
  const href = c => ({ PHONE: "tel:" + clean(c.value), SMS: "sms:" + clean(c.value), EMAIL: "mailto:" + c.value, WHATSAPP: "https://wa.me/" + clean(c.value).replace("+", ""), MAP_URL: safe(c.value) }[c.type]);
  $("#contactList").innerHTML = list.map(c => { const h = href(c); const t = c.type === "MAP_URL" ? "Open in maps" : c.value;
    return `<li><small>${esc(c.label || LABEL[c.type])}</small>${h ? `<a href="${esc(h)}" ${/^http/.test(h) ? 'target="_blank" rel="noopener noreferrer"' : ""}>${esc(t)}</a>` : esc(c.value)}</li>`; }).join("");
}, $("#contactList"));

// ---- inquiry form ----
let tsToken = "";
if (C.TURNSTILE_SITE_KEY) { const s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=tsReady"; s.async = true; document.head.append(s);
  window.tsReady = () => turnstile.render("#ts", { sitekey: C.TURNSTILE_SITE_KEY, callback: t => tsToken = t }); }
$("#inqForm").onsubmit = async e => {
  e.preventDefault(); const f = e.target, m = $("#inqMsg"), d = Object.fromEntries(new FormData(f));
  Object.keys(d).forEach(k => d[k] = String(d[k]).trim() || null); d.message = d.message || ""; d.turnstileToken = tsToken || null;
  m.className = "msg"; m.textContent = "Sending\u2026";
  try { const r = await api("/api/public/inquiries", { method: "POST", body: d }); m.className = "msg ok"; m.textContent = r.message || "Thank you. We will contact you soon."; f.reset(); }
  catch (er) { m.className = "msg err"; m.textContent = er.fields ? Object.values(er.fields)[0] : er.message; }
};

// ---- login + employee bank + admin overview ----
const dlg = $("#dlg"); let me = null;
const open = html => { dlg.innerHTML = html; if (!dlg.open) dlg.showModal(); return dlg; };
const closeBtn = '<button class="btn btn-ghost" data-close>Close</button>';
dlg.onclick = e => { if (e.target === dlg || e.target.hasAttribute("data-close")) dlg.close(); };
const err = (el, e) => { el.className = "msg err"; el.textContent = e.fields ? Object.values(e.fields)[0] : e.message; };

// function loginView() {
//   open(`<div class="top"><h3>Staff login</h3>${closeBtn}</div><form class="form" id="lf"><label>Username<input name="username" required autocomplete="username"></label>
//     <label>Password<input name="password" type="password" required autocomplete="current-password"></label><button class="btn">Sign in</button><p class="msg" id="lm" role="alert"></p></form>`);
//   $("#lf").onsubmit = async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target));
//     try { me = await api("/api/auth/login", { method: "POST", body: d }); home(); } catch (x) { err($("#lm"), x); } };
// }
  
function loginView() {
  open(`<div class="top"><h3>Staff login</h3>${closeBtn}</div>
    <form class="form" id="lf">
      <label>Username<input name="username" required autocomplete="username"></label>
      <label>Password<input name="password" type="password" required autocomplete="current-password"></label>
      <button class="btn" type="submit">Sign in</button>
      <p class="msg" id="lm" role="alert"></p>
    </form>`);

  $("#lf").onsubmit = async e => {
    e.preventDefault();

    const form = e.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const message = $("#lm");
    const d = Object.fromEntries(new FormData(form));

    button.disabled = true;
    message.className = "msg";
    message.textContent = "Signing in...";

    try {
      console.log("[login] Sending login request");

      me = await api("/api/auth/login", {
        method: "POST",
        body: d
      });

      console.log("[login] Login response received");

      message.textContent = "Verifying session...";

      const session = await api("/api/auth/me");

      if (!session || !session.id && !session.username && !session.fullName) {
        throw new Error(
          "Login succeeded, but the server did not confirm your session."
        );
      }

      me = session;
      console.log("[login] Session verified");
      location.href = "panel.html";

    } catch (x) {
      console.error("[login] Error:", x);
      me = null;
      message.className = "msg err";
      message.textContent =
        x.message || "Login or session verification failed.";
    } finally {
      button.disabled = false;
    }
  };
}

function home() { location.href = "panel.html"; }
$("#loginBtn").onclick = () => me ? home() : loginView();
api("/api/auth/me").then(u => { me = u; $("#loginBtn").textContent = u.fullName.split(" ")[0]; }).catch(() => {});
})();

function startHeroAutoSlide() {
    const slides = document.querySelector(".slides");

    if (!slides) return;

    let direction = 1; // 1 = right, -1 = left
    const speed = 1;   // pixels per frame

    setInterval(() => {
        const maxScroll = slides.scrollWidth - slides.clientWidth;

        if (maxScroll <= 0) return;

        slides.scrollLeft += direction * speed;

        if (slides.scrollLeft >= maxScroll - 1) {
            direction = -1;
        } else if (slides.scrollLeft <= 0) {
            direction = 1;
        }
    }, 20);
}

startHeroAutoSlide();
