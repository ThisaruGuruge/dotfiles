return {
	"mbbill/undotree",
	keys = {
		{ "<leader>u", "<cmd>UndotreeToggle<cr>", desc = "Toggle Undotree" },
	},
	config = function()
		-- Focus undotree window when opened
		vim.g.undotree_SetFocusWhenToggle = 1
		-- Use short timestamps
		vim.g.undotree_ShortIndicators = 1
		-- Set window layout (tree on left, diff below)
		vim.g.undotree_WindowLayout = 2
		-- Set tree width
		vim.g.undotree_SplitWidth = 30
	end,
}
