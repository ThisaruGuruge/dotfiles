return {
    -- Debug Adapter Protocol (DAP)
    {
        "mfussenegger/nvim-dap",
        dependencies = {
            -- DAP UI
            { "rcarriga/nvim-dap-ui", dependencies = { "nvim-neotest/nvim-nio" } },
            -- DAP Mason integration
            { "jay-babu/mason-nvim-dap.nvim", dependencies = { "williamboman/mason.nvim" } },
        },
        config = function()
            local dap = require("dap")
            local dapui = require("dapui")

            -- Install debug adapters if they are not present
            require("mason-nvim-dap").setup({
                ensure_installed = { "debugpy", "java-debug-adapter", "java-test" },
                automatic_installation = true,
                handlers = {},
            })

            -- Python DAP configuration
            dap.adapters.debugpy = function(cb, config)
                if config.request == 'attach' then
                    -- Attach to a running process
                    local dbg = require('dap.ext.vscode').json_decode(vim.fn.input('DAP Attach JSON: '))
                    cb(dbg)
                else
                    -- Launch a new process
                    local adapter = {
                        type = "executable",
                        command = require("mason-registry").get_package("debugpy"):get_install_path() .. "/venv/bin/python",
                        args = { "-m", "debugpy.adapter" },
                    }
                    cb(adapter)
                end
            end

            dap.configurations.python = {
                {
                    type = "debugpy",
                    request = "launch",
                    name = "Launch file",
                    program = "${file}",
                    pythonPath = function()
                        -- Use the python from the current virtualenv
                        if vim.env.VIRTUAL_ENV then
                            return vim.env.VIRTUAL_ENV .. "/bin/python"
                        end
                        -- Fallback to the python in the path
                        return vim.fn.exepath("python3")
                    end,
                },
            }

            -- Java DAP configuration
            -- nvim-jdtls handles the adapter setup automatically.
            -- This is more for launching tests and specific configurations.
            -- See :help jdtls-dap-config
            dap.configurations.java = {
                {
                    type = "java",
                    request = "launch",
                    name = "Debug (Attach) - Remote",
                    hostName = "127.0.0.1",
                    port = 5005, -- Default remote debug port
                },
            }

            -- DAP UI setup
            dapui.setup({
                layouts = {
                    {
                        elements = {
                            { id = "scopes", size = 0.25 },
                            { id = "breakpoints", size = 0.25 },
                            { id = "stacks", size = 0.25 },
                            { id = "watches", size = 0.25 },
                        },
                        size = 40,
                        position = "left",
                    },
                    {
                        elements = {
                            { id = "repl", size = 0.5 },
                            { id = "console", size = 0.5 },
                        },
                        size = 0.25,
                        position = "bottom",
                    },
                },
                floating = {
                    max_height = 0.9,
                    border = "rounded",
                },
                controls = {
                    enabled = true,
                    element = "repl",
                },
            })

            -- DAP Keybindings
            vim.keymap.set("n", "<leader>db", dap.toggle_breakpoint, { desc = "Toggle breakpoint" })
            vim.keymap.set("n", "<leader>dc", dap.continue, { desc = "Continue" })
            vim.keymap.set("n", "<leader>do", dap.step_over, { desc = "Step over" })
            vim.keymap.set("n", "<leader>di", dap.step_into, { desc = "Step into" })
            vim.keymap.set("n", "<leader>dO", dap.step_out, { desc = "Step out" })
            vim.keymap.set("n", "<leader>dr", dap.repl.open, { desc = "Open REPL" })
            vim.keymap.set("n", "<leader>dl", dap.run_last, { desc = "Run last" })
            vim.keymap.set("n", "<leader>du", dapui.toggle, { desc = "Toggle DAP UI" })

            -- Open DAP UI on DAP events
            dap.listeners.after.event_initialized["dapui_config"] = function()
                dapui.open()
            end
            dap.listeners.before.event_terminated["dapui_config"] = function()
                dapui.close()
            end
            dap.listeners.before.event_exited["dapui_config"] = function()
                dapui.close()
            end
        end,
    },
}
