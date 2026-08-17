-- Java debugging. nvim-jdtls sets up the adapter itself (via the
-- java-debug-adapter / java-test bundles Mason installs, see plugins/dap.lua);
-- this only adds the launch configurations. See :help jdtls-dap-config.
--
-- Tier 3: hand-written configurations. Auto-discovered by the loader at the
-- end of plugins/dap.lua — nothing imports this explicitly.
local M = {}

---@param dap table The `dap` module, passed in by the loader
M.setup = function(dap)
  dap.configurations.java = {
    {
      type = "java",
      request = "launch",
      name = "Debug (Attach) - Remote",
      hostName = "127.0.0.1",
      port = 5005, -- Default remote debug port
    },
  }
end

return M
