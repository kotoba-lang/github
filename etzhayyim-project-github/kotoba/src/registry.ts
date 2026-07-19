/**
 * github kotoba — public repo + profile + issue + org-membership registries +
 * coverage. AT PDS records (no RW). Issues FK→repo; memberships FK→profile (org
 * + member). Public crawled GitHub data only; private-repo sync stays etzhayyim.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  ACCOUNT_TYPES,
  ISSUE_COLLECTION,
  ISSUE_STATES,
  MEMBERSHIP_COLLECTION,
  PROFILE_COLLECTION,
  REPO_COLLECTION,
  isUint,
  issueDidFor,
  issueRkey,
  membershipDidFor,
  membershipRkey,
  profileDidFor,
  profileRkey,
  repoDidFor,
  repoRkey,
  type CoverageInput,
  type CoverageOutput,
  type GetRepoInput,
  type GetRepoOutput,
  type IngestIssueInput,
  type IngestIssueOutput,
  type IngestProfileInput,
  type IngestProfileOutput,
  type IngestRepoInput,
  type IngestRepoOutput,
  type IssueRecord,
  type IssueView,
  type ListIssuesInput,
  type ListIssuesOutput,
  type ListMembershipsInput,
  type ListMembershipsOutput,
  type ListProfilesInput,
  type ListProfilesOutput,
  type ListReposInput,
  type ListReposOutput,
  type MembershipRecord,
  type MembershipView,
  type ProfileRecord,
  type ProfileView,
  type RecordMembershipInput,
  type RecordMembershipOutput,
  type RepoRecord,
  type RepoView,
} from "./types.js";

const PAGE_LIMIT = 100;
const DEFAULT_MAX_SCAN = 10_000;

async function exists(e: Etzhayyim, collection: string, rkey: string): Promise<boolean> {
  const resp = await e.read({ collection, rkey }).catch(() => ({ records: [] }));
  return Boolean(resp.records[0]?.value);
}

async function scanAll<T>(e: Etzhayyim, collection: string, maxScan: number, onRow: (v: T) => void): Promise<number> {
  let cursor: string | undefined;
  let scanned = 0;
  while (scanned < maxScan) {
    const page = await e.read<T>({ collection, cursor, limit: PAGE_LIMIT });
    for (const r of page.records) {
      if (scanned >= maxScan) break;
      onRow(r.value);
      scanned += 1;
    }
    if (scanned >= maxScan || !page.cursor || page.records.length < PAGE_LIMIT) break;
    cursor = page.cursor;
  }
  return scanned;
}

// ─── Repo ───────────────────────────────────────────────────────────

export async function ingestRepo(e: Etzhayyim, input: IngestRepoInput): Promise<IngestRepoOutput> {
  if (!input.repoId || !input.owner || !input.name || !input.fullName) return { status: "rejected", error: "missingRequiredFields" };
  if (!isUint(input.stars) || !isUint(input.forks)) return { status: "rejected", error: "starsForksMustBeUint" };
  const rkey = repoRkey(input.repoId);
  const existing = await e.read<RepoRecord>({ collection: REPO_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", repoUri: existing.records[0].uri, did: existing.records[0].value.did, repoId: input.repoId };
  }
  const did = repoDidFor(input.repoId);
  const record: RepoRecord = {
    did,
    repoId: input.repoId,
    owner: input.owner,
    name: input.name,
    fullName: input.fullName,
    description: input.description,
    primaryLanguage: input.primaryLanguage,
    stars: input.stars,
    forks: input.forks,
    topics: input.topics,
    url: input.url,
    sourceUrl: input.sourceUrl,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({ collection: REPO_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "ingested", repoUri: receipt.uri, did, repoId: input.repoId };
}

export async function getRepo(e: Etzhayyim, input: GetRepoInput): Promise<GetRepoOutput> {
  if (!input.repoId) return { error: "invalidRepoId" };
  const resp = await e.read<RepoRecord>({ collection: REPO_COLLECTION, rkey: repoRkey(input.repoId) }).catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  return { repo: { ...r.value, repoUri: r.uri } };
}

export async function listRepos(e: Etzhayyim, input: ListReposInput = {}): Promise<ListReposOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<RepoRecord>({ collection: REPO_COLLECTION, cursor: input.cursor, limit });
  const q = input.q?.toLowerCase();
  const items: RepoView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.owner && v.owner !== input.owner) return false;
      if (input.primaryLanguage && v.primaryLanguage !== input.primaryLanguage) return false;
      if (q) {
        const hay = [v.fullName, v.description ?? ""].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((r) => ({ ...r.value, repoUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Profile ────────────────────────────────────────────────────────

export async function ingestProfile(e: Etzhayyim, input: IngestProfileInput): Promise<IngestProfileOutput> {
  if (!input.login) return { status: "rejected", error: "missingLogin" };
  if (!ACCOUNT_TYPES.has(input.accountType)) return { status: "rejected", error: "invalidAccountType" };
  if (input.publicRepoCount != null && !isUint(input.publicRepoCount)) return { status: "rejected", error: "publicRepoCountMustBeUint" };
  if (input.followerCount != null && !isUint(input.followerCount)) return { status: "rejected", error: "followerCountMustBeUint" };
  const rkey = profileRkey(input.login);
  const existing = await e.read<ProfileRecord>({ collection: PROFILE_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", profileUri: existing.records[0].uri, did: existing.records[0].value.did, login: input.login };
  }
  const did = profileDidFor(input.login);
  const record: ProfileRecord = {
    did,
    login: input.login,
    accountType: input.accountType,
    name: input.name,
    company: input.company,
    location: input.location,
    publicRepoCount: input.publicRepoCount,
    followerCount: input.followerCount,
    url: input.url,
    sourceUrl: input.sourceUrl,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({ collection: PROFILE_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "ingested", profileUri: receipt.uri, did, login: input.login };
}

export async function listProfiles(e: Etzhayyim, input: ListProfilesInput = {}): Promise<ListProfilesOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<ProfileRecord>({ collection: PROFILE_COLLECTION, cursor: input.cursor, limit });
  const q = input.q?.toLowerCase();
  const items: ProfileView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.accountType && v.accountType !== input.accountType) return false;
      if (q) {
        const hay = [v.login, v.name ?? ""].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((r) => ({ ...r.value, profileUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Issue ──────────────────────────────────────────────────────────

export async function ingestIssue(e: Etzhayyim, input: IngestIssueInput): Promise<IngestIssueOutput> {
  if (!input.issueId || !input.repoId || !input.title) return { status: "rejected", error: "missingRequiredFields" };
  if (!isUint(input.number)) return { status: "rejected", error: "numberMustBeUint" };
  if (!ISSUE_STATES.has(input.state)) return { status: "rejected", error: "invalidState" };
  if (!(await exists(e, REPO_COLLECTION, repoRkey(input.repoId)))) {
    return { status: "repoNotFound", error: `repoNotFound:${input.repoId}` };
  }
  const rkey = issueRkey(input.issueId);
  const existing = await e.read<IssueRecord>({ collection: ISSUE_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", issueUri: existing.records[0].uri, did: existing.records[0].value.did, issueId: input.issueId };
  }
  const did = issueDidFor(input.issueId);
  const record: IssueRecord = {
    did,
    issueId: input.issueId,
    repoId: input.repoId,
    number: input.number,
    title: input.title,
    state: input.state,
    authorLogin: input.authorLogin,
    url: input.url,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({ collection: ISSUE_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "ingested", issueUri: receipt.uri, did, issueId: input.issueId };
}

export async function listIssues(e: Etzhayyim, input: ListIssuesInput = {}): Promise<ListIssuesOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<IssueRecord>({ collection: ISSUE_COLLECTION, cursor: input.cursor, limit });
  const items: IssueView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.repoId && v.repoId !== input.repoId) return false;
      if (input.state && v.state !== input.state) return false;
      if (input.authorLogin && v.authorLogin !== input.authorLogin) return false;
      return true;
    })
    .map((r) => ({ ...r.value, issueUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Membership (org → member edge) ─────────────────────────────────

export async function recordMembership(e: Etzhayyim, input: RecordMembershipInput): Promise<RecordMembershipOutput> {
  if (!input.membershipId || !input.orgLogin || !input.memberLogin) return { status: "rejected", error: "missingRequiredFields" };
  if (!(await exists(e, PROFILE_COLLECTION, profileRkey(input.orgLogin)))) {
    return { status: "orgNotFound", error: `orgNotFound:${input.orgLogin}` };
  }
  if (!(await exists(e, PROFILE_COLLECTION, profileRkey(input.memberLogin)))) {
    return { status: "memberNotFound", error: `memberNotFound:${input.memberLogin}` };
  }
  const rkey = membershipRkey(input.membershipId);
  const existing = await e.read<MembershipRecord>({ collection: MEMBERSHIP_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", membershipUri: existing.records[0].uri, did: existing.records[0].value.did, membershipId: input.membershipId };
  }
  const did = membershipDidFor(input.membershipId);
  const record: MembershipRecord = {
    did,
    membershipId: input.membershipId,
    orgLogin: input.orgLogin,
    memberLogin: input.memberLogin,
    role: input.role,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({ collection: MEMBERSHIP_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "recorded", membershipUri: receipt.uri, did, membershipId: input.membershipId };
}

export async function listMemberships(e: Etzhayyim, input: ListMembershipsInput = {}): Promise<ListMembershipsOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<MembershipRecord>({ collection: MEMBERSHIP_COLLECTION, cursor: input.cursor, limit });
  const items: MembershipView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.orgLogin && v.orgLogin !== input.orgLogin) return false;
      if (input.memberLogin && v.memberLogin !== input.memberLogin) return false;
      return true;
    })
    .map((r) => ({ ...r.value, membershipUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Coverage ───────────────────────────────────────────────────────

export async function coverage(e: Etzhayyim, input: CoverageInput = {}): Promise<CoverageOutput> {
  const maxScan = Math.min(input.maxScan ?? DEFAULT_MAX_SCAN, DEFAULT_MAX_SCAN);
  const reposByLanguage: Record<string, number> = {};
  const profilesByType: Record<string, number> = {};
  const repoCount = await scanAll<RepoRecord>(e, REPO_COLLECTION, maxScan, (v) => {
    if (v.primaryLanguage) reposByLanguage[v.primaryLanguage] = (reposByLanguage[v.primaryLanguage] ?? 0) + 1;
  });
  const profileCount = await scanAll<ProfileRecord>(e, PROFILE_COLLECTION, maxScan, (v) => {
    profilesByType[v.accountType] = (profilesByType[v.accountType] ?? 0) + 1;
  });
  const issueCount = await scanAll<IssueRecord>(e, ISSUE_COLLECTION, maxScan, () => {});
  const membershipCount = await scanAll<MembershipRecord>(e, MEMBERSHIP_COLLECTION, maxScan, () => {});
  return {
    repoCount,
    profileCount,
    issueCount,
    membershipCount,
    reposByLanguage,
    profilesByType,
    truncated: repoCount >= maxScan || profileCount >= maxScan || issueCount >= maxScan || membershipCount >= maxScan,
  };
}
