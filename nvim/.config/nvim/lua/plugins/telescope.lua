return {
    {
        "nvim-telescope/telescope.nvim",
        dependencies = {
            "nvim-lua/plenary.nvim",
{ 'nvim-telescope/telescope-fzf-native.nvim', build = 'make' }
        },
        cmd = "Telescope",
        keys = {
            { "<leader>en", function()
                require('telescope.builtin').find_files { cwd = vim.fn.stdpath("config") }
            end, desc = "Find Neovim config files" },
            { "<leader>ep", function()
                require('telescope.builtin').find_files { cwd = vim.fs.joinpath(vim.fn.stdpath("data"), "lazy") }
            end, desc = "Find plugin files" },
            { "<leader>fg", desc = "Live Grep (multi)" },
        },
        config = function()
            local pickers = require("telescope.pickers")
            local finders = require("telescope.finders")
            local make_entry = require("telescope.make_entry")
            local conf = require("telescope.config").values

            local live_multigrep = function(opts)
                opts = opts or {}
                opts.cwd = opts.cwd or vim.uv.cwd()
                local finder = finders.new_async_job {
                    command_generator = function(prompt)
                        if not prompt or prompt == "" then return nil end
                        local pieces = vim.split(prompt, "  ")
                        local args = { "rg" }
                        if pieces[1] then
                            table.insert(args, "-e")
                            table.insert(args, pieces[1])
                        end
                        if pieces[2] and pieces[2] ~= "" then
                            table.insert(args, "--type")
                            table.insert(args, pieces[2])
                        end
                        if pieces[3] then
                            table.insert(args, "-g")
                            table.insert(args, pieces[3])
                        end
                        table.insert(args, { "--color=never", "--no-heading", "--with-filename", "--line-number", "--column", "--smart-case" })
                        return vim.iter(args):flatten():totable()
                    end,
                    entry_maker = make_entry.gen_from_vimgrep(opts),
                    cwd = opts.cwd,
                }
                pickers.new(opts, {
                    debounce = 100,
                    prompt_title = "Multi Grep",
                    finder = finder,
                    previewer = conf.grep_previewer(opts),
                    sorter = require("telescope.sorters").empty(),
                }):find()
            end

            vim.keymap.set("n", "<leader>fg", live_multigrep)

            require('telescope').setup({
                pickers = {
                    find_files = {
                        theme = "ivy"
                    }
                },
                defaults = {
                    mappings = {
                        i = {
                            ["<C-u>"] = false,
                            ["<C-d>"] = false,
                        },
                        n = {
                            ["q"] = require('telescope.actions').close,
                        },
                    },
                    file_ignore_patterns = { "node_modules", ".git/", "%.lock" },
                    layout_config = {
                        horizontal = {
                            preview_width = 0.55,
                        },
                    },
                },
                extensions = {
                    fzf = {}
                }
            })
            require('telescope').load_extension('fzf')
        end,
    },
}
