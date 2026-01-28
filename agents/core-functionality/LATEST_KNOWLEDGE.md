# Core Functionality - Latest Knowledge

**Last Verified:** 2026-01-27  
**Next Review:** Before each major task

---

## Current Best Practices (2025-2026)

### React Patterns

**Server Components (Next.js 13+/React 19)**
- Default to server components for data fetching
- Use `'use client'` only when needed (interactivity, hooks)
- Streaming and Suspense for progressive loading

**State Management Trends**
- Zustand over Redux for most cases (simpler, less boilerplate)
- React Query/TanStack Query for server state
- URL state for shareable/bookmarkable state
- Form state with React Hook Form

**Component Patterns**
```tsx
// Compound components for complex UI
<Select>
  <Select.Trigger />
  <Select.Content>
    <Select.Item />
  </Select.Content>
</Select>

// Render props for flexibility
<DataTable
  data={items}
  renderRow={(item) => <CustomRow item={item} />}
/>
```

### User Experience Trends

**Progressive Enhancement**
- Core functionality works without JS
- Enhanced experience with JS enabled
- Offline-first where applicable

**Micro-interactions**
- Subtle animations for feedback (150-300ms)
- Skeleton loaders over spinners
- Optimistic updates for perceived speed

**Mobile-First Interactions**
- Touch targets minimum 44x44px
- Swipe gestures where intuitive
- Bottom navigation for thumb reach

### Form Best Practices

```tsx
// Modern form pattern
const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
  defaultValues: { ... }
});

// Inline validation feedback
// Submit on blur for critical fields
// Debounced validation for expensive checks
```

**Validation UX**
- Validate on blur, not on change (reduces noise)
- Show success state, not just errors
- Group related errors
- Preserve user input on error

### Loading States

**Skeleton UI**
```tsx
// Match content layout
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 rounded w-3/4" />
  <div className="h-4 bg-gray-200 rounded w-1/2 mt-2" />
</div>
```

**Progressive Loading**
- Load critical content first
- Lazy load below-fold content
- Use Intersection Observer for triggers

### Error Handling

**User-Friendly Errors**
```tsx
// Bad: "Error 500: Internal Server Error"
// Good: "Something went wrong. Your changes weren't saved. Try again?"

// Include:
// 1. What happened (brief)
// 2. What user can do
// 3. Recovery action
```

**Error Boundaries**
```tsx
<ErrorBoundary fallback={<ErrorFallback />}>
  <FeatureComponent />
</ErrorBoundary>
```

---

## Anti-Patterns to Avoid

### State Management
❌ Prop drilling more than 2-3 levels  
❌ Global state for local concerns  
❌ Derived state stored separately  
❌ Mutating state directly

### User Experience
❌ Disabling buttons without explanation  
❌ Clearing forms on validation error  
❌ Infinite loading without timeout  
❌ Breaking browser back button

### Performance
❌ Re-renders on every keystroke  
❌ Fetching on mount without caching  
❌ Large bundle for simple features  
❌ Blocking UI during async operations

---

## Testing Philosophy

**User-Centric Testing**
```tsx
// Test what users see and do
test('user can submit feedback', async () => {
  render(<FeedbackForm />);
  
  await userEvent.type(screen.getByLabelText(/message/i), 'Great app!');
  await userEvent.click(screen.getByRole('button', { name: /submit/i }));
  
  expect(screen.getByText(/thank you/i)).toBeInTheDocument();
});
```

**What to Test**
- User flows (happy path)
- Edge cases (empty, error, loading)
- Accessibility (keyboard, screen reader)
- NOT implementation details

---

## Accessibility Checklist

- [ ] All interactive elements keyboard accessible
- [ ] Focus visible and logical order
- [ ] ARIA labels where needed
- [ ] Color not sole indicator
- [ ] Motion respects prefers-reduced-motion
- [ ] Error messages linked to inputs
- [ ] Skip links for navigation

---

## Performance Benchmarks

| Metric | Target | Measure |
|--------|--------|---------|
| First Input Delay | <100ms | User can interact quickly |
| Interaction to Next Paint | <200ms | Feedback feels instant |
| Time to Interactive | <3.5s | Page usable quickly |

---

## Resources to Verify

When in doubt, check:
- [React Documentation](https://react.dev)
- [Web.dev UX Guides](https://web.dev/learn)
- [Nielsen Norman Group](https://nngroup.com/articles)
- [Smashing Magazine UX](https://smashingmagazine.com/category/ux)

---

*Knowledge evolves. Verify before applying.*
