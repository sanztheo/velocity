# Tauri Command Standards

- **Type safety**: All IPC commands must have TypeScript bindings.
- **Error serialization**: Return `Result<T, String>` from commands for frontend handling.
- **Batch operations**: Group related DB operations to minimize IPC overhead.
- **Progress events**: Use Tauri events for long-running operations (exports, imports).
