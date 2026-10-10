// 身份与授权 —— 用户上下文（演示期隐式单用户）。

export type ActorType = "user" | "agent" | "system";

export interface Actor {
  type: ActorType;
  id: string;
}

export interface UserContext {
  userId: string;
  actor: Actor;
}

/** 演示期唯一用户标识：来自服务端环境变量，绝不来自请求参数。 */
export function getDemoUserId(): string {
  return process.env.DEFAULT_OWNER_ID ?? "demo-user";
}

/**
 * 构建当前用户上下文。
 *
 * 演示期 actor 默认是 user。Phase G 接入 MCP / Agent 令牌后，actor 将由
 * "已验证的会话 / 令牌"解析而来（agent 令牌 → actor.type='agent'，actor.id=令牌 id），
 * 本函数签名保持不变，业务层无需改动。
 */
export function getUserContext(
  actor: Actor = { type: "user", id: getDemoUserId() },
): UserContext {
  return { userId: getDemoUserId(), actor };
}
