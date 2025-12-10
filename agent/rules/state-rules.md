# Frontend State Management

- **Zustand for global state**: Use Zustand stores, not React Context for shared state.
- **Store separation**: One store per domain (connections, queries, settings).
- **No prop drilling**: If passing props > 2 levels deep, use a store.
- **Persist critical state**: Connection configs should survive page refresh.
