# unique-toolnames

**Severity:** error · **Fixable:** no

## Rationale

Agents address tools by name. Two tools sharing a `toolname` — across a page or
across the site — means one shadows the other or the agent's call is ambiguous.

## What it flags

The same non-empty `toolname` declared on more than one scanned form. Every
occurrence is reported, each pointing at the others.

## Fix

Give each tool a distinct, action-oriented name (`searchCatalog`,
`checkoutCart`, `cancelOrder`). If two pages really expose the *same* capability,
factor it into one shared component so there is a single registration.
