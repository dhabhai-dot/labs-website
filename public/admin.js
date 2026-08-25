const loginPanel = document.querySelector("#loginPanel");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#loginForm");
const loginStatus = document.querySelector("#loginStatus");
const dashboardStatus = document.querySelector("#dashboardStatus");
const leadRows = document.querySelector("#leadRows");
const filters = {
  search: document.querySelector("#searchInput"),
  from: document.querySelector("#fromDate"),
  to: document.querySelector("#toDate"),
  status: document.querySelector("#statusFilter"),
  read: document.querySelector("#readFilter")
};

init();

async function init() {
  const session = await api("/api/admin/session", { silent: true });
  if (session?.ok) showDashboard();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.textContent = "Checking...";
  loginStatus.classList.remove("error");
  const payload = Object.fromEntries(new FormData(loginForm).entries());
  const result = await api("/api/admin/login", { method: "POST", body: payload });
  if (!result?.ok) {
    loginStatus.textContent = result?.error || "Unable to login.";
    loginStatus.classList.add("error");
    return;
  }
  loginForm.reset();
  showDashboard();
});

document.querySelector("#logoutButton").addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST", body: {} });
  dashboard.classList.add("hidden");
  loginPanel.classList.remove("hidden");
});

document.querySelector("#filterButton").addEventListener("click", loadLeads);
Object.values(filters).forEach((field) => field.addEventListener("keydown", (event) => { if (event.key === "Enter") loadLeads(); }));

async function showDashboard() {
  loginPanel.classList.add("hidden");
  dashboard.classList.remove("hidden");
  await Promise.all([loadStats(), loadLeads()]);
}

async function loadStats() {
  const result = await api("/api/admin/stats");
  if (!result?.ok) return;
  document.querySelector("#totalLeads").textContent = result.stats.total;
  document.querySelector("#todayLeads").textContent = result.stats.today;
  document.querySelector("#monthLeads").textContent = result.stats.month;
  document.querySelector("#unreadLeads").textContent = result.stats.unread;
}

async function loadLeads() {
  dashboardStatus.textContent = "Loading leads...";
  dashboardStatus.classList.remove("error");
  const query = buildQuery();
  document.querySelector("#csvExport").href = `/api/admin/export.csv${query}`;
  document.querySelector("#excelExport").href = `/api/admin/export.xlsx${query}`;
  const result = await api(`/api/admin/leads${query}`);
  if (!result?.ok) {
    dashboardStatus.textContent = result?.error || "Unable to load leads.";
    dashboardStatus.classList.add("error");
    return;
  }
  renderLeads(result.leads || []);
  dashboardStatus.textContent = `${result.total} lead${result.total === 1 ? "" : "s"} found.`;
}

function renderLeads(leads) {
  leadRows.innerHTML = leads.map((lead) => `
    <tr>
      <td><div class="lead-name">${escapeHtml(lead.full_name)}</div><div class="lead-meta">${escapeHtml(lead.company_name)}<br>${escapeHtml(lead.email)}<br>${escapeHtml(lead.phone)}</div></td>
      <td>${escapeHtml(lead.service_required)}<br><span class="lead-meta">${escapeHtml(lead.budget || "No budget")} / ${escapeHtml(lead.timeline || "No timeline")}</span></td>
      <td>${escapeHtml(lead.message)}</td>
      <td>${formatDate(lead.submitted_at)}<br><span class="lead-meta">${escapeHtml(lead.visitor_ip || lead.country || "IP unavailable")}</span></td>
      <td><span class="badge ${lead.is_read ? "read" : "unread"}">${lead.is_read ? "Read" : "Unread"}</span></td>
      <td><span class="badge">${escapeHtml(lead.status)}</span></td>
      <td><div class="actions"><button data-action="read" data-id="${lead.id}">${lead.is_read ? "Mark Unread" : "Mark Read"}</button><button data-action="contacted" data-id="${lead.id}">Contacted</button><button data-action="closed" data-id="${lead.id}">Closed</button><button class="danger" data-action="delete" data-id="${lead.id}">Delete</button></div></td>
    </tr>
  `).join("") || `<tr><td colspan="7">No enquiries found.</td></tr>`;

  leadRows.querySelectorAll("button").forEach((button) => button.addEventListener("click", handleLeadAction));
}

async function handleLeadAction(event) {
  const id = event.currentTarget.dataset.id;
  const action = event.currentTarget.dataset.action;
  if (action === "delete") {
    if (!confirm("Delete this lead permanently?")) return;
    await api(`/api/admin/leads/${id}`, { method: "DELETE" });
  } else if (action === "read") {
    const row = event.currentTarget.closest("tr");
    const isUnread = Boolean(row?.querySelector(".badge.unread"));
    await api(`/api/admin/leads/${id}`, { method: "PATCH", body: { isRead: isUnread } });
  } else {
    await api(`/api/admin/leads/${id}`, { method: "PATCH", body: { status: action } });
  }
  await Promise.all([loadStats(), loadLeads()]);
}

function buildQuery() {
  const params = new URLSearchParams();
  if (filters.search.value.trim()) params.set("search", filters.search.value.trim());
  if (filters.from.value) params.set("from", filters.from.value);
  if (filters.to.value) params.set("to", filters.to.value);
  if (filters.status.value) params.set("status", filters.status.value);
  if (filters.read.value) params.set("read", filters.read.value);
  const text = params.toString();
  return text ? `?${text}` : "";
}

async function api(url, options = {}) {
  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: "same-origin"
    });
    const result = await response.json();
    if (!response.ok && !options.silent) return result;
    return result;
  } catch (error) {
    if (!options.silent) return { ok: false, error: error.message };
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[char]));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
