return {
	"stevearc/aerial.nvim",
	dependencies = {
		"nvim-treesitter/nvim-treesitter",
		"nvim-tree/nvim-web-devicons",
	},
	event = { "BufReadPost", "BufNewFile" },
	keys = {
		{ "<leader>a", "<cmd>AerialToggle!<cr>", desc = "Toggle Outline" },
		{ "{", "<cmd>AerialPrev<cr>", desc = "Previous Symbol" },
		{ "}", "<cmd>AerialNext<cr>", desc = "Next Symbol" },
	},
	opts = {
		backends = { "treesitter", "lsp", "markdown" },
		layout = {
			max_width = { 40, 0.2 },
			min_width = 25,
			default_direction = "prefer_left",
		},
		-- Auto-open when opening a file
		open_automatic = true,
		filter_kind = false,
		show_guides = true,
		guides = {
			mid_item = "├─",
			last_item = "└─",
			nested_top = "│ ",
			whitespace = "  ",
		},
	},
}
