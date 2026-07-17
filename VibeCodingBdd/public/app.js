fetch("/api/auth/me").then(function(r) {
  if (r.status === 401) window.location.href = "/login";
}).catch(function() {});

var refreshBtn = document.getElementById("refreshBtn");
var statusEl = document.getElementById("status");
var allGridEl = document.getElementById("allGrid");
var paginationEl = document.getElementById("pagination");
var searchInput = document.getElementById("searchInput");
var onlineGridEl = document.getElementById("onlineGrid");
var onlineCountEl = document.getElementById("onlineCount");
var allCountEl = document.getElementById("allCount");
var lastUpdateEl = document.getElementById("lastUpdate");

var PAGE_SIZE = 50;
var currentPage = 0;
var totalRows = 0;
var loading = false;
var searchTimeout = null;
var adminsLoaded = false;

function esc(s) { return String(s||"").replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]; }); }

function fmtHours(seconds) {
  if (seconds == null || seconds === 0) return null;
  var h = Number(seconds) / 3600;
  if (h >= 1) return h.toFixed(1) + "\u0447";
  return Math.round(Number(seconds) / 60) + "\u043c";
}

function fmtAge(created_at) {
  if (!created_at) return null;
  try {
    var d = new Date(created_at);
    if (isNaN(d.getTime())) return null;
    var now = new Date();
    var days = Math.floor((now - d) / 86400000);
    if (days < 1) return "\u0441\u0435\u0433\u043e\u0434\u043d\u044f";
    if (days < 30) return days + " \u0434. \u043d\u0430\u0437\u0430\u0434";
    if (days < 365) return Math.floor(days / 30) + " \u043c. \u043d\u0430\u0437\u0430\u0434";
    return Math.floor(days / 365) + " \u0433. " + Math.floor((days % 365) / 30) + " \u043c.";
  } catch(e) { return null; }
}

function fmtDateShort(v) {
  if (!v) return null;
  try { return new Date(v).toLocaleDateString("ru-RU"); } catch(e) { return null; }
}

function teamTag(team) {
  if (!team || team === "none" || team === "HIDE" || team === "SPEC") return '<span class="tag" style="background:rgba(168,85,247,0.15);color:#c084fc;">SPEC</span>';
  if (team === "CT") return '<span class="tag" style="background:rgba(59,130,246,0.15);color:#60a5fa;">CT</span>';
  if (team === "T") return '<span class="tag" style="background:rgba(245,158,11,0.15);color:#fbbf24;">T</span>';
  return '<span class="tag" style="background:rgba(107,114,128,0.15);color:#9ca3af;">' + esc(team) + '</span>';
}

function faceitBadge(level, elo) {
  if (level == null) return "";
  var cls = level >= 10 ? "faceit-lvl-10" : level >= 7 ? "faceit-lvl-7" : level >= 4 ? "faceit-lvl-4" : "text-gray-400";
  var txt = '<span class="' + cls + ' font-bold">' + level + '</span>';
  if (elo) txt += '<span class="text-gray-600 text-[10px] ml-0.5">' + elo + '</span>';
  return '<span class="tag" style="background:rgba(255,255,255,0.06);">' + txt + '</span>';
}

function roleColor(groupName) {
  var map = {
    "GLADMIN": "#f95dff", "G": "#f95dff", "\u0413\u043b. \u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440": "#f95dff",
    "STADMIN": "#22c7aa", "S": "#22c7aa", "\u0421\u0442. \u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440": "#22c7aa", "\u0421\u0442. \u0410\u0434\u043c\u0438\u043d": "#22c7aa",
    "STMODER": "#8c56f0", "\u0421\u0442. \u041c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440": "#8c56f0",
    "MODER": "#e75288", "\u041c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440": "#e75288",
    "MLMODER": "#e2bb6d", "\u041c\u043b. \u041c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440": "#e2bb6d", "\u041c\u043b. \u041c\u043e\u0434\u0435\u0440": "#e2bb6d",
    "STAFF": "#eab308", "\u0421\u0442\u0430\u0444\u0444": "#eab308",
    "admin": "#6b7280", "admin+": "#6b7280",
    "\u0412\u043b\u0430\u0434\u0435\u043b\u0435\u0446": "#ff3c3c", "\u041a\u0443\u0440\u0430\u0442\u043e\u0440": "#ff8c00",
    "\u0420\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u0447\u0438\u043a": "#3a84c8",
    "\u0421\u043f\u0435\u0446. \u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440": "#d39ae1",
    "\u041c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440 Discord": "#bd458c",
    "\u041c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440 \u043c\u0435\u0441\u044f\u0446\u0430": "#da5f23",
    "\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440": "#ebc04e", "\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440 +": "#ffcc00"
  };
  return map[groupName] || "#6b7280";
}

function roleTag(groupName, groupDisplayName) {
  if (!groupName) return "";
  var label = groupDisplayName || groupName;
  var color = roleColor(groupName);
  return '<span class="tag" style="background:' + color + '18;color:' + color + ';">' + esc(label) + '</span>';
}

