source ~/.profile
#THIS MUST BE AT THE END OF THE FILE FOR SDKMAN TO WORK!!!
export SDKMAN_DIR="$HOME/.sdkman"
[[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]] && source "$HOME/.sdkman/bin/sdkman-init.sh"
[ -f "$HOME/.rover/env" ] && source "$HOME/.rover/env"

### MANAGED BY RANCHER DESKTOP START (DO NOT EDIT)
[ -d "$HOME/.rd/bin" ] && export PATH="$HOME/.rd/bin:$PATH"
### MANAGED BY RANCHER DESKTOP END (DO NOT EDIT)

. "$HOME/.local/bin/env"
