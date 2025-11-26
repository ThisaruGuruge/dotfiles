-- WezTerm Configuration
-- Pull in the wezterm API
local wezterm = require("wezterm")

-- This table will hold the configuration
local config = {}

-- In newer versions of wezterm, use the config_builder which will
-- help provide clearer error messages
if wezterm.config_builder then
	config = wezterm.config_builder()
end

-- ============================================================================
-- Appearance
-- ============================================================================

-- Color scheme
config.color_scheme = "Catppuccin Mocha" -- Popular modern dark theme
-- Alternative options: "Tokyo Night", "Nord", "Dracula", "Gruvbox Dark"

-- Font configuration
config.font = wezterm.font_with_fallback({
	"FiraCode Nerd Font", -- Main font with ligatures
	"JetBrains Mono",
	"Menlo",
})
config.font_size = 13.0

-- Window appearance
config.window_decorations = "RESIZE" -- Hide title bar but keep resize
config.window_background_opacity = 0.95
config.macos_window_background_blur = 20

-- Tab bar
config.enable_tab_bar = true
config.hide_tab_bar_if_only_one_tab = true
config.use_fancy_tab_bar = false -- Use retro-style tab bar
config.tab_bar_at_bottom = false

-- Padding
config.window_padding = {
	left = 8,
	right = 8,
	top = 8,
	bottom = 8,
}

-- ============================================================================
-- Key Bindings - macOS Option Key for Word Jumps
-- ============================================================================

-- IMPORTANT: Send Option as Alt/Meta for word navigation
-- This allows Option+Left/Right to jump words, Option+Backspace to delete words
config.send_composed_key_when_left_alt_is_pressed = false
config.send_composed_key_when_right_alt_is_pressed = false

config.keys = {
	-- Word navigation with Option key
	{
		key = "LeftArrow",
		mods = "OPT",
		action = wezterm.action.SendKey({
			key = "b",
			mods = "ALT",
		}),
	},
	{
		key = "RightArrow",
		mods = "OPT",
		action = wezterm.action.SendKey({
			key = "f",
			mods = "ALT",
		}),
	},

	-- Delete word backwards with Option+Backspace
	{
		key = "Backspace",
		mods = "OPT",
		action = wezterm.action.SendKey({
			key = "w",
			mods = "CTRL",
		}),
	},

	-- Jump to beginning/end of line with Cmd
	{
		key = "LeftArrow",
		mods = "CMD",
		action = wezterm.action.SendKey({
			key = "a",
			mods = "CTRL",
		}),
	},
	{
		key = "RightArrow",
		mods = "CMD",
		action = wezterm.action.SendKey({
			key = "e",
			mods = "CTRL",
		}),
	},

	-- Split panes
	{
		key = "d",
		mods = "CMD",
		action = wezterm.action.SplitHorizontal({ domain = "CurrentPaneDomain" }),
	},
	{
		key = "d",
		mods = "CMD|SHIFT",
		action = wezterm.action.SplitVertical({ domain = "CurrentPaneDomain" }),
	},

	-- Navigate panes
	{
		key = "[",
		mods = "CMD",
		action = wezterm.action.ActivatePaneDirection("Prev"),
	},
	{
		key = "]",
		mods = "CMD",
		action = wezterm.action.ActivatePaneDirection("Next"),
	},

	-- Close pane
	{
		key = "w",
		mods = "CMD",
		action = wezterm.action.CloseCurrentPane({ confirm = true }),
	},

	-- Create/navigate tabs
	{
		key = "t",
		mods = "CMD",
		action = wezterm.action.SpawnTab("CurrentPaneDomain"),
	},
	{
		key = "1",
		mods = "CMD",
		action = wezterm.action.ActivateTab(0),
	},
	{
		key = "2",
		mods = "CMD",
		action = wezterm.action.ActivateTab(1),
	},
	{
		key = "3",
		mods = "CMD",
		action = wezterm.action.ActivateTab(2),
	},
	{
		key = "4",
		mods = "CMD",
		action = wezterm.action.ActivateTab(3),
	},
	{
		key = "5",
		mods = "CMD",
		action = wezterm.action.ActivateTab(4),
	},
	{
		key = "6",
		mods = "CMD",
		action = wezterm.action.ActivateTab(5),
	},
	{
		key = "7",
		mods = "CMD",
		action = wezterm.action.ActivateTab(6),
	},
	{
		key = "8",
		mods = "CMD",
		action = wezterm.action.ActivateTab(7),
	},
	{
		key = "9",
		mods = "CMD",
		action = wezterm.action.ActivateTab(8),
	},

	-- Toggle fullscreen
	{
		key = "Enter",
		mods = "CMD",
		action = wezterm.action.ToggleFullScreen,
	},

	-- Clear scrollback
	{
		key = "k",
		mods = "CMD",
		action = wezterm.action.ClearScrollback("ScrollbackAndViewport"),
	},

	-- Search
	{
		key = "f",
		mods = "CMD",
		action = wezterm.action.Search({ CaseSensitiveString = "" }),
	},
}

-- ============================================================================
-- Mouse Bindings
-- ============================================================================

config.mouse_bindings = {
	-- Click to select + Cmd to open URLs
	{
		event = { Up = { streak = 1, button = "Left" } },
		mods = "CMD",
		action = wezterm.action.OpenLinkAtMouseCursor,
	},
}

-- ============================================================================
-- Performance & Behavior
-- ============================================================================

-- Scrollback
config.scrollback_lines = 10000

-- Performance
config.max_fps = 120
config.animation_fps = 60

-- Shell
config.default_prog = { "/bin/zsh", "-l" }

-- Cursor
config.default_cursor_style = "BlinkingBar"
config.cursor_blink_rate = 700

-- Bell
config.audible_bell = "Disabled"
config.visual_bell = {
	fade_in_function = "EaseIn",
	fade_in_duration_ms = 150,
	fade_out_function = "EaseOut",
	fade_out_duration_ms = 150,
}

-- ============================================================================
-- Advanced Features
-- ============================================================================

-- Enable ligatures (for FiraCode)
config.harfbuzz_features = { "calt=1", "clig=1", "liga=1" }

-- Hyperlinks
config.hyperlink_rules = {
	-- URLs with protocols
	{
		regex = "\\b\\w+://[\\w.-]+\\.[a-z]{2,15}\\S*\\b",
		format = "$0",
	},
	-- Implicit localhost URLs
	{
		regex = "\\blocalhost:[0-9]+\\b",
		format = "http://$0",
	},
	-- GitHub/GitLab-style issue references
	{
		regex = "\\b\\w+/\\w+#[0-9]+\\b",
		format = "https://github.com/$0",
	},
}

-- ============================================================================
-- Return the configuration to wezterm
-- ============================================================================

return config
