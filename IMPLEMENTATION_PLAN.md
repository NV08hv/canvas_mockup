# Apply Button Implementation Plan

## Current Status
The EditModal has been updated to use local state (`local Transform`) instead of directly modifying the global state.

## Remaining Tasks

1. Replace all remaining `currentTransform` references with `localTransform` in EditModal
2. Remove all calls to `onTransformChange` during editing (keep only on Apply)
3. Add Apply button to header
4. Add apply handler that commits local state to global
5. Add keyboard shortcuts (Enter/Ctrl+Enter)
6. Update header readouts to show `localTransform`

## File Locations
- Main file: `/Users/nguyenlevy/Documents/canvas_mockup/src/components/MockupCanvas.tsx`
- EditModal component starts around line 300
