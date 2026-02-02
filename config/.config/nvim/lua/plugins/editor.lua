return {
	{
		"nvim-treesitter/nvim-treesitter",
		build = ":TSUpdate",
		event = { "BufReadPost", "BufNewFile" },
		config = function()
			-- Install parsers (run :TSInstall manually or use this list)
			local parsers = {
				"lua",
				"vim",
				"vimdoc",
				"bash",
				"json",
				"yaml",
				"markdown",
				"markdown_inline",
				"typescript",
				"javascript",
				"go",
				"rust",
				"python",
			}

			-- Auto-install missing parsers when entering a buffer
			vim.api.nvim_create_autocmd("FileType", {
				callback = function()
					local ft = vim.bo.filetype
					local lang = vim.treesitter.language.get_lang(ft) or ft
					if vim.tbl_contains(parsers, lang) then
						pcall(function()
							if not pcall(vim.treesitter.language.inspect, lang) then
								vim.cmd("TSInstall " .. lang)
							end
						end)
					end
					-- Enable treesitter highlighting
					pcall(vim.treesitter.start)
				end,
			})

			-- Incremental selection keymaps
			vim.keymap.set("n", "<CR>", function()
				require("nvim-treesitter.incremental_selection").init_selection()
			end, { desc = "Init treesitter selection" })
			vim.keymap.set("x", "<CR>", function()
				require("nvim-treesitter.incremental_selection").node_incremental()
			end, { desc = "Increment treesitter selection" })
			vim.keymap.set("x", "<BS>", function()
				require("nvim-treesitter.incremental_selection").node_decremental()
			end, { desc = "Decrement treesitter selection" })
		end,
	},

	{
		"nvim-lualine/lualine.nvim",
		event = "VeryLazy",
		dependencies = { "nvim-tree/nvim-web-devicons" },
		config = function()
			require("lualine").setup({
				options = {
					icons_enabled = true,
					theme = "auto",
					component_separators = { left = "|", right = "|" },
					section_separators = { left = "", right = "" },
					globalstatus = true,
				},
			})
		end,
	},

	{
		"folke/which-key.nvim",
		event = "VeryLazy",
		config = function()
			local wk = require("which-key")
			wk.setup({
				plugins = {
					marks = true,
					registers = true,
					spelling = {
						enabled = true,
						suggestions = 20,
					},
					presets = {
						operators = true,
						motions = true,
						text_objects = true,
						windows = true,
						nav = true,
						z = true,
						g = true,
					},
				},
				win = {
					border = "rounded",
					padding = { 1, 2 },
				},
				icons = {
					breadcrumb = "»",
					separator = "→",
					group = "+",
				},
				show_help = true,
				show_keys = true,
				triggers = {
					{ "<leader>", mode = "n" },
					{ "<auto>", mode = "nxsot" },
				},
				-- Expand groups by default
				expand = 1,
				-- Show keybindings faster
				delay = 200,
			})

			-- Register keybindings with which-key (includes both binding and description)
			wk.add({
				-- Leader groups (with clear visual indicators)
				{ "<leader>f", group = "󰍉 Find/Search...", icon = "" },
				{ "<leader>g", group = " Git...", icon = "" },
				{ "<leader>l", group = " LSP...", icon = "" },
				{ "<leader>t", group = " Toggle...", icon = "" },

				-- Find/Telescope mappings (with commands)
				{ "<leader>ff", "<cmd>Telescope find_files<cr>", desc = "Find Files", icon = "" },
				{ "<leader>fg", "<cmd>Telescope live_grep<cr>", desc = "Live Grep", icon = "" },
				{ "<leader>fb", "<cmd>Telescope buffers<cr>", desc = "Find Buffers", icon = "" },
				{ "<leader>fh", "<cmd>Telescope help_tags<cr>", desc = "Find Help", icon = "" },
				{ "<leader>fr", "<cmd>Telescope oldfiles<cr>", desc = "Recent Files", icon = "" },
				{ "<leader>fw", "<cmd>Telescope grep_string<cr>", desc = "Find Word Under Cursor", icon = "" },
				{ "<leader>fk", "<cmd>Telescope keymaps<cr>", desc = "Find Keymaps", icon = "" },
				{
					"<leader>fs",
					"<cmd>Telescope current_buffer_fuzzy_find<cr>",
					desc = "Search in Buffer",
					icon = "",
				},

				-- File explorer (direct actions)
				{ "<leader>e", "<cmd>Neotree toggle<cr>", desc = " Toggle File Explorer", icon = "" },
				{
					"<leader>o",
					function()
						if vim.bo.filetype == "neo-tree" then
							vim.cmd("wincmd p")
						else
							vim.cmd("Neotree focus")
						end
					end,
					desc = " Focus File Explorer",
					icon = "",
				},

				-- Ctrl mappings
				{ "<C-p>", "<cmd>Telescope git_files<cr>", desc = "Find Git Files", icon = "" },

				-- Git mappings (will be registered by gitsigns, these are placeholders)
				{ "<leader>gs", desc = "Stage Hunk", icon = "" },
				{ "<leader>gr", desc = "Reset Hunk", icon = "" },
				{ "<leader>gS", desc = "Stage Buffer", icon = "" },
				{ "<leader>gu", desc = "Undo Stage Hunk", icon = "" },
				{ "<leader>gR", desc = "Reset Buffer", icon = "" },
				{ "<leader>gp", desc = "Preview Hunk", icon = "" },
				{ "<leader>gb", desc = "Blame Line", icon = "" },
				{ "<leader>gd", desc = "Diff This", icon = "" },
				{ "<leader>gD", desc = "Diff This ~", icon = "" },
				{ "<leader>gg", desc = "LazyGit", icon = "" },
				{ "<leader>gw", desc = "Switch Git Worktree", icon = "" },
				{ "<leader>gW", desc = "Create Git Worktree", icon = "" },

				-- LSP mappings (will be set in LspAttach, these help which-key)
				{ "<leader>lr", desc = "Rename Symbol", icon = "" },
				{ "<leader>la", desc = "Code Action", icon = "" },
				{ "<leader>lf", desc = "Format Buffer", icon = "" },
				{ "<leader>ld", desc = "Show Diagnostics", icon = "" },

				-- Toggle mappings
				{ "<leader>tt", desc = "Toggle Terminal", icon = "" },

				-- Navigation group (g prefix)
				{ "g", group = " Go to / Navigate..." },
				{ "gd", desc = "Go to Definition", icon = "" },
				{ "gD", desc = "Go to Declaration", icon = "" },
				{ "gr", desc = "Find References", icon = "" },
				{ "gi", desc = "Go to Implementation", icon = "" },

				-- Diagnostics navigation
				{ "[d", desc = "Previous Diagnostic", icon = "" },
				{ "]d", desc = "Next Diagnostic", icon = "" },
				{ "[c", desc = "Previous Git Hunk", icon = "" },
				{ "]c", desc = "Next Git Hunk", icon = "" },

				-- Other useful mappings
				{ "K", desc = "Hover Documentation", icon = "" },
				{
					"<leader>?",
					function()
						require("telescope.builtin").keymaps()
					end,
					desc = " Search All Keybindings",
					icon = "",
				},
				{
					"<leader><leader>",
					function()
						require("which-key").show({ keys = "<leader>", loop = false })
					end,
					desc = " Show This Menu",
					icon = "",
				},
			})
		end,
	},

	{
		"hrsh7th/nvim-cmp",
		event = "InsertEnter",
		dependencies = {
			"hrsh7th/cmp-nvim-lsp",
			"hrsh7th/cmp-buffer",
			"hrsh7th/cmp-path",
			"saadparwaiz1/cmp_luasnip",
			"L3MON4D3/LuaSnip",
			"rafamadriz/friendly-snippets",
		},
		config = function()
			local cmp = require("cmp")
			local luasnip = require("luasnip")

			require("luasnip.loaders.from_vscode").lazy_load()

			cmp.setup({
				snippet = {
					expand = function(args)
						luasnip.lsp_expand(args.body)
					end,
				},
				mapping = cmp.mapping.preset.insert({
					["<C-b>"] = cmp.mapping.scroll_docs(-4),
					["<C-f>"] = cmp.mapping.scroll_docs(4),
					["<C-Space>"] = cmp.mapping.complete(),
					["<C-e>"] = cmp.mapping.abort(),
					["<CR>"] = cmp.mapping.confirm({ select = true }),
					["<Tab>"] = cmp.mapping(function(fallback)
						if cmp.visible() then
							cmp.select_next_item()
						elseif luasnip.expand_or_jumpable() then
							luasnip.expand_or_jump()
						else
							fallback()
						end
					end, { "i", "s" }),
					["<S-Tab>"] = cmp.mapping(function(fallback)
						if cmp.visible() then
							cmp.select_prev_item()
						elseif luasnip.jumpable(-1) then
							luasnip.jump(-1)
						else
							fallback()
						end
					end, { "i", "s" }),
				}),
				sources = cmp.config.sources({
					{ name = "nvim_lsp" },
					{ name = "luasnip" },
				}, {
					{ name = "buffer" },
					{ name = "path" },
				}),
			})
		end,
	},

	{
		"akinsho/toggleterm.nvim",
		version = "*",
		keys = {
			{ "<leader>tt", "<cmd>ToggleTerm<cr>", desc = "Toggle terminal" },
		},
		config = function()
			require("toggleterm").setup({
				size = 12,
				open_mapping = [[<c-\>]],
				shade_terminals = true,
				direction = "float",
				float_opts = {
					border = "curved",
				},
			})
		end,
	},
}