function renderCard(player, isOnline) {
  var steamId = player.steam_id || player.steamid || "";
  var name = player.db_name || player.name || player.nickname || steamId;
  var avatar = player.db_avatar || player.avatar_full || player.avatar || "";
  var server = player._server || {};
  var serverName = server.site_name || server.domain || server.name || "";
  var mapName = server.live_data?.map || server.map || "";
  var ip = server.ip || "";
  var port = server.port || "";
  var team = player.team || "";
  var kills = player.db_kills != null ? player.db_kills : (player.kills != null ? player.kills : null);
  var deaths = player.db_deaths != null ? player.db_deaths : (player.deaths != null ? player.deaths : null);
  var playtime = player.db_playtime || player.playtime || null;
  var faceitLevel = player.db_faceit_level || player.faceit_level;
  var faceitElo = player.db_faceit_elo || player.faceit_elo;
  var groupName = player.group_name || "";
  var groupDisplay = player.group_display_name || groupName;
  var fearCreatedAt = player.db_fear_created_at || player.created_at;
  var ping = player.ping != null ? player.ping : (player.db_ping != null ? player.db_ping : null);
  var fearRank = player.db_rank || player.rank || null;
  var connectUrl = ip && port ? "steam://connect/" + ip + ":" + port : null;
  var steamUrl = "https://steamcommunity.com/profiles/" + steamId;
  var fearUrl = "https://fearproject.ru/profile/" + steamId;

  var kd = "-";
  if (kills != null && deaths != null && deaths > 0) kd = (kills / deaths).toFixed(1);
  else if (kills != null) kd = kills + "/0";

  var items = [];
  if (serverName) items.push(esc(serverName));
  if (mapName) items.push(esc(mapName));
  var playtimeStr = fmtHours(playtime);
  if (playtimeStr) items.push(playtimeStr + " \u043d\u0430 \u0441\u0430\u0439\u0442\u0435");
  var ageStr = fmtAge(fearCreatedAt);
  if (ageStr) items.push(ageStr);

  var html = '<div class="admin-card' + (isOnline ? ' online' : '') + ' rounded-xl bg-white/[0.03] p-3 flex flex-col gap-2 fade-in">';

  html += '<div class="flex items-start gap-2.5">';
  html += '<div class="relative shrink-0">';
  html += '<img src="' + esc(avatar) + '" alt="" class="w-10 h-10 rounded-lg object-cover">';
  if (isOnline) html += '<div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0a0a0c]"></div>';
  html += '</div>';

  html += '<div class="flex-1 min-w-0">';
  html += '<div class="flex items-center gap-1.5 flex-wrap">';
  html += '<span class="text-sm font-semibold text-white truncate max-w-[160px]">' + esc(name) + '</span>';
  if (groupName) html += roleTag(groupName, groupDisplay);
  if (team && isOnline) html += teamTag(team);
  html += '</div>';
  html += '<div class="text-[11px] text-gray-500 font-mono mt-0.5">' + esc(steamId) + '</div>';
  html += '</div>';

  if (connectUrl) {
    html += '<a href="' + connectUrl + '" class="connect-btn shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1" title="\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0438\u0442\u044c\u0441\u044f"><i class="ph ph-plugs text-xs"></i>Connect</a>';
  }
  html += '</div>';

  if (items.length > 0) {
    html += '<div class="flex items-center gap-1.5 flex-wrap text-[11px] text-gray-500">';
    items.forEach(function(item, i) {
      if (i > 0) html += '<span class="text-gray-700">\u00b7</span>';
      html += '<span>' + item + '</span>';
    });
    html += '</div>';
  }

  html += '<div class="flex items-center justify-between">';
  html += '<div class="flex items-center gap-1.5 flex-wrap">';
  if (kills != null || deaths != null) {
    html += '<span class="tag" style="background:rgba(255,255,255,0.06);"><span class="text-gray-400 text-[10px]">K/D</span> <span class="text-white font-semibold">' + kd + '</span></span>';
  }
  if (faceitLevel != null) html += faceitBadge(faceitLevel, faceitElo);
  if (ping != null) html += '<span class="tag" style="background:rgba(255,255,255,0.06);"><span class="text-gray-400 text-[10px]">PING</span> <span class="text-white font-semibold">' + ping + 'ms</span></span>';
  html += '</div>';

  html += '<div class="flex items-center gap-1">';
  html += '<a href="' + fearUrl + '" target="_blank" class="p-1 rounded hover:bg-white/10 transition-colors" title="Fear Profile"><i class="ph ph-user text-gray-500 hover:text-white text-xs"></i></a>';
  html += '<a href="' + steamUrl + '" target="_blank" class="p-1 rounded hover:bg-white/10 transition-colors" title="Steam Profile"><i class="ph ph-steam-logo text-gray-500 hover:text-white text-xs"></i></a>';
  html += '<button onclick="copyToClipboard(\'' + esc(steamId) + '\', this)" class="p-1 rounded hover:bg-white/10 transition-colors" title="SteamID"><i class="ph ph-copy text-gray-500 hover:text-white text-xs"></i></button>';
  if (ip && port) {
    html += '<button onclick="copyToClipboard(\'' + esc(ip + ':' + port) + '\', this)" class="p-1 rounded hover:bg-white/10 transition-colors" title="IP:PORT"><i class="ph ph-link text-gray-500 hover:text-white text-xs"></i></button>';
  }
  html += '</div>';

  html += '</div>';
  html += '</div>';

  return html;
}

