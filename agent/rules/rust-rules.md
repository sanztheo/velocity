# Rust Code Standards

- **Error handling**: Use `thiserror` for custom errors, propagate with `?` operator.
- **No unwrap() in production code**: Use `expect()` with meaningful messages or proper error handling.
- **Async consistency**: Prefer `tokio` runtime, avoid blocking calls on async threads.
- **Documentation**: All public functions must have `///` doc comments.
