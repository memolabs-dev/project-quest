#!/bin/sh
# Runs the main e2e project, then the load-time test alone, whatever the first gave (a failing main test must never
# skip the load gate). Arguments go to both runs.
npx playwright test --project=main "$@"
main=$?
npx playwright test --project=load "$@"
load=$?
[ "$main" -eq 0 ] && [ "$load" -eq 0 ]
