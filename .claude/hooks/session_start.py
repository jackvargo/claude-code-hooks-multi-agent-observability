#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "python-dotenv",
# ]
# ///

"""
SessionStart hook: Sets environment variables for all subsequent hooks.

This hook is called once when a Claude Code session starts.
It writes to CLAUDE_ENV_FILE which Claude Code sources, making
variables available to all subsequent bash commands and hooks.

Sets:
- PROJECT_NAME: Derived from project directory for UI display
- WATCHER_API_KEY: Forwarded from .env for remote server authentication
- WATCHER_SERVER_URL: Forwarded from .env for remote server URL

Environment variables provided by Claude Code:
- CLAUDE_ENV_FILE: Path to temp file for persisting env vars (SessionStart only)
- CLAUDE_PROJECT_DIR: The project's working directory
"""

import os
import sys

# Import the shared project name logic - single source of truth
from utils.message_builder import get_project_name


def load_env_file(project_dir: str) -> dict:
    """Load .env file from project directory if it exists."""
    from dotenv import dotenv_values

    env_vars = {}

    # Try project .env first
    project_env = os.path.join(project_dir, '.env')
    if os.path.isfile(project_env):
        env_vars.update(dotenv_values(project_env))

    # Also check user's home directory for global config
    home_env = os.path.expanduser('~/.claude/.env')
    if os.path.isfile(home_env):
        # Project .env takes precedence, so load home first
        home_vars = dotenv_values(home_env)
        for key, value in home_vars.items():
            if key not in env_vars:
                env_vars[key] = value

    return env_vars


def main():
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

    # Load .env files (project and global)
    dotenv_vars = load_env_file(project_dir)

    # Use the shared function for consistency
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

            # Forward WATCHER_* variables from .env
            for key in ['WATCHER_API_KEY', 'WATCHER_SERVER_URL']:
                value = dotenv_vars.get(key, '')
                if value:
                    safe_value = value.replace('"', '\\"')
                    f.write(f'export {key}="{safe_value}"\n')

        with open(debug_log, 'a') as log:
            log.write(f"SUCCESS: Wrote PROJECT_NAME=\"{safe_name}\" to {env_file}\n")
            for key in ['WATCHER_API_KEY', 'WATCHER_SERVER_URL']:
                if dotenv_vars.get(key):
                    log.write(f"SUCCESS: Forwarded {key} to {env_file}\n")
    except Exception as e:
        with open(debug_log, 'a') as log:
            log.write(f"ERROR writing to env file: {e}\n")

    # Always exit 0 - hook failures should not block Claude Code
    sys.exit(0)


if __name__ == '__main__':
    main()
