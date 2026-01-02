-- WezTerm Configuration
-- Pull in the wezterm API
local wezterm = require("wezterm")

-- Use config builder
local config = wezterm.config_builder()

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
-- Use INTEGRATED_BUTTONS|RESIZE for native fullscreen with menu bar on hover
-- Alternative: "RESIZE" hides title bar but prevents menu bar access in fullscreen
config.window_decorations = "INTEGRATED_BUTTONS|RESIZE"
config.window_background_opacity = 0.90 -- Adjust transparency (0.0-1.0)
config.macos_window_background_blur = 20

-- Background image
config.background = {
	{
		source = {
			File = wezterm.home_dir .. "/Pictures/Wallpapers/Towards the darkness.jpg",
		},
		-- Adjust image opacity separately from window opacity
		opacity = 0.4,
		-- How the image should be sized/positioned
		hsb = {
			brightness = 0.1, -- Darken the image so text is readable
		},
		-- Image positioning options: "Cover", "Contain", etc.
		width = "100%",
		height = "100%",
	},
}

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
	{
		key = "l",
		mods = "CMD",
		action = wezterm.action_callback(function(window, pane)
			-- scroll to bottom in case you aren't already
			window:perform_action(wezterm.action.ScrollToBottom, pane)

			-- get the current height of the viewport
			local height = pane:get_dimensions().viewport_rows

			-- build a string of new lines equal to the viewport height
			local blank_viewport = string.rep("\r\n", height)

			-- inject those new lines to push the viewport contents into the scrollback
			pane:inject_output(blank_viewport)

			-- send an escape sequence to clear the viewport (CTRL-L)
			pane:send_text("\x0c")
		end),
	},

	-- Search
	{
		key = "f",
		mods = "CMD",
		action = wezterm.action.Search({ CaseSensitiveString = "" }),
	},
	-- Shift enter for line break in Claude
	{
		key = "Enter",
		mods = "SHIFT",
		action = wezterm.action({ SendString = "\x1b\r" }),
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

-- Automatically reload configuration when it changes
config.automatically_reload_config = true

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
