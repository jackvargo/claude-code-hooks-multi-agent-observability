# Hook Configuration for Remote Watcher Deployment

## Overview

Claude Code hooks send observability events to the Watcher server. By default, hooks send to `http://localhost:4000/events`. For remote deployments (such as `https://watcher.flipgoal.xyz`), you must configure hooks to use the remote server URL and provide API key authentication.

## Quick Start

1. **Set your API key environment variable:**
   ```bash
   export WATCHER_API_KEY=watcher_sk_your_generated_key_here
   ```

2. **Update your project's `.claude/settings.json`:**
   ```json
   {
     "hooks": {
       "notification": {
         "enabled": true,
         "handler": "~/.claude/hooks/notification.py",
         "args": "--server-url https://watcher.flipgoal.xyz/events --event-type Notification"
       },
       "stop": {
         "enabled": true,
         "handler": "~/.claude/hooks/stop.py",
         "args": "--server-url https://watcher.flipgoal.xyz/events --event-type Stop"
       }
     }
   }
   ```

3. **Verify connectivity:**
   ```bash
   curl -X POST https://watcher.flipgoal.xyz/events \
     -H "Authorization: Bearer $WATCHER_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"source_app":"test","session_id":"test","hook_event_type":"Test","payload":{}}'
   ```
   Expected response: `200 OK`

## Configuration Details

### API Key (WATCHER_API_KEY)

The WATCHER_API_KEY environment variable contains the secret token used to authenticate hook requests to the server.

**Format:**
- Prefix: `watcher_sk_` (identifies the key type)
- Minimum length: 32 characters (recommended)
- Generated with: `openssl rand -hex 32`

**Example:**
```bash
export WATCHER_API_KEY=watcher_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

**How it's used:**
- Automatically injected into the `Authorization` header as `Bearer <WATCHER_API_KEY>`
- Required for every request to the `/events` endpoint
- Optional for local development (localhost:4000 has validation disabled when no env var is set)

### Server URL (--server-url flag)

The `--server-url` flag specifies the endpoint where hooks send events.

**Syntax:**
```bash
--server-url <URL>
```

**Valid values:**
- Local development: `http://localhost:4000/events`
- Remote deployment: `https://watcher.flipgoal.xyz/events`
- Custom domain: `https://your-domain.com/events`

**Default behavior:**
- If not specified: defaults to `http://localhost:4000/events`
- Can be overridden per hook in `.claude/settings.json`

### Hook Integration Points

The following hook scripts support remote server configuration:

#### notification.py
Captures Claude Code notifications and completion events.

```json
{
  "notification": {
    "enabled": true,
    "handler": "~/.claude/hooks/notification.py",
    "args": "--server-url https://watcher.flipgoal.xyz/events --event-type Notification"
  }
}
```

#### stop.py
Captures session stop events.

```json
{
  "stop": {
    "enabled": true,
    "handler": "~/.claude/hooks/stop.py",
    "args": "--server-url https://watcher.flipgoal.xyz/events --event-type Stop"
  }
}
```

#### subagent_stop.py
Captures subagent completion events.

```json
{
  "subagent_stop": {
    "enabled": true,
    "handler": "~/.claude/hooks/subagent_stop.py",
    "args": "--server-url https://watcher.flipgoal.xyz/events --event-type SubagentStop"
  }
}
```

## Configuration Examples

### Example 1: Local Development (No Auth Required)

For local development without authentication:

```json
{
  "hooks": {
    "notification": {
      "enabled": true,
      "handler": "~/.claude/hooks/notification.py",
      "args": "--event-type Notification"
    },
    "stop": {
      "enabled": true,
      "handler": "~/.claude/hooks/stop.py",
      "args": "--event-type Stop"
    }
  }
}
```

Server expects: `http://localhost:4000/events` (default)

### Example 2: Remote Deployment with API Key

For remote server with API key authentication:

```json
{
  "hooks": {
    "notification": {
      "enabled": true,
      "handler": "~/.claude/hooks/notification.py",
      "args": "--server-url https://watcher.flipgoal.xyz/events --event-type Notification"
    },
    "stop": {
      "enabled": true,
      "handler": "~/.claude/hooks/stop.py",
      "args": "--server-url https://watcher.flipgoal.xyz/events --event-type Stop"
    },
    "subagent_stop": {
      "enabled": true,
      "handler": "~/.claude/hooks/subagent_stop.py",
      "args": "--server-url https://watcher.flipgoal.xyz/events --event-type SubagentStop"
    }
  }
}
```

Environment setup:
```bash
export WATCHER_API_KEY=watcher_sk_your_key_here
```

### Example 3: Multiple Projects with Different Servers

Project A (local):
```json
{
  "hooks": {
    "notification": {
      "args": "--event-type Notification"
    }
  }
}
```

Project B (remote):
```json
{
  "hooks": {
    "notification": {
      "args": "--server-url https://watcher.flipgoal.xyz/events --event-type Notification"
    }
  }
}
```

Both projects can use the same hook scripts with different configurations.

## Authentication Flow

1. **Hook script receives configuration:**
   - `--server-url` flag specifies the target endpoint
   - `WATCHER_API_KEY` environment variable contains the API key

2. **Hook constructs request:**
   ```python
   headers = {
       'Content-Type': 'application/json',
       'Authorization': f'Bearer {os.environ.get("WATCHER_API_KEY")}'
   }
   ```

