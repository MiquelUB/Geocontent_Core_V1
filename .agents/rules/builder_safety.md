# Builder Safety & Verification Protocol

## Recurring Bug Prevention Checklist

Every time code is changed in `components/admin/` or `lib/`:

1. **Imports Checklist**:
   - Check every icon imported from `lucide-react`.
   - Ensure symbols referenced in JSX are present in the `import { ... }` list at line 1-20.

2. **Prop Chain Checklist**:
   - If `Parent.tsx` renders `<Child newProp={val} />`:
     - Verify `interface ChildProps` has `newProp?: type`.
     - Verify `function Child({ newProp }: ChildProps)` destructures `newProp`.

3. **Runtime Crash Prevention**:
   - Wrap all JSON fields from Prisma (`videoUrls`, `carouselImages`, `translations`) in safe array parsers before running array methods.

4. **Build Verification**:
   - Always run `npm run build` to confirm compilation success.
