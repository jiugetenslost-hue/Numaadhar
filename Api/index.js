// ═══════════════════════════════════════════════════════
//   SRA CYBER TECH — Number & Aadhar Search API
//   Cloudflare Worker  |  @Lejent36
// ═══════════════════════════════════════════════════════

// ── API Keys ─────────────────────────────────────────
const API_KEYS = new Set([
  "cybertech",
  "sracyber"
]);

// ── HF Space URL (source API) ─────────────────────────
const HF = "https://tfqdeadlo-1-78bapi.hf.space";

// ── Credit ────────────────────────────────────────────
const CREDIT = {
  name:      "SRA CYBER TECH",
  developer: "@Lejent36",
  contact:   "https://t.me/LEGENTOSINT",
  footer:    "Powered by SRA Cyber Tech"
};

// ── JSON response helper ──────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

// ── Upstream credits hata do ──────────────────────────
function clean(obj) {
  if (Array.isArray(obj)) return obj.map(clean);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (["api_by","contact","telegram","channel","developer"]
            .includes(k.toLowerCase())) continue;
      out[k] = clean(v);
    }
    return out;
  }
  if (typeof obj === "string") {
    return obj
      .split("\n")
      .filter(l => !/^\s*(telegram\s*:|channel\s*:)/i.test(l))
      .join("\n")
      .trim();
  }
  return obj;
}

// ── HF Space se ek search karo ───────────────────────
async function hfSearch(q, field, mode, limit) {
  const params = new URLSearchParams({ q, field, mode, limit, pretty: "false" });
  const res = await fetch(`${HF}/search?${params}`, {
    headers: { Accept: "application/json" },
    cf: { cacheTtl: 60, cacheEverything: true }
  });
  if (!res.ok) throw new Error(`HF ${res.status}`);
  return res.json();
}

// ═══════════════════════════════════════════════════════
//   Main Worker
// ═══════════════════════════════════════════════════════
export default {
  async fetch(req) {
    const url = new URL(req.url);
    const p   = url.pathname;

    // ── Health check ──────────────────────────────────
    if (p === "/" || p === "") {
      return json({
        status:  true,
        message: "SRA Cyber Tech API chal rahi hai ✅",
        endpoints: {
          number_search:    `/api?key=cybertech&number=9876543210`,
          aadhar_search:    `/api?key=cybertech&aadhar=123456789012`,
          dono_ek_saath:    `/api?key=cybertech&number=9876543210&aadhar=123456789012`,
          name_search:      `/api?key=cybertech&name=Rahul`,
          address_search:   `/api?key=cybertech&address=Delhi`,
          pincode_search:   `/api?key=cybertech&pincode=110001`,
          limit_example:    `/api?key=cybertech&number=9876543210&limit=5`,
        },
        api_keys: ["cybertech", "sracyber"],
        credit: CREDIT
      });
    }

    // ── 404 ───────────────────────────────────────────
    if (p !== "/api") {
      return json({ status: false, message: "Route nahi mila. /api use karo.", credit: CREDIT }, 404);
    }

    // ── API Key check ─────────────────────────────────
    const key = url.searchParams.get("key") || "";
    if (!API_KEYS.has(key)) {
      return json({
        status:  false,
        message: "Invalid ya missing API Key",
        hint:    "?key=cybertech ya ?key=sracyber use karo",
        credit:  CREDIT
      }, 401);
    }

    // ── Query params ──────────────────────────────────
    const number  = (url.searchParams.get("number")  || "").trim();
    const aadhar  = (url.searchParams.get("aadhar")  || "").trim();
    const name    = (url.searchParams.get("name")    || "").trim();
    const address = (url.searchParams.get("address") || "").trim();
    const pincode = (url.searchParams.get("pincode") || "").trim();
    const limit   = Math.min(parseInt(url.searchParams.get("limit") || "10", 10), 50) || 10;

    // ── Kuch toh dena hoga ───────────────────────────
    if (!number && !aadhar && !name && !address && !pincode) {
      return json({
        status:  false,
        message: "Koi query nahi di",
        zarori:  "number, aadhar, name, address ya pincode mein se koi ek do",
        example: "/api?key=cybertech&number=9876543210",
        credit:  CREDIT
      }, 400);
    }

    // ── Validation ────────────────────────────────────
    if (number && !/^\d{10}$/.test(number)) {
      return json({ status: false, message: "Number 10 digit ka hona chahiye", credit: CREDIT }, 400);
    }
    if (aadhar && !/^\d{12}$/.test(aadhar)) {
      return json({ status: false, message: "Aadhar 12 digit ka hona chahiye", credit: CREDIT }, 400);
    }
    if (pincode && !/^\d{6}$/.test(pincode)) {
      return json({ status: false, message: "Pincode 6 digit ka hona chahiye", credit: CREDIT }, 400);
    }

    // ── Parallel searches ─────────────────────────────
    try {
      const tasks = [];

      if (number)  tasks.push({ type: "number",  p: hfSearch(number,  "phoneNumber",  "exact",    limit) });
      if (aadhar)  tasks.push({ type: "aadhar",  p: hfSearch(aadhar,  "aadharNumber", "exact",    limit) });
      if (name)    tasks.push({ type: "name",    p: hfSearch(name,    "name",         "contains", limit) });
      if (address) tasks.push({ type: "address", p: hfSearch(address, "address",      "contains", limit) });
      if (pincode) tasks.push({ type: "pincode", p: hfSearch(pincode, "pincode",      "exact",    limit) });

      const settled = await Promise.allSettled(tasks.map(t => t.p));

      const out      = { status: false, credit: CREDIT };
      let totalFound = 0;

      for (let i = 0; i < tasks.length; i++) {
        const type   = tasks[i].type;
        const result = settled[i];

        if (result.status === "rejected") {
          out[type] = { status: false, error: "Source se data nahi mila" };
          continue;
        }

        const data    = clean(result.value);
        const results = data.results || [];
        const count   = typeof data.count === "number" ? data.count : results.length;
        totalFound   += count;

        out[type] = {
          status:  count > 0,
          total:   count,
          results: results
        };
      }

      out.status      = totalFound > 0;
      out.total_found = totalFound;

      return json(out, 200);

    } catch (e) {
      return json({
        status:  false,
        message: "Server error aa gaya",
        error:   e.message,
        credit:  CREDIT
      }, 500);
    }
  }
};
