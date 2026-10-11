#!/bin/zsh
# ============================================================================
# Archive Functions
# ============================================================================
# Compression and extraction utilities: compress(), extract()

# compress <path>... : create <path>.tar.gz next to each argument.
# A trailing slash (what tab completion adds to directories) is stripped, so
# `compress dir/` produces dir.tar.gz rather than a hidden ".tar.gz".
compress() {
    if [[ $# -eq 0 ]]; then
        echo "Usage: compress <file-or-dir>..." >&2
        return 1
    fi

    local target name rc=0
    for target in "$@"; do
        name="$target"
        while [[ "$name" == */ && "$name" != / ]]; do name="${name%/}"; done
        if [[ ! -e "$name" ]]; then
            echo "compress: '$target' does not exist" >&2
            rc=1
            continue
        fi
        if [[ -e "$name.tar.gz" ]]; then
            echo "compress: '$name.tar.gz' already exists, not overwriting" >&2
            rc=1
            continue
        fi
        tar -czvf "$name.tar.gz" "$name" || rc=1
    done
    return $rc
}

# extract <archive>... : unpack each archive into the current directory.
# `unar` is preferred for rar/7z/zip when installed: it creates a containing
# directory when an archive has several top-level entries instead of
# scattering files into the cwd, and it handles rar without the (removed from
# Homebrew) unrar. Falls back to unrar / 7z / unzip.
extract() {
    if [[ $# -eq 0 ]]; then
        echo "Usage: extract <archive>..." >&2
        return 1
    fi

    local archive rc=0
    for archive in "$@"; do
        if [[ ! -f "$archive" ]]; then
            echo "extract: '$archive' is not a valid file" >&2
            rc=1
            continue
        fi

        case "$archive" in
            *.tar.bz2 | *.tbz2) tar xjf "$archive" ;;
            *.tar.gz | *.tgz) tar xzf "$archive" ;;
            *.tar.xz | *.txz | *.tar.zst | *.tar) tar xf "$archive" ;;
            *.bz2) bunzip2 "$archive" ;;
            *.gz) gunzip "$archive" ;;
            *.xz) unxz "$archive" ;;
            *.Z) uncompress "$archive" ;;
            *.rar)
                if command -v unar >/dev/null 2>&1; then
                    unar "$archive"
                elif command -v unrar >/dev/null 2>&1; then
                    unrar x "$archive"
                else
                    echo "extract: no rar extractor found. Install with: brew install unar" >&2
                    false
                fi
                ;;
            *.7z)
                if command -v unar >/dev/null 2>&1; then
                    unar "$archive"
                elif command -v 7z >/dev/null 2>&1; then
                    7z x "$archive"
                else
                    echo "extract: no 7z extractor found. Install with: brew install unar" >&2
                    false
                fi
                ;;
            *.zip)
                if command -v unar >/dev/null 2>&1; then
                    unar "$archive"
                else
                    unzip "$archive" -x "__MACOSX/*"
                fi
                ;;
            *)
                echo "extract: '$archive' cannot be extracted via extract()" >&2
                false
                ;;
        esac || rc=1
    done
    return $rc
}
