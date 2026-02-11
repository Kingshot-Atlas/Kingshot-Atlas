/**
 * Cloudflare Email Worker — receives inbound emails to support@ks-atlas.com
 * and stores them in the Supabase `support_emails` table.
 *
 * SETUP:
 * 1. Enable Email Routing on ks-atlas.com in Cloudflare Dashboard
 * 2. Create Email Worker route: support@ks-atlas.com → this worker
 * 3. Set environment variables in Cloudflare Worker settings:
 *    - SUPABASE_URL (e.g. https://qdczmafwcvnwfvixxbwg.supabase.co)
 *    - SUPABASE_SERVICE_KEY (service_role key from Supabase)
 *    - FORWARD_TO (optional: personal email for backup forwarding)
 */

// Spam keywords — reject emails containing these
const SPAM_KEYWORDS = [
  "viagra", "cialis", "cryptocurrency giveaway", "nigerian prince",
  "wire transfer", "inheritance fund", "lottery winner", "click here now",
  "unsubscribe from all", "act now!!!", "free money", "earn $",
  "work from home opportunity", "mlm", "binary options",
];

// Auto-categorization rules
function categorizeEmail(subject, body) {
  const text = `${subject} ${body}`.toLowerCase();
  if (/bug|error|crash|broken|not working|issue|glitch/.test(text)) return "bug_report";
  if (/feature|request|suggestion|would be nice|add support|please add/.test(text)) return "feature_request";
  if (/feedback|review|opinion|thoughts|experience/.test(text)) return "feedback";
  if (/transfer|kingdom.*move|migration|recruit/.test(text)) return "transfer";
  if (/score|rank|atlas.*score|tier|rating/.test(text)) return "score_inquiry";
  if (/subscribe|cancel|payment|billing|charge|refund|pro|upgrade/.test(text)) return "billing";
  return "general";
}

export default {
  async email(message, env) {
    const from = message.from;
    const to = message.to;
    const subject = message.headers.get("subject") || "(no subject)";

    // Rate limiting: max 5 emails/hour per sender via Supabase count
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
      try {
        const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
        const countResp = await fetch(
          `${env.SUPABASE_URL}/rest/v1/support_emails?from_email=eq.${encodeURIComponent(from)}&created_at=gte.${encodeURIComponent(oneHourAgo)}&select=id`,
          {
            headers: {
              apikey: env.SUPABASE_SERVICE_KEY,
              Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
              Prefer: "count=exact",
            },
          }
        );
        const count = parseInt(countResp.headers.get("content-range")?.split("/")[1] || "0", 10);
        if (count >= 5) {
          console.warn(`Rate limited: ${from} sent ${count} emails in the last hour`);
          // Still forward for safety, but don't store
          if (env.FORWARD_TO) {
            try { await message.forward(env.FORWARD_TO); } catch (_) {}
          }
          return;
        }
      } catch (e) {
        console.error(`Rate limit check failed: ${e.message}`);
        // Continue processing on rate limit check failure
      }
    }

    // Read the raw email body
    let bodyText = "";
    try {
      const reader = message.raw.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let raw = "";
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) raw += decoder.decode(value, { stream: !done });
      }

      // Extract plain text from raw email (simple extraction)
      // Look for Content-Type: text/plain section
      const plainMatch = raw.match(
        /Content-Type:\s*text\/plain[^\r\n]*\r?\n\r?\n([\s\S]*?)(?:\r?\n--|\r?\n\r?\n--)/i
      );
      if (plainMatch) {
        bodyText = plainMatch[1].trim();
      } else {
        // Fallback: take everything after the headers
        const headerEnd = raw.indexOf("\r\n\r\n");
        if (headerEnd > -1) {
          bodyText = raw.substring(headerEnd + 4).trim();
        } else {
          bodyText = raw;
        }
      }

      // Truncate to 50KB to prevent abuse
      if (bodyText.length > 50000) {
        bodyText = bodyText.substring(0, 50000) + "\n... [truncated]";
      }
    } catch (e) {
      bodyText = `[Error reading email body: ${e.message}]`;
    }

    // Spam filter
    const combinedText = `${subject} ${bodyText}`.toLowerCase();
    const isSpam = SPAM_KEYWORDS.some((kw) => combinedText.includes(kw));
    if (isSpam) {
      console.warn(`Spam detected from ${from}: "${subject}"`);
      return; // Silently drop spam
    }

    // Auto-categorize
    const category = categorizeEmail(subject, bodyText);

    // Store in Supabase
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
      try {
        const resp = await fetch(
          `${env.SUPABASE_URL}/rest/v1/support_emails`,
          {
            method: "POST",
            headers: {
              apikey: env.SUPABASE_SERVICE_KEY,
              Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              direction: "inbound",
              from_email: from,
              to_email: to,
              subject: subject,
              body_text: bodyText,
              status: "unread",
              metadata: {
                message_id: message.headers.get("message-id"),
                date: message.headers.get("date"),
                category: category,
              },
            }),
          }
        );

        if (!resp.ok) {
          console.error(
            `Failed to store email in Supabase: ${resp.status} ${await resp.text()}`
          );
        }
      } catch (e) {
        console.error(`Error storing email: ${e.message}`);
      }
    }

    // Forward to personal email as backup
    if (env.FORWARD_TO) {
      try {
        await message.forward(env.FORWARD_TO);
      } catch (e) {
        console.error(`Failed to forward email: ${e.message}`);
      }
    }
  },
};
