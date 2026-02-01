# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported |
| ------- | --------- |
| 1.0.x   | Yes       |
| < 1.0   | No        |

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
2. **Automatic Decryption:** Shell automatically decrypts secrets on startup
3. **Safe Editing:** Use `edit_secrets` command to edit encrypted files
4. **Key Isolation:** Encryption keys stored in `~/.config/sops/age/keys.txt`

#### Secure Setup

```bash
# GOOD: Use edit_secrets for safe editing
edit_secrets

# GOOD: View decrypted secrets without editing
sops -d ~/.env

# GOOD: Use .env.example template
cp zsh/.env.example zsh/.env
edit_secrets
```

#### What NOT to Do

```bash
# BAD: Don't commit .env files
git add zsh/.env  # NEVER DO THIS

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

Use `zsh/.env.example` as a template:

```bash
# Copy template
cp zsh/.env.example zsh/.env

# Edit with SOPS encryption
edit_secrets
```

### Git Security

#### .gitignore Protection

Sensitive files are automatically excluded:

```
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

- Installs Homebrew packages from packages.json
- Creates encrypted environment files
- Sets up SOPS/age encryption
- Creates symlinks with GNU Stow
- Does NOT modify existing configs without backup
- Does NOT download executables from untrusted sources
- Does NOT require sudo (except for Xcode Command Line Tools)

### Age Encryption Key Management

#### Key Location

Encryption keys are stored at:
```
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

If you suspect your age key is compromised:

```bash
# 1. Generate new age key
age-keygen -o ~/.config/sops/age/new-keys.txt

# 2. Update SOPS config
vim ~/.sops.yaml  # Update key reference

# 3. Re-encrypt all secrets
sops -r -d ~/.env > /tmp/env-plaintext
sops -e /tmp/env-plaintext > ~/.env
rm /tmp/env-plaintext

# 4. Replace old key
mv ~/.config/sops/age/new-keys.txt ~/.config/sops/age/keys.txt
```

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

**Last Updated:** 2026-02-01
**Maintained by:** [Thisaru Guruge](https://thisaru.me)
