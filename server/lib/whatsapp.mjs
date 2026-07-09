export async function sendWhatsAppLead(config, lead) {
  const message = [
    "NEW WEBSITE LEAD",
    "",
    `Name: ${lead.full_name}`,
    `Company: ${lead.company_name}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone}`,
    `Service: ${lead.service_required}`,
    `Budget: ${lead.budget || "Not specified"}`,
    `Timeline: ${lead.timeline || "Not specified"}`,
    `Project Description: ${lead.message}`,
    "",
    `Submitted: ${formatDate(lead.submitted_at)}`
  ].join("\n");

  const response = await fetch(`https://graph.facebook.com/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsapp.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: config.whatsapp.toNumber,
      type: "text",
      text: { preview_url: false, body: message }
    })
  });

  if (!response.ok) {
    const details = await response.text();
    const error = new Error("WhatsApp notification failed.");
    error.statusCode = 502;
    error.details = details;
    throw error;
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}
