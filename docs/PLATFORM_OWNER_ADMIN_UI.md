# v0.18.0 - Platform Owner Admin UI

v0.18.0 adds the first platform-wide administration experience on top of the existing Organisation Owner UI.

## Purpose

The Platform Owner UI is a separate high-trust admin layer for users with platform permissions. It is intended for SaaS operators, not tenant administrators.

## Included screens

- Platform Dashboard
- All Organisations
- Global Plans / Features
- Cross-tenant Audit Logs
- Cross-tenant Security Events
- System / Developer Context

## Platform Dashboard

Shows whole-platform operating metrics:

- total organisations
- active tenants
- suspended tenants
- global plan count
- recent platform audit events
- recent platform security events
- API health
- readiness status

## All Organisations

Allows a platform owner to:

- list all organisations
- search organisations
- create organisations
- activate organisations
- suspend organisations
- view each organisation's current plan summary
- assign a plan to an organisation
- apply plan feature defaults to an organisation

## Global Plans / Features

Allows a platform owner with plan management permissions to:

- view the global plan catalogue
- create a custom plan
- update an existing plan
- edit plan feature defaults using JSON
- edit plan limits using JSON

This build remains subscription-readiness only. It does not add payment processing, invoices or billing webhooks.

## Cross-tenant audit and security visibility

The Platform Owner UI includes cross-tenant viewers for:

- platform audit logs
- platform security events

These use the existing platform log APIs and require platform audit/security permissions.

## System / Developer screen

Shows:

- API health
- readiness state
- Mongo ready state where available
- Swagger/OpenAPI links
- current platform auth context
- platform permission summary

## Permissions

The UI is visible when the authenticated user has at least one of:

```text
platform.organisations.view
platform.organisations.manage
```

Specific actions still rely on backend permission checks, including:

```text
platform.organisations.view
platform.organisations.manage
plans.view
plans.manage
audit.platform.view
security.events.platform.view
```

## Out of scope

v0.18.0 does not add:

- billing/payment processing
- platform admin invitation workflows beyond the existing user APIs
- compute allocation UI
- advanced analytics dashboards
- white-label portal builder
- custom role designer

These can be added in later builds.
