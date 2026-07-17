export const projectRoles = [
  "admin",
  "commissioning_manager",
  "reviewer",
  "field_engineer",
  "approver",
  "viewer",
  "scheduler"
] as const;

export type ProjectRole = (typeof projectRoles)[number];

export type Permission =
  | "project:manage"
  | "source:upload"
  | "requirement:review"
  | "evidence:capture"
  | "finding:manage"
  | "gate:approve"
  | "schedule:manage"
  | "audit:view";

const grants: Record<ProjectRole, readonly Permission[]> = {
  admin: ["project:manage", "source:upload", "requirement:review", "evidence:capture", "finding:manage", "gate:approve", "schedule:manage", "audit:view"],
  commissioning_manager: ["source:upload", "requirement:review", "evidence:capture", "finding:manage", "schedule:manage", "audit:view"],
  reviewer: ["requirement:review", "audit:view"],
  field_engineer: ["evidence:capture"],
  approver: ["gate:approve", "audit:view"],
  viewer: ["audit:view"],
  scheduler: ["schedule:manage", "audit:view"]
};

export function can(role: ProjectRole, permission: Permission) {
  return grants[role].includes(permission);
}

export interface AuthIdentity {
  userId: string;
  email: string;
  displayName: string;
  role: ProjectRole;
  provider: "development" | "credentials" | "clerk";
}

export const developmentIdentity: AuthIdentity = {
  userId: "dev-commissioning-manager",
  email: "manager@pramana.local",
  displayName: "Aarav Mehta",
  role: "commissioning_manager",
  provider: "development"
};
