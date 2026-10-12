# Security Policy

## Supported Versions

Releases are cut from `main` (see [Release Process](CONTRIBUTING.md#release-process)). Only the latest release receives security fixes; there are no maintenance branches.

| Version        | Supported |
| -------------- | --------- |
| Latest release | Yes       |
| Older releases | No        |

## Reporting a Vulnerability

We take the security of this dotfiles repository seriously. If you discover a security vulnerability, please follow these steps:

### Private Disclosure

**Please DO NOT open a public GitHub issue for security vulnerabilities.**

Instead, report security issues privately:

1. **Email:** Send details to the repository maintainer at [create an issue with "SECURITY" prefix](https://github.com/ThisaruGuruge/dotfiles/issues/new)
2. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Initial Response:** Within 48 hours
- **Status Update:** Within 7 days
- **Fix Timeline:** Depends on severity
  - Critical: 1-7 days
  - High: 7-14 days
  - Medium: 14-30 days
  - Low: 30-90 days

### What to Expect

1. **Acknowledgment:** We'll confirm receipt of your report
2. **Investigation:** We'll investigate and validate the issue
3. **Fix Development:** We'll develop and test a fix
4. **Disclosure:** We'll release the fix and credit you (if desired)
5. **Publication:** We may publish a security advisory

## Security Best Practices

### Secrets Management

This repository uses **SOPS (Secrets OPerationS) + age encryption** for managing sensitive data:

#### How It Works

1. **Encryption at Rest:** All secrets in `~/.env` are encrypted using age encryption
2. **Automatic Decryption:** The shell decrypts `~/.env` once into a private cache (`~/.cache/zsh/env_cache.v2`, mode 600 in a 700 directory) keyed on the file's `sops_mac`, and reads `NAME=value` lines without sourcing or evaluating anything
3. **Safe Editing:** Use `edit_secrets` command to edit encrypted files
4. **Key Isolation:** Encryption keys stored in `~/.config/sops/age/keys.txt`

#### Secure Setup

```bash
# GOOD: Use edit_secrets for safe editing
edit_secrets

# GOOD: View decrypted secrets without editing
sops -d ~/.env

# GOOD: Start from the keys listed in zsh/.env.example
edit_secrets   # creates/edits the encrypted ~/.env
```

#### What NOT to Do

```bash
# BAD: Don't keep secrets inside the repo checkout (nothing reads zsh/.env,
# and one `git add -f` or `git stash -u` would publish it)
cp zsh/.env.example zsh/.env  # NEVER DO THIS; use edit_secrets (~/.env)

# BAD: Don't share encryption keys
cat ~/.config/sops/age/keys.txt  # Keep this private

# BAD: Don't store plaintext secrets
echo "export API_KEY=secret123" > ~/.env  # Use edit_secrets instead
```

### Environment Variables Security

#### Protected Information

The following should ALWAYS be encrypted:

- API keys and tokens (GitHub, AWS, etc.)
- Database credentials
- Private keys and certificates
- OAuth secrets
- Personal access tokens

#### Template Usage

`zsh/.env.example` lists the keys a machine needs. Add them to the encrypted
`~/.env` with `edit_secrets`; never copy the template to `zsh/.env`:

```bash
# Decrypts ~/.env into a private temp dir, opens $EDITOR (vim/nvim without
# swap/undo files), re-encrypts, and checks the result decrypts before saving
edit_secrets
```

`~/.sops.yaml` (which age recipient new secrets are encrypted to) is per
machine: `init.sh` writes it from `bash/.sops.yaml.example` with this machine's
public key, and it is not tracked in the repo.

### Git Security

#### .gitignore Protection

Sensitive files are automatically excluded:

```text
.env           # Environment variables (encrypted or not)
*.key          # Private keys
*.pem          # Certificates
credentials*   # Any credentials files
```

#### Pre-commit Checks

Before committing:

```bash
# Verify no secrets in files
git diff --cached

# Check for common secret patterns
git diff --cached | grep -iE "(password|secret|token|api_key)"
```

### Installation Security

#### Trusted Sources

Only run the installation script from trusted sources:

```bash
# GOOD: Clone from official repository
git clone https://github.com/ThisaruGuruge/dotfiles.git

# GOOD: Review init.sh before running
cat init.sh

# Then run installation
./init.sh
```

#### What init.sh Does

The installation script:

- Installs Homebrew packages from `Brewfile` (plus the optional `packages/*.brewfile` categories you pick)
- Sets up SOPS/age encryption: an age key, a per-machine `~/.sops.yaml`, and an encrypted `~/.env`
- Creates symlinks with bestow; a file already in the way is either renamed to `*.bestow.backup` or left alone (you choose)
- Copies `.zshrc`, `.vimrc`, `.aliases.sh`, `.functions.sh` and `.paths.sh` to `~/.dotfiles_backup_<timestamp>` before stowing
- Changes some files **without** keeping a copy, by design:
  - a plaintext `~/.env` (or the file a `~/.env` symlink points to) is replaced by its encrypted version, only after a `sops -d` round trip matches, and no plaintext copy is kept
  - a `~/.sops.yaml` symlink that dangles or points at the repo's old `bash/.sops.yaml` is replaced by a real file (any other symlink is only replaced if you agree)
  - `/etc/pam.d/sudo_local` is edited in place to add or migrate the `pam_reattach` line (a `sudo_local` that is replaced outright is first copied to `sudo_local.backup.<timestamp>`)
- Does NOT download executables from untrusted sources
- Uses sudo for the Homebrew installer, the Touch ID setup (`/etc/pam.d/sudo_local` and the root-owned `/opt/pam/pam_reattach.so`) and the Xcode Command Line Tools

### Age Encryption Key Management

#### Key Location

Encryption keys are stored at:

```text
~/.config/sops/age/keys.txt
```

#### Key Backup

**IMPORTANT:** Backup your age key to a secure location!

```bash
# Backup to secure USB drive (recommended)
cp ~/.config/sops/age/keys.txt /Volumes/SecureUSB/sops-age-key-backup.txt

# Or use encrypted backup
gpg -c ~/.config/sops/age/keys.txt
```

#### Key Rotation

If you suspect your age key is compromised, re-encrypt `~/.env` to a new key.
`sops rotate` does this in place (the plaintext never touches the disk) and
also replaces the data key, so the old age key can't open the new file:

```bash
KEYS=~/.config/sops/age/keys.txt

# 1. Generate the new key next to the old one (sops still needs the old key)
(umask 077 && age-keygen -o ~/.config/sops/age/new-keys.txt)
OLD=$(age-keygen -y "$KEYS")
NEW=$(age-keygen -y ~/.config/sops/age/new-keys.txt)

# 2. Re-encrypt ~/.env to the new key only, with a fresh data key
SOPS_AGE_KEY_FILE="$KEYS" sops rotate -i --add-age "$NEW" --rm-age "$OLD" ~/.env

# 3. Check the new key alone can decrypt it, then make it the key
SOPS_AGE_KEY_FILE=~/.config/sops/age/new-keys.txt sops -d ~/.env >/dev/null &&
    mv ~/.config/sops/age/new-keys.txt "$KEYS"

# 4. Encrypt future edits to the new key, and drop backups made with the old one
sed -i '' "s/$OLD/$NEW/g" ~/.sops.yaml
rm -f ~/.env.backup.*
```

Then back up the new key, and change the secrets themselves (tokens,
passwords): if the old key leaked, assume everything it could decrypt did too.
Don't decrypt to a file and re-encrypt with `sops -e plain > ~/.env`: the shell
truncates `~/.env` before sops runs, and the plaintext copy outlives the
rotation.

## Known Security Considerations

### Shell History

Be aware that secrets may appear in shell history:

```bash
# Enable Atuin for encrypted history sync (recommended)
atuin import auto
atuin sync

# Or clear specific commands from history
history -d <line_number>
```

### Clipboard Security

Avoid copying secrets to clipboard when possible:

```bash
# GOOD: Use secrets directly in commands
export AWS_ACCESS_KEY_ID=$(sops -d ~/.env | grep AWS_ACCESS_KEY_ID | cut -d'=' -f2)

# RISKY: Clipboard may be logged or intercepted
# sops -d ~/.env  # Then copy-paste
```

### Tmux Session Security

Tmux sessions persist secrets in memory:

```bash
# Clear environment before detaching
tmux set-environment -r SENSITIVE_VAR

# Or kill session when done
tmux kill-session -t sensitive-work
```

## Security Features

### What's Protected

- **Environment variables:** SOPS + age encryption
- **Git history:** No secrets committed (verified)
- **Configuration files:** Proper .gitignore exclusions
- **CI/CD:** Security scanning in GitHub Actions
- **Package sources:** Only trusted Homebrew formulas

### Automated Security Checks

GitHub Actions CI includes:

- Shellcheck validation
- Secret pattern scanning
- Hardcoded path detection
- Dependency validation

## Vulnerability Disclosure

If we discover or are notified of a security issue:

1. We will confirm the issue and its scope
2. We will develop a fix and test thoroughly
3. We will release a patched version
4. We will update the CHANGELOG.md
5. We may publish a security advisory

## Security Updates

Subscribe to repository releases to receive security updates:

```bash
# Watch repository on GitHub
# or use GitHub CLI
gh repo view ThisaruGuruge/dotfiles --web
```

## Additional Resources

- [SOPS Documentation](https://github.com/mozilla/sops)
- [age Encryption](https://github.com/FiloSottile/age)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [Homebrew Security](https://docs.brew.sh/Security)

## Questions?

For security-related questions that are not vulnerabilities:

- Open a GitHub Discussion
- Check the README.md troubleshooting section
- Review CONTRIBUTING.md guidelines

---

**Last Updated:** 2026-10-12
**Maintained by:** [Thisaru Guruge](https://thisaru.me)
