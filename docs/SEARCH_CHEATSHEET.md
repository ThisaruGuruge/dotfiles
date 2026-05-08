# Search Cheat Sheet

Tools: `fd` (find files) and `rg` / ripgrep (search content).

Aliases: `f` = `fd`, `fg` = `fd -g`, `g` = `rg`

---

## Find Files — `fd` (alias: `f`)

### Pattern types

`fd` uses **regex** by default. Use `-g` for glob syntax.

```sh
f "config"          # regex: matches any file with "config" in name
f "\.json$"         # regex: ends with .json
f -g "*.json"       # glob: use -g flag for glob syntax
fg "*.json"         # alias for fd -g (glob)
fg "*.bal"          # find Ballerina files
```

### Filter by extension or exclude

```sh
f -e json           # by extension (no dot needed, no glob)
f -e json -e yaml   # multiple extensions
f -E "*.bal"        # exclude files matching pattern
f -E node_modules   # exclude a directory
```

> Note: `-x` is NOT a filter flag — it executes a command on each result (like `find -exec`).

### Hidden files

```sh
fh "*.json"         # alias: fd --hidden (include dotfiles)
fa "*.json"         # alias: fd --hidden --no-ignore (also gitignored)
f -H -g "*.json"    # explicit flags
```

### Scope and depth

```sh
f "config" ./src            # search in a specific directory
f -g "*.json" --max-depth 3 # limit recursion depth
```

### File type filters

```sh
f -t f "*.json"             # files only
f -t d "node_modules"       # directories only
f -t l "*.sh"               # symlinks only
```

### Combining flags

```sh
# Glob, files only, in a specific dir, include hidden
fg "*.json" -t f ./config --hidden

# Everything (hidden + gitignored), files only, by extension
fa -t f -e bal
```

---

## Search Content in Files — `rg` (alias: `g`)

### Basic usage

```sh
g "TODO"                    # search in current directory (recursive)
g "pattern" ./src           # search in a specific directory
g -i "pattern"              # case-insensitive
```

### Hidden and ignored files

```sh
gh "pattern"                # alias: rg --hidden (includes dotfiles)
rga "pattern"               # alias: rg --hidden --no-ignore (search everything)
g -u "pattern"              # -u: unrestricted (skips .gitignore)
g -uu "pattern"             # -uu: also includes hidden files
g -uuu "pattern"            # -uuu: also searches binary files
```

### File type filters

```sh
g -t json "pattern"         # built-in type: json
g -t py "pattern"           # built-in type: python
g -t ts "pattern"           # built-in type: typescript
g -t go "pattern"           # built-in type: go
                            # other types: js, java, yaml, toml, md, sh, ...

g -g "*.json" "pattern"     # custom glob filter
g -g "!*.min.js" "pattern"  # exclude files matching glob
```

### Output control

```sh
g -l "pattern"              # filenames only (no content)
g -c "pattern"              # match count per file
g -n "pattern"              # show line numbers (on by default)
g --no-filename "pattern"   # suppress filenames
```

### Context lines

```sh
g -C 3 "pattern"            # 3 lines before and after each match
g -A 2 "pattern"            # 2 lines after
g -B 2 "pattern"            # 2 lines before
```

### Combining flags

```sh
# Hidden files, TypeScript, in ./src, case-insensitive
gh -t ts -i "useState" ./src

# Everything (no filters), with 2 lines of context
rga -C 2 "pattern"
```

### Language-specific aliases

```sh
grepbal "pattern"           # rg --type ballerina
```

---

## Quick Reference

| Goal | Command |
|------|---------|
| Find file by name (regex) | `f "name"` |
| Find file by glob | `fg "*.json"` |
| Find file by extension | `f -e json` |
| Exclude files/dirs | `f -E node_modules` |
| Find file, include hidden | `fh "name"` |
| Find file, include gitignored | `fa "name"` |
| Find file in dir | `f "name" ./path` |
| Search string in files | `g "pattern"` |
| Search, include hidden | `gh "pattern"` |
| Search everything | `rga "pattern"` |
| Search by file type | `g -t json "pattern"` |
| Search by glob | `g -g "*.json" "pattern"` |
| Filenames only | `g -l "pattern"` |
| With context | `g -C 3 "pattern"` |
