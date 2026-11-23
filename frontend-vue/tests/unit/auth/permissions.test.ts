import { describe, expect, it } from "vitest";
import { userSchema } from "@/core/auth/types";
import { hasPermission, PERMISSIONS } from "@/core/auth/permissions";
import { probeSession } from "@/core/auth/session";

const base = {
  id: "viewer",
  email: "viewer@example.test",
  system_role: "user",
};
describe("current Gateway user contract", () => {
  it("keeps resolved, null and absent effective route permissions distinct", () => {
    expect(userSchema.parse({ ...base, permissions: [] })).toHaveProperty(
      "permissions",
      [],
    );
    expect(
      userSchema.parse({ ...base, permissions: ["runs:create"] }),
    ).toHaveProperty("permissions", ["runs:create"]);
    expect(userSchema.parse({ ...base, permissions: null })).toHaveProperty(
      "permissions",
      null,
    );
    expect(userSchema.parse(base)).not.toHaveProperty("permissions");
  });
  it("accepts a nonempty custom role through the actual session decoder", async () => {
    const session = await probeSession((async () =>
      Response.json({
        ...base,
        system_role: "researcher",
        permissions: ["runs:create"],
      })) as typeof fetch);
    expect(session).toMatchObject({
      tag: "authenticated",
      user: { system_role: "researcher", permissions: ["runs:create"] },
    });
    expect(userSchema.safeParse({ ...base, system_role: "" }).success).toBe(
      false,
    );
  });
});

for (const permission of Object.values(PERMISSIONS)) {
  it(`uses the current effective grant list for ${permission}`, () => {
    expect(hasPermission({ permissions: [permission] }, permission)).toBe(true);
    expect(hasPermission({ permissions: [] }, permission)).toBe(false);
    for (const user of [null, undefined, {}, { permissions: null }])
      expect(hasPermission(user, permission)).toBe(true);
  });
}
