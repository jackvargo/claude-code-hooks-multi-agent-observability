#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "anthropic",
#     "python-dotenv",
# ]
# ///

"""
Multi-Agent Observability Hook Script
Sends Claude Code hook events to the observability server.

Enhanced to include contextual information:
- project_name: Derived from cwd for display in UI
- agent_type: Extracted from Task tool calls for subagent identification
"""

import json
import sys
import os
import argparse
import urllib.request
import urllib.error
from datetime import datetime
from glob import glob
from utils.summarizer import generate_event_summary
from utils.message_builder import get_project_name

def get_agent_type_cache_path(session_id: str) -> str | None:
    """Get the path to the agent type cache file for this session."""
    try:
        # Use /tmp or system temp directory
        import tempfile
        temp_dir = tempfile.gettempdir()
        cache_file = os.path.join(temp_dir, f'claude-agent-types-{session_id}.json')
        return cache_file
    except Exception:
        return None


def save_agent_type_to_cache(session_id: str, agent_id: str, agent_type: str) -> None:
    """Save agent_id -> agent_type mapping to cache for this session."""
    cache_path = get_agent_type_cache_path(session_id)
    if not cache_path:
        return

    try:
        # Read existing cache
        cache = {}
        if os.path.isfile(cache_path):
            try:
                with open(cache_path, 'r') as f:
                    cache = json.load(f)
            except (json.JSONDecodeError, IOError):
                cache = {}

        # Update cache
        cache[agent_id] = agent_type

        # Write back
        with open(cache_path, 'w') as f:
            json.dump(cache, f)
    except Exception:
        # Fail silently - caching is a best-effort optimization
        pass


def load_agent_type_from_cache(session_id: str, agent_id: str) -> str | None:
    """Load agent_type from cache for given agent_id."""
    cache_path = get_agent_type_cache_path(session_id)
    if not cache_path or not os.path.isfile(cache_path):
        return None

    try:
        with open(cache_path, 'r') as f:
            cache = json.load(f)
            return cache.get(agent_id)
    except (json.JSONDecodeError, IOError, KeyError):
        return None


def find_agent_id_for_tool(transcript_path: str, tool_use_id: str) -> str | None:
    """
    Find the agent_id that owns a given tool_use_id by searching agent transcript files.

    Args:
        transcript_path: Path to the main transcript file
        tool_use_id: The tool_use_id to search for

    Returns:
        The agent_id (e.g., 'a3143629') if found, None otherwise
    """
    if not transcript_path or not tool_use_id:
        return None

    try:
        # Get directory containing the transcript
        transcript_dir = os.path.dirname(transcript_path)
        if not transcript_dir or not os.path.isdir(transcript_dir):
            return None

        # Find all agent-*.jsonl files in the same directory
        agent_files = glob(os.path.join(transcript_dir, 'agent-*.jsonl'))

        # Search each agent file for the tool_use_id
        for agent_file in agent_files:
            try:
                with open(agent_file, 'r') as f:
                    # Search line by line for efficiency
                    for line in f:
                        if tool_use_id in line:
                            # Extract agent_id from filename
                            # Format: agent-a3143629.jsonl -> a3143629
                            filename = os.path.basename(agent_file)
                            if filename.startswith('agent-') and filename.endswith('.jsonl'):
                                agent_id = filename[6:-6]  # Remove 'agent-' prefix and '.jsonl' suffix
                                return agent_id
            except (IOError, OSError, PermissionError):
                # Skip files that can't be read
                continue
    except Exception:
        # Fail gracefully - don't crash the hook
        pass

    return None

