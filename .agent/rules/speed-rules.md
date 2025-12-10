---
trigger: always_on
---

# High Performance & Scalability (Big Data Context)

**Core Principle:** This project is a database management tool (like TablePlus). It must handle **millions to billions of rows** without freezing the UI or crashing the browser.

## 🚀 Rendering Strategy (Virtualization)

- **Mandatory Virtualization:** NEVER render a full dataset directly to the DOM.
- **Implementation:** ALWAYS implement "Windowing" or "Virtual Scrolling" (e.g., using `@tanstack/react-virtual` or `react-window`). The DOM should only contain the rows currently visible to the user.
- **Fixed Layouts:** Prefer fixed-height rows/columns where possible to reduce layout recalculation costs.

## 💾 Data Handling & Memory Management

- **No "Select All" Fetching:** Never fetch the entire dataset from the database into the client memory at once.
- **Lazy Loading & Pagination:** Implement strict server-side pagination (cursor-based preferred for performance) or infinite loading strategies.
- **Streaming:** For exports or large data operations, use streams instead of buffering the whole file in memory.

## ⚡ Algorithmic Efficiency

- **Main Thread Safety:** Do not block the main UI thread. If sorting or filtering large local datasets is necessary, offload the computation to **Web Workers**.
- **Lookup Optimization:** Avoid O(n) array searches inside loops. Use HashMaps/Sets (O(1)) for looking up IDs or keys in large datasets.
