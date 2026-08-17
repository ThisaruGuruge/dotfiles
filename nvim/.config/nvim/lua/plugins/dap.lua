-- Debug Adapter Protocol (DAP) — core, language-agnostic setup.
--
-- Adapters and configurations deliberately do NOT live here. Each language
-- gets its own `dap-<lang>.lua` file so adding a debugger is a drop-in; see
-- "Adding a debugger" in CLAUDE.md for the three ways a language plugs in.
local function map(lhs, rhs, desc, mode)
  return { lhs, rhs, desc = desc, mode = mode }
end

return {
  {
    "mfussenegger/nvim-dap",
    dependencies = {
      -- DAP UI (scopes/breakpoints/stacks/watches + repl/console)
      { "rcarriga/nvim-dap-ui", dependencies = { "nvim-neotest/nvim-nio" } },
      -- Inline variable values at end-of-line while stepping
      "theHamsta/nvim-dap-virtual-text",
      -- Installs adapters that come from Mason
      { "jay-babu/mason-nvim-dap.nvim", dependencies = { "williamboman/mason.nvim" } },
    },
    keys = {
      -- Breakpoints
      map("<leader>db", function()
        require("dap").toggle_breakpoint()
      end, "Toggle breakpoint"),
      map("<leader>dB", function()
        vim.ui.input({ prompt = "Breakpoint condition: " }, function(condition)
          if condition and condition ~= "" then
            require("dap").set_breakpoint(condition)
          end
        end)
      end, "Conditional breakpoint"),
      map("<leader>dp", function()
        vim.ui.input({ prompt = "Log point message: " }, function(message)
          if message and message ~= "" then
            require("dap").set_breakpoint(nil, nil, message)
          end
        end)
      end, "Log point"),

      -- Stepping. Each has an F-key twin matching the VS Code / IntelliJ
      -- layout, for use mid-session when the leader prefix is a keystroke too
      -- many. F5/F6/F10/F11 are otherwise unused across nvim, tmux, and ghostty.
      map("<leader>dc", function()
        require("dap").continue()
      end, "Continue / start"),
      map("<F5>", function()
        require("dap").continue()
      end, "Debug: continue / start"),
      map("<leader>do", function()
        require("dap").step_over()
      end, "Step over"),
      map("<F10>", function()
        require("dap").step_over()
      end, "Debug: step over"),
      map("<leader>di", function()
        require("dap").step_into()
      end, "Step into"),
      map("<F11>", function()
        require("dap").step_into()
      end, "Debug: step into"),
      map("<leader>dO", function()
        require("dap").step_out()
      end, "Step out"),
      map("<S-F11>", function()
        require("dap").step_out()
      end, "Debug: step out"),
      map("<leader>dC", function()
        require("dap").run_to_cursor()
      end, "Run to cursor"),

      -- Session control
      map("<leader>dq", function()
        require("dap").terminate()
      end, "Terminate session"),
      map("<F6>", function()
        require("dap").terminate()
      end, "Debug: terminate session"),
      map("<leader>dR", function()
        require("dap").restart()
      end, "Restart session"),
      map("<leader>dl", function()
        require("dap").run_last()
      end, "Run last configuration"),

      -- Inspection
      map("<leader>dr", function()
        require("dap").repl.toggle()
      end, "Toggle REPL"),
      map("<leader>du", function()
        require("dapui").toggle()
      end, "Toggle DAP UI"),
      map("<leader>de", function()
        require("dapui").eval(nil, { enter = true })
      end, "Evaluate expression", { "n", "v" }),
    },
    config = function()
      local dap = require("dap")
      local dapui = require("dapui")

      -- mason-nvim-dap.setup() can only be called once, so this list is the
      -- one bit of per-language knowledge core can't hand off to a
      -- `dap-<lang>.lua` file. Adapters installed outside Mason don't belong here.
      require("mason-nvim-dap").setup({
        ensure_installed = { "delve", "debugpy", "java-debug-adapter", "java-test" },
        automatic_installation = true,
        -- Intentionally empty. mason-nvim-dap ships its own adapters and
        -- configurations (a `delve` adapter with four `type = "delve"` Go
        -- configs, among others); enabling the default handlers would list
        -- those in the picker alongside the ones the per-language files
        -- register, so every Go debug would start with a "which of these
        -- eight?" prompt. Empty handlers means Mason only installs binaries.
        handlers = {},
      })

      require("nvim-dap-virtual-text").setup({})

      -- Gutter signs. DapStopped also highlights the whole current line so
      -- the execution point is findable without hunting for the arrow.
      local signs = {
        DapBreakpoint = { text = "●", texthl = "DiagnosticError" },
        DapBreakpointCondition = { text = "◆", texthl = "DiagnosticWarn" },
        DapLogPoint = { text = "◉", texthl = "DiagnosticInfo" },
        DapBreakpointRejected = { text = "○", texthl = "DiagnosticHint" },
        DapStopped = { text = "▶", texthl = "DiagnosticOk", linehl = "Visual", numhl = "DiagnosticOk" },
      }
      for name, opts in pairs(signs) do
        vim.fn.sign_define(name, opts)
      end

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

      -- Tier-3 languages (hand-written adapter + configurations) live in
      -- lua/thisarug/dap/ and are discovered automatically: drop in a file
      -- exporting `setup(dap)` and it registers itself, no edit here needed.
      -- Languages with a dedicated dap plugin (tier 2, e.g. Go) get a spec in
      -- lua/plugins/dap-<lang>.lua instead; languages whose plugin registers
      -- itself (tier 1, e.g. Ballerina) need nothing at all.
      for _, path in ipairs(vim.api.nvim_get_runtime_file("lua/thisarug/dap/*.lua", true)) do
        local name = vim.fn.fnamemodify(path, ":t:r")
        local ok, mod = pcall(require, "thisarug.dap." .. name)
        if ok and type(mod) == "table" and type(mod.setup) == "function" then
          mod.setup(dap)
        else
          vim.notify(("DAP: could not load language module %q"):format(name), vim.log.levels.WARN)
        end
      end

      -- Open the UI when a session starts, close it when one ends
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