function copyToClipboard(text, el) {
  navigator.clipboard.writeText(text).then(function() {
    var orig = el.innerHTML;
    el.innerHTML = '<i class="ph ph-check text-emerald-400 text-xs"></i>';
    setTimeout(function() { el.innerHTML = orig; }, 1000);
  });
}

function clearAllCards() {
  allGridEl.innerHTML = '';
  currentPage = 0;
  totalRows = 0;
  allGridEl.innerHTML = '<div class="col-span-full text-center py-6 text-gray-500 text-xs">\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...</div>';
}

async function loadPage(reset) {
  if (loading) return;
  if (!reset && currentPage * PAGE_SIZE >= totalRows && totalRows > 0) return;
  loading = true;

  if (reset) clearAllCards();

  var search = searchInput ? searchInput.value.trim() : "";
  var offset = reset ? 0 : currentPage * PAGE_SIZE;
  var url = "/api/admins?limit=" + PAGE_SIZE + "&offset=" + offset + "&sortBy=admin_id&sortDir=DESC" + (search ? "&search=" + encodeURIComponent(search) : "");

  try {
    var res = await fetch(url);
    var data = await res.json();
    totalRows = data.total || 0;
    var rows = data.rows || [];

    if (reset) allGridEl.innerHTML = '';

    var html = '';
    rows.forEach(function(row) { html += renderCard(row, false); });
    allGridEl.insertAdjacentHTML('beforeend', html);

    currentPage++;
    if (paginationEl) paginationEl.textContent = "\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u043e " + Math.min(currentPage * PAGE_SIZE, totalRows) + " \u0438\u0437 " + totalRows;
    if (allCountEl) allCountEl.textContent = "(" + totalRows + ")";
  } catch (error) {
    if (paginationEl) paginationEl.textContent = "\u041e\u0448\u0438\u0431\u043a\u0430: " + error.message;
  } finally {
    loading = false;
  }
}

// Infinite scroll
var observer = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting && !loading) loadPage(false);
  });
}, { rootMargin: "300px" });

var sentinel = document.createElement("div");
sentinel.id = "scrollSentinel";
sentinel.className = "h-1";
allGridEl.parentElement.appendChild(sentinel);
observer.observe(sentinel);

// Search
if (searchInput) {
  searchInput.addEventListener("input", function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function() { loadPage(true); }, 300);
  });
}

// Tabs
document.querySelectorAll(".tab-btn").forEach(function(btn) {
  btn.addEventListener("click", function() {
    document.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
    document.querySelectorAll(".tab-content").forEach(function(c) { c.classList.remove("active"); });
    btn.classList.add("active");
    var tab = document.getElementById("tab-" + btn.dataset.tab);
    if (tab) tab.classList.add("active");
    if (btn.dataset.tab === "all" && !adminsLoaded) {
      adminsLoaded = true;
      loadPage(true);
    }
  });
});

// Online admins
async function loadOnlineAdmins() {
  try {
    var res = await fetch("/api/servers");
    var data = await res.json();
    var servers = data.servers || [];

    var allPlayers = [];
    servers.forEach(function(s) {
      (s.live_data && s.live_data.players || []).forEach(function(p) {
        if (p.is_admin) {
          p._server = s;
          allPlayers.push(p);
        }
      });
    });

    var seen = {};
    var unique = allPlayers.filter(function(p) {
      if (seen[p.steam_id]) return false;
      seen[p.steam_id] = true;
      return true;
    });

    if (onlineCountEl) onlineCountEl.textContent = "(" + unique.length + ")";

    if (unique.length === 0) {
      onlineGridEl.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500 text-sm">\u041d\u0438\u043a\u043e\u0433\u043e \u043d\u0435\u0442 \u043e\u043d\u043b\u0430\u0439\u043d</div>';
      return;
    }

    var html = '';
    unique.forEach(function(p) { html += renderCard(p, true); });
    onlineGridEl.innerHTML = html;

    if (lastUpdateEl) lastUpdateEl.textContent = "\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e: " + new Date().toLocaleTimeString("ru-RU");
  } catch (error) {
    onlineGridEl.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500 text-sm">\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c</div>';
  }
}

// Refresh
if (refreshBtn) {
  refreshBtn.addEventListener("click", async function() {
    try {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<i class="ph ph-arrows-clockwise animate-spin"></i> \u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435...';
      var response = await fetch("/api/refresh", { method: "POST" });
      var data = await response.json();
      if (!response.ok) throw new Error(data.error || "\u041e\u0448\u0438\u0431\u043a\u0430");
      setTimeout(function() { loadOnlineAdmins(); }, 3000);
    } catch (error) {
      alert(error.message);
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '<i class="ph ph-arrows-clockwise"></i> \u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c';
    }
  });
}

// Logout
var logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async function() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  });
}

setInterval(loadOnlineAdmins, 15000);
loadOnlineAdmins();
