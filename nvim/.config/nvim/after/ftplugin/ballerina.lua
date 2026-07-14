vim.keymap.set("n", "<leader>br", "<cmd>BallerinaRun<cr>", { buffer = true, desc = "Ballerina Run" })
vim.keymap.set("n", "<leader>bb", "<cmd>BallerinaBuild<cr>", { buffer = true, desc = "Ballerina Build" })
vim.keymap.set("n", "<leader>bt", "<cmd>BallerinaTest<cr>", { buffer = true, desc = "Ballerina Test" })
vim.keymap.set("n", "<leader>bf", "<cmd>BallerinaFormat<cr>", { buffer = true, desc = "Ballerina Format" })
vim.keymap.set(
	"n",
	"<leader>bF",
	"<cmd>BallerinaFormatToggle<cr>",
	{ buffer = true, desc = "Ballerina Format Toggle" }
)
