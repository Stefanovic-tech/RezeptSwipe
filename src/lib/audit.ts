import { execute } from "./db";

export async function logAdminAction(params: {
  actorUserId: number | null;
  action: string;
  targetUserId?: number | null;
  targetHouseholdId?: number | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await execute(
    `INSERT INTO admin_audit_log
       (actor_user_id, action, target_user_id, target_household_id, meta)
     VALUES (?, ?, ?, ?, ?)`,
    [
      params.actorUserId,
      params.action,
      params.targetUserId ?? null,
      params.targetHouseholdId ?? null,
      params.meta ? JSON.stringify(params.meta) : JSON.stringify({}),
    ]
  );
}
