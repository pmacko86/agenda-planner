#!/usr/bin/env bash
# Publish the app to GitHub Pages by pushing index.html, style.css and app.js
# to the `gh-pages` branch of `origin`. Your main branch is left untouched.
set -euo pipefail

FILES=(index.html style.css app.js)
BRANCH=gh-pages

cd "$(dirname "$0")"
REMOTE_URL=$(git remote get-url origin)
SRC_REV=$(git rev-parse --short HEAD)
if [[ -n $(git status --porcelain -- "${FILES[@]}") ]]; then
  echo "Warning: uncommitted changes in app files; deploying the working tree anyway." >&2
  SRC_REV="$SRC_REV+dirty"
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  git clone --quiet --branch "$BRANCH" --single-branch "$REMOTE_URL" "$TMP"
  find "$TMP" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
else
  git -C "$TMP" init --quiet
  git -C "$TMP" checkout --quiet --orphan "$BRANCH"
  git -C "$TMP" remote add origin "$REMOTE_URL"
fi

cp "${FILES[@]}" "$TMP"/
touch "$TMP/.nojekyll"

git -C "$TMP" add -A
if git -C "$TMP" diff --cached --quiet; then
  echo "Nothing to deploy: $BRANCH is already up to date."
  exit 0
fi
git -C "$TMP" commit --quiet -m "Deploy $SRC_REV"
git -C "$TMP" push --quiet origin "$BRANCH"

# Derive https://<user>.github.io/<repo>/ from the remote URL
SLUG=$(echo "$REMOTE_URL" | sed -E 's#^(git@github.com:|https://github.com/)##; s#\.git$##')
echo "Deployed $SRC_REV. Live shortly at https://${SLUG%%/*}.github.io/${SLUG#*/}/"
