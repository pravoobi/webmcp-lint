/**
 * Deliberately bad imperative WebMCP tools — the JS/TS sibling of
 * checkout.html, exercised by the `dogfood` CI job and the imperative-rule
 * tests. Every finding here is expected; none of these should ever pass
 * `webmcp-lint static` cleanly.
 */

// BAD: no inputSchema (schema-required), mutates with no confirmation gate
// (confirm-state-changing), and no throttle/agentInvoked check
// (agent-rate-limit).
document.modelContext.registerTool({
  name: "deleteAccount",
  description: "Permanently delete the current user's account",
  execute: async ({ id }: { id: string }) => {
    return fetch(`/api/account/${id}`, { method: "DELETE" });
  },
});

// BAD: schema property with no description (schema-descriptions).
navigator.modelContext.registerTool({
  name: "searchOrders",
  description: "Search past orders by keyword",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "free-text search" },
      limit: { type: "number" },
    },
  },
  execute: async ({ query, limit }: { query: string; limit?: number }) => {
    return fetch(`/api/orders?q=${query}&limit=${limit ?? 10}`);
  },
});

// PARTLY OK: schema-complete and gated via destructiveHint, so
// confirm-state-changing is clean — but still no throttle/agentInvoked
// check, so agent-rate-limit still (correctly) flags it. Consent and call
// frequency are independent concerns.
document.modelContext.registerTool({
  name: "cancelOrder",
  description: "Cancel a pending order by id",
  inputSchema: {
    type: "object",
    properties: { orderId: { type: "string", description: "order id to cancel" } },
    required: ["orderId"],
  },
  annotations: { destructiveHint: true },
  execute: async ({ orderId }: { orderId: string }) => {
    return fetch(`/api/orders/${orderId}`, { method: "DELETE" });
  },
});
