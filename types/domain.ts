export type Role = "member" | "leader" | "admin";

export type UserProfile = {
  userId: string;
  displayName: string;
  createdAt: string;
};

export type Group = {
  groupId: string;
  name: string;
  joinCodeHash: string;
  leaderUserIds: string[];
  activeProgramId?: string;
  createdAt: string;
};

export type GroupMembership = {
  groupId: string;
  userId: string;
  role: Role;
  displayName: string;
  joinedAt: string;
};

export type SectionProgress = {
  userId: string;
  groupId: string;
  programId: string;
  weekNumber: number;
  dayNumber: number;
  sectionId: string;
  completed: boolean;
  pointsEarned: number;
  updatedAt: string;
};

export type EncryptedAnswer = {
  userId: string;
  groupId: string;
  programId: string;
  promptId: string;
  weekNumber: number;
  dayNumber: number;
  sectionId: string;
  ciphertext: string;
  iv: string;
  salt: string;
  keyDerivation: "PBKDF2-SHA-256";
  iterations: number;
  algorithm: "AES-GCM";
  version: 1;
  updatedAt: string;
};

export type UserScore = {
  userId: string;
  groupId: string;
  programId: string;
  weekNumber: number;
  weeklyScore: number;
  cumulativeScore: number;
  streak: number;
  updatedAt: string;
};
