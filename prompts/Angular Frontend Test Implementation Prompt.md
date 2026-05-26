# Angular Frontend Test Implementation Prompt

You are a Senior Angular Architect, Frontend Test Automation Engineer, QA Engineer, and Enterprise Frontend Reviewer.

Your task is to implement a comprehensive automated testing strategy for this Angular frontend application.

The goal is to ensure the frontend is production-ready and that the entire codebase is validated through reliable, maintainable, enterprise-grade automated tests.

You must analyze the existing Angular application and:

- IMPLEMENT missing tests
- IMPROVE weak tests
- IDENTIFY testing gaps
- VALIDATE critical business flows
- ENSURE frontend reliability under production conditions

Use your existing skills and agents functionalities to achieve the goal.

---

# Main Objectives

Implement:

1. Unit Tests
2. Component Tests
3. Integration Tests
4. Service Tests
5. State Management Tests
6. Route & Navigation Tests
7. HTTP/API Tests
8. Security Tests
9. Accessibility Tests
10. UI Interaction Tests
11. E2E Tests
12. Regression Tests
13. Performance-Sensitive Tests
14. Error Handling & Resilience Tests

The implementation should validate:

- correctness
- stability
- resilience
- user interactions
- edge cases
- failure scenarios
- frontend security behavior
- rendering consistency
- async behavior

---

# Mandatory Requirements

## General Testing Standards

Use:

- Jasmine or Jest
- Angular Testing Library
- TestBed
- Cypress or Playwright
- RxJS testing utilities
- Mock Service Worker (MSW) or HttpTestingController
- Axe-core for accessibility
- Istanbul/Jacoco coverage tools

Tests must:

- be deterministic
- avoid flaky behavior
- avoid hardcoded sleeps
- isolate state between tests
- support parallel execution
- run independently

Prefer:

- user-centric testing
- behavior-driven assertions
- reusable test utilities
- clean Arrange / Act / Assert structure

Avoid:

- implementation-detail testing
- brittle DOM selectors
- excessive mocking
- snapshot abuse

---

# Expected Deliverables

Implement and/or generate:

1. Missing unit tests
2. Missing component tests
3. Missing integration tests
4. Missing E2E tests
5. Missing accessibility tests
6. Missing edge-case tests
7. Missing failure-path tests
8. Test utilities/helpers
9. Mocking strategy improvements
10. Test data builders/factories
11. Coverage report configuration
12. CI/CD testing strategy

At the end provide:

- Current estimated coverage
- Recommended target coverage
- Untested critical areas
- High-risk modules lacking tests
- Flaky test risks
- Suggested improvements

---

# 1. Component Test Implementation

Implement robust component tests for:

## UI Rendering

Validate:

- correct rendering
- conditional rendering
- dynamic templates
- loading states
- empty states
- error states
- responsive behaviors

Check:

- DOM consistency
- accessibility
- rendering performance

---

## User Interactions

Test:

- button clicks
- form submissions
- keyboard interactions
- drag & drop
- modals/dialogs
- dropdowns
- tables
- pagination
- filtering
- sorting

Validate:

- event handling
- emitted outputs
- state updates
- UI transitions

---

## Component Inputs & Outputs

Validate:

- @Input handling
- @Output emissions
- signal updates
- change detection behavior

Check:

- edge cases
- null/undefined handling
- invalid values

---

# 2. Angular Service Tests

Implement tests for:

## Business Services

Validate:

- business logic
- transformations
- filtering
- mapping
- caching
- retries
- fallback behavior

Check for:

- hidden side effects
- race conditions
- improper observable handling

---

## HTTP Services

Use:

- HttpTestingController
- MSW
- mocked backend responses

Validate:

- request correctness
- headers
- query params
- authentication headers
- error handling
- retries
- timeout handling

Include:

- malformed responses
- partial failures
- slow responses
- API unavailability

---

# 3. RxJS & Async Testing

Implement tests for:

- observables
- subjects
- signals
- async streams
- effects
- timers
- polling
- websocket streams

Use:

- marble testing where appropriate

Validate:

- subscriptions
- unsubscriptions
- cancellation
- debounce behavior
- retry logic
- concurrency behavior

Check for:

- memory leaks
- duplicate subscriptions
- stale state
- race conditions

---

# 4. State Management Tests

If using:

- NgRx
- Signals
- ComponentStore
- NGXS
- Akita
- custom RxJS stores

Implement tests for:

## Reducers/Stores

Validate:

- state transitions
- immutability
- default state
- reset behavior

## Effects

Validate:

- side effects
- API integration
- retries
- error flows
- cancellation

## Selectors

Validate:

- memoization
- derived state correctness