3. **Server validates request:**
   - Extracts `Authorization` header
   - Validates bearer token against configured `WATCHER_API_KEY`
   - Returns 401 Unauthorized if key is missing or invalid
   - Returns 200 OK if key is valid and event is stored

## Troubleshooting

### Issue: 401 Unauthorized

**Symptom:** Curl test returns `401 Unauthorized`

**Causes:**
- API key not set: `WATCHER_API_KEY` environment variable is empty
- API key incorrect: Value doesn't match server's configured key
- Missing header: Hook script not including `Authorization` header

**Solutions:**
```bash
# Verify key is set
echo $WATCHER_API_KEY

# Verify key value matches server
ssh user@homelab-server
grep WATCHER_API_KEY /path/to/.env

# Test with explicit key
curl -X POST https://watcher.flipgoal.xyz/events \
  -H "Authorization: Bearer watcher_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### Issue: Connection Refused

**Symptom:** `curl: (7) Failed to connect to watcher.flipgoal.xyz port 443`

**Causes:**
- Server not running
- DNS not resolving
- Network/firewall blocking access
- Wrong domain name

**Solutions:**
```bash
# Check DNS resolution
nslookup watcher.flipgoal.xyz

# Test connectivity
curl -v https://watcher.flipgoal.xyz

# Check server logs (on homelab)
docker logs agent-watcher

# Verify Traefik routing
docker exec traefik curl http://localhost:8000/events
```

### Issue: Events Not Appearing in UI

**Symptom:** Hook sends successfully (200 OK) but events don't appear in dashboard

**Causes:**
- WebSocket connection not established
- Events stored in database but not visible due to filtering
- Client-side JavaScript error

**Solutions:**
```bash
# Check if events are in database
docker exec agent-watcher sqlite3 /data/events.db \
  "SELECT COUNT(*) FROM events;"

# Check browser console for errors
# In UI: Press F12 -> Console tab -> Look for red errors

# Verify WebSocket connection
# In UI: Press F12 -> Network tab -> Filter by "WS" -> Should see /stream
```

### Issue: WATCHER_API_KEY Not Found

**Symptom:** Hook scripts report missing or empty API key

**Causes:**
- Environment variable not exported
- Shell session doesn't have the variable
- Using different user/terminal

**Solutions:**
```bash
# Export in current shell
export WATCHER_API_KEY=watcher_sk_your_key

# Verify it's set
echo $WATCHER_API_KEY

# Add to ~/.bashrc for persistence
echo 'export WATCHER_API_KEY=watcher_sk_your_key' >> ~/.bashrc
source ~/.bashrc

# Or use .env file with direnv
echo 'export WATCHER_API_KEY=watcher_sk_your_key' > .envrc
direnv allow
```

## Security Best Practices

### API Key Management

1. **Generate secure keys:**
   ```bash
   # Generate a 32-byte random key
   openssl rand -hex 32

   # Output: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
   # Prepend prefix
   # Result: watcher_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
   ```

2. **Never commit secrets:**
   - Add `.env` to `.gitignore`
   - Use environment variables or secret managers
   - Audit git history for accidental commits

3. **Rotate keys periodically:**
   - Change API key every 90 days
   - Update all projects with new key simultaneously
   - Monitor old key usage before deactivation

4. **Use environment variables:**
   - Never pass API key via command-line arguments
   - Don't store in `.claude/settings.json`
   - Only in shell environment or `.env` (gitignored)

5. **Restrict server access:**
   - UI routes protected by Authentik (GitHub OAuth)
   - `/events` endpoint protected by API key (server-side)
   - Use HTTPS for all remote communications

## Server-Side Validation

The Watcher server validates API keys for every request to the `/events` endpoint:

```typescript
// Pseudocode from apps/server/src/index.ts
function validateApiKey(req: Request): boolean {
  // Skip validation if no API key configured (local dev)
  if (!API_KEY) return true;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7);
  return token === API_KEY;
}

// In /events POST handler:
if (!validateApiKey(req)) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401 }
  );
}
```

## Migration from Local to Remote

If you've been running hooks locally and want to switch to remote:

1. **Backup local data (optional):**
   ```bash
   # On homelab server
   cp /data/events.db /data/events.db.backup
   ```

2. **Update project settings:**
   ```bash
   # Edit .claude/settings.json
   # Add --server-url flag to all hooks
   ```

3. **Set API key:**
   ```bash
   export WATCHER_API_KEY=watcher_sk_your_key
   ```

4. **Verify connectivity:**
   ```bash
   # Test one hook
   curl -X POST https://watcher.flipgoal.xyz/events \
     -H "Authorization: Bearer $WATCHER_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"source_app":"migration-test","session_id":"1","hook_event_type":"Test","payload":{}}'
   ```

5. **Run a test session:**
   - Start Claude Code in a project with the updated settings
   - Run a simple operation (query, task call)
   - Check UI for events appearing

## Related Documentation

- **Deployment Guide**: `docs/HOMELAB_DEPLOYMENT_TEMPLATE.md`
- **Server Configuration**: `apps/server/README.md`
- **Environment Variables**: `.env.example`
- **Project Architecture**: `CLAUDE.md`

## Additional Resources

- send_event.py: Main event sender script
- notification.py: Handles notification hook events
- stop.py: Handles stop hook events
- subagent_stop.py: Handles subagent completion
