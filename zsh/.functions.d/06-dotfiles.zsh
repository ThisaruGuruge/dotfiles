#!/bin/zsh
# ============================================================================
# Dotfiles Management Functions
# ============================================================================
# Dotfiles utilities: edit_secrets(), edit_dotfiles(), update_dotfiles()
# Secrets helpers: _dotfiles_is_sops_encrypted(), _dotfiles_env_parse(),
# _dotfiles_env_expand(), _dotfiles_env_lint(), _dotfiles_secrets_ask() and
# _dotfiles_load_env(). The IDE fast path in .zshrc sources this file on its
# own (no aliases loaded), and in normal shells aliases are already defined
# when it's sourced — so every external command here goes through `command`.

# ----------------------------------------------------------------------------
# Secrets (~/.env) helpers
# ----------------------------------------------------------------------------

# True when $1 is a sops-encrypted dotenv file. sops encrypts each value on its
# own (KEY=ENC[...]) and always writes a sops_mac= line, so the first line of
# an encrypted file can be anything — don't test for a leading #ENC[.
_dotfiles_is_sops_encrypted() {
    [[ -f $1 ]] && command grep -q -e '^sops_mac=' -- "$1" 2>/dev/null
}

# Expand $NAME and ${NAME} in $1 in one left-to-right pass, plus (with $2 =
# double) the \\ \" \$ \` escapes of a double-quoted shell string; any other
# \x stays as is. Substituted values are never scanned again. Sets REPLY.
_dotfiles_env_expand() {
    local __dfe_rest=$1 __dfe_out=""
    local __dfe_re='(\\(.)|\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*))'
    while [[ $__dfe_rest =~ $__dfe_re ]]; do
        __dfe_out+=${__dfe_rest[1,MBEGIN-1]}
        if [[ -n $match[2] ]]; then
            if [[ $2 == double && $match[2] == [\\\"\$\`] ]]; then
                __dfe_out+=$match[2]
            else
                __dfe_out+="\\$match[2]"
            fi
        else
            __dfe_out+=${(P)${match[3]:-$match[4]}}
        fi
        __dfe_rest=${__dfe_rest[MEND+1,-1]}
    done
    REPLY=$__dfe_out$__dfe_rest
}

# Export variables from dotenv text on stdin without sourcing or eval'ing it:
# nothing in the file runs while it loads. Accepted lines are
# `[export ]NAME=VALUE` (blank lines and # comments are skipped) where VALUE is:
#   'single quoted'   taken literally (anything except a single quote)
#   "double quoted"   shell rules for \\ \" \$ \` and $NAME / ${NAME};
#                     nothing else expands, and bare backticks, $(...) and
#                     other ${...} forms are refused
#   unquoted          no whitespace, quotes, backslashes or shell
#                     metacharacters; $NAME / ${NAME} expand, and ~ or ~/...
#                     at the start or after a colon becomes $HOME (not ~user)
# optionally followed by a # comment. A fixed list of names is refused: the
# ones zsh turns into code or uses to find code (prompts, hook arrays, PATH,
# FPATH, ZDOTDIR, LD_*/DYLD_*, ...), shell state whose assignment breaks or
# kills the session (IFS, HOME, UID, TMOUT, ...), the loader's own variables
# and sops metadata. So are names that currently hold an array, an association
# or a read-only value, since a string can't be assigned to them. Values are
# not policed: anything a program reads from the environment (NODE_OPTIONS,
# GIT_SSH_COMMAND, ...) is yours to set. Refused entries are reported by name
# only, never by value; -q suppresses the report.
_dotfiles_env_parse() {
    emulate -L zsh
    setopt extendedglob
    zmodload zsh/parameter 2>/dev/null
    local __dfe_quiet=0
    [[ $1 == -q ]] && __dfe_quiet=1
    local __dfe_line __dfe_name __dfe_value __dfe_rest __dfe_seg REPLY MATCH MBEGIN MEND
    local -a match mbegin mend __dfe_refused __dfe_parts
    local -i __dfe_malformed=0 __dfe_bad
    local -a __dfe_reserved=(
        # prompts (expanded with prompt_subst) and what zsh/bash run by themselves
        'PS[1-4]' PROMPT 'PROMPT[2-4]' RPROMPT RPROMPT2 'RPS[12]' SPROMPT
        PROMPT_EOL_MARK PROMPT_COMMAND PERIOD TMOUT '*_functions'
        # where shells and the dynamic linker look for code
        PATH path FPATH fpath MODULE_PATH module_path CDPATH cdpath ZDOTDIR
        ENV BASH_ENV 'LD_*' 'DYLD_*'
        # shell state; assigning zsh's identity and counter specials can abort
        # the shell (UID, USERNAME, ...)
        IFS HOME PWD OLDPWD SHELL SHLVL UID EUID GID EGID USERNAME LINENO
        RANDOM SECONDS PPID HISTCMD ERRNO TTYIDLE ARGC COLUMNS LINES 'ZSH_*'
        # the loader's own variables, and sops metadata (only a cache that
        # still holds ciphertext would have it)
        match mbegin mend MATCH MBEGIN MEND reply REPLY '__dfe_*' 'sops_*'
    )
    local __dfe_reserved_pat="(${(j:|:)__dfe_reserved})"
    local __dfe_re_assign='^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$'
    local __dfe_re_single="^'([^']*)'[[:space:]]*(#.*)?\$"
    local __dfe_re_double='^"((\\.|[^"\\`])*)"[[:space:]]*(#.*)?$'
    local __dfe_re_plain='^((\$\{[A-Za-z_][A-Za-z0-9_]*\}|\$[A-Za-z_][A-Za-z0-9_]*|[^[:space:]'"'"'"\\`$;&|<>(){}])*)[[:space:]]*(#.*)?$'

    while IFS= read -r __dfe_line || [[ -n $__dfe_line ]]; do
        [[ $__dfe_line == [[:space:]]#(\#*|) ]] && continue
        if [[ ! $__dfe_line =~ $__dfe_re_assign ]]; then
            (( __dfe_malformed++ ))
            continue
        fi
        __dfe_name=$match[2]
        __dfe_value=$match[3]

        if [[ $__dfe_name == ${~__dfe_reserved_pat} ||
            ${parameters[$__dfe_name]} == (array|association)* ||
            ${parameters[$__dfe_name]} == *readonly* ]]; then
            __dfe_refused+=($__dfe_name)
            continue
        fi

        if [[ $__dfe_value =~ $__dfe_re_single ]]; then
            __dfe_value=$match[1]
        elif [[ $__dfe_value =~ $__dfe_re_double ]]; then
            __dfe_rest=$match[1]
            # Escaped characters are literal, so check what's left without them
            __dfe_seg=${__dfe_rest//\\?/}
            if [[ $__dfe_seg == *'$('* || ${__dfe_seg//\$\{[A-Za-z_][A-Za-z0-9_]#\}/} == *'${'* ]]; then
                __dfe_refused+=($__dfe_name)
                continue
            fi
            _dotfiles_env_expand "$__dfe_rest" double
            __dfe_value=$REPLY
        elif [[ $__dfe_value =~ $__dfe_re_plain ]]; then
            # Like a shell assignment: ~ alone or ~/... at the start of the
            # value or right after a colon is $HOME (~user is refused)
            __dfe_parts=()
            __dfe_bad=0
            for __dfe_seg in "${(@s.:.)match[1]}"; do
                if [[ $__dfe_seg == '~'(|/*) ]]; then
                    _dotfiles_env_expand "${__dfe_seg:1}"
                    __dfe_parts+=("$HOME$REPLY")
                elif [[ $__dfe_seg == '~'* ]]; then
                    __dfe_bad=1
                    break
                else
                    _dotfiles_env_expand "$__dfe_seg"
                    __dfe_parts+=("$REPLY")
                fi
            done
            if (( __dfe_bad )); then
                __dfe_refused+=($__dfe_name)
                continue
            fi
            __dfe_value=${(j.:.)__dfe_parts}
        else
            __dfe_refused+=($__dfe_name)
            continue
        fi
        typeset -gx "$__dfe_name=$__dfe_value"
    done

    (( __dfe_quiet )) && return 0
    (( __dfe_malformed )) && print -u2 "dotfiles: ignored $__dfe_malformed malformed line(s) in ~/.env"
    (( $#__dfe_refused )) && print -u2 "dotfiles: refused ~/.env entries (unsupported value or reserved name): ${(j:, :)__dfe_refused}"
    return 0
}

# Load ~/.env into the environment. A sops-encrypted file is decrypted once and
# the plaintext cached in ~/.cache/zsh/env_cache.v2 (file 0600, directory 0700).
# The cache's first line records the sops_mac of the ~/.env it came from; that
# value changes on every sops write, so the cache is used only while ~/.env is
# that exact file (an edit, a rotation or a restored backup all miss). A
# plaintext ~/.env is read directly. Both paths go through
# _dotfiles_env_parse, so neither file is ever executed, and its report of
# skipped lines prints only when ~/.env changed, not in every new shell.
_dotfiles_load_env() {
    emulate -L zsh
    setopt extendedglob
    local env_file="$HOME/.env"
    local cache_dir="$HOME/.cache/zsh"
    local cache_file="$cache_dir/env_cache.v2"
    local seen_file="$cache_dir/env_plain_seen.v2"
    local line mac="" header decrypted sig="" seen=""
    local -a fresh
    local -A st
    [[ -f $env_file ]] || return 0

    # The pre-v2 cache could be a world-readable copy of the ciphertext (older
    # loaders misread sops files that don't start with a comment); never read it
    [[ -e $cache_dir/env_cache || -L $cache_dir/env_cache ]] && command rm -f -- "$cache_dir/env_cache"

    while IFS= read -r line || [[ -n $line ]]; do
        if [[ $line == sops_mac=* ]]; then
            mac=${line#sops_mac=}
            break
        fi
    done <"$env_file"

    if [[ -z $mac ]]; then
        # Plaintext ~/.env: read it as-is, drop a cache left over from an
        # encrypted version, and report skipped lines once per version of the
        # file (mtime, size and inode)
        [[ -e $cache_file || -L $cache_file ]] && command rm -f -- "$cache_file"
        zmodload -F zsh/stat b:zstat 2>/dev/null &&
            zstat -H st -- "$env_file" 2>/dev/null &&
            sig="${st[mtime]}:${st[size]}:${st[inode]}"
        fresh=($seen_file(N.U))
        (( $#fresh )) && IFS= read -r seen <"$seen_file"
        if [[ -n $sig && $seen == "$sig" ]]; then
            _dotfiles_env_parse -q <"$env_file"
        else
            _dotfiles_env_parse <"$env_file"
            [[ -n $sig ]] && (
                umask 077
                command mkdir -p -- "$cache_dir" && print -r -- "$sig" >|"$seen_file"
            ) 2>/dev/null
        fi
        return 0
    fi

    # Cache hit: a regular 0600 file we own, in a 0700 directory we own (not
    # symlinks), whose header names this ~/.env
    header="#dotfiles-env-cache v2 $mac"
    fresh=($cache_file(N.Uf600) $cache_dir(N/Uf700))
    if (( $#fresh == 2 )) && IFS= read -r line <"$cache_file" && [[ $line == "$header" ]]; then
        _dotfiles_env_parse -q <"$cache_file"
        return 0
    fi

    if (( ! $+commands[sops] )); then
        print -u2 "Warning: SOPS not available - cannot decrypt $env_file"
        return 1
    fi
    if ! decrypted=$(SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}" command sops -d "$env_file" 2>/dev/null); then
        print -u2 "Warning: Failed to decrypt $env_file - check your SOPS/age configuration"
        return 1
    fi

    # Write the cache under a private umask (no readable window) and rename it
    # into place, so a half-written cache is never picked up. The header is
    # the sops_mac read before decrypting: if ~/.env changed in between, the
    # next shell misses and decrypts again.
    (
        umask 077
        tmp=""
        command mkdir -p -- "$cache_dir" && command chmod 700 "$cache_dir" &&
            tmp=$(command mktemp "$cache_dir/env_cache.XXXXXX") &&
            print -r -- "$header"$'\n'"$decrypted" >|"$tmp" &&
            command mv -f -- "$tmp" "$cache_file" ||
            { [[ -n $tmp ]] && command rm -f -- "$tmp"; }
    )

    # zsh runs the last pipeline stage in this shell, so the exports stick
    print -r -- "$decrypted" | _dotfiles_env_parse
}

# Print the line numbers (never the contents) of lines in dotenv file $1 that
# sops can't store: CR line endings, and non-comment lines without KEY= (a
# bare name, or the second line of a value spread over several lines).
# Returns 1 if there are any.
_dotfiles_env_lint() {
    emulate -L zsh
    setopt extendedglob
    local line
    local -i n=0
    local -a cr bare
    while IFS= read -r line || [[ -n $line ]]; do
        (( n++ ))
        if [[ $line == *$'\r'* ]]; then
            cr+=($n)
        elif [[ $line != [[:space:]]#(\#*|) && $line != [[:space:]]#[A-Za-z_]*=* ]]; then
            bare+=($n)
        fi
    done <"$1"
    (( $#cr )) && print -r -- "   line ${(j:, :)cr}: carriage return (CRLF/CR line ending); save with Unix line endings"
    (( $#bare )) && print -r -- "   line ${(j:, :)bare}: not KEY=value (a bare name, or a value continued from the line above; values can't span lines)"
    (( $#cr + $#bare == 0 ))
}

# Ask what to do with edits that couldn't be saved. Sets REPLY to edit, keep
# or discard; without a terminal on stdin the answer is discard.
_dotfiles_secrets_ask() {
    local answer=""
    REPLY=discard
    [[ -t 0 ]] || return 0
    print -r -- "   [e] edit again   [k] keep the unencrypted copy for now   [d] discard the edits"
    print -n -- "   Choice [e/k/D]: "
    read -r answer
    case $answer in
        [Ee]*) REPLY=edit ;;
        [Kk]*) REPLY=keep ;;
    esac
}

# Edit ~/.env with sops encryption. The plaintext only exists inside a private
# (0700) temp directory that is removed when the function exits or is
# interrupted; vim/nvim run without swap, undo, backup or shada copies; and the
# new ciphertext has to decrypt back to what you saved before it replaces
# ~/.env (or, if ~/.env is a symlink, its target). If the save fails (editor
# error, a line sops can't store, encryption failure) you can edit again, keep
# the plaintext copy (announced, 0600 in the 0700 directory) or discard it.
# New secrets are encrypted per ~/.sops.yaml; without one, to this machine's
# own age key. The previous encrypted file is kept as
# ~/.env.backup.<timestamp> (newest 3 kept).
edit_secrets() {
    emulate -L zsh
    setopt localtraps extendedglob
    local env_file="$HOME/.env"
    local sops_config="$HOME/.sops.yaml"
    local key_file="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}"
    local old_umask tmp_dir plain_file enc_file err_file before_hash after_hash
    local failure lint_out skipped recipient REPLY
    local -i editor_rc
    local -a editor backups recipients key_patterns sops_args

    # Check if SOPS is available
    if (( ! $+commands[sops] )); then
        echo "❌ SOPS is not installed. Install it with: brew install sops"
        return 1
    fi

    # Check if age key exists
    if [[ ! -f $key_file ]]; then
        echo "❌ Age encryption key not found at $key_file. Run ./init.sh to set up secret management first."
        return 1
    fi
    if (( ! $+commands[age-keygen] )); then
        echo "❌ age is not installed. Install it with: brew install age"
        return 1
    fi
    # This machine's public key(s): the recipients it can decrypt for
    recipients=(${(f)"$(command age-keygen -y -- "$key_file" 2>/dev/null)"})
    if (( ! $#recipients )); then
        echo "❌ Could not read an age key from $key_file"
        return 1
    fi
    export SOPS_AGE_KEY_FILE="$key_file"

    # ~/.sops.yaml is per machine (not tracked) and names who new secrets are
    # encrypted to. It has to include this machine, or the saved file would be
    # unreadable here. Without one, encrypt to this machine's key directly
    # (--config /dev/null stops sops from picking up a .sops.yaml from $PWD).
    if [[ -f $sops_config ]]; then
        for recipient in $recipients; do
            key_patterns+=(-e "$recipient")
        done
        if ! command grep -qF "${key_patterns[@]}" -- "$sops_config"; then
            echo "❌ $sops_config doesn't list this machine's age key (${recipients[1]}), so a file encrypted with it couldn't be decrypted here."
            echo "   Add the key to it, or delete it and re-run ./init.sh. $env_file was not changed."
            return 1
        fi
        sops_args=(--config "$sops_config")
    else
        if [[ -L $sops_config ]]; then
            echo "⚠️  $sops_config is a dangling symlink (older setups linked it into the repo)."
            echo "   Encrypting to this machine's age key. To fix it: rm ~/.sops.yaml && ./init.sh"
        else
            echo "⚠️  $sops_config is missing. Encrypting to this machine's age key; ./init.sh creates the file."
        fi
        sops_args=(--config /dev/null --age "${(j:,:)recipients}")
    fi

    # A symlinked ~/.env: edit and replace the file it points to, so no
    # plaintext target is left behind next to a new encrypted ~/.env
    if [[ -L $env_file ]]; then
        if [[ ! -e $env_file ]]; then
            echo "❌ $env_file is a symlink to $(command readlink -- "$env_file"), which doesn't exist. Remove the link or restore its target first."
            return 1
        fi
        env_file=${env_file:A}
        echo "ℹ️  ~/.env is a symlink; editing its target, $env_file"
    fi

    old_umask=$(umask)
    umask 077
    if ! tmp_dir=$(command mktemp -d "${TMPDIR:-/tmp}/edit_secrets.XXXXXX"); then
        umask "$old_umask"
        echo "❌ Could not create a private temp directory"
        return 1
    fi
    # A function's EXIT trap runs after its locals are gone, so bake the
    # values into the trap text
    trap "umask ${(q)old_umask}; command rm -rf -- ${(q)tmp_dir}" EXIT
    trap 'return 130' INT TERM HUP

    # Names must end in .env: the sops creation_rule matches \.env$, and the
    # extension tells sops to use the dotenv format
    plain_file="$tmp_dir/secrets.env"
    enc_file="$tmp_dir/secrets.enc.env"
    err_file="$tmp_dir/sops.err"

    # Handle existing .env file
    if [[ -f $env_file ]]; then
        if _dotfiles_is_sops_encrypted "$env_file"; then
            echo "🔓 Decrypting .env file for editing..."
            # Explicit format: a symlink target may not be named *.env
            if ! command sops -d --input-type dotenv --output-type dotenv "$env_file" >"$plain_file"; then
                echo "❌ Failed to decrypt $env_file (is it encrypted to this machine's age key?)"
                return 1
            fi
            echo "✅ File decrypted successfully"
        else
            echo "📄 Loading plaintext .env file for editing (it will be encrypted on save)..."
            command cp -- "$env_file" "$plain_file" || return 1
        fi
    else
        # Create new template
        echo "📝 Creating new .env file template..."
        command cat >"$plain_file" <<'EOF'
# Environment Variables
# Format: export KEY="value"
# This file will be encrypted after editing

export GITHUB_TOKEN="your_github_token_here"
export DATABASE_URL="your_database_url_here"
export API_KEY="your_api_key_here"
export AWS_ACCESS_KEY_ID="your_aws_access_key"
export AWS_SECRET_ACCESS_KEY="your_aws_secret_key"

EOF
    fi

    before_hash=$(command shasum -a 256 <"$plain_file")

    # vim/nvim: no swap file, no undo file, no backup and no shada/viminfo
    # (registers) copies of the plaintext. --cmd applies before the user's
    # config and -c after it, since the config may turn undofile back on.
    editor=(${(z)${EDITOR:-vim}})
    editor=("${(Q)editor[@]}")
    if [[ ${editor[1]:t} == (nvim|vim|vi) ]]; then
        local safe_opts='set noundofile noswapfile nobackup nowritebackup'
        editor+=(-n -i NONE --cmd "$safe_opts" -c "$safe_opts")
    fi

    while true; do
        echo "🖊️  Opening editor..."
        "${editor[@]}" "$plain_file"
        editor_rc=$?

        after_hash=$(command shasum -a 256 <"$plain_file")
        if [[ $before_hash == "$after_hash" ]]; then
            if (( editor_rc )); then
                echo "❌ The editor (${editor[1]}) exited with status $editor_rc and nothing was saved. $env_file was not changed."
                return 1
            fi
            echo "📝 No changes made, skipping encryption"
            return 0
        fi

        failure=""
        if (( editor_rc )); then
            failure="The editor exited with status $editor_rc (for example :cq), so the edits you saved were not encrypted."
        elif ! lint_out=$(_dotfiles_env_lint "$plain_file"); then
            failure="sops can't store this as a dotenv file:"$'\n'"$lint_out"
        else
            # Lines the shell loader would skip are worth knowing about, but
            # they don't block the save (checked in a subshell: no exports)
            skipped=$( (_dotfiles_env_parse <"$plain_file") 2>&1 >/dev/null)
            if [[ -n $skipped ]]; then
                echo "⚠️  Saved anyway, but new shells will skip some lines:"
                print -r -- "${skipped//dotfiles: /   }"
            fi
            echo "🔒 Encrypting..."
            # sops quotes a line it can't parse, so its error goes through a
            # filter instead of straight to the terminal
            if ! command sops "${sops_args[@]}" --encrypt "$plain_file" >"$enc_file" 2>"$err_file"; then
                failure="sops couldn't encrypt it: $(command sed -E 's/(line):.*/\1: (contents hidden)/' "$err_file" | command head -n 3)"
            elif ! _dotfiles_is_sops_encrypted "$enc_file" ||
                ! command sops -d "$enc_file" 2>/dev/null | command awk 'NF' | command cmp -s - <(command awk 'NF' "$plain_file"); then
                # Round trip: the result must decrypt with this machine's key
                # back to what was saved (sops drops blank lines, so compare
                # without them)
                failure="The encrypted file didn't decrypt back to your edits."
            fi
        fi
        [[ -z $failure ]] && break

        echo "❌ $failure"
        echo "   $env_file was not changed."
        _dotfiles_secrets_ask
        case $REPLY in
            edit)
                continue
                ;;
            keep)
                trap "umask ${(q)old_umask}" EXIT
                echo "📄 Your edits are kept, unencrypted, in $plain_file"
                echo "   (mode 600, in a private 700 directory). Copy what you need into"
                echo "   edit_secrets, then delete it: rm -rf ${(q)tmp_dir}"
                return 1
                ;;
            *)
                echo "🗑️  Discarded the edits."
                return 1
                ;;
        esac
    done

    # Keep the previous version. Only ciphertext is ever backed up — a
    # plaintext ~/.env being encrypted for the first time is not copied.
    if _dotfiles_is_sops_encrypted "$env_file"; then
        if ! command cp -- "$env_file" "$env_file.backup.$(command date +%Y%m%d_%H%M%S)"; then
            echo "❌ Could not back up $env_file, so it was not replaced"
            return 1
        fi
    fi

    if ! command mv -f -- "$enc_file" "$env_file"; then
        echo "❌ Could not replace $env_file; it was not changed"
        return 1
    fi

    # Keep the newest 3 backups (names sort by timestamp)
    backups=("$env_file".backup.[0-9]##_[0-9]##(N.On))
    (( $#backups > 3 )) && command rm -f -- "${(@)backups[4,-1]}"

    # New shells would miss the cache anyway (it's keyed by sops_mac); drop
    # the old plaintext now rather than leave it on disk
    command rm -f -- "$HOME/.cache/zsh/env_cache.v2" "$HOME/.cache/zsh/env_cache"

    echo "✅ Secrets encrypted and saved to $env_file"
    echo "💡 Restart your terminal or run 'source ~/.zshrc' to load updated secrets"
}

# Edit dotfiles configuration with easy access to all config files
edit_dotfiles() {
    # Try to detect dotfiles directory - prefer dotfiles over .dotfiles
    local dotfiles_dir=""
    if [ -d "${HOME}/dotfiles" ]; then
        dotfiles_dir="${HOME}/dotfiles"
    elif [ -d "${HOME}/.dotfiles" ]; then
        dotfiles_dir="${HOME}/.dotfiles"
    fi

    if [ -z "$dotfiles_dir" ]; then
        echo "❌ Dotfiles directory not found"
        echo "   Clone the repository first:"
        echo "   • git clone <repo-url> ~/dotfiles"
        echo "   • OR: git clone <repo-url> ~/.dotfiles"
        return 1
    fi

    echo "📝 Using dotfiles directory: $dotfiles_dir"

    echo "📝 Dotfiles Configuration Editor"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Select what to edit:"
    echo ""
    echo "  1) Shell Configuration (.zshrc)"
    echo "  2) Aliases (.aliases.sh)"
    echo "  3) Functions (.functions.d/)"
    echo "  4) Paths (.paths.sh)"
    echo "  5) Git Config (config)"
    echo "  6) Neovim Config (init.lua)"
    echo "  7) Powerlevel10k Prompt (.p10k.zsh)"
    echo "  8) Environment Template (.env.example)"
    echo "  9) Brewfile (package list)"
    echo " 10) Init Script (init.sh)"
    echo " 11) Browse all files"
    echo ""
    echo "  0) Exit"
    echo ""

    local choice
    read -r "choice?Choose file to edit (0-11): "

    local file_to_edit=""
    local description=""

    case "$choice" in
        1)
            file_to_edit="$dotfiles_dir/zsh/.zshrc"
            description="Shell Configuration"
            ;;
        2)
            file_to_edit="$dotfiles_dir/zsh/.aliases.sh"
            description="Command Aliases"
            ;;
        3)
            file_to_edit="$dotfiles_dir/zsh/.functions.d/"
            description="Custom Functions"
            ;;
        4)
            file_to_edit="$dotfiles_dir/zsh/.paths.sh"
            description="PATH Configuration"
            ;;
        5)
            file_to_edit="$dotfiles_dir/git/.config/git/config"
            description="Git Configuration"
            ;;
        6)
            file_to_edit="$dotfiles_dir/nvim/.config/nvim/init.lua"
            description="Neovim Configuration"
            ;;
        7)
            file_to_edit="$dotfiles_dir/zsh/.p10k.zsh"
            description="Powerlevel10k Prompt"
            ;;
        8)
            file_to_edit="$dotfiles_dir/zsh/.env.example"
            description="Environment Template"
            ;;
        9)
            file_to_edit="$dotfiles_dir/Brewfile"
            description="Homebrew Package List"
            ;;
        10)
            file_to_edit="$dotfiles_dir/init.sh"
            description="Installation Script"
            ;;
        11)
            echo ""
            echo "📁 Available dotfiles:"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            find "$dotfiles_dir" -type f \( -name ".*" -o -name "*.sh" -o -name "*.json" -o -name "Brewfile" -o -name "README.md" \) ! -path "*/.git/*" | sed "s|$dotfiles_dir/||" | sort
            echo ""
            read -r "relative_path?Enter file path to edit (relative to $dotfiles_dir): "
            if [ -n "$relative_path" ]; then
                file_to_edit="$dotfiles_dir/$relative_path"
                description="Custom File: $relative_path"
            else
                echo "❌ No file specified"
                return 1
            fi
            ;;
        0)
            echo "👋 Goodbye!"
            return 0
            ;;
        *)
            echo "❌ Invalid choice: $choice"
            return 1
            ;;
    esac

    # Verify file/directory exists
    if [ ! -e "$file_to_edit" ]; then
        echo "❌ Not found: $file_to_edit"
        return 1
    fi

    # Back up regular files into a private temp dir (never next to the dotfile,
    # where it would pollute the repo). Directories rely on git instead.
    local backup_dir="" backup_file=""
    if [ -f "$file_to_edit" ]; then
        backup_dir="$(mktemp -d "${TMPDIR:-/tmp}/edit_dotfiles.XXXXXX")" || return 1
        backup_file="$backup_dir/${file_to_edit##*/}"
        command cp "$file_to_edit" "$backup_file"
        echo "💾 Backup: $backup_file"
    fi

    # Edit the file
    echo "🖊️  Opening $description for editing..."
    ${EDITOR:-vim} "$file_to_edit"

    # Check if file (or, for a directory, anything under it) was modified
    local modified=false
    if [ -n "$backup_file" ]; then
        cmp -s "$file_to_edit" "$backup_file" || modified=true
    elif ! git -C "$dotfiles_dir" diff --quiet -- "$file_to_edit" 2>/dev/null; then
        modified=true
    fi

    if [ "$modified" = true ]; then
        echo "✅ File modified successfully"

        # Test syntax for shell files
        case "$file_to_edit" in
            *.zsh | */.zshrc)
                echo "🔍 Testing syntax..."
                if zsh -n "$file_to_edit" 2>/dev/null; then
                    echo "✅ Syntax check passed"
                else
                    echo "⚠️  Syntax check failed - please review your changes"
                fi
                ;;
            *.sh)
                echo "🔍 Testing syntax..."
                if zsh -n "$file_to_edit" 2>/dev/null; then
                    echo "✅ Syntax check passed"
                else
                    echo "⚠️  Syntax check failed - please review your changes"
                fi
                ;;
            *.json)
                echo "🔍 Testing JSON syntax..."
                if command -v jq >/dev/null 2>&1 && jq empty "$file_to_edit" 2>/dev/null; then
                    echo "✅ JSON syntax check passed"
                elif python3 -m json.tool "$file_to_edit" >/dev/null 2>&1; then
                    echo "✅ JSON syntax check passed"
                else
                    echo "⚠️  JSON syntax check failed - please review your changes"
                fi
                ;;
        esac

        echo ""
        echo "💡 Next steps:"
        case "$file_to_edit" in
            */.zshrc | */.aliases.sh | */.functions.d/ | */.functions.d/* | */.paths.sh)
                echo "   • Restart terminal or run: source ~/.zshrc"
                ;;
            */zen.json)
                echo "   • Restart terminal to see prompt changes"
                ;;
            */Brewfile)
                echo "   • Run: brew bundle --file=$dotfiles_dir/Brewfile"
                ;;
            */init.sh)
                echo "   • Test with: bash -n $dotfiles_dir/init.sh"
                ;;
        esac

        # Option to commit changes
        if git -C "$dotfiles_dir" rev-parse --git-dir >/dev/null 2>&1; then
            echo ""
            if confirm "Commit changes to git?"; then
                git -C "$dotfiles_dir" add "$file_to_edit"
                echo "Enter commit message:"
                read -r "commit_msg?> "
                if [ -n "$commit_msg" ]; then
                    git -C "$dotfiles_dir" commit -m "$commit_msg"
                    echo "✅ Changes committed to git"
                else
                    echo "❌ Empty commit message - changes staged but not committed"
                fi
            fi
        fi
    else
        echo "📝 No changes made"
        [ -n "$backup_dir" ] && rm -rf "$backup_dir" # Remove unnecessary backup
    fi

    echo "🎉 Edit complete!"
}

