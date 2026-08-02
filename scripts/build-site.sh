#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
client_dir="$project_dir/dist/client"
server_dir="$project_dir/dist/server"

rm -rf "$project_dir/dist"
mkdir -p "$client_dir" "$server_dir"

for file in \
  404.html \
  contact.html \
  index.html \
  mission.html \
  privacy.html \
  responsible-use.html \
  terms.html \
  robots.txt \
  sitemap.xml \
  _headers \
  _redirects \
  _routes.json
do
  cp "$project_dir/$file" "$client_dir/$file"
done

mkdir -p "$client_dir/assets" "$client_dir/decision-science"
cp -R "$project_dir/assets/." "$client_dir/assets/"
cp -R "$project_dir/decision-science/." "$client_dir/decision-science/"

cp "$project_dir/server/index.mjs" "$server_dir/index.js"
cp \
  "$project_dir/functions/_shared/article-view-api.mjs" \
  "$server_dir/article-view-api.mjs"
