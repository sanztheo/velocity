# Security Best Practices

- **Never log sensitive data**: No passwords, tokens, or connection strings in logs.
- **Sanitize all SQL inputs**: Use parameterized queries exclusively, never string concatenation.
- **Validate user input**: Both frontend AND backend validation required.
- **Credentials storage**: Use OS keychain (Tauri's secure storage) for database credentials.
