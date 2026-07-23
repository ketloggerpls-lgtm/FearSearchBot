const logger = require("./logger");

const STEAM_API_KEY = process.env.STEAM_API_KEY || "";
const STEAM_API_BASE = "https://api.steampowered.com";
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSteamAccountCreationDates(steamids) {
  if (!STEAM_API_KEY) {
    logger.warn("STEAM_API_KEY not configured");
    return {};
  }
  if (!steamids || !steamids.length) return {};

  const unique = [...new Set(steamids.map(String))];
  const result = {};
  const toFetch = [];

  // Check cache first
  const now = Date.now();
  for (const sid of unique) {
    const cached = cache.get(sid);
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      result[sid] = cached.timecreated;
    } else {
      toFetch.push(sid);
    }
  }

  // Batch in chunks of 100
  for (let i = 0; i < toFetch.length; i += 100) {
    const batch = toFetch.slice(i, i + 100);
    const url = `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(STEAM_API_KEY)}&steamids=${batch.join(",")}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        logger.warn("Steam API error", { status: res.status, batchSize: batch.length });
        continue;
      }
      const data = await res.json();
      const players = (data.response && data.response.players) || [];
      for (const p of players) {
        const sid = String(p.steamid);
        const timecreated = p.timecreated || null;
        result[sid] = timecreated;
        cache.set(sid, { timecreated, ts: now });
      }
    } catch (e) {
      logger.warn("Steam API fetch failed", { error: e.message, batchSize: batch.length });
    }
    // Small delay between batches
    if (i + 100 < toFetch.length) await sleepMs(200);
  }

  return result;
}

module.exports = { fetchSteamAccountCreationDates };
