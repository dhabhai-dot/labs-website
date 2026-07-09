import nodemailer from "nodemailer";
import { escapeHtml } from "./validation.mjs";

let transporter;

export async function sendLeadEmail(config, lead) {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass }
    });
  }

  await transporter.sendMail({
    from: config.businessEmailFrom,
    to: config.businessEmailTo,
    subject: "New Lead - L.A.B.S. Website",
    html: renderLeadEmail(lead)
  });
}

function renderLeadEmail(lead) {
  const rows = [
    ["Name", lead.full_name],
    ["Company", lead.company_name],
    ["Email", lead.email],
    ["Phone", lead.phone],
    ["Service", lead.service_required],
    ["Budget", lead.budget || "Not specified"],
    ["Timeline", lead.timeline || "Not specified"],
    ["Project Description", lead.message],
    ["Date & Time", formatDate(lead.submitted_at)]
  ];

  return `
    <!doctype html>
    <html>
      <body style="margin:0;background:#f4f7f2;font-family:Arial,sans-serif;color:#111;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f4f7f2;">
          <tr><td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#ffffff;border:1px solid #dfe6da;border-radius:8px;overflow:hidden;">
              <tr><td style="padding:28px 32px;background:#111;color:#fff;">
                <p style="margin:0 0 8px;color:#62b531;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">L.A.B.S. Website</p>
                <h1 style="margin:0;font-size:28px;line-height:1.2;">New qualified lead received</h1>
              </td></tr>
              <tr><td style="padding:28px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${rows.map(([label, value]) => `
                    <tr>
                      <td style="width:150px;padding:12px 0;border-bottom:1px solid #edf1ea;color:#5e675d;font-size:13px;font-weight:700;vertical-align:top;">${escapeHtml(label)}</td>
                      <td style="padding:12px 0;border-bottom:1px solid #edf1ea;color:#111;font-size:15px;line-height:1.5;vertical-align:top;">${escapeHtml(value)}</td>
                    </tr>
                  `).join("")}
                </table>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}
