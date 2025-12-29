# Palette's UX Journal

## 2024-05-23 - Accessibility of Search Inputs
**Learning:** Even well-structured components often miss basic accessible names for search inputs when relying on visual placeholders. This is a common pattern where visual design (clean search bar) overrides semantic structure (labels).
**Action:** Always verify inputs have `aria-label` or `aria-labelledby` when visual labels are hidden or omitted. Decorative icons inside inputs should be explicitly hidden with `aria-hidden="true"` to avoid screen reader noise.
