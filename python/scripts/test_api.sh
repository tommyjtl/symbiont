#!/usr/bin/env bash
set -euo pipefail

BASE="${SYMBIONT_URL:-http://127.0.0.1:7341}"

echo "== Health =="
curl -sf "$BASE/health" | python3 -m json.tool

echo ""
echo "== Run bash snippet =="
curl -sf -X POST "$BASE/sandbox/run" \
  -H "Content-Type: application/json" \
  -d '{"recipeId":"bash","files":{"code":"echo hello from symbiont"}}' \
  | python3 -m json.tool

echo ""
echo "== Save session =="
curl -sf -X POST "$BASE/session" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/demo","domain":"example.com","recipeId":"bash","originalCode":"echo hi","currentCode":"echo hi"}' \
  | python3 -m json.tool

echo ""
echo "== Get session =="
curl -sf "$BASE/session?url=https://example.com/demo" | python3 -m json.tool

echo ""
echo "== Run mojo snippet =="
curl -sf -X POST "$BASE/sandbox/run" \
  -H "Content-Type: application/json" \
  -d '{"recipeId":"mojo","files":{"code":"fn main():\n    print(\"hello from symbiont mojo\")"}}' \
  | python3 -m json.tool

echo ""
echo "All API tests passed."
