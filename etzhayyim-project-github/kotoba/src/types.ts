/**
 * github kotoba — public GitHub-data catalog: repo + profile + issue + org
 * membership.
 *
 * Per ADR-2606011400 (Consensys pattern) + ADR-2605172400 (3-axis OR-test).
 *
 * SPLIT (this app is (c) mixed):
 *   PUBLIC (THIS PACKAGE) — crawled PUBLIC GitHub data: public repositories,
 *   user/org profiles, public issues, org→member graph. These cite an external
 *   authority (github.com) and are open-data — no PII custody (public profiles),
 *   no settlement, no liability. → migrated to etzhayyim front (AT PDS records).
 *
 *   PRIVATE (STAYS etzhayyim, NOT in this package) — authenticated `github-sync` of a
 *   user's PRIVATE repos (GitHub token custody + private source code = Custody)
 *   and `commit-analysis` (derived compute). Consumed via consent-capability.
 *
 * AT-Lexicon: no float. Stars / forks / counts are integers.
 *
 * Identity hierarchy:
 *   did:web:github.etzhayyim.com                            — controller
 *   did:web:github.etzhayyim.com:repo:{repoId}              — a public repo
 *   did:web:github.etzhayyim.com:profile:{login}            — a public profile
 *   did:web:github.etzhayyim.com:issue:{issueId}            — a public issue
 *   did:web:github.etzhayyim.com:member:{membershipId}      — an org-membership edge
 */

export const GITHUB_DID_PREFIX = "did:web:github.etzhayyim.com:" as const;

export const REPO_COLLECTION = "com.etzhayyim.apps.github.repo";
export const PROFILE_COLLECTION = "com.etzhayyim.apps.github.profile";
export const ISSUE_COLLECTION = "com.etzhayyim.apps.github.issue";
export const MEMBERSHIP_COLLECTION = "com.etzhayyim.apps.github.membership";

// ─── Enums ──────────────────────────────────────────────────────────

export type AccountType = "user" | "organization";
export type IssueState = "open" | "closed";

export const ACCOUNT_TYPES: ReadonlySet<string> = new Set(["user", "organization"]);
export const ISSUE_STATES: ReadonlySet<string> = new Set(["open", "closed"]);

// ─── Repo (public repository) ───────────────────────────────────────

export interface RepoRecord {
  did: string;
  repoId: string;
  owner: string;
  name: string;
  fullName: string;
  description?: string;
  primaryLanguage?: string;
  stars: number;
  forks: number;
  topics?: string[];
  url?: string;
  sourceUrl?: string;
  createdAt: string;
}
export interface RepoView extends RepoRecord {
  repoUri: string;
}
export interface IngestRepoInput {
  repoId: string;
  owner: string;
  name: string;
  fullName: string;
  stars: number;
  forks: number;
  description?: string;
  primaryLanguage?: string;
  topics?: string[];
  url?: string;
  sourceUrl?: string;
}
export interface IngestRepoOutput {
  status: "ingested" | "alreadyExists" | "rejected";
  repoUri?: string;
  did?: string;
  repoId?: string;
  error?: string;
}
export interface GetRepoInput {
  repoId: string;
}
export interface GetRepoOutput {
  repo?: RepoView;
  error?: string;
}
export interface ListReposInput {
  owner?: string;
  primaryLanguage?: string;
  /** App-layer substring search over fullName + description. */
  q?: string;
  limit?: number;
  cursor?: string;
}
export interface ListReposOutput {
  items: RepoView[];
  cursor?: string;
  total: number;
}

// ─── Profile (public user / org) ────────────────────────────────────

