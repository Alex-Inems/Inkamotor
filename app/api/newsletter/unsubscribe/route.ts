import { setContactBlacklisted } from "@/lib/brevo";
import { setDbSubscriberBlocked } from "@/lib/crm/subscribers";
import { verifyUnsubscribeToken } from "@/lib/newsletter/unsubscribe";

export const dynamic = "force-dynamic";

function page(title: string, body: string) {
  return new Response(
    `<!doctype html>
<html lang="en">
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<body style="margin:0;background:#f7f4ee;color:#1c1b19;font-family:Georgia,serif">
  <main style="max-width:480px;margin:64px auto;padding:0 20px">
    <p style="letter-spacing:.12em;text-transform:uppercase;font-size:12px;color:#8a8478">Inkamoto Tours</p>
    <h1 style="font-size:28px;font-weight:500">${title}</h1>
    <p style="line-height:1.5">${body}</p>
  </main>
</body>
</html>`,
    {
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase() ?? "";
  const sig = url.searchParams.get("sig")?.trim() ?? "";
  if (!(await verifyUnsubscribeToken(email, sig))) {
    return page(
      "Link not valid",
      "This unsubscribe link is expired or was copied incorrectly.",
    );
  }

  try {
    await setDbSubscriberBlocked(email, true);
  } catch {
    /* table may not exist yet — still try Brevo */
  }
  try {
    await setContactBlacklisted(email, true);
  } catch {
    /* contact may not exist in Brevo */
  }

  return page(
    "You’re unsubscribed",
    `${email} will no longer get Inkamoto Tours newsletters.`,
  );
}
