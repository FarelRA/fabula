import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { DEFAULT_TEMPLATES } from "./templates";
import { templateVars } from "./registry";

/**
 * Template seeding (PLAN §7.8). Idempotent by (key, version): running it any
 * number of times converges to the same state. Public so a fresh dev,
 * self-host or CI deployment can bootstrap without CLI access.
 */

export const seedV1 = mutation({
  args: {},
  returns: v.object({ inserted: v.number(), active: v.number() }),
  handler: async (ctx) => {
    let inserted = 0;
    for (const template of DEFAULT_TEMPLATES) {
      const existing = await ctx.db
        .query("promptTemplates")
        .withIndex("by_key_version", (q) =>
          q.eq("key", template.key).eq("version", template.version),
        )
        .first();
      if (!existing) {
        await ctx.db.insert("promptTemplates", {
          key: template.key,
          version: template.version,
          content: template.content,
          vars: template.vars.length > 0 ? template.vars : templateVars(template.content),
          isActive: true,
          notes: template.notes,
          createdAt: Date.now(),
        });
        inserted += 1;
      } else {
        // Converge: pre-release v1 content edits update in place. After the
        // first public release, changes ship as NEW versions (PLAN §7.8).
        if (existing.content !== template.content || !existing.isActive) {
          await ctx.db.patch(existing._id, {
            content: template.content,
            vars:
              template.vars.length > 0 ? template.vars : templateVars(template.content),
            isActive: true,
            notes: template.notes,
          });
        }
      }
    }
    const all = await ctx.db.query("promptTemplates").collect();
    return { inserted, active: all.filter((row) => row.isActive).length };
  },
});

export const listActive = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("promptTemplates"),
      key: v.string(),
      version: v.number(),
      content: v.string(),
      vars: v.array(v.string()),
      notes: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("promptTemplates").collect();
    return rows
      .filter((row) => row.isActive)
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map((row) => ({
        _id: row._id,
        key: row.key,
        version: row.version,
        content: row.content,
        vars: row.vars,
        notes: row.notes,
      }));
  },
});
