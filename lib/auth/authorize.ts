import type { UserContext } from "./context";

export type AuthErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN_RESOURCE"
  | "FORBIDDEN_OPERATION"
  | "USE_PROPOSAL_FLOW";

export class AuthorizationError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * 资源归属检查：资源必须属于当前用户上下文。
 * 所有查询 / 更新 / 删除都必须先过这一关。
 */
export function assertOwner(
  ctx: UserContext,
  resourceUserId: string | null | undefined,
): void {
  if (resourceUserId !== ctx.userId) {
    throw new AuthorizationError("FORBIDDEN_RESOURCE", "无权访问该资源。");
  }
}

/**
 * user_edit 类操作只允许 user 主体。
 * Agent 主体调用应被拒绝并改走提议流程（对应 403 USE_PROPOSAL_FLOW）。
 */
export function requireUserActor(ctx: UserContext): void {
  if (ctx.actor.type !== "user") {
    throw new AuthorizationError("USE_PROPOSAL_FLOW", "该操作需通过提议流程。");
  }
}
