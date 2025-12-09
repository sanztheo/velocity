---
trigger: always_on
---

# Code Architecture & Modularity

**Core Principle:** Enforce strict separation of concerns. Avoid monolithic files and ensure a clean, maintainable folder structure.

## 📂 Structural Rules

- **One Component per File:** Never define multiple exported components in a single file. Break them into separate files.
- **Feature-Based Organization:** Group related files (components, hooks, types) by feature rather than by file type (e.g., use a `features/auth/` folder).
- **Separation of Logic:** Extract complex business logic and state management into **Custom Hooks** or utility functions. Keep UI components purely for rendering.

## 📏 Size Limits

- If a file exceeds ~200 lines, you must proactively suggest refactoring or splitting it into smaller sub-components or utils.
- Do not place API calls directly inside components; move them to a dedicated service or API layer.
