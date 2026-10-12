-- Big-file guard: one place for the thresholds that decide when per-buffer
-- features (treesitter highlight/fold, format-on-save, statusline word count,
-- JSON path) are too expensive to run.
local M = {}

M.max_bytes = 1.5 * 1024 * 1024
M.max_lines = 50000

--- True when the buffer is large enough that expensive features should skip it.
---@param buf? integer
---@return boolean
function M.is_big(buf)
  buf = (buf == nil or buf == 0) and vim.api.nvim_get_current_buf() or buf
  if not vim.api.nvim_buf_is_valid(buf) then
    return false
  end
  local lines = vim.api.nvim_buf_line_count(buf)
  if lines > M.max_lines then
    return true
  end
  -- Byte offset of the end of the buffer; cheap, and works before the file is
  -- written (unlike fs_stat).
  local ok, size = pcall(vim.api.nvim_buf_get_offset, buf, lines)
  return ok and size > M.max_bytes
end

return M
