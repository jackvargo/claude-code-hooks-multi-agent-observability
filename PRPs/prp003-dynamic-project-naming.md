# PRP-003: Dynamic Project Naming via SessionStart Hook

**Status**: draft
**Created**: 2024-12-29
**Project**: claude-code-hooks-multi-agent-observability
**Type**: single

## Goal

Replace the static `--source-app` parameter in `vective-observability-notifications.settings.json` with a dynamic project name derived from the current working directory, set via the `SessionStart` hook using `CLAUDE_ENV_FILE`.

### Success Criteria

- [ ] SessionStart hook creates and writes `PROJECT_NAME` to `$CLAUDE_ENV_FILE`
- [ ] All hook commands in settings.json reference `$PROJECT_NAME` instead of hardcoded `--source-app vective-system`
- [ ] Project name derivation matches existing `get_project_name()` logic from `message_builder.py`
- [ ] Events in observability dashboard show correct project name from cwd
- [ ] Solution works when settings.json is copied to other projects

## Why

- **Portability**: The current settings template requires manual editing of `--source-app` when copied to new projects
- **Consistency**: Project name should be derived the same way everywhere (currently `message_builder.py` already does this from cwd)
- **Automation**: SessionStart hook runs once per session, making it the ideal place to set session-wide context

## What

### User-Visible Behavior

1. When a Claude Code session starts, the SessionStart hook:
   - Derives project name from `$CLAUDE_PROJECT_DIR` (the current working directory)
   - Writes `export PROJECT_NAME="Derived Project Name"` to `$CLAUDE_ENV_FILE`

2. All subsequent hook commands:
   - Use `$PROJECT_NAME` environment variable instead of hardcoded value
   - Events show the dynamically derived project name in the observability dashboard

### Technical Requirements

