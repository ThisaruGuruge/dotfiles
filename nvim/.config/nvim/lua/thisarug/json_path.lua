local M = {}

M.get = function()
  if vim.bo.filetype ~= "json" then
    return ""
  end

  -- Big files skip treesitter entirely; get_parser would parse them on demand.
  if require("thisarug.bigfile").is_big() then
    return ""
  end

  local ok, parser = pcall(vim.treesitter.get_parser, 0, "json")
  if not ok or not parser then
    return ""
  end

  local tree = parser:parse()[1]
  if not tree then
    return ""
  end

  local cursor = vim.api.nvim_win_get_cursor(0)
  local row, col = cursor[1] - 1, cursor[2]

  local node = tree:root():named_descendant_for_range(row, col, row, col)
  if not node then
    return "root"
  end

  local path = {}

  while node and node:type() ~= "document" do
    local parent = node:parent()
    if not parent then
      break
    end

    if parent:type() == "pair" then
      local key_node = parent:named_child(0)
      if key_node then
        local key = vim.treesitter.get_node_text(key_node, 0)
        key = key:gsub('^"(.*)"$', "%1")
        table.insert(path, 1, key)
      end
      node = parent
    elseif parent:type() == "array" then
      local nr, nc = node:range()
      local idx = 0
      -- Walking every sibling is O(n) per cursor move; give up on huge arrays.
      if parent:child_count() > 2000 then
        table.insert(path, 1, "[…]")
        node = parent
        goto continue
      end
      for i = 0, parent:child_count() - 1 do
        local child = parent:child(i)
        local ct = child:type()
        if ct ~= "[" and ct ~= "]" and ct ~= "," then
          local cr, cc = child:range()
          if cr == nr and cc == nc then
            break
          end
          idx = idx + 1
        end
      end
      table.insert(path, 1, "[" .. idx .. "]")
      node = parent
    else
      node = parent
    end
    ::continue::
  end

  if #path == 0 then
    return "root"
  end

  local result = "root"
  for _, part in ipairs(path) do
    if part:sub(1, 1) == "[" then
      result = result .. part
    else
      result = result .. "." .. part
    end
  end

  return result
end

return M
