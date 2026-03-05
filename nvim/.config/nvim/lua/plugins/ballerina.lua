-- Register .bal filetype early (before any lazy-loading)
vim.filetype.add({
	extension = {
		bal = "ballerina",
	},
})

-- Resolve bal binary: prefer PATH lookup, fall back to known install location
local bal_cmd = vim.fn.exepath("bal")
if bal_cmd == "" then
	bal_cmd = "/Library/Ballerina/bin/bal"
end

-- Set up Ballerina LSP using Neovim 0.11+ native API.
-- Capabilities are inherited from the global "*" config set in lsp.lua.
-- Root marker is Ballerina.toml only — .git is intentionally excluded
-- because Ballerina projects don't require a git repo.
vim.lsp.config("ballerina", {
	cmd = { bal_cmd, "start-language-server" },
	filetypes = { "ballerina" },
	root_markers = { "Ballerina.toml" },
})
vim.lsp.enable("ballerina")

return {
    -- Syntax highlighting for Ballerina (no treesitter grammar exists)
    {
        "martskins/vim-ballerina",
        ft = "ballerina",
    },
}
