import xlsx from "xlsx";

const headers = [
  ["submitted_at", "Submitted"],
  ["full_name", "Name"],
  ["company_name", "Company"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["service_required", "Service"],
  ["budget", "Budget"],
  ["timeline", "Timeline"],
  ["message", "Message"],
  ["status", "Status"],
  ["visitor_ip", "Visitor IP"],
  ["browser", "Browser"],
  ["country", "Country"]
];

export function leadsToCsv(leads) {
  const rows = [headers.map(([, label]) => csvCell(label)).join(",")];
  for (const lead of leads) rows.push(headers.map(([key]) => csvCell(lead[key])).join(","));
  return rows.join("\n");
}

export function leadsToExcelBuffer(leads) {
  const rows = leads.map((lead) => Object.fromEntries(headers.map(([key, label]) => [label, lead[key] ?? ""])));
  const workbook = xlsx.utils.book_new();
  const sheet = xlsx.utils.json_to_sheet(rows);
  xlsx.utils.book_append_sheet(workbook, sheet, "Leads");
  return xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}