1. **New SessionStart hook script** (`session_start.py`)
   - Access `$CLAUDE_PROJECT_DIR` (provided by Claude Code - the project's working directory)
   - Access `$CLAUDE_ENV_FILE` (provided by Claude Code - path to temp file for persisting variables)
   - **Import and reuse** `get_project_name()` from `utils/message_builder.py` (single source of truth)
   - Write `export PROJECT_NAME="..."` to the env file

2. **Updated settings.json template**
   - Add `SessionStart` hook section
   - Replace `--source-app vective-system` with `--source-app "$PROJECT_NAME"` in all commands

### How CLAUDE_ENV_FILE Works

```
┌─────────────────────────────────────────────────────────────────┐
│ Claude Code Session Start                                       │
├─────────────────────────────────────────────────────────────────┤
│ 1. Claude Code creates a temp file: /tmp/claude-env-abc123      │
│ 2. Sets CLAUDE_ENV_FILE=/tmp/claude-env-abc123                  │
│ 3. Sets CLAUDE_PROJECT_DIR=/path/to/current/project             │
│ 4. Runs SessionStart hooks with these env vars                  │
│ 5. After hooks complete, sources the env file                   │
│ 6. Variables written to file become available to all            │
│    subsequent bash commands in the session                      │
└─────────────────────────────────────────────────────────────────┘
```

**Key point**: We don't create or configure CLAUDE_ENV_FILE - Claude Code provides it automatically to SessionStart hooks only.

## All Needed Context

### Documentation & References

```yaml
# CRITICAL: Vective System standards (ALWAYS include)
- file: @PRPs/config/CLAUDE.vective.md
  why: Core Vective System standards, TCP protocol, agent coordination requirements

# Project-specific standards
- file: @CLAUDE.md
  why: Project architectural standards, patterns, and constraints

# Claude Code Hooks Documentation
- url: https://code.claude.com/docs/en/hooks
  why: CLAUDE_ENV_FILE mechanism for persisting environment variables
  critical: |
    SessionStart hooks have access to CLAUDE_ENV_FILE which provides a file path
    where you can persist environment variables for subsequent bash commands.
    Write "export VAR=value" to this file and it becomes available in all
    subsequent bash commands during the session.

# Existing Implementation
- file: .claude/hooks/utils/message_builder.py
  why: Contains get_project_name() function to reuse for consistency

- file: vective-observability-notifications.settings.json
  why: The settings template file to be modified
```

### Current Codebase tree

```
.claude/hooks/
├── notification.py
├── send_event.py
├── stop.py
├── subagent_stop.py
├── user_prompt_submit.py
└── utils/
    ├── llm/
    │   └── anth.py
    ├── message_builder.py      # Contains get_project_name()
    └── summarizer.py
```

### Desired Codebase tree with files to be added

```
.claude/hooks/
├── session_start.py            # NEW: SessionStart hook (Python to reuse get_project_name)
├── notification.py
├── send_event.py
├── stop.py
├── subagent_stop.py
├── user_prompt_submit.py
└── utils/
    ├── llm/
    │   └── anth.py
    ├── message_builder.py      # EXISTING: Contains get_project_name() - single source of truth
    └── summarizer.py

vective-observability-notifications.settings.json  # MODIFIED
```

### Known Gotchas & Library Quirks

```python
# CRITICAL: CLAUDE_ENV_FILE is ONLY available in SessionStart hooks
# Other hooks do NOT have access to this variable
# It is PROVIDED by Claude Code - we don't create it

# CRITICAL: CLAUDE_PROJECT_DIR is also provided by Claude Code
# This is the project's working directory

# CRITICAL: Environment variables written to CLAUDE_ENV_FILE must use:
#   export VAR="value"
# The file is sourced by Claude Code, so it must contain valid shell syntax

# CRITICAL: The variable must be quoted in settings.json commands:
#   --source-app "$PROJECT_NAME"
# Without quotes, names with spaces will break

# GOTCHA: Hook script must exit 0 even on failure
# Hook failures should not block Claude Code operations

# GOTCHA: Path in settings.json may need to be absolute
# Use ~/.claude/config/hooks/ for user-wide hooks

# MODULARITY: Use get_project_name() from utils/message_builder.py
# This ensures consistent name derivation if logic changes in future
```

## Implementation Blueprint

### Data Models

No new data models required. The solution uses existing environment variable mechanisms.

### List of Tasks

```yaml
Task 1:
CREATE .claude/hooks/session_start.py:
  - Python script (reuses existing get_project_name() for modularity)
  - Check if $CLAUDE_ENV_FILE is set (provided by Claude Code)
  - Get project path from $CLAUDE_PROJECT_DIR (provided by Claude Code)
  - Import and call get_project_name() from utils/message_builder.py
  - Write "export PROJECT_NAME=..." to $CLAUDE_ENV_FILE
  - Exit 0 always (even on error)

Task 2:
MODIFY vective-observability-notifications.settings.json:
  - ADD SessionStart hook section calling session_start.py
  - REPLACE all instances of "--source-app vective-system" with "--source-app \"$PROJECT_NAME\""
  - Preserve all other hook configurations

Task 3:
TEST environment variable persistence:
  - Verify SessionStart hook runs on session start
  - Verify PROJECT_NAME is available in subsequent hook commands
  - Verify events in dashboard show correct project name
```

### Task 1 Pseudocode

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

"""
SessionStart hook: Sets PROJECT_NAME environment variable for all subsequent hooks.

This hook is called once when a Claude Code session starts.
It writes to CLAUDE_ENV_FILE which Claude Code sources, making
PROJECT_NAME available to all subsequent bash commands.

Environment variables provided by Claude Code:
- CLAUDE_ENV_FILE: Path to temp file for persisting env vars (SessionStart only)
- CLAUDE_PROJECT_DIR: The project's working directory
"""

import os
import sys

# Import the shared project name logic - single source of truth
from utils.message_builder import get_project_name


def main():
    # CLAUDE_ENV_FILE is provided by Claude Code to SessionStart hooks only
    env_file = os.environ.get('CLAUDE_ENV_FILE')
    if not env_file:
        # Not in SessionStart context or not provided - exit silently
        sys.exit(0)

    # CLAUDE_PROJECT_DIR is provided by Claude Code
    project_dir = os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())

    # Use the shared function for consistency
    # If this logic changes in message_builder.py, it changes everywhere
    project_name = get_project_name(project_dir)

    if not project_name:
        project_name = "Unknown Project"

    # Write to the env file - Claude Code will source this
    # Must use shell-compatible syntax: export VAR="value"
    try:
        with open(env_file, 'a') as f:
            # Escape any quotes in the project name
            safe_name = project_name.replace('"', '\\"')
            f.write(f'export PROJECT_NAME="{safe_name}"\n')
    except Exception:
        # Never fail the hook - just continue without setting the var
        pass

    # Always exit 0 - hook failures should not block Claude Code
    sys.exit(0)


