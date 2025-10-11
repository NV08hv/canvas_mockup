# Design 2 Implementation - Partial Progress

Due to the complexity of the codebase and the large number of interconnected functions, implementing full Design 2 support requires many systematic changes throughout the file.

## What's Been Completed:
1. ✅ Added `design2` state with same structure as `design1`
2. ✅ Added `activeDesignNumber` state to track which design is being edited (1 or 2)
3. ✅ Added `handleDesign2Upload` function
4. ✅ Added per-mockup custom transforms and blend modes for Design 2 (`mockupCustomTransforms2`, `mockupCustomBlendModes2`)
5. ✅ Updated `getEffectiveTransform`, `getEffectiveBlendMode`, `getEffectivePosition` to accept `designNum` parameter
6. ✅ Updated `drawDesign` to accept `designNum` parameter

## What Still Needs To Be Done:

### Critical Updates Needed:
1. Update canvas rendering to draw BOTH designs (currently only draws design 1)
2. Update `hitTestDesign` to support both designs
3. Update `getActiveDesignState` to return the active design based on `activeDesignNumber`
4. Update `updateActiveDesignTransform` and `updateActiveDesignBlendMode` to work with both designs
5. Update all drag handlers to support both designs
6. Add Design 2 upload UI in the sidebar
7. Add design selector/toggle buttons in the UI
8. Update export function to include both designs
9. Update Interactive Preview to show currently selected design
10. Update Edit Modal to work with currently selected design

### Recommended Approach:
Instead of doing a partial implementation that may break functionality, I recommend:

1. **Option A**: Complete a simpler version where Design 2 is always rendered on top of Design 1 automatically when loaded, sharing the same controls (no independent editing yet)

2. **Option B**: Implement full independent design support with a design selector, requiring all the updates listed above

Would you like me to:
- Implement Option A (simpler, both designs always visible)
- Continue with Option B (full independent control - requires more extensive changes)
- Revert the partial changes and start with a cleaner approach?
