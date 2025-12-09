---
trigger: always_on
---

# No Automatic Execution Policy

**Core Principle:** You must NEVER run, start, or execute the project application automatically. The decision to run the code belongs solely to the user.

## 🚫 Strictly Forbidden

- Do not run commands that start the application or server (e.g., `npm start`, `npm run dev`, `python main.py`, `go run`, etc.) on your own initiative.
- Do not execute the build output automatically after writing code.

## ✅ Permitted Verification Actions

- You ARE allowed to run "passive" commands to check for errors.
- Examples of allowed actions:
  - Linters (e.g., `eslint`, `pylint`).
  - Type Checkers (e.g., `tsc --noEmit`, `mypy`).
  - Syntax checks or compilation checks (e.g., `cargo check`).
  - Unit tests, ONLY if specifically requested or strictly necessary for debugging context, but never the full application.

## 🗣️ User Override

- You may only run the application if the user explicitly instructs you to do so (e.g., "Run the app", "Start the server").
- If you are unsure, simply write the code and ask the user: "Would you like me to run this now?"
