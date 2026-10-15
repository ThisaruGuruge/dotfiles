# Dotfiles

One person's macOS machine setup: shell, editor, terminal and Claude Code configuration kept in a git repo and linked into the home directory.

## Language

### Linking

**Package**:
A top-level directory of the repo whose contents mirror a path under the home directory and are linked there.
_Avoid_: module, stow package, config dir

**Bestow**:
The owner's own symlink tool that links a Package's files into place, one file at a time.
_Avoid_: stow, GNU Stow

### Claude Code

**Account**:
One of two Claude Code identities, Personal or Enterprise, each with its own config directory.
_Avoid_: profile, login

**Mod**:
A TypeScript plugin in `claude-mods/` that changes Claude Code's interface or behaviour and is loaded by both Accounts.
_Avoid_: extension, add-on

**Pin**:
A per-directory setting that fixes which Account (or Google Workspace account) plain `claude` or `gws` uses there.
_Avoid_: lock, default

### Secrets

**Secrets file**:
The SOPS-encrypted `~/.env` that holds every secret, kept outside the repo.
_Avoid_: dotenv, env file

**Secrets cache**:
The decrypted copy of the Secrets file that the shell reads at startup so it does not decrypt on every launch.
_Avoid_: env cache

### Shell

**Lazy-loaded runtime**:
A language runtime manager (NVM, SDKMAN, pyenv) that is only initialised the first time it is used, to keep shell startup fast.
_Avoid_: deferred tool

**Init cache**:
The saved output of a tool's `init` command, regenerated only when the tool changes.
_Avoid_: shell cache

### Releases

**Dev branch**:
The branch where finished fixes accumulate so they ship as one release.
_Avoid_: staging, develop

**Release**:
A version tag and GitHub Release cut automatically when a pull request that touches more than docs or CI reaches `main`.
_Avoid_: deploy, publish
