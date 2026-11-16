#!/bin/sh
# Claude Code status line, enterprise account: peach ● WORK, cost always shown (see scripts/bin/claude-statusline)
exec "${CLAUDE_STATUSLINE:-$HOME/bin/claude-statusline}" --label WORK --color '250;179;135' --cost always
