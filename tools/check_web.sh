#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f domain/shared/build.gradle.kts ]]; then
  echo 'Initialize shared models: git submodule update --init domain' >&2
  exit 1
fi
./gradlew check bootJar --console=plain
