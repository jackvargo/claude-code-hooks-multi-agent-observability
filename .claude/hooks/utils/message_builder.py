#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

"""
Contextual message builder for TTS announcements.

Builds specific, informative voice messages including:
- Project name (from cwd)
- Agent type (from payload for subagents)
- Task summary (from AI summary or fallback)
"""

import os
import random
from pathlib import Path
from typing import Optional, Dict, Any


def get_project_name(cwd: str) -> str:
    """
    Extract a readable project name from the current working directory.

    Args:
        cwd: Current working directory path

    Returns:
        Human-readable project name
    """
    if not cwd:
        return ""

    # Get the last directory component
    path = Path(cwd)
    name = path.name

    # Handle common directory patterns
    if name in (".", "", "~"):
        return ""

    # Convert common naming conventions to readable form
    # kebab-case: my-project -> My Project
    # snake_case: my_project -> My Project
    # camelCase: myProject -> My Project (basic handling)

    # Replace dashes and underscores with spaces
    readable = name.replace("-", " ").replace("_", " ")

    # Title case
    readable = readable.title()

    return readable


def get_engineer_name() -> str:
    """Get engineer name from environment if available."""
    return os.getenv('ENGINEER_NAME', '').strip()


def build_notification_message(input_data: Dict[str, Any]) -> str:
    """
    Build a contextual notification message for when agent needs input.

    Args:
        input_data: Hook input data containing cwd, message, notification_type, etc.

    Returns:
        Formatted notification message for TTS
    """
    cwd = input_data.get('cwd', '')
    project = get_project_name(cwd)
    notification_type = input_data.get('notification_type', '')
    message = input_data.get('message', '')
    engineer = get_engineer_name()

    # Build contextual message
    parts = []

    # Occasionally include engineer name (30% chance)
    if engineer and random.random() < 0.3:
        parts.append(engineer)

    # Add project context if available
    if project:
        parts.append(project)

    # Add appropriate action based on notification type
    if notification_type == 'permission_prompt':
        parts.append("needs permission")
    elif notification_type == 'idle_prompt':
        parts.append("is waiting")
    else:
        parts.append("needs your input")

    # Join parts naturally
    if len(parts) == 1:
        return parts[0]
    elif len(parts) == 2:
        return f"{parts[0]}: {parts[1]}"
    else:
        # Engineer, Project: action
        return f"{parts[0]}, {parts[1]}: {parts[2]}"


def build_stop_message(
    input_data: Dict[str, Any],
    summary: Optional[str] = None
) -> str:
    """
    Build a contextual completion message for main agent stop.

    Args:
        input_data: Hook input data containing cwd, session_id, etc.
        summary: Optional AI-generated summary of what was completed

    Returns:
        Formatted completion message for TTS
    """
    cwd = input_data.get('cwd', '')
    project = get_project_name(cwd)

    # If we have a summary, use it
    if summary:
        # Clean up summary for speech
        summary = summary.strip().rstrip('.')

        # Truncate if too long for speech
        if len(summary) > 50:
            summary = summary[:47] + "..."

        return f"Completed {summary}"

    # Fallback messages
    if project:
        return f"{project}: Task complete"

    # Generic fallback
    completions = [
        "Task complete",
        "Work complete",
        "All done",
        "Ready for next task"
    ]
    return random.choice(completions)


def build_subagent_message(
    input_data: Dict[str, Any],
    summary: Optional[str] = None
) -> str:
    """
    Build a contextual message for subagent completion.

    Args:
        input_data: Hook input data containing cwd, payload with agent details
        summary: Optional AI-generated summary of subagent task

    Returns:
        Formatted subagent completion message for TTS
    """
    cwd = input_data.get('cwd', '')
    project = get_project_name(cwd)

    # Try to extract agent type from payload
    # The Task tool passes subagent_type and description
    payload = input_data if isinstance(input_data, dict) else {}

    # Look for agent type in various possible locations
    agent_type = None

    # Check if there's a tool_input with subagent_type (from Task tool)
    tool_input = payload.get('tool_input', {})
    if isinstance(tool_input, dict):
        agent_type = tool_input.get('subagent_type', '')

    # Also check direct payload for agent info
    if not agent_type:
        agent_type = payload.get('subagent_type', '')

    # Clean up agent type for speech
    if agent_type:
        # Convert kebab-case to readable: frontend-developer -> Frontend Developer
        agent_name = agent_type.replace("-", " ").replace("_", " ").title()
    else:
        agent_name = "Subagent"

    # Build message
    parts = []

    if project:
        parts.append(project)

    parts.append(agent_name)

    if summary:
        # Clean summary for speech
        summary = summary.strip().rstrip('.')
        if len(summary) > 40:
            summary = summary[:37] + "..."
        parts.append(f"finished {summary}")
    else:
        parts.append("complete")

    # Join: "Project: Agent complete" or "Agent complete"
    if len(parts) == 2:
        return f"{parts[0]}: {parts[1]}"
    elif len(parts) == 3:
        return f"{parts[0]}: {parts[1]} {parts[2]}"
    else:
        return parts[0]


def extract_brief_context(transcript_path: str, max_chars: int = 100) -> Optional[str]:
    """
    Extract a brief context from the transcript for message building.

    This is a lightweight alternative to full LLM summarization.

    Args:
        transcript_path: Path to the JSONL transcript file
        max_chars: Maximum characters to extract

    Returns:
        Brief context string or None
    """
    import json

    if not transcript_path or not os.path.exists(transcript_path):
        return None

    try:
        # Read the last few lines of the transcript
        with open(transcript_path, 'r') as f:
            lines = f.readlines()

        # Look for the most recent user message or task description
        for line in reversed(lines[-10:]):  # Check last 10 entries
            try:
                entry = json.loads(line.strip())

                # Look for user prompts
                if entry.get('type') == 'user':
                    content = entry.get('content', '')
                    if isinstance(content, str) and content:
                        # Extract first sentence or meaningful chunk
                        brief = content.split('.')[0].strip()
                        if len(brief) > max_chars:
                            brief = brief[:max_chars-3] + "..."
                        return brief

            except json.JSONDecodeError:
                continue

    except Exception:
        pass

    return None
