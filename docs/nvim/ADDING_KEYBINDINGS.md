# Adding New Keybindings to Neovim

This guide explains how to add new keybindings that will automatically appear in which-key with beautiful descriptions and icons.

## Location

All keybindings are centralized in: **`config/.config/nvim/lua/plugins/editor.lua`**

## Steps to Add a New Keybinding

### Important: Use which-key's `wk.add()` for BOTH binding AND description

In the `wk.add({})` section (around line 125+), add BOTH the command and description:

```lua
-- In the appropriate group section
{ "<leader>xc", "<cmd>YourCommand<cr>", desc = "Your Description", icon = "" },
```

**Do NOT use `vim.keymap.set()` separately** - which-key v3 handles both the keybinding and the description in one place.

### 3. Add a group if needed

If you're creating a new prefix (like `<leader>x` for the first time):

```lua
-- Add group first
{ "<leader>x", group = "Your Group Name", icon = "" },

-- Then add individual commands
{ "<leader>xc", desc = "Your Command", icon = "" },
```

## Example: Adding a New Git Command

```lua
-- In the wk.add({}) section, add:
{ "<leader>gc", "<cmd>Git commit<cr>", desc = "Git Commit", icon = "" },
```

That's it! One line does both the keybinding and the description.

## Icon Reference

Common Nerd Font icons you can use:

-  - File/Document
-  - Search
-  - Git
-  - Code/Programming
-  - Settings/Config
-  - Terminal
-  - Toggle/Switch
-  - Help/Question
-  - Warning/Diagnostic
-  - Save/Disk
-  - Navigation

## Automatic Features

Once you add a keybinding this way:

- It will appear when you press `<Space>` and wait
- It will show in `<Space>?` (searchable keybindings)
- It will have proper icons and descriptions
- It will be grouped correctly in which-key

## LSP Keybindings

LSP keybindings (like `gd`, `gr`, `gi`) are defined in `config/.config/nvim/lua/plugins/lsp.lua` in the `LspAttach` autocmd.

To add LSP-related keybindings:

1. Add them in the `LspAttach` callback in `lsp.lua`
2. Register them in which-key's `editor.lua` for descriptions

## Testing Your Changes

After adding keybindings:

1. Save the file
2. Restart Neovim: `:qa` then reopen
3. Press `<Space>` and wait to see your new keybindings
4. Or press `<Space>?` to search for them

## Troubleshooting

**Keybinding doesn't appear in which-key:**
- Make sure you added BOTH the keybinding AND the which-key registration
- Check for typos in the key combination
- Ensure the keybinding is set before `wk.add()` is called

**Icon doesn't show:**
- Make sure you're using a Nerd Font in your terminal
- Test with a simple text icon first
- Check that the icon character is copied correctly

**Keybinding works but description is missing:**
- You likely only set the keybinding but forgot to register it with which-key
- Add it to the `wk.add({})` section