export interface ProfileRecord {
  did: string;
  login: string;
  accountType: AccountType;
  name?: string;
  company?: string;
  location?: string;
  publicRepoCount?: number;
  followerCount?: number;
  url?: string;
  sourceUrl?: string;
  createdAt: string;
}
export interface ProfileView extends ProfileRecord {
  profileUri: string;
}
export interface IngestProfileInput {
  login: string;
  accountType: AccountType;
  name?: string;
  company?: string;
  location?: string;
  publicRepoCount?: number;
  followerCount?: number;
  url?: string;
  sourceUrl?: string;
}
export interface IngestProfileOutput {
  status: "ingested" | "alreadyExists" | "rejected";
  profileUri?: string;
  did?: string;
  login?: string;
  error?: string;
}
export interface ListProfilesInput {
  accountType?: AccountType;
  q?: string;
  limit?: number;
  cursor?: string;
}
export interface ListProfilesOutput {
  items: ProfileView[];
  cursor?: string;
  total: number;
}

// ─── Issue (public issue, FK→repo) ──────────────────────────────────

export interface IssueRecord {
  did: string;
  issueId: string;
  /** FK → repo. */
  repoId: string;
  number: number;
  title: string;
  state: IssueState;
  authorLogin?: string;
  url?: string;
  createdAt: string;
}
export interface IssueView extends IssueRecord {
  issueUri: string;
}
export interface IngestIssueInput {
  issueId: string;
  repoId: string;
  number: number;
  title: string;
  state: IssueState;
  authorLogin?: string;
  url?: string;
}
export interface IngestIssueOutput {
  status: "ingested" | "alreadyExists" | "rejected" | "repoNotFound";
  issueUri?: string;
  did?: string;
  issueId?: string;
  error?: string;
}
export interface ListIssuesInput {
  repoId?: string;
  state?: IssueState;
  authorLogin?: string;
  limit?: number;
  cursor?: string;
}
export interface ListIssuesOutput {
  items: IssueView[];
  cursor?: string;
  total: number;
}

// ─── Membership (org→member edge, FK both → profile) ────────────────

export interface MembershipRecord {
  did: string;
  membershipId: string;
  /** FK → profile (org login). */
  orgLogin: string;
  /** FK → profile (member login). */
  memberLogin: string;
  role?: string;
  createdAt: string;
}
export interface MembershipView extends MembershipRecord {
  membershipUri: string;
}
export interface RecordMembershipInput {
  membershipId: string;
  orgLogin: string;
  memberLogin: string;
  role?: string;
}
export interface RecordMembershipOutput {
  status: "recorded" | "alreadyExists" | "rejected" | "orgNotFound" | "memberNotFound";
  membershipUri?: string;
  did?: string;
  membershipId?: string;
  error?: string;
}
export interface ListMembershipsInput {
  orgLogin?: string;
  memberLogin?: string;
  limit?: number;
  cursor?: string;
}
export interface ListMembershipsOutput {
  items: MembershipView[];
  cursor?: string;
  total: number;
}

// ─── Coverage ───────────────────────────────────────────────────────

export interface CoverageInput {
  maxScan?: number;
}
export interface CoverageOutput {
  repoCount?: number;
  profileCount?: number;
  issueCount?: number;
  membershipCount?: number;
  reposByLanguage?: Record<string, number>;
  profilesByType?: Record<string, number>;
  truncated?: boolean;
  error?: string;
}

// ─── Validation + helpers ───────────────────────────────────────────

export function isUint(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0;
}

export function repoDidFor(id: string): string {
  return `${GITHUB_DID_PREFIX}repo:${id.toLowerCase()}`;
}
export function repoRkey(id: string): string {
  return `repo-${id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
export function profileDidFor(login: string): string {
  return `${GITHUB_DID_PREFIX}profile:${login.toLowerCase()}`;
}
export function profileRkey(login: string): string {
  return `profile-${login.toLowerCase()}`;
}
export function issueDidFor(id: string): string {
  return `${GITHUB_DID_PREFIX}issue:${id.toLowerCase()}`;
}
export function issueRkey(id: string): string {
  return `issue-${id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
export function membershipDidFor(id: string): string {
  return `${GITHUB_DID_PREFIX}member:${id.toLowerCase()}`;
}
export function membershipRkey(id: string): string {
  return `member-${id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
