---
trigger: always_on
---

# Rust Code Architecture & Modularity

**Core Principle:** Enforce strict separation of concerns using Rust's module system. Avoid monolithic `mod` files and ensure tight cohesion between data (`struct`) and behavior (`impl`).

## 📂 Structural Rules (The Module System)

- **One Primary Struct per Module:** Avoid defining multiple complex structs in a single file. If a struct requires a large `impl` block, give it its own file/module.
- **Feature-Based Organization:** Group code by domain domain (e.g., `crates/query_engine`, `src/connection`) rather than technical layers. Use Rust **Workspaces** if a feature becomes distinct enough to be a separate library.
- **Separation of Logic:**
  - **Data vs Behavior:** Keep your data definitions (`structs`/`enums`) clean.
  - **Traits for Behavior:** Define shared behavior in `traits`. If logic is complex, move the implementation into a dedicated service module or a separate `impl` file.

## 📏 Complexity & Size Limits

- **File Size:** If a file exceeds ~250 lines, split it. Use sub-modules (folders with `mod.rs` or new file syntax) to break down complex logic.
- **No Logic in `main`:** The `main.rs` (or UI entry point) should only bootstrap the application. Move all business logic to `lib.rs` or dedicated modules.
- **Abstraction Layers:** Do not perform raw SQL or low-level byte manipulation directly in high-level modules. Use the **Repository Pattern** or **Service Layer** traits to abstract data access.

## 🦀 Safety & Error Handling

- **No Panics:** Never use `.unwrap()` or `.expect()` in production code. Always propagate errors using `Result<T, E>` and strictly typed custom errors (e.g., using `thiserror`).
