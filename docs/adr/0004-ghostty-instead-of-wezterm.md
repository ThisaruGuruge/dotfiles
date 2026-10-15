# Use Ghostty as the terminal, not WezTerm

The terminal moved from WezTerm to Ghostty in July 2026 (`78b1f1c`, `e97dd97`). WezTerm had rendering bugs on macOS: a blank screen after a display switch or re-login, and jumbled text. Ghostty renders natively with Metal and fixed them.

## Consequences

- Dropped on purpose: background image, custom hyperlink regexes (localhost, GitHub shorthand), `Cmd+W` as tmux kill-pane, and fine-grained visual bell.
- `Cmd+Left/Right` send Home/End and `Cmd+Backspace/Delete` send `Ctrl+U` / `Alt+k`, so `03-keybindings.zsh` binds every Home/End form that tmux can hand a pane. They depend on the tmux prefix staying `Ctrl+a`; `test-zsh` fails if it changes.
- `macos-option-as-alt = left` covers Option+arrow word movement with no explicit bindings.
- SSH hosts need a one-time `infocmp -x xterm-ghostty | ssh HOST -- tic -x -`.
- Yazi image previews use the Kitty protocol, with chafa as a fallback.
