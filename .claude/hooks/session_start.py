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
    import sys

    # Debug: Log to stderr so we can see what's happening
    debug_log = "/tmp/session_start_debug.log"

    # CLAUDE_ENV_FILE is provided by Claude Code to SessionStart hooks only
    env_file = os.environ.get('CLAUDE_ENV_FILE')

    with open(debug_log, 'a') as log:
        log.write(f"\n=== SessionStart hook ran at {__import__('datetime').datetime.now()} ===\n")
        log.write(f"CLAUDE_ENV_FILE: {env_file}\n")
        log.write(f"CLAUDE_PROJECT_DIR: {os.environ.get('CLAUDE_PROJECT_DIR', 'NOT SET')}\n")

    if not env_file:
        with open(debug_log, 'a') as log:
            log.write("ERROR: CLAUDE_ENV_FILE not set - exiting\n")
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

        with open(debug_log, 'a') as log:
            log.write(f"SUCCESS: Wrote PROJECT_NAME=\"{safe_name}\" to {env_file}\n")
    except Exception as e:
        with open(debug_log, 'a') as log:
            log.write(f"ERROR writing to env file: {e}\n")

    # Always exit 0 - hook failures should not block Claude Code
    sys.exit(0)


if __name__ == '__main__':
    main()
