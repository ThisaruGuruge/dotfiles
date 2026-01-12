local wezterm = require("wezterm")

local config = wezterm.config_builder()

-- ============================================================================
-- Appearance
-- ============================================================================

-- Color scheme
config.color_scheme = "Catppuccin Mocha"

config.font = wezterm.font_with_fallback({
	"FiraCode Nerd Font",
	"JetBrains Mono",
	"Menlo",
})
config.font_size = 13.0

-- Use INTEGRATED_BUTTONS|RESIZE for native fullscreen with menu bar on hover
config.window_decorations = "INTEGRATED_BUTTONS|RESIZE"
config.window_background_opacity = 0.90
config.macos_window_background_blur = 20

config.background = {
	{
		source = {
			File = wezterm.config_dir .. "/resources/backgrounds/background_image.jpg",
		},
		opacity = 0.4,
		hsb = {
			brightness = 0.1,
		},
		width = "100%",
		height = "100%",
	},
}

config.enable_tab_bar = true
config.hide_tab_bar_if_only_one_tab = true
config.use_fancy_tab_bar = false
config.tab_bar_at_bottom = false

config.window_padding = {
	left = 8,
	right = 8,
	top = 8,
	bottom = 8,
}

-- ============================================================================
-- Key Bindings
-- ============================================================================

-- Send Option as Alt/Meta for word navigation
config.send_composed_key_when_left_alt_is_pressed = false
config.send_composed_key_when_right_alt_is_pressed = false

config.keys = {
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
	{
		key = "Backspace",
		mods = "OPT",
		action = wezterm.action.SendKey({
			key = "w",
			mods = "CTRL",
		}),
	},
	{
		key = "Delete",
		mods = "OPT",
		action = wezterm.action.SendKey({
			key = "d",
			mods = "ALT",
		}),
	},
	{
		key = "Backspace",
		mods = "CMD",
		action = wezterm.action.SendKey({
			key = "u",
			mods = "CTRL",
		}),
	},
	{
		key = "Delete",
		mods = "CMD",
		action = wezterm.action.SendKey({
			key = "k",
			mods = "CTRL",
		}),
	},
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
	{
		key = "w",
		mods = "CMD",
		action = wezterm.action.CloseCurrentPane({ confirm = true }),
	},
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
	{
		key = "Enter",
		mods = "CMD",
		action = wezterm.action.ToggleFullScreen,
	},
	{
		key = "k",
		mods = "CMD",
		action = wezterm.action.ClearScrollback("ScrollbackAndViewport"),
	},
	{
		key = "l",
		mods = "CMD",
		action = wezterm.action_callback(function(window, pane)
			window:perform_action(wezterm.action.ScrollToBottom, pane)
			local height = pane:get_dimensions().viewport_rows
			local blank_viewport = string.rep("\r\n", height)
			pane:inject_output(blank_viewport)
			pane:send_text("\x0c")
		end),
	},
	{
		key = "f",
		mods = "CMD",
		action = wezterm.action.Search({ CaseSensitiveString = "" }),
	},
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
	{
		event = { Up = { streak = 1, button = "Left" } },
		mods = "CMD",
		action = wezterm.action.OpenLinkAtMouseCursor,
	},
}

-- ============================================================================
-- Performance & Behavior
-- ============================================================================

config.automatically_reload_config = true

config.scrollback_lines = 10000

config.max_fps = 120
config.animation_fps = 60

config.default_prog = { "/bin/zsh", "-l" }

config.default_cursor_style = "BlinkingBar"
config.cursor_blink_rate = 700

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

config.harfbuzz_features = { "calt=1", "clig=1", "liga=1" }

config.hyperlink_rules = {
	{
		regex = "\\b\\w+://[\\w.-]+\\.[a-z]{2,15}\\S*\\b",
		format = "$0",
	},
	{
		regex = "\\blocalhost:[0-9]+\\b",
		format = "http://$0",
	},
	{
		regex = "\\b\\w+/\\w+#[0-9]+\\b",
		format = "https://github.com/$0",
	},
}

return config