# Update dotfiles repository and apply changes
update_dotfiles() {
    # Try to detect dotfiles directory - prefer dotfiles over .dotfiles
    local dotfiles_dir=""
    if [ -d "${HOME}/dotfiles" ]; then
        dotfiles_dir="${HOME}/dotfiles"
    elif [ -d "${HOME}/.dotfiles" ]; then
        dotfiles_dir="${HOME}/.dotfiles"
    fi

    if [ -z "$dotfiles_dir" ]; then
        echo "❌ Dotfiles directory not found"
        echo "   Clone the repository first:"
        echo "   • git clone <repo-url> ~/dotfiles"
        echo "   • OR: git clone <repo-url> ~/.dotfiles"
        return 1
    fi

    echo "🔄 Using dotfiles directory: $dotfiles_dir"

    if ! git -C "$dotfiles_dir" rev-parse --git-dir >/dev/null 2>&1; then
        echo "❌ Dotfiles directory is not a git repository"
        return 1
    fi

    echo "🔄 Updating Dotfiles Repository"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Show current status
    echo "📍 Current status:"
    local current_branch
    local current_commit
    current_branch=$(git -C "$dotfiles_dir" branch --show-current 2>/dev/null || echo "unknown")
    current_commit=$(git -C "$dotfiles_dir" rev-parse --short HEAD 2>/dev/null || echo "unknown")
    echo "   Branch: $current_branch"
    echo "   Commit: $current_commit"
    echo ""

    # Check for uncommitted changes
    if ! git -C "$dotfiles_dir" diff-index --quiet HEAD --; then
        echo "⚠️  You have uncommitted changes:"
        git -C "$dotfiles_dir" status --porcelain
        echo ""

        if confirm "Stash uncommitted changes before updating?"; then
            git -C "$dotfiles_dir" stash push -m "Auto-stash before dotfiles update $(date)"
            echo "✅ Changes stashed"
        else
            echo "❌ Update cancelled - commit or stash your changes first"
            return 1
        fi
    fi

    # Fetch latest changes
    echo "🌐 Fetching latest changes..."
    if git -C "$dotfiles_dir" fetch origin; then
        echo "✅ Fetch completed"
    else
        echo "❌ Failed to fetch from remote"
        return 1
    fi

    # Check if updates are available
    local commits_behind
    commits_behind=$(git -C "$dotfiles_dir" rev-list HEAD..origin/"$current_branch" --count 2>/dev/null || echo "0")

    if [ "$commits_behind" = "0" ]; then
        echo "✅ Already up to date!"
        return 0
    fi

    # Show what will be updated
    echo ""
    echo "📋 Updates available ($commits_behind commits behind):"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    git -C "$dotfiles_dir" log HEAD..origin/"$current_branch" --oneline --decorate

    echo ""
    if ! confirm "Apply these updates?"; then
        echo "❌ Update cancelled"
        return 0
    fi

    # Create backup of current state
    local backup_branch
    backup_branch="backup-$(date +%Y%m%d_%H%M%S)"
    git -C "$dotfiles_dir" branch "$backup_branch"
    echo "💾 Created backup branch: $backup_branch"

    # Pull updates
    echo ""
    echo "⬇️  Pulling updates..."
    if git -C "$dotfiles_dir" pull origin "$current_branch"; then
        echo "✅ Updates applied successfully"
    else
        echo "❌ Update failed - you may need to resolve conflicts"
        echo "💡 Your backup is available at branch: $backup_branch"
        return 1
    fi

    # Show what changed
    echo ""
    echo "📝 Changes applied:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    git -C "$dotfiles_dir" log "$current_commit"..HEAD --oneline --decorate

    # Check if critical files changed
    local changed_files
    changed_files=$(git -C "$dotfiles_dir" diff --name-only "$current_commit"..HEAD)
    echo ""
    echo "🔍 Analyzing changes..."

    # Provide next steps
    echo ""
    echo "💡 Next steps:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if echo "$changed_files" | grep -q -E "\.(zshrc|aliases\.sh|paths\.sh)$|functions\.d/"; then
        echo "   🔄 Shell configuration updated"
        if confirm "Reload shell configuration now?"; then
            echo "🔄 Reloading shell configuration..."
            source "$HOME/.zshrc"
            echo "✅ Shell configuration reloaded"
        else
            echo "   💡 Run: source ~/.zshrc (or restart terminal)"
        fi
    fi

    if echo "$changed_files" | grep -q "Brewfile"; then
        echo "   📦 Package list updated"
        if confirm "Update installed packages with brew bundle?"; then
            echo "📦 Updating packages..."
            brew bundle --file="$dotfiles_dir/Brewfile"
            echo "✅ Packages updated"
        else
            echo "   💡 Run: brew bundle --file=$dotfiles_dir/Brewfile"
        fi
    fi

    if echo "$changed_files" | grep -q "\.p10k\.zsh"; then
        echo "   🎨 Prompt config updated"
        echo "   💡 Restart terminal to see prompt changes"
    fi

    if echo "$changed_files" | grep -q "init.sh"; then
        echo "   🛠️ Installation script updated"
        echo "   💡 Re-run ./init.sh if you need new features"
    fi

    if command -v dotdoctor >/dev/null 2>&1; then
        echo "   🩺 Run dotdoctor to check for files that still need linking (bestow stow <pkg>)"
    fi

    # Cleanup old backup branches (keep last 5)
    echo ""
    echo "🧹 Cleaning up old backups..."
    git -C "$dotfiles_dir" for-each-ref --format='%(refname:short)' refs/heads/backup-* | sort -r | tail -n +6 | while read -r branch; do
        git -C "$dotfiles_dir" branch -D "$branch"
        echo "   🗑️ Removed old backup: $branch"
    done

    echo ""
    echo "🎉 Dotfiles update complete!"
    echo "   📂 Repository: $dotfiles_dir"
    echo "   🏷️  Current: $(git -C "$dotfiles_dir" rev-parse --short HEAD)"
    echo "   💾 Backup: $backup_branch"
}