def send_event_to_server(event_data, server_url='http://localhost:4000/events'):
    """Send event data to the observability server."""
    try:
        # Build headers
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Claude-Code-Hook/1.0'
        }

        # Add API key authorization if configured
        api_key = os.environ.get('WATCHER_API_KEY', '')
        if api_key:
            headers['Authorization'] = f'Bearer {api_key}'

        # Prepare the request
        req = urllib.request.Request(
            server_url,
            data=json.dumps(event_data).encode('utf-8'),
            headers=headers
        )
        
        # Send the request
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                return True
            else:
                print(f"Server returned status: {response.status}", file=sys.stderr)
                return False
                
    except urllib.error.URLError as e:
        print(f"Failed to send event: {e}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        return False

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Send Claude Code hook events to observability server')
    parser.add_argument('--source-app', required=False, default='', help='Source application name (optional - reads from PROJECT_NAME env var if not provided)')
    parser.add_argument('--event-type', required=True, help='Hook event type (PreToolUse, PostToolUse, etc.)')
    # Server URL: CLI arg > WATCHER_SERVER_URL env var > localhost default
    default_server = os.environ.get('WATCHER_SERVER_URL', 'http://localhost:4000/events')
    parser.add_argument('--server-url', default=default_server, help='Server URL (default: WATCHER_SERVER_URL env var or localhost:4000)')
    parser.add_argument('--add-chat', action='store_true', help='Include chat transcript if available')
    parser.add_argument('--summarize', action='store_true', help='Generate AI summary of the event')

    args = parser.parse_args()
    
    try:
        # Read hook data from stdin
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON input: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Extract enhanced context
    cwd = input_data.get('cwd', '')
    project_name = get_project_name(cwd) if cwd else ''

    # Determine source_app with fallback chain:
    # 1. --source-app argument (if provided and non-empty)
    # 2. PROJECT_NAME environment variable (set by SessionStart hook)
    # 3. Derived from cwd using get_project_name()
    # 4. 'unknown-project' as last resort
    source_app = args.source_app.strip() if args.source_app else ''
    if not source_app:
        source_app = os.environ.get('PROJECT_NAME', '').strip()
    if not source_app:
        source_app = project_name or 'unknown-project'

    # Get session_id early - needed for cache lookups
    session_id = input_data.get('session_id', 'unknown')

    # Get agent_type - check payload first (SubagentStart provides it directly)
    # Fall back to tool_input.subagent_type for Task tool PreToolUse events
    agent_type = input_data.get('agent_type', '')
    if not agent_type:
        tool_input = input_data.get('tool_input', {})
        if isinstance(tool_input, dict):
            agent_type = tool_input.get('subagent_type', '')

    # Get agent_id - check payload first (SubagentStart/SubagentStop provide it directly)
    # Fall back to transcript search for PreToolUse/PostToolUse
    agent_id = input_data.get('agent_id', '')
    if not agent_id and args.event_type in ['PostToolUse', 'PreToolUse']:
        tool_use_id = input_data.get('tool_use_id', '')
        transcript_path = input_data.get('transcript_path', '')
        if tool_use_id and transcript_path:
            agent_id = find_agent_id_for_tool(transcript_path, tool_use_id) or ''

    # For Task PostToolUse, agent_id may be in tool_response.agentId
    if not agent_id and args.event_type == 'PostToolUse':
        tool_response = input_data.get('tool_response', {})
        if isinstance(tool_response, dict):
            agent_id = tool_response.get('agentId', '')  # Note: camelCase

    # Cache agent_type for SubagentStart events (for later retrieval by SubagentStop)
    if args.event_type == 'SubagentStart' and agent_id and agent_type:
        save_agent_type_to_cache(session_id, agent_id, agent_type)

    # For SubagentStop and tool events, try to retrieve agent_type from cache
    # if we have agent_id but no agent_type
    if agent_id and not agent_type:
        cached_agent_type = load_agent_type_from_cache(session_id, agent_id)
        if cached_agent_type:
            agent_type = cached_agent_type

    # Prepare event data for server with enhanced context
    event_data = {
        'source_app': source_app,
        'session_id': session_id,
        'hook_event_type': args.event_type,
        'payload': input_data,
        'timestamp': int(datetime.now().timestamp() * 1000),
        # Enhanced context for UI display
        'project_name': project_name,
        'agent_type': agent_type,
        'agent_id': agent_id,
        'cwd': cwd,
    }
    
    # Handle --add-chat option
    if args.add_chat and 'transcript_path' in input_data:
        transcript_path = input_data['transcript_path']
        if os.path.exists(transcript_path):
            # Read .jsonl file and convert to JSON array
            chat_data = []
            try:
                with open(transcript_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            try:
                                chat_data.append(json.loads(line))
                            except json.JSONDecodeError:
                                pass  # Skip invalid lines
                
                # Add chat to event data
                event_data['chat'] = chat_data
            except Exception as e:
                print(f"Failed to read transcript: {e}", file=sys.stderr)
    
    # Generate summary if requested
    if args.summarize:
        summary = generate_event_summary(event_data)
        if summary:
            event_data['summary'] = summary
        # Continue even if summary generation fails
    
    # Send to server
    success = send_event_to_server(event_data, args.server_url)
    
    # Always exit with 0 to not block Claude Code operations
    sys.exit(0)

if __name__ == '__main__':
    main()