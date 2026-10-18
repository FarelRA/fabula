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
import type * as compiler_blocks from "../compiler/blocks.js";
import type * as compiler_compileCasting from "../compiler/compileCasting.js";
import type * as compiler_compileDirectorMeta from "../compiler/compileDirectorMeta.js";
import type * as compiler_compileMemory from "../compiler/compileMemory.js";
import type * as compiler_compileRolePrompt from "../compiler/compileRolePrompt.js";
import type * as compiler_types from "../compiler/types.js";
import type * as crons from "../crons.js";
import type * as directorNotes from "../directorNotes.js";
import type * as domain_branchPlans from "../domain/branchPlans.js";
import type * as domain_castConstraints from "../domain/castConstraints.js";
import type * as domain_factDedupe from "../domain/factDedupe.js";
import type * as domain_orchestrate from "../domain/orchestrate.js";
import type * as facts from "../facts.js";
import type * as generation_avatar from "../generation/avatar.js";
import type * as generation_casting from "../generation/casting.js";
import type * as generation_context from "../generation/context.js";
import type * as generation_directorMeta from "../generation/directorMeta.js";
import type * as generation_helpers from "../generation/helpers.js";
import type * as generation_lifecycle from "../generation/lifecycle.js";
import type * as generation_memory from "../generation/memory.js";
import type * as generation_opening from "../generation/opening.js";
import type * as generation_options from "../generation/options.js";
import type * as generation_record from "../generation/record.js";
import type * as generation_runs from "../generation/runs.js";
import type * as generation_sampleLine from "../generation/sampleLine.js";
import type * as generation_snapshots from "../generation/snapshots.js";
import type * as generation_turn from "../generation/turn.js";
import type * as generation_validators from "../generation/validators.js";
import type * as http from "../http.js";
import type * as lib_aiSdkGateway from "../lib/aiSdkGateway.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_fakeGateway from "../lib/fakeGateway.js";
import type * as lib_fakeLanguageModel from "../lib/fakeLanguageModel.js";
import type * as lib_fakeMarkers from "../lib/fakeMarkers.js";
import type * as lib_gateway from "../lib/gateway.js";
import type * as lib_gatewayFactory from "../lib/gatewayFactory.js";
import type * as lib_ids from "../lib/ids.js";
import type * as lib_invariants from "../lib/invariants.js";
import type * as lib_modelRegistry from "../lib/modelRegistry.js";
import type * as lib_models from "../lib/models.js";
import type * as lib_patch from "../lib/patch.js";
import type * as lib_path from "../lib/path.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as lib_retry from "../lib/retry.js";
import type * as lib_text from "../lib/text.js";
import type * as lib_time from "../lib/time.js";
import type * as lib_tokenBudget from "../lib/tokenBudget.js";
import type * as lib_validators from "../lib/validators.js";
import type * as prompts_load from "../prompts/load.js";
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
  "compiler/blocks": typeof compiler_blocks;
  "compiler/compileCasting": typeof compiler_compileCasting;
  "compiler/compileDirectorMeta": typeof compiler_compileDirectorMeta;
  "compiler/compileMemory": typeof compiler_compileMemory;
  "compiler/compileRolePrompt": typeof compiler_compileRolePrompt;
  "compiler/types": typeof compiler_types;
  crons: typeof crons;
  directorNotes: typeof directorNotes;
  "domain/branchPlans": typeof domain_branchPlans;
  "domain/castConstraints": typeof domain_castConstraints;
  "domain/factDedupe": typeof domain_factDedupe;
  "domain/orchestrate": typeof domain_orchestrate;
  facts: typeof facts;
  "generation/avatar": typeof generation_avatar;
  "generation/casting": typeof generation_casting;
  "generation/context": typeof generation_context;
  "generation/directorMeta": typeof generation_directorMeta;
  "generation/helpers": typeof generation_helpers;
  "generation/lifecycle": typeof generation_lifecycle;
  "generation/memory": typeof generation_memory;
  "generation/opening": typeof generation_opening;
  "generation/options": typeof generation_options;
  "generation/record": typeof generation_record;
  "generation/runs": typeof generation_runs;
  "generation/sampleLine": typeof generation_sampleLine;
  "generation/snapshots": typeof generation_snapshots;
  "generation/turn": typeof generation_turn;
  "generation/validators": typeof generation_validators;
  http: typeof http;
  "lib/aiSdkGateway": typeof lib_aiSdkGateway;
  "lib/authz": typeof lib_authz;
  "lib/fakeGateway": typeof lib_fakeGateway;
  "lib/fakeLanguageModel": typeof lib_fakeLanguageModel;
  "lib/fakeMarkers": typeof lib_fakeMarkers;
  "lib/gateway": typeof lib_gateway;
  "lib/gatewayFactory": typeof lib_gatewayFactory;
  "lib/ids": typeof lib_ids;
  "lib/invariants": typeof lib_invariants;
  "lib/modelRegistry": typeof lib_modelRegistry;
  "lib/models": typeof lib_models;
  "lib/patch": typeof lib_patch;
  "lib/path": typeof lib_path;
  "lib/pricing": typeof lib_pricing;
  "lib/retry": typeof lib_retry;
  "lib/text": typeof lib_text;
  "lib/time": typeof lib_time;
  "lib/tokenBudget": typeof lib_tokenBudget;
  "lib/validators": typeof lib_validators;
  "prompts/load": typeof prompts_load;
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
