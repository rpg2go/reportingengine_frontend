# Frontend Testing Guide & Specification

This guide outlines the automated testing architecture, standards, and patterns for the Reporting Platform Angular frontend. Use this as a reference and starting point when writing new unit and integration tests.

---

## 🚀 Running the Test Suite

We use **Vitest** in a standard Node environment for maximum speed and execution efficiency.

To run all tests:
```bash
npm test
```

---

## 📐 Key Testing Principles

1. **Class-Instance Testing**: Instead of using heavy, DOM-rendering wrappers (like jsdom/happy-dom or TestBed component compiling), we test component and service logic by instantiating their TypeScript classes directly. This ensures tests complete in milliseconds.
2. **Deterministic & Isolated**: Do not rely on shared state or network calls. Mock all dependencies (HTTP client, routers, stores) and clear global storage before each test.
3. **No Hardcoded Sleeps**: Use RxJS observables, mock subjects, or Vitest timers (`vi.useFakeTimers()`) to test async logic.
4. **Stable Assertions**: Focus assertions on business-critical logic, state mutations (signals), output emissions, and routing calls.

---

## 🛠️ Implementation Patterns (For Developers & LLMs)

### 1. The `@angular/compiler` Import (Mandatory)
Always include `import '@angular/compiler';` at the top of every new spec file. This avoids JIT compilation errors for Angular-compiled packages in the Node environment.

```typescript
import '@angular/compiler';
import { describe, it, expect, vi } from 'vitest';
```

### 2. Dependency Injection & Functional Testing
For functional guards, interceptors, or components that use Angular's `inject()` function internally, you must execute them within an Injection Context using `runInInjectionContext` and a manual `Injector`.

#### Guard Example:
```typescript
import { Injector, runInInjectionContext } from '@angular/core';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

const injector = Injector.create({
  providers: [
    { provide: AuthService, useValue: { isAuthenticated: () => true } }
  ]
});

const allowed = runInInjectionContext(injector, () => authGuard({} as any, {} as any));
expect(allowed).toBe(true);
```

### 3. Component Lifecycle Testing
When instantiating component classes manually, Angular lifecycle hooks (such as `ngOnInit`) **are not automatically called**. You must trigger them manually.

#### Component Example:
```typescript
runInInjectionContext(injector, () => {
  const component = new MyComponent();
  component.ngOnInit(); // Manually run lifecycle hooks
  expect(component.dataLoaded()).toBe(true);
});
```

### 4. Global Mocking (sessionStorage, localStorage & DOM)
If services or components access browser-specific globals, polyfill or mock them globally in the test file before instantiating target classes.

#### Storage Mocking:
```typescript
const mockStore: Record<string, string> = {};
globalThis.sessionStorage = {
  getItem: (key: string) => mockStore[key] || null,
  setItem: (key: string, value: string) => { mockStore[key] = value; },
  removeItem: (key: string) => { delete mockStore[key]; },
  clear: () => { for (const key in mockStore) delete mockStore[key]; },
} as any;
```

#### DOM Mocking (e.g. for File Downloads):
```typescript
const mockLink = { href: '', download: '', click: vi.fn() };
globalThis.document = {
  createElement: vi.fn().mockReturnValue(mockLink),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn()
  }
} as any;

globalThis.window = {
  URL: {
    createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
    revokeObjectURL: vi.fn()
  }
} as any;
```

### 5. Testing Async Loading States
To assert loader toggling (e.g., `loading = signal(true)` before call and `false` after), use an RxJS `Subject` to control the timing of the mock response emission.

```typescript
import { Subject } from 'rxjs';

it('should toggle loading state during execution', () => {
  const responseSubject = new Subject<any>();
  mockService.getData.mockReturnValue(responseSubject);

  component.fetchData();
  expect(component.loading()).toBe(true); // Spinner is active

  responseSubject.next({ data: 'success' });
  responseSubject.complete();

  expect(component.loading()).toBe(false); // Spinner is inactive
});
```

---

## 🏷️ Test Naming & Structure Conventions

- **File Placement**: Store spec files alongside the file they test. For example, `src/app/services/report.service.ts` corresponds to `src/app/services/report.service.spec.ts`.
- **Test Block Naming**:
  - Main suite: `describe('ClassName', () => { ... })` or `describe('FunctionName', () => { ... })`
  - Assertions: Use the `shouldDoXWhenY` or `givenX_whenY_thenZ` naming convention.
- **Act / Arrange / Assert**: Keep test structures clean and readable. Use `beforeEach` to arrange shared configurations.
