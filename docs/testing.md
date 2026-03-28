# Testing Guidance

## Principle

Test the full internal lifecycle of a feature while mocking external boundaries.

## What To Mock

- Outbound API responses
- Third-party SDK calls
- Network failures and retry conditions
- Time or randomness when they affect control flow

## What Not To Skip

Even when an API response is mocked, tests should still exercise:

- input parsing and validation
- orchestration logic
- state transitions
- error handling paths
- rendered output or returned results

## Preferred Test Shape

1. Mock the external dependency at the boundary.
2. Pass the mocked response through the real feature code.
3. Assert on the full lifecycle outcome, not just the raw mock payload.

## Why

This keeps tests deterministic and fast without reducing them to shallow unit checks that only verify
mock wiring.
