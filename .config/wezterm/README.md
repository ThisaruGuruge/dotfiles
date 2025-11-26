# WezTerm Configuration

This WezTerm configuration is designed for macOS with modern terminal workflows.

## Location
- **Config file**: `~/.config/wezterm/wezterm.lua`
- **Managed by**: Dotfiles (symlinked from `~/dotfiles/.config/wezterm/`)

## Key Features

### Option Key for Word Navigation ✨
The configuration enables **Option (Alt) key** for word-level navigation:

- **Option + Left Arrow**: Jump backward one word
- **Option + Right Arrow**: Jump forward one word
- **Option + Backspace**: Delete word backwards
- **Cmd + Left Arrow**: Jump to beginning of line
- **Cmd + Right Arrow**: Jump to end of line

This is configured via:
```lua
config.send_composed_key_when_left_option_is_pressed = false
config.send_composed_key_when_right_option_is_pressed = false
```

### Appearance
- **Color scheme**: Catppuccin Mocha (dark theme)
  - Alternatives: Tokyo Night, Nord, Dracula, Gruvbox Dark
- **Font**: FiraCode Nerd Font with ligatures enabled
- **Window**: Semi-transparent (95% opacity) with macOS blur effect
- **Tab bar**: Retro-style, hidden when only one tab is open

### Keyboard Shortcuts

#### Panes
- **Cmd + D**: Split horizontally
- **Cmd + Shift + D**: Split vertically
- **Cmd + [**: Navigate to previous pane
- **Cmd + ]**: Navigate to next pane
- **Cmd + W**: Close current pane (with confirmation)

#### Tabs
- **Cmd + T**: New tab
- **Cmd + 1-9**: Switch to tab 1-9
- **Cmd + W**: Close tab/pane

#### Other
- **Cmd + Enter**: Toggle fullscreen
- **Cmd + K**: Clear scrollback
- **Cmd + F**: Search

### Advanced Features
- **Scrollback**: 10,000 lines
- **Performance**: 120 FPS max, 60 FPS animations
- **Hyperlinks**: Automatic detection of URLs, localhost addresses, and GitHub issue references
- **Ligatures**: Enabled for FiraCode font
- **Bell**: Visual only (no sound)

## Customization

### Change Color Scheme
Edit line 21 in `wezterm.lua`:
```lua
config.color_scheme = "Your Theme Name"
```

Popular options:
- `"Catppuccin Mocha"` (current)
- `"Tokyo Night"`
- `"Nord"`
- `"Dracula"`
- `"Gruvbox Dark"`
- `"Solarized Dark"`

### Change Font
Edit lines 24-28:
```lua
config.font = wezterm.font_with_fallback({
	"Your Preferred Font",
	"FiraCode Nerd Font",
	"Menlo",
})
config.font_size = 13.0
```

### Adjust Transparency
Edit line 33:
```lua
config.window_background_opacity = 0.95  -- 1.0 is fully opaque, 0.0 is fully transparent
```

## Testing

After making changes, WezTerm will automatically reload the configuration. Check for errors by opening the debug console:
- **Cmd + Shift + L**: Open debug overlay
- Look for any Lua syntax errors or warnings

## Integration with Dotfiles

This configuration is part of the dotfiles `.config` package. It's symlinked to `~/.config/wezterm/` so changes in the dotfiles repo are immediately reflected.

To update:
```bash
cd ~/dotfiles
# Edit .config/wezterm/wezterm.lua
# Changes are immediately active in WezTerm
```

## Troubleshooting

### Option key not working for word jumps
1. Ensure you're using a recent version of WezTerm
2. Check that the configuration file is being loaded: look for any syntax errors in the debug console
3. Restart WezTerm completely (Cmd + Q, then reopen)

### Font not displaying correctly
1. Install FiraCode Nerd Font: `brew install font-fira-code-nerd-font`
2. Restart WezTerm
3. If issues persist, change to a system font like "Menlo"

### Configuration not loading
```bash
# Check config file exists and is readable
ls -la ~/.config/wezterm/wezterm.lua

# Verify it's symlinked correctly
readlink ~/.config/wezterm

# Should show: /Users/thisaru/dotfiles/.config/wezterm
```

## Resources
- [WezTerm Documentation](https://wezfurlong.org/wezterm/)
- [WezTerm Key Bindings](https://wezfurlong.org/wezterm/config/keys.html)
- [WezTerm Color Schemes](https://wezfurlong.org/wezterm/colorschemes/)
