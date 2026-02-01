# Contributing to Dotfiles

Thank you for your interest in contributing to this dotfiles repository! This document provides guidelines and instructions for contributing.

## Table of Contents

- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Running Tests](#running-tests)
- [Code Style](#code-style)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Adding New Packages](#adding-new-packages)
- [Reporting Issues](#reporting-issues)

---

## How to Contribute

Contributions are welcome in several forms:

1. **Bug Reports** - Report issues you encounter
2. **Feature Requests** - Suggest new features or improvements
3. **Code Contributions** - Submit pull requests with fixes or enhancements
4. **Documentation** - Improve or expand documentation
5. **Testing** - Test on different systems and report results

---

## Development Setup

### Prerequisites

- macOS (primary target platform)
- Git
- Homebrew
- Zsh shell

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

   ```bash
   git clone https://github.com/YOUR_USERNAME/dotfiles.git ~/dotfiles
   cd ~/dotfiles
   ```

3. Add upstream remote:

   ```bash
   git remote add upstream https://github.com/ThisaruGuruge/dotfiles.git
   ```

4. Create a feature branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

### Testing Your Changes

Before submitting a pull request, test your changes:

```bash
# Run validation suite
./bin/test-zsh-config

# Test shell syntax
zsh -n zsh/.zshrc
zsh -n zsh/.zshrc.d/*.zsh
zsh -n zsh/.functions.d/*.zsh
bash -n zsh/.aliases.sh

# Run shellcheck on modified scripts
shellcheck your-modified-script.sh

# Test init script (dry run)
# Note: Be careful running init.sh in development
```

---

## Running Tests

### Comprehensive Validation

The repository includes a comprehensive validation suite:

```bash
# Run full validation (recommended before submitting PR)
test-zsh

# Or directly:
./bin/test-zsh-config
```

This validates:

- All tools and packages are installed
- Environment variables are set correctly
- Shell configuration loads without errors
- Performance metrics (startup time)
- PATH is configured correctly

### CI/CD Validation

All pull requests are automatically validated through GitHub Actions:

- **Shellcheck**: Validates shell script syntax and best practices
- **shfmt**: Checks shell script formatting
- **JSON validation**: Validates JSON config files
- **Security scanning**: Checks for hardcoded paths and secrets
- **macOS testing**: Tests on macOS environment

---

## Code Style

### Shell Scripts

**Formatting**:

- Use 4 spaces for indentation (no tabs)
- Format with `shfmt -i 4 -ci`
- Maximum line length: 120 characters (soft limit)

**Best Practices**:

- Use `#!/bin/zsh` for zsh scripts, `#!/usr/bin/env bash` for bash scripts
- Quote variables: `"$variable"` not `$variable`
- Use `[[ ]]` for conditionals in zsh/bash
- Prefer `local` for function-scoped variables
- Add error handling for critical operations

**Example**:

```bash
#!/bin/zsh

# Good variable usage
my_function() {
    local input="$1"

    if [[ -z "$input" ]]; then
        echo "Error: Input required" >&2
        return 1
    fi

    echo "Processing: $input"
}
```

### Shellcheck Compliance

All shell scripts must pass shellcheck validation:

```bash
# Run shellcheck
shellcheck your-script.sh

# Common exclusions (when justified):
# SC1091 - Can't follow source (for dynamic sourcing)
# SC2039 - In POSIX sh, 'local' is undefined (when using bash/zsh)
```

### Python Scripts

For Python utilities (bin/manage-packages, bin/generate-brewfile):

- Follow PEP 8 style guidelines
- Use 4 spaces for indentation
- Include docstrings for functions
- Use type hints where applicable

---

## Commit Message Guidelines

**Starting from v1.0.0**, this repository adopts [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring (no functional change)
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependencies, build, etc.)
- `ci`: CI/CD changes

### Scopes (Optional)

Use scopes to indicate which part of the codebase is affected:

- `(init)` - init.sh installation script
- `(zsh)` - Zsh configuration (.zshrc, .zshrc.d/, .aliases.sh)
- `(functions)` - Shell functions (.functions.d/)
- `(ci)` - GitHub Actions workflows
- `(docs)` - Documentation (README, CONTRIBUTING, etc.)
- `(packages)` - Package management (Brewfile, packages/)
- `(security)` - Secret management and security features
- `(prompt)` - Starship prompt configuration
- `(git)` - Git configuration
- `(nvim)` - Neovim configuration
- `(wezterm)` - WezTerm configuration
- `(tmux)` - Tmux configuration

### Examples

**Good commit messages**:

```bash
feat(zsh): add fzf integration for history search

Add fzf keybindings for enhanced history search with Ctrl+R.
Includes fuzzy matching and preview pane.

Closes #123

fix(init): resolve package installation order issue

SDKMAN installation was failing when brew packages weren't installed first.
Reordered installation steps to ensure dependencies are met.

docs(readme): update troubleshooting section

Add solutions for common Starship glyph/font rendering issues.

perf(zsh): optimize NVM lazy loading

Reduce shell startup time from 1.2s to 0.6s by deferring full NVM initialization.

chore(packages): update Homebrew package versions

Bump lazygit to 0.55.1, starship to 1.20.0
```

**Bad commit messages** (avoid these):

```bash
Update stuff
Fix bug
WIP
asdf
Minor changes
```

### Breaking Changes

For breaking changes, add `BREAKING CHANGE:` in the footer or use `!` after type:

```bash
feat(zsh)!: change default shell theme to minimal

BREAKING CHANGE: The default Starship prompt layout has changed (old configs may need updates).
Users can restore the previous theme by setting THEME=zen in .env
```

### Commit Message Template

You can set up a git commit message template:

```bash
# Create template file
cat > ~/.gitmessage << 'EOF'
# <type>(<scope>): <subject>
# |<----  Using a Maximum Of 50 Characters  ---->|

# Explain why this change is being made
# |<----   Try To Limit Each Line to a Maximum Of 72 Characters   ---->|

# Provide links or keys to any relevant tickets, articles or other resources
# Example: Closes #123

# --- COMMIT END ---
# Type can be:
#   feat     (new feature)
#   fix      (bug fix)
#   docs     (changes to documentation)
#   style    (formatting, missing semi colons, etc; no code change)
#   refactor (refactoring production code)
#   test     (adding missing tests, refactoring tests; no production code change)
#   chore    (updating build tasks etc; no production code change)
# Scope is optional and can be: init, zsh, ci, docs, packages, security, etc.
# --------------------
# Remember to:
#   - Use the imperative mood in the subject line
#   - Do not end the subject line with a period
#   - Separate subject from body with a blank line
#   - Use the body to explain what and why vs. how
#   - Can use multiple lines with "-" for bullet points in body
EOF

# Configure git to use the template
git config --local commit.template ~/.gitmessage
```

---

## Pull Request Process

### Before Submitting

1. **Update from upstream**:

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run validation**:

   ```bash
   ./bin/test-zsh-config
   ```

3. **Check shellcheck**:

   ```bash
   find . -name "*.sh" -not -path "./.git/*" | xargs shellcheck -e SC1091,SC2039
   ```

4. **Format shell scripts**:

   ```bash
   find . -name "*.sh" -not -path "./.git/*" | xargs shfmt -w -i 4 -ci
   ```

5. **Test manually**:

   - Test your changes in a clean environment if possible
   - Verify aliases/functions work as expected
   - Check for unintended side effects

### Submitting the PR

1. **Push your branch**:

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request** on GitHub with:

   - Clear title describing the change
   - Description explaining what and why
   - Reference any related issues (e.g., "Closes #123")
   - Screenshots/output if applicable

3. **PR Checklist**:

   - [ ] Code follows shell script style guidelines
   - [ ] `test-zsh` validation passes
   - [ ] Shellcheck validation passes
   - [ ] Documentation updated (README, comments, etc.)
   - [ ] Commit messages follow conventional commits format
   - [ ] No hardcoded paths or secrets
   - [ ] Changes tested locally

### Review Process

- Maintainers will review your PR
- Address any feedback or requested changes
- CI must pass before merging
- PRs are typically reviewed within 2-3 days

---

## Adding New Packages

To add a new package to the dotfiles:

### 1. Update Brewfile

Add the package to the main `Brewfile` for core packages, or to the appropriate category file in `packages/`:

```ruby
# In Brewfile (core packages)
brew "your-package"  # Description of your package

# Or in packages/development.brewfile (optional category)
brew "your-dev-tool"
```

### 2. Test Installation

```bash
brew bundle --file=Brewfile
```

### 3. Update init.sh (if needed)

If the package requires special installation or configuration, update `init.sh`.

### 4. Add to validation suite

Update `bin/test-zsh-config` to validate the new package if it's critical.

### 5. Document in README

Add the package to the relevant section in README.md with usage examples.

### 6. Test installation

Test that the package installs correctly:

```bash
# Clean test
brew install your-package

# Or test full init
./init.sh
```

---

## Reporting Issues

### Before Creating an Issue

1. **Search existing issues** - Your issue may already be reported
2. **Run validation** - `test-zsh` may identify the problem
3. **Check troubleshooting** - README has solutions for common issues

### Creating a Good Issue

Include:

1. **Clear title** - Describe the problem concisely
2. **Environment details**:

   ```bash
   # Run and include output:
   sw_vers  # macOS version
   echo $SHELL  # Shell
   zsh --version  # Zsh version
   ```

3. **Steps to reproduce** - Exact steps to trigger the issue
4. **Expected behavior** - What should happen
5. **Actual behavior** - What actually happens
6. **Error messages** - Full error output if applicable
7. **Validation output** - Output from `test-zsh` if relevant

### Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature or improvement
- `documentation` - Documentation improvements
- `question` - Questions about usage
- `help wanted` - Extra attention needed
- `good first issue` - Good for newcomers

---

## Development Tips

### Quick Testing Loop

```bash
# Make changes to config files
vim zsh/.aliases.sh

# Reload shell without restarting
source ~/.zshrc

# Or create a test function
test_change() {
    source ~/dotfiles/zsh/.aliases.sh
    # Test your changes
}
```

### Debugging

```bash
# Enable zsh debugging
zsh -x

# Test specific file syntax
zsh -n zsh/.zshrc

# Run shellcheck on specific file
shellcheck zsh/.functions.sh

# Profile startup performance
./bin/profile-startup
```

### Useful Git Commands

```bash
# Update from upstream
git fetch upstream
git rebase upstream/main

# Interactive rebase to clean up commits
git rebase -i HEAD~3

# Amend last commit
git commit --amend

# Check what would be committed
git diff --cached
```

---

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Accept criticism gracefully
- Assume good intentions

### Unacceptable Behavior

- Harassment or discriminatory language
- Personal attacks or trolling
- Publishing others' private information
- Other conduct which could reasonably be considered inappropriate

---

## Questions?

- **General questions**: Open a GitHub Discussion or Issue
- **Security issues**: See SECURITY.md (if you find a vulnerability)
- **Contribution ideas**: Open an issue to discuss before implementing large changes
- **Author**: [Thisaru Guruge](https://thisaru.me)

---

## License

By contributing, you agree that your contributions will be licensed under the same MIT License that covers this project.

---

Thank you for contributing!
