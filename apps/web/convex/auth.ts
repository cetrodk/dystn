import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const verifyPin = mutation({
  args: { pin: v.string() },
  handler: async (_ctx, { pin }) => {
    const expected = process.env.APP_PIN || "4477";
    return { valid: pin === expected };
  },
});
