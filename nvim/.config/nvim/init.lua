-- Compatibility shim for Neovim 0.11+ (ft_to_lang was removed)
if not vim.treesitter.language.ft_to_lang then
	vim.treesitter.language.ft_to_lang = vim.treesitter.language.get_lang
end

require("thisarug")
require("config.lazy")
