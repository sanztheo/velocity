# Smart Implementation & Web Verification

**Core Principle:** Do not rely solely on your internal training data. You must actively leverage web searches to identify the most current, efficient, and "state-of-the-art" implementation patterns.

## 🌐 Search Mandates

- **Complex Logic:** Before implementing complex functions or algorithms, search for current best practices (e.g., "Rust high performance csv parsing 2024" or "React virtual list best practices").
- **Library APIs:** Verify that external libraries/crates are up-to-date. Do not use deprecated methods. Check official documentation or GitHub issues for recent changes.
- **Performance Benchmarks:** When multiple approaches exist, look for comparisons or benchmarks to select the one that handles "millions of rows" most efficiently.

## 💡 Implementation Strategy

- **Synthesis:** Do not just copy-paste the first result. Compare 2-3 sources (StackOverflow, Official Docs, Tech Blogs) to synthesize the best solution.
- **Justification:** Briefly explain _why_ the chosen method was selected based on your search (e.g., "Chosen for O(1) lookup time" or "Avoids unnecessary memory allocation").
