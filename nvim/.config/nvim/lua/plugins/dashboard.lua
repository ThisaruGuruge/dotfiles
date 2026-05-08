return {
	"goolord/alpha-nvim",
	dependencies = { "nvim-tree/nvim-web-devicons" },
	event = "VimEnter",
	config = function()
		local alpha = require("alpha")
		local dashboard = require("alpha.themes.dashboard")

		-- Header
		dashboard.section.header.val = {
			[[                                                               ]],
			[[ ████████╗██╗  ██╗██╗███████╗ █████╗ ██████╗ ██╗   ██╗ ██████╗ ]],
			[[ ╚══██╔══╝██║  ██║██║██╔════╝██╔══██╗██╔══██╗██║   ██║██╔════╝ ]],
			[[    ██║   ███████║██║███████╗███████║██████╔╝██║   ██║██║  ███╗]],
			[[    ██║   ██╔══██║██║╚════██║██╔══██║██╔══██╗██║   ██║██║   ██║]],
			[[    ██║   ██║  ██║██║███████║██║  ██║██║  ██║╚██████╔╝╚██████╔╝]],
			[[    ╚═╝   ╚═╝  ╚═╝╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ]],
			[[                                                               ]],
		}

		-- Buttons
		dashboard.section.buttons.val = {
			dashboard.button("f", "  Find File", "<cmd>Telescope find_files<cr>"),
			dashboard.button("r", "  Recent Files", "<cmd>Telescope oldfiles<cr>"),
			dashboard.button("g", "  Live Grep", ":lua require('telescope').extensions.live_grep_args.live_grep_args()<cr>"),
			dashboard.button("e", "  File Explorer", "<cmd>Yazi cwd<cr>"),
			dashboard.button("l", "󰒲  Lazy", "<cmd>Lazy<cr>"),
			dashboard.button("q", "  Quit", "<cmd>qa<cr>"),
		}

		-- Footer: plugin count
		vim.api.nvim_create_autocmd("User", {
			pattern = "LazyVimStarted",
			callback = function()
				local stats = require("lazy").stats()
				dashboard.section.footer.val = "Loaded " .. stats.loaded .. "/" .. stats.count .. " plugins in " .. string.format("%.1f", stats.startuptime) .. "ms"
				pcall(vim.cmd.AlphaRedraw)
			end,
		})

		-- Layout
		dashboard.section.header.opts.hl = "AlphaHeader"
		dashboard.section.buttons.opts.hl = "AlphaButtons"
		dashboard.section.footer.opts.hl = "AlphaFooter"

		alpha.setup(dashboard.opts)

		-- Disable folding on alpha buffer
		vim.api.nvim_create_autocmd("FileType", {
			pattern = "alpha",
			callback = function()
				vim.opt_local.foldenable = false
				vim.opt_local.laststatus = 0
			end,
		})
	end,
}
