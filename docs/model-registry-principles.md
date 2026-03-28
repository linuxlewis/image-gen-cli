# Model Registry Principles

This document is the source of truth for model-registry rules in this repo.

## Core Rule

The CLI is model-first, not provider-first.

Flow:

`canonical model id -> registry entry -> one or more provider routes`

Users and internal feature logic should select canonical models. Provider-specific identifiers exist to
resolve how a given provider exposes that model, not to define the product surface.

## Identifier Types

### Canonical Model ID

- Stable repo-owned identifier for a model capability.
- Used by CLI flags, docs, tests, fixtures, and internal selection logic.
- Must not encode a provider name unless the model is truly provider-exclusive as a product concept.
- Should be durable enough to survive route changes across providers.

Examples:

- `gpt-image-1`
- `flux-1.1-pro`
- `imagen-4-ultra`

### Route Model ID

- Provider-facing identifier used for one concrete route.
- May match the provider API's literal model name, deployment name, or routed alias.
- Lives under a provider route definition, not as the primary identifier for the model itself.
- May differ across direct and aggregated providers even when they target the same canonical model.

Examples:

- direct provider route id: `gpt-image-1`
- aggregated provider route id: `openai/gpt-image-1`
- vendor deployment id: `my-prod-image-deployment`

When the provider exposes a raw identifier that is operationally important, store it as route metadata
instead of promoting it to the canonical id.

## Registry Shape

Each canonical model entry should own the durable description of the model:

- `canonicalModelId`
- `family`
- `aliases`
- `status`
- `confidence`
- `routes[]`

Each route should describe one provider-specific way to reach that canonical model:

- `provider`
- `providerType`
- `routeModelId`
- optional raw/deployment identifiers
- route-level status notes when needed

## Model Family

- `family` groups related canonical models for UX and maintenance.
- Families should reflect product lineage or capability grouping, not transport details.
- Do not use provider names as the family unless the family is inherently provider-defined.

Examples:

- `gpt-image`
- `flux`
- `imagen`

## Provider Abstraction Rules

- Feature code should depend on canonical models and provider capabilities, not hardcoded route ids.
- Provider adapters translate canonical intent into provider route details.
- Registry entries may expose multiple routes for the same canonical model without changing CLI semantics.
- Adding an aggregated provider must not force direct providers into a separate model namespace.

## Direct vs Aggregated Providers

Direct providers expose their own native model endpoint.

Examples:

- OpenAI serving `gpt-image-1`
- Black Forest Labs serving a native FLUX model

Aggregated providers expose another vendor's model through a broker, router, or marketplace.

Examples:

- OpenRouter exposing `openai/gpt-image-1`
- Replicate exposing a hosted vendor model

Rules:

- Direct and aggregated providers may coexist under the same canonical model entry.
- The distinction belongs in provider/route metadata, not in the canonical model id.
- Aggregated routes should preserve the underlying canonical model when that mapping is known.
- If an aggregated route points to a model with uncertain equivalence, lower confidence instead of
  inventing a misleading canonical id.

## Alias Handling

- Aliases are alternate names that should resolve to one canonical model id.
- Aliases may come from legacy CLI names, common shorthand, or previous provider naming.
- Aliases must not become a second source of truth for registry semantics.
- If an alias is ambiguous across models, do not register it until resolution rules are explicit.

Preferred behavior:

- normalize user input
- resolve alias to canonical model id
- continue using the canonical model id internally

## Status And Confidence

Each canonical model entry should carry lightweight metadata so agents can evolve the registry without
guessing.

### Status

`status` describes lifecycle state. Keep values few and obvious.

Suggested values:

- `active`: intended for normal selection
- `preview`: available but still in flux
- `deprecated`: supported temporarily but being phased out
- `disabled`: kept for history or migrations, not for normal selection

### Confidence

`confidence` describes how certain the registry mapping is.

Suggested values:

- `high`: direct documentation or confirmed provider behavior
- `medium`: strong inference, partial verification, or recent provider churn
- `low`: provisional mapping that needs confirmation

Use confidence for questions like:

- Is this aggregated route truly equivalent to the canonical model?
- Is a provider alias stable or only incidentally accepted?
- Is a deprecated route still usable?

## Practical Rules For Future Tickets

- Add or change canonical ids rarely; route ids are expected to change more often.
- When adding a provider, first map it onto existing canonical models before creating new ones.
- When a provider uses multiple raw identifiers for one route, keep one route entry and attach the extra
  raw identifiers as metadata.
- Prefer explicit status/confidence notes over silent assumptions.
- If a mapping is not yet trustworthy, document the uncertainty in the registry instead of hiding it in
  code comments.
