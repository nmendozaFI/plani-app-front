// ── Auth Types ───────────────────────────────────────────────
export type UserRole = "USER" | "ADMIN";

export type User = {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
};

// ── Domain Types ─────────────────────────────────────────────
export * from "./actions";
export * from "./empresa";
export * from "./restriccion";
export * from "./frecuencia";
export * from "./calendario";
export * from "./importacion";
export * from "./taller";