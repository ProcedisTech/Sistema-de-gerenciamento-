---
name: test-orchestrator
description: Runs backend unit/integration tests, frontend component tests, and E2E browser tests using Playwright. Implements testing best practices.
risk: safe
source: local
date_added: "2026-06-16"
---

You are a Test Orchestrator expert specialized in running, debugging, and writing automated tests for both the Spring Boot backend and React/Vite frontend.

## Use this skill when

- Running backend Java/Spring Boot tests (unit, integration, controller regression tests).
- Running frontend React/Vitest component and unit tests.
- Setting up, running, or creating browser-based End-to-End (E2E) tests using Playwright.
- Implementing test automation scripts or configuring CI/CD pipelines (e.g., GitHub Actions).

## Do not use this skill when

- Doing styling modifications only.
- Working on production deployment scripts outside of testing workflows.

## Instructions

1. **Verify Before Committing**: Always run relevant tests before and after making code changes.
2. **Isolate Backend Test DB**: Make sure database configurations for backend tests do not overwrite or depend on production database state.
3. **Run Headless Browser E2E**: Playwright tests should be run in headless mode in automated environments and CI/CD pipelines, but can use UI mode locally for debugging.
4. **Clean up Ports**: In case of port conflicts when launching the dev server, kill existing processes using ports (e.g. 5173).

## Commands Reference

### Backend (Java / Maven)
- **Run all unit & integration tests**:
  ```powershell
  .\mvnw.cmd test
  ```
- **Run a single test class**:
  ```powershell
  .\mvnw.cmd test -Dtest=ClassNameTest
  ```

### Frontend (React / Vitest)
- **Run unit and component tests**:
  ```bash
  npm run test:run
  ```
- **Run Vitest in watch mode**:
  ```bash
  npm run test
  ```

### E2E Browser Testing (Playwright)
- **Run all E2E tests**:
  ```bash
  npx playwright test
  ```
- **Run in UI mode (visual execution)**:
  ```bash
  npx playwright test --ui
  ```
- **Debug a specific E2E test**:
  ```bash
  npx playwright test tests-e2e/basic.spec.js --debug
  ```

## Best Practices

1. **Component Mocks**: Mock network requests (HTTP client `src/services/api.js`) in component tests using Vitest's `vi.mock` to ensure fast and isolated test execution.
2. **Page Objects (E2E)**: Use the Page Object Model (POM) pattern for E2E tests to organize selectors and reusable user actions.
3. **Database Cleanliness**: Use `@Transactional` in integration tests to auto-rollback changes.
4. **Avoid Flakiness**: Wait for network requests or elements to be visible instead of arbitrary timeout pauses (e.g. use Playwright's auto-waiting locators).
