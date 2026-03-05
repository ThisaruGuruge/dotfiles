-- TMux Integration
-- Seamless navigation between NeoVim splits and TMux panes

return {
	{
		"christoomey/vim-tmux-navigator",
		lazy = false, -- Load immediately for navigation to work
		cmd = {
			"TmuxNavigateLeft",
			"TmuxNavigateDown",
			"TmuxNavigateUp",
			"TmuxNavigateRight",
			"TmuxNavigatePrevious",
		},
		keys = {
			{ "<C-h>", "<cmd>TmuxNavigateLeft<cr>", desc = "Navigate Left (TMux/NeoVim)" },
			{ "<C-j>", "<cmd>TmuxNavigateDown<cr>", desc = "Navigate Down (TMux/NeoVim)" },
			{ "<C-k>", "<cmd>TmuxNavigateUp<cr>", desc = "Navigate Up (TMux/NeoVim)" },
			{ "<C-l>", "<cmd>TmuxNavigateRight<cr>", desc = "Navigate Right (TMux/NeoVim)" },
			{ "<C-\\>", "<cmd>TmuxNavigatePrevious<cr>", desc = "Navigate Previous (TMux/NeoVim)" },
		},
	},
}
