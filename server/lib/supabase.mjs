import { createClient } from "@supabase/supabase-js";

let client;

export function getSupabase(config) {
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return client;
}

export async function createLead(config, lead) {
  const supabase = getSupabase(config);
  const { data, error } = await supabase
    .from("leads")
    .insert({
      full_name: lead.fullName,
      company_name: lead.companyName,
      email: lead.email,
      phone: lead.phone,
      service_required: lead.serviceRequired,
      budget: lead.budget || null,
      message: lead.message,
      submitted_at: lead.submittedAt,
      visitor_ip: lead.visitorIp,
      browser: lead.browser,
      country: lead.country || null,
      recaptcha_score: lead.recaptchaScore,
      status: "new"
    })
    .select("*")
    .single();

  if (error) throw databaseError(error);
  await addLeadEvent(config, data.id, "created", "Lead submitted from website.");
  return data;
}

export async function listLeads(config, filters) {
  const supabase = getSupabase(config);
  const page = Math.max(Number(filters.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize || 25), 1), 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("leads").select("*", { count: "exact" }).order("submitted_at", { ascending: false }).range(from, to);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.fromDate) query = query.gte("submitted_at", `${filters.fromDate}T00:00:00.000Z`);
  if (filters.toDate) query = query.lte("submitted_at", `${filters.toDate}T23:59:59.999Z`);
  if (filters.search) {
    const safeSearch = String(filters.search).replace(/[%,]/g, "");
    query = query.or(`full_name.ilike.%${safeSearch}%,company_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%,service_required.ilike.%${safeSearch}%`);
  }

  const { data, error, count } = await query;
  if (error) throw databaseError(error);
  return { leads: data || [], total: count || 0, page, pageSize };
}

export async function listAllLeads(config, filters = {}) {
  const supabase = getSupabase(config);
  let query = supabase.from("leads").select("*").order("submitted_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.fromDate) query = query.gte("submitted_at", `${filters.fromDate}T00:00:00.000Z`);
  if (filters.toDate) query = query.lte("submitted_at", `${filters.toDate}T23:59:59.999Z`);
  const { data, error } = await query;
  if (error) throw databaseError(error);
  return data || [];
}

export async function getLeadStats(config) {
  const supabase = getSupabase(config);
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const [total, today, month, newLeads, contacted, closed] = await Promise.all([
    countLeads(supabase),
    countLeads(supabase, (query) => query.gte("submitted_at", todayStart)),
    countLeads(supabase, (query) => query.gte("submitted_at", monthStart)),
    countLeads(supabase, (query) => query.eq("status", "new")),
    countLeads(supabase, (query) => query.eq("status", "contacted")),
    countLeads(supabase, (query) => query.eq("status", "closed"))
  ]);

  return { total, today, month, new: newLeads, contacted, closed };
}

export async function updateLeadStatus(config, id, status) {
  const supabase = getSupabase(config);
  const { data, error } = await supabase
    .from("leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw databaseError(error);
  await addLeadEvent(config, id, "status_changed", `Status changed to ${status}.`);
  return data;
}

export async function deleteLead(config, id) {
  const supabase = getSupabase(config);
  await addLeadEvent(config, id, "deleted", "Lead deleted from admin dashboard.");
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw databaseError(error);
}

async function addLeadEvent(config, leadId, eventType, note) {
  const supabase = getSupabase(config);
  const { error } = await supabase.from("lead_events").insert({ lead_id: leadId, event_type: eventType, note });
  if (error) console.error("Lead event write failed", error);
}

async function countLeads(supabase, apply = (query) => query) {
  const query = apply(supabase.from("leads").select("id", { count: "exact", head: true }));
  const { count, error } = await query;
  if (error) throw databaseError(error);
  return count || 0;
}

function databaseError(error) {
  const err = new Error("Database operation failed.");
  err.statusCode = 500;
  err.cause = error;
  return err;
}
