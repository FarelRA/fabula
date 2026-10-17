/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions from "../actions.js";
import type * as auth from "../auth.js";
import type * as beats from "../beats.js";
import type * as branches from "../branches.js";
import type * as candidates from "../candidates.js";
import type * as cast from "../cast.js";
import type * as claim from "../claim.js";
import type * as crons from "../crons.js";
import type * as directorNotes from "../directorNotes.js";
import type * as domain_branchPlans from "../domain/branchPlans.js";
import type * as facts from "../facts.js";
import type * as http from "../http.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_fakeGateway from "../lib/fakeGateway.js";
import type * as lib_gateway from "../lib/gateway.js";
import type * as lib_ids from "../lib/ids.js";
import type * as lib_invariants from "../lib/invariants.js";
import type * as lib_models from "../lib/models.js";
import type * as lib_path from "../lib/path.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as lib_time from "../lib/time.js";
import type * as lib_tokenBudget from "../lib/tokenBudget.js";
import type * as lib_validators from "../lib/validators.js";
import type * as prompts_registry from "../prompts/registry.js";
import type * as prompts_seed from "../prompts/seed.js";
import type * as prompts_templates from "../prompts/templates.js";
import type * as scenes from "../scenes.js";
import type * as shared_contracts from "../shared/contracts.js";
import type * as shares from "../shares.js";
import type * as summaries from "../summaries.js";
import type * as usage from "../usage.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  auth: typeof auth;
  beats: typeof beats;
  branches: typeof branches;
  candidates: typeof candidates;
  cast: typeof cast;
  claim: typeof claim;
  crons: typeof crons;
  directorNotes: typeof directorNotes;
  "domain/branchPlans": typeof domain_branchPlans;
  facts: typeof facts;
  http: typeof http;
  "lib/authz": typeof lib_authz;
  "lib/fakeGateway": typeof lib_fakeGateway;
  "lib/gateway": typeof lib_gateway;
  "lib/ids": typeof lib_ids;
  "lib/invariants": typeof lib_invariants;
  "lib/models": typeof lib_models;
  "lib/path": typeof lib_path;
  "lib/pricing": typeof lib_pricing;
  "lib/time": typeof lib_time;
  "lib/tokenBudget": typeof lib_tokenBudget;
  "lib/validators": typeof lib_validators;
  "prompts/registry": typeof prompts_registry;
  "prompts/seed": typeof prompts_seed;
  "prompts/templates": typeof prompts_templates;
  scenes: typeof scenes;
  "shared/contracts": typeof shared_contracts;
  shares: typeof shares;
  summaries: typeof summaries;
  usage: typeof usage;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
};
