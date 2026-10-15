# Keep secrets in a SOPS+age file outside the repo

Secrets live in `~/.env`, encrypted with SOPS and an age key (`~/.config/sops/age/keys.txt`). There is no `.env` in the repo, and the repo never holds a plaintext or encrypted copy of it. Introduced 2025-09-25 with `edit_secrets`; hardened in 2.x (PR #42).

## Considered options

- **Plaintext `.env`, git-ignored** — one forgotten ignore rule or backup file leaks every key.
- **SOPS + age** — encrypted at rest, no server, works offline, one key per machine.

## Consequences

- `~/.sops.yaml` is per machine and untracked; `init.sh` writes it from `bash/.sops.yaml.example`, so a fork never encrypts to the owner's key.
- The shell never `source`s the file. A parser (`_dotfiles_env_parse`) reads `NAME=value` lines and skips shell syntax, so a tampered file cannot run code at login.
- The decrypted cache (`~/.cache/zsh/env_cache.v2`) is written `0600` under `umask 077` and is valid only for the current file's MAC. An earlier cache could leave a world-readable copy of the ciphertext.
- Hand-editing the encrypted file breaks its MAC; `rebuild-env` recovers from that.
- `edit_secrets` is the only supported way to edit; plaintext exists only in a private temp dir that is removed on exit.

TODO(owner): record why SOPS+age was chosen over `pass`, 1Password CLI or macOS Keychain, if those were weighed.
