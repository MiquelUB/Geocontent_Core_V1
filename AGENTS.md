# Agent Guidelines & Quality Control Protocol

This document defines mandatory safety rules and verification protocols for any AI agent working on this codebase.

## 🚨 MANDATORY PRE-COMMIT & PRE-PUSH CHECKLIST

Before declaring any task complete or committing code, you MUST follow these 5 rules:

### 1. Verify Imports for All JSX Symbols
Whenever you add or use any component, icon, or utility in JSX (e.g., `CheckCircle2`, `Loader2`, `Sparkles`, `Badge`, `Input`), you MUST verify it is explicitly imported at the top of the file.
- **Verification command:** `grep -n "<SymbolName>" <FilePath>`

### 2. Verify Prop Destructuring & Signature Matching
Whenever you pass a new prop from a parent component (e.g., `AdminDashboard` passing `refreshTrigger` to `RoutePoiManager`):
- Check the child's TypeScript interface / type definition.
- Check the child's function signature destructuring: `function ChildComponent({ prop1, prop2, newProp }: Props)`.
- Ensure `newProp` is declared in BOTH places.

### 3. Safe Parsing for DB/Prisma Data Structures
Never assume Prisma or API JSON fields return an `Array`. They can return stringified JSON strings (e.g. `'["url1"]'`).
- Always use a safe parsing helper (like `parseVideos` or `Array.isArray(x) ? x : JSON.parse(x)`) before calling `.map()`, `.filter()`, or `.slice()` to prevent white-screen crashes.

### 4. Precise File Edits (Avoid Syntax Corruptions in Large Files)
- When modifying large files (>300 lines), avoid aggressive multi-chunk tools that risk duplicating modules or placing imports inside functions.
- Inspect the file diff with `git diff` after editing to ensure no duplicated imports or broken syntax were introduced.

### 5. Mandatory Verification via Build
NEVER declare success without running:
```bash
npm run build
```
Ensure the build succeeds with zero Webpack / TypeScript compilation errors.
