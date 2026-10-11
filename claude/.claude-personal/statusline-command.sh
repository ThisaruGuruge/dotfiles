#!/bin/sh
# Claude Code status line, personal account: blue ● PERSONAL, cost hidden until non-zero (see bin/claude-statusline)
exec "${CLAUDE_STATUSLINE:-$HOME/dotfiles/bin/claude-statusline}" --label PERSONAL --color '137;180;250' --cost nonzero
