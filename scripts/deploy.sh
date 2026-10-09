#!/bin/sh
# Copy the built plugin into one or more vaults' plugin folders.
# Vaults come from OBSIDIAN_VAULTS (colon-separated) or OBSIDIAN_VAULT, set in
# the environment or in .deploy.env. The environment wins over .deploy.env.
set -eu
cd "$(dirname "$0")/.."

if [ -z "${OBSIDIAN_VAULTS:-}${OBSIDIAN_VAULT:-}" ] && [ -f .deploy.env ]; then
  . ./.deploy.env
fi
vaults="${OBSIDIAN_VAULTS:-${OBSIDIAN_VAULT:-}}"
if [ -z "$vaults" ]; then
  echo "set OBSIDIAN_VAULTS (colon-separated) or OBSIDIAN_VAULT (env or .deploy.env) to your vault path(s)" >&2
  exit 1
fi

# Check every vault before copying anything, so a typo doesn't leave a partial deploy.
old_ifs=$IFS
IFS=:
for vault in $vaults; do
  if [ ! -d "$vault/.obsidian" ]; then
    echo "not an Obsidian vault (no .obsidian folder): $vault" >&2
    exit 1
  fi
done
for vault in $vaults; do
  dest="$vault/.obsidian/plugins/gtd-flow"
  mkdir -p "$dest"
  cp main.js manifest.json styles.css "$dest/"
  echo "deployed to $dest"
done
IFS=$old_ifs
