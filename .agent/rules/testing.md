# Testing Standards

- **Unit tests for utilities**: All pure functions must have tests.
- **Integration tests for Rust commands**: Test database commands with mock connections.
- **No tests in production build**: Use `#[cfg(test)]` for Rust test modules.
- **Component tests**: Critical UI flows (connection, query execution) need Playwright/Vitest tests.