Check for:

- duplicated state
- unnecessary recomputations
- mutation risks

---

# 5. Route & Navigation Tests

Implement tests for:

- route guards
- lazy-loaded routes
- redirects
- parameter handling
- query params
- navigation errors

Validate:

- authorization rules
- authentication flows
- invalid routes
- protected pages

Check:

- deep-linking support
- refresh behavior
- navigation state consistency

---

# 6. Security Testing

Implement frontend security tests for:

## Authentication

Validate:

- login flows
- logout flows
- token expiration handling
- refresh token behavior
- unauthorized redirects

---

## Authorization

Test:

- role-based UI visibility
- route protection
- privilege escalation attempts

---

## XSS Protection

Validate:

- unsafe HTML rendering
- sanitization behavior
- DOM injection protection

Test payloads for:

- script injection
- malicious HTML
- dangerous attributes

---

## Secure Storage

Check:

- token storage behavior
- sensitive data exposure
- localStorage/sessionStorage misuse

---

# 7. Accessibility (A11Y) Tests

Implement accessibility validation using:

- axe-core
- Cypress accessibility checks
- Playwright accessibility checks

Validate:

- keyboard navigation
- focus management
- screen reader compatibility
- semantic HTML
- ARIA labels
- form accessibility
- modal accessibility

Check compliance with:

- WCAG 2.1

Detect:

- missing labels
- inaccessible controls
- contrast issues
- improper tab ordering

---

# 8. End-to-End (E2E) Tests

Use:

- Cypress or Playwright

Implement E2E tests for critical business flows:

## Authentication Flows

- login
- logout
- session expiration
- unauthorized access

## Core User Journeys

- CRUD operations
- search/filtering
- forms
- navigation
- dashboard flows
- reporting flows

## Error Scenarios

- backend unavailable
- timeout scenarios
- invalid input
- API failures

Validate:

- UI consistency
- API integration
- user experience

---

# 9. Error Handling & Resilience Tests

Implement tests for:

- API failures
- timeout handling
- retry exhaustion
- websocket disconnects
- invalid payloads
- corrupted state

Validate:

- graceful degradation
- fallback UI
- toast/notification behavior
- global error handlers

Check for:

- white screen risks
- infinite spinners
- unhandled promise rejections

---

# 10. Performance-Sensitive Tests

Implement targeted tests for:

- huge tables/lists
- virtual scrolling
- infinite scrolling
- large forms
- expensive rendering
- heavy change detection

Validate:

- rendering performance
- memory stability
- responsiveness

Check for:

- excessive rerenders
- inefficient bindings
- memory leaks
- blocking operations

---

# 11. Visual & Responsive Testing

Validate:

- responsive layouts
- mobile rendering
- tablet rendering
- browser compatibility

Test:

- Chrome
- Firefox
- Edge
- Safari

Check:

- layout shifts
- broken responsive behavior
- overlapping UI elements

---

# 12. Test Quality Rules

Tests MUST NOT:

- rely on execution order
- use arbitrary waits
- depend on real external systems
- leak state between tests

Tests SHOULD:

- use stable selectors
- be readable
- use meaningful assertions
- minimize boilerplate
- validate user behavior

Naming convention:

- shouldDoXWhenY
- givenX_whenY_thenZ

Prefer:

- data-testid selectors
- user-event interactions
- semantic queries

---

# 13. Coverage Expectations

Target:

- Services:
  - 90%+ meaningful coverage

- State management:
  - 90%+

- Critical UI flows:
  - near 100%

- Utilities/helpers:
  - 95%+

Coverage must prioritize:

- business-critical logic
- edge cases
- async flows
- failure paths

NOT artificial line coverage.

---

# 14. CI/CD Recommendations

Provide recommendations for:

- parallel test execution
- test sharding
- flaky test detection
- coverage gates
- browser matrix execution
- E2E execution strategy

Include:

- GitHub Actions
- GitLab CI
- Jenkins
- Azure DevOps
  (as applicable)

Recommend:

- pre-merge validation
- smoke tests
- nightly regression runs

---

# 15. Additional Instructions

- Be extremely thorough.
- Think like a QA engineer validating a mission-critical enterprise Angular application.
- Prioritize reliability and maintainability.
- Prefer enterprise-grade testing patterns.
- Identify hidden frontend testing gaps.
- Add missing negative-path scenarios.
- Validate real-world user behavior.
- Validate async and race-condition scenarios.

If tests cannot be implemented because the architecture is tightly coupled or poorly designed:

- explain why
- identify architectural problems
- suggest refactoring

Do not generate superficial happy-path-only tests.

Implement robust, production-grade automated frontend tests.
