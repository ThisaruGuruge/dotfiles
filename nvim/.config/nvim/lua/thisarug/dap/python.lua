-- Python debugging via debugpy (installed by Mason, see plugins/dap.lua).
--
-- Tier 3: hand-written adapter + configurations. Auto-discovered by the
-- loader at the end of plugins/dap.lua — nothing imports this explicitly.
local M = {}

---@param dap table The `dap` module, passed in by the loader
M.setup = function(dap)
  dap.adapters.debugpy = function(cb, config)
    if config.request == "attach" then
      -- Attach to a running process
      local dbg = require("dap.ext.vscode").json_decode(vim.fn.input("DAP Attach JSON: "))
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
end

return M
