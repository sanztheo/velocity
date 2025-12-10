---
trigger: always_on
---

# UI & Design System: Shadcn UI

**Core Principle:** All UI development must strictly utilize the **Shadcn UI** component library and **Tailwind CSS**.

## 🎨 Design Standards

- **Component Priority:** Always use existing Shadcn components (e.g., Button, Card, Input) instead of building raw HTML elements.
- **Import Paths:** Assume components are available in the standard `@/components/ui` directory.
- **Styling:** Use Tailwind CSS utility classes for layout, spacing, and overrides. Do not write custom CSS files unless absolutely necessary.
- **Icons:** Use `lucide-react` for icons, consistent with the Shadcn ecosystem.

## 🚫 Forbidden

- Do not use other component libraries (like Material UI or Bootstrap).
- Do not invent custom UI styles if a Shadcn primitive can be used.