if __name__ == '__main__':
    main()
```

### Task 2 Changes

Current settings.json excerpt:
```json
"command": "uv run ~/.claude/config/hooks/send_event.py --source-app vective-system --event-type PreToolUse --summarize"
```

Updated:
```json
"SessionStart": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "uv run ~/.claude/config/hooks/session_start.py"
      }
    ]
  }
],
"command": "uv run ~/.claude/config/hooks/send_event.py --source-app \"$PROJECT_NAME\" --event-type PreToolUse --summarize"
```

**Note**: All occurrences of `--source-app vective-system` become `--source-app "$PROJECT_NAME"` (with quotes to handle spaces).

### Integration Points

```yaml
SETTINGS:
  - add: SessionStart hook section
  - modify: All command strings containing --source-app

SCRIPTS:
  - create: .claude/hooks/session_start.py
  - no chmod needed (uv run handles execution)
```

## Validation Loop

### Level 1: Syntax & Style

```bash
# Verify Python script syntax
python3 -m py_compile .claude/hooks/session_start.py

# Verify JSON validity
jq . vective-observability-notifications.settings.json

# Expected: No errors
```

### Level 2: Unit Tests

```bash
# Test project name derivation end-to-end
cd /path/to/some-test-project
export CLAUDE_PROJECT_DIR="$(pwd)"
export CLAUDE_ENV_FILE=$(mktemp)

# Run the hook
uv run .claude/hooks/session_start.py

# Source the env file (as Claude Code would)
source "$CLAUDE_ENV_FILE"
echo "PROJECT_NAME=$PROJECT_NAME"
# Expected: PROJECT_NAME="Some Test Project"

# Cleanup
rm "$CLAUDE_ENV_FILE"
```

### Level 2b: Unit Test for get_project_name consistency

```python
# Verify session_start.py uses the same logic as message_builder.py
from utils.message_builder import get_project_name

# These should match what session_start.py produces
assert get_project_name("/path/to/my-awesome-project") == "My Awesome Project"
assert get_project_name("/path/to/some_project_name") == "Some Project Name"
assert get_project_name("/path/to/simpleproject") == "Simpleproject"
```

### Level 3: Integration Test

```bash
# Start a new Claude Code session with the updated settings
# Trigger any hook (e.g., run a bash command)
# Check observability dashboard for:
# - source_app field should show derived project name
# - NOT "vective-system" or "$PROJECT_NAME" literal
```

### Level 4: Cross-Project Validation

```bash
# Copy settings.json to a different project
cp vective-observability-notifications.settings.json ~/other-project/.claude/settings.json

# Start Claude Code in that project
# Verify events show "Other Project" as source_app
```

## Final Validation Checklist

- [ ] `bash -n session_start.sh` passes (syntax valid)
- [ ] `jq . settings.json` passes (JSON valid)
- [ ] SessionStart hook runs on new session
- [ ] `$PROJECT_NAME` contains readable project name
- [ ] Events show correct project name in dashboard
- [ ] Solution works when copied to other projects
- [ ] No hardcoded "vective-system" remains in settings.json

## Anti-Patterns to Avoid

- **Don't duplicate project name logic** - import `get_project_name()` from `utils/message_builder.py`
- **Don't forget to quote $PROJECT_NAME** - names with spaces will break
- **Don't forget exit 0** - hook failures shouldn't block Claude Code
- **Don't assume CLAUDE_ENV_FILE exists** - check before writing (only provided to SessionStart hooks)
- **Don't try to set CLAUDE_ENV_FILE yourself** - it's provided by Claude Code automatically
- **Don't use relative paths in settings.json** - use absolute paths like `~/.claude/config/hooks/`

## Team Communication Protocol - Agent Updates

### Agent Organizer Analysis Matrix
[To be populated by agent-organizer if orchestration requested]

### Agent Task Updates
[TCP-SATC and TCP-SATR updates from execution agents as they work]

---

## Related PRPs

- **Parent context**: This PRP enhances the observability system from PRP-002
- **Enables**: Portable settings.json template for any project

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CLAUDE_ENV_FILE not available | Low | High | Check for variable before writing |
| Shell quoting issues | Medium | Medium | Test with project names containing spaces |
| Settings not applied | Low | Medium | Document /hooks menu review requirement |

## Revision Log

| Version | Date | Changes |
|---------|------|---------|
| 1 | 2024-12-29 | Initial PRP created |
