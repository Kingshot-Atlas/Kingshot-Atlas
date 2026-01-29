# Discord Message Templates

Templates for posting updates to Discord (future implementation).

---

## Regular Update

```
📢 **Kingshot Atlas Update — [Date]**

**✨ New**
• [Highlight 1]
• [Highlight 2]

**🐛 Fixed**
• [Key fix]

**🔧 Improved**
• [Key improvement]

📖 Full notes: https://ks-atlas.com/changelog
```

---

## Major Release

```
🎉 **Kingshot Atlas [Version/Name] is Here!**

Big update with exciting new features:

**Highlights:**
🌟 [Major feature 1] — [brief description]
🌟 [Major feature 2] — [brief description]
🌟 [Major feature 3] — [brief description]

Plus bug fixes and improvements!

📖 Full details: https://ks-atlas.com/changelog
💬 Let us know what you think!
```

---

## Hotfix

```
🔧 **Quick Fix — [Date]**

Fixed an issue where [problem description].

Everything should be working normally now. Thanks for the reports!
```

---

## Maintenance Notice

```
🔧 **Scheduled Maintenance**

Kingshot Atlas will be briefly unavailable on [date] at [time] for maintenance.

Expected duration: [X minutes/hours]

Thanks for your patience!
```

---

## Outage Notice

```
⚠️ **Service Issue**

We're aware of issues with [affected feature] and working on a fix.

Started: [time]
Status: Investigating

Will update when resolved.
```

---

## Resolution Notice

```
✅ **All Clear!**

The issue with [feature] has been resolved. Everything is back to normal.

Thanks for your patience!
```

---

## Teaser

```
👀 **Coming Soon...**

Something new is on the way. Stay tuned!

[Optional: vague hint or emoji]
```

---

## Configuration Notes (Future)

When Discord integration is set up:

```yaml
# Webhook URL (keep secret)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Channel to post to
DISCORD_CHANNEL_ID=...

# Role to mention for major updates (optional)
DISCORD_MENTION_ROLE=@updates
```

---

*Templates maintained by Release Manager*
