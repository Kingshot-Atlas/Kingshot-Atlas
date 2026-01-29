# MCP (Model Context Protocol) Guide for Kingshot Atlas

> This guide explains how to connect Cascade to external services via MCP, allowing AI-assisted management of your infrastructure.

## What is MCP?

MCP allows Cascade to directly interact with external APIs and services. Instead of you copying/pasting values, Cascade can:
- Create Stripe products and prices
- Query and modify Supabase tables
- Manage GitHub repos (create branches, PRs, issues)
- Deploy to hosting platforms

---

## Available MCP Servers for This Project

| Service | MCP Server | Status | Use Case |
|---------|------------|--------|----------|
| **Stripe** | `@stripe/mcp` | ✅ Configured | Create products, prices, payment links |
| **Supabase** | `supabase` (hosted) | 🔧 Easy setup | Query/modify database, manage tables |
| **GitHub** | `@modelcontextprotocol/server-github` | 🔧 Needs token | Manage repos, create PRs, issues |
| **Netlify** | ❌ No official MCP | - | Manual dashboard only |
| **Render** | ❌ No official MCP | - | Manual dashboard only |

---

## Current MCP Configuration

Location: `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "stripe": {
      "command": "npx",
      "args": [
        "-y",
        "@stripe/mcp",
        "--tools=all",
        "--api-key=sk_live_..."
      ]
    }
  }
}
```

---

## Adding Supabase MCP

Supabase now offers a hosted MCP server with OAuth - no PAT required!

Add to your `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "stripe": { ... },
    "supabase": {
      "url": "https://mcp.supabase.com/mcp"
    }
  }
}
```

After restart, Cascade will prompt you to authenticate via browser.

### Supabase MCP Capabilities
- List and query tables
- Insert, update, delete rows
- Run SQL queries
- Manage database schema
- View project configuration

---

## Adding GitHub MCP

Requires a Personal Access Token (PAT).

1. Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. Create a token with `repo` scope
3. Add to config:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxx"
      }
    }
  }
}
```

### GitHub MCP Capabilities
- Create/read/update files
- Create branches and PRs
- Manage issues
- Search code
- View commit history

---

## Risks & Benefits Analysis

### ✅ Benefits

| Benefit | Description |
|---------|-------------|
| **Speed** | No copy/pasting - Cascade can directly create resources |
| **Accuracy** | No transcription errors from manual input |
| **Automation** | Complex multi-step workflows in one request |
| **Context** | Cascade sees actual data, not just what you paste |
| **Less switching** | Stay in IDE instead of multiple dashboards |

### ⚠️ Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Secret key exposure** | 🔴 High | Keys stored in plaintext in config file. Ensure file permissions are restricted. |
| **Accidental destructive actions** | 🟡 Medium | Cascade asks for confirmation on dangerous ops. Review before approving. |
| **API costs** | 🟡 Medium | Each MCP call may count against API limits/costs |
| **Token scope too broad** | 🟡 Medium | Use minimal required scopes for tokens |
| **Config file in home directory** | 🟢 Low | File is outside repo, won't be committed |

### Security Best Practices

1. **Use test/development keys first** - Switch to live keys only when confident
2. **Rotate keys after AI access** - Especially for one-time setup tasks
3. **Review all confirmations** - Don't auto-approve destructive actions
4. **Limit token scopes** - Only grant permissions actually needed
5. **Don't commit mcp_config.json** - It's in ~/.codeium, not your repo

---

## Recommended Setup for Kingshot Atlas

### Minimal (Current)
- ✅ Stripe MCP (for payment management)

### Full Stack
```json
{
  "mcpServers": {
    "stripe": {
      "command": "npx",
      "args": ["-y", "@stripe/mcp", "--tools=all", "--api-key=sk_live_..."]
    },
    "supabase": {
      "url": "https://mcp.supabase.com/mcp"
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      }
    }
  }
}
```

---

## Troubleshooting MCP

### "No MCPs installed" in Windsurf
1. Verify `~/.codeium/windsurf/mcp_config.json` exists
2. Check JSON syntax is valid
3. Restart Windsurf completely (not just reload)
4. Click hammer icon (🔨) in Cascade toolbar to check status

### MCP server not connecting
1. Test the npx command manually in terminal
2. Check for npm/node installation issues
3. Verify API keys are correct
4. Check network connectivity

### Permission errors
1. Verify token has required scopes
2. Check if API key is active (not revoked)
3. For Supabase OAuth, re-authenticate in browser

---

## Quick Reference: MCP Config Location

```
~/.codeium/windsurf/mcp_config.json
```

Or click: **Hammer icon (🔨) → Configure** in Cascade toolbar
