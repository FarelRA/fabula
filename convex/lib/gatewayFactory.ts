import { AiSdkGateway } from "./aiSdkGateway";
import { FakeGateway } from "./fakeGateway";
import type { ModelGateway } from "./gateway";
import { isFakeMode } from "./modelRegistry";

/**
 * Gateway factory: the deterministic fake in fake mode (tests/CI/E2E),
 * the AI SDK gateway everywhere else. Turn streaming goes through the agent
 * component instead (same fake switch via resolveLanguageModel).
 */
export function getGateway(): ModelGateway {
  return isFakeMode() ? new FakeGateway() : new AiSdkGateway();
}
