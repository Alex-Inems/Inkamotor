export type NewsletterTemplate = {
  id: string;
  name: string;
  subject: string;
  preview: string;
  html: string;
  builtin: boolean;
};

function branded(title: string, body: string) {
  return `<div style="background:#1c1b19;padding:24px 12px">
  <div style="max-width:560px;margin:0 auto;background:#f7f4ee;color:#1c1b19;font-family:Georgia,serif">
    <div style="height:6px;background:linear-gradient(90deg,#31595d 20%,#e1736c 40%,#ecbb5a 60%,#624e8a 80%,#65814f 100%)"></div>
    <div style="background:#31595d;color:#fff;padding:20px 24px">
      <p style="margin:0;letter-spacing:0.16em;font-size:12px">INKAMOTO TOURS</p>
      <h1 style="margin:10px 0 0;font-size:28px;font-weight:normal">${title}</h1>
    </div>
    <div style="padding:24px;font-size:16px;line-height:1.55">
      ${body}
    </div>
  </div>
</div>`;
}

export const builtinTemplates: NewsletterTemplate[] = [
  {
    id: "tpl_departures",
    name: "Upcoming departures",
    subject: "New dates on the Peru roadbook",
    preview: "A few seats left on the next Inkamoto departures.",
    builtin: true,
    html: branded(
      "New departure dates",
      `<p>Hello,</p>
<p>We opened a few extra seats on the next motorcycle road trips in Peru. If you have been waiting for a date, this is a good moment to lock it in.</p>
<p><strong>What is included:</strong> guided riding days, support vehicle, hotels, and the usual Inkamoto crew.</p>
<p>Reply to this email with the month that works for you, or tell us who is travelling with you.</p>
<p>See you on the dirt,<br/>Inkamoto Tours</p>`,
    ),
  },
  {
    id: "tpl_letter",
    name: "Simple letter",
    subject: "A note from Inkamoto",
    preview: "A short update from the team.",
    builtin: true,
    html: branded(
      "A note from the team",
      `<p>Hello,</p>
<p>Write your update here. Keep it short — one story, one date, one ask.</p>
<p>Ride safe,<br/>Inkamoto Tours</p>`,
    ),
  },
  {
    id: "tpl_thanks",
    name: "Thank you / after the trip",
    subject: "Thank you for riding with Inkamoto",
    preview: "Photos, next dates, and a thank you from the crew.",
    builtin: true,
    html: branded(
      "Thank you for riding with us",
      `<p>Hello,</p>
<p>Thank you for the kilometres together. If you have photos or a favourite stretch of road, we would love to hear it.</p>
<p>Friends of riders travel with us at a thank-you rate — just mention your name when they write.</p>
<p>Until the next pass,<br/>Inkamoto Tours</p>`,
    ),
  },
];

export function builtinById(id: string) {
  return builtinTemplates.find((t) => t.id === id) ?? null;
}
