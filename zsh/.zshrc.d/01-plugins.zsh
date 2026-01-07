# ============================================================================
# ZSH Plugins - Zinit Plugin Manager
# ============================================================================
# Essential plugins load immediately, others use turbo mode for faster startup

# Source/Load zinit
ZINIT_HOME="${HOME}/.local/share/zinit/zinit.git"
if [ -f "${ZINIT_HOME}/zinit.zsh" ]; then
    source "${ZINIT_HOME}/zinit.zsh"
else
    # Fallback or silent failure if not installed yet (prevents terminal errors)
    echo "Zinit not found at ${ZINIT_HOME}. Run ./init.sh to install."
    return 1
fi

# ZSH Plugins - Essential plugins load immediately, others use turbo mode

# Load completions immediately (needed for tab completion)
zinit light zsh-users/zsh-completions

# Load fzf-tab immediately (needed for enhanced tab completion)
zinit light Aloxaf/fzf-tab

# Load syntax highlighting with turbo mode (visual, can be delayed)
zinit ice wait"1" lucid
zinit light zsh-users/zsh-syntax-highlighting

# Load autosuggestions with turbo mode (helpful but not critical)
zinit ice wait"1" lucid
zinit light zsh-users/zsh-autosuggestions

# Add in snippets with turbo mode (utility functions, can be delayed)
zinit ice wait"2" lucid
zinit snippet OMZP::sudo

# Homebrew command-not-found integration (updated)
if ! command -v brew >/dev/null; then return; fi

homebrew_command_not_found_handle() {
  local cmd="$1"

  if [[ -n "${ZSH_VERSION}" ]]
  then
    autoload is-at-least
  fi

  # do not run when inside Midnight Commander or within a Pipe, except if CI
  if test -z "${HOMEBREW_COMMAND_NOT_FOUND_CI}" && test -n "${MC_SID}" -o ! -t 1
  then
    [[ -n "${ZSH_VERSION}" ]] && is-at-least "5.2" "${ZSH_VERSION}" &&
      echo "zsh: command not found: ${cmd}" >&2
    return 127
  fi

  if [[ "${cmd}" != "-h" ]] && [[ "${cmd}" != "--help" ]] && [[ "${cmd}" != "--usage" ]] && [[ "${cmd}" != "-?" ]]
  then
    local txt
    txt="$(brew which-formula --skip-update --explain "${cmd}" 2>/dev/null)"
  fi

  if [[ -z "${txt}" ]]
  then
    [[ -n "${ZSH_VERSION}" ]] && is-at-least "5.2" "${ZSH_VERSION}" &&
      echo "zsh: command not found: ${cmd}" >&2
  else
    echo "${txt}"
  fi

  return 127
}

if [[ -n "${ZSH_VERSION}" ]]
then
  command_not_found_handler() {
    homebrew_command_not_found_handle "$*"
    return $?
  }
fi
