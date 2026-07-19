import { describe, it, expect, beforeEach } from "vitest";
import { MockEtzhayyim } from "@etzhayyim/sdk-mock";
import {
  ingestRepo,
  getRepo,
  listRepos,
  ingestProfile,
  listProfiles,
  ingestIssue,
  listIssues,
  recordMembership,
  listMemberships,
  coverage,
} from "../src/index.js";

const SRC = "https://github.com/example";

describe("github kotoba", () => {
  let e: any;
  beforeEach(() => {
    e = new MockEtzhayyim({ did: "did:web:github.etzhayyim.com" });
  });

  describe("repo + profile catalog", () => {
    it("ingests repos (uint stars/forks), reads, lists, searches", async () => {
      expect((await ingestRepo(e, { repoId: "torvalds/linux", owner: "torvalds", name: "linux", fullName: "torvalds/linux", primaryLanguage: "C", stars: 180000, forks: 52000, topics: ["kernel"], sourceUrl: SRC })).status).toBe("ingested");
      expect((await getRepo(e, { repoId: "torvalds/linux" })).repo?.stars).toBe(180000);
      expect((await ingestRepo(e, { repoId: "x/y", owner: "x", name: "y", fullName: "x/y", stars: -1, forks: 0 })).status).toBe("rejected"); // uint
      await ingestRepo(e, { repoId: "denoland/deno", owner: "denoland", name: "deno", fullName: "denoland/deno", primaryLanguage: "Rust", stars: 90000, forks: 5000 });
      expect((await listRepos(e, { primaryLanguage: "C" })).total).toBe(1);
      expect((await listRepos(e, { q: "deno" })).total).toBe(1);
    });
    it("ingests profiles (accountType validated)", async () => {
      expect((await ingestProfile(e, { login: "torvalds", accountType: "user", name: "Linus Torvalds", followerCount: 200000 })).status).toBe("ingested");
      expect((await ingestProfile(e, { login: "x", accountType: "bot" as any })).status).toBe("rejected");
      expect((await ingestProfile(e, { login: "denoland", accountType: "organization", publicRepoCount: 60 })).status).toBe("ingested");
      expect((await listProfiles(e, { accountType: "organization" })).total).toBe(1);
      expect((await listProfiles(e, { q: "linus" })).total).toBe(1);
    });
  });

  describe("issues FK→repo + org membership FK→profile", () => {
    beforeEach(async () => {
      await ingestRepo(e, { repoId: "denoland/deno", owner: "denoland", name: "deno", fullName: "denoland/deno", stars: 1, forks: 1 });
      await ingestProfile(e, { login: "denoland", accountType: "organization" });
      await ingestProfile(e, { login: "ry", accountType: "user" });
    });
    it("ingests issues (FK→repo, uint number, state validated), rejects missing repo", async () => {
      expect((await ingestIssue(e, { issueId: "deno-1", repoId: "denoland/deno", number: 42, title: "bug", state: "open", authorLogin: "ry" })).status).toBe("ingested");
      expect((await ingestIssue(e, { issueId: "deno-X", repoId: "denoland/deno", number: 1, title: "x", state: "merged" as any })).status).toBe("rejected"); // state
      expect((await ingestIssue(e, { issueId: "deno-N", repoId: "denoland/deno", number: 2.5 as any, title: "x", state: "open" })).status).toBe("rejected"); // number
      expect((await ingestIssue(e, { issueId: "g-1", repoId: "ghost/repo", number: 1, title: "g", state: "open" })).status).toBe("repoNotFound");
      expect((await listIssues(e, { repoId: "denoland/deno", state: "open" })).total).toBe(1);
    });
    it("records org membership (both FK→profile), rejects missing org/member", async () => {
      expect((await recordMembership(e, { membershipId: "m-1", orgLogin: "denoland", memberLogin: "ry", role: "admin" })).status).toBe("recorded");
      expect((await recordMembership(e, { membershipId: "m-O", orgLogin: "ghost-org", memberLogin: "ry" })).status).toBe("orgNotFound");
      expect((await recordMembership(e, { membershipId: "m-M", orgLogin: "denoland", memberLogin: "ghost-user" })).status).toBe("memberNotFound");
      expect((await listMemberships(e, { orgLogin: "denoland" })).total).toBe(1);
    });
    it("coverage rolls up by language / account type", async () => {
      await ingestIssue(e, { issueId: "i-1", repoId: "denoland/deno", number: 1, title: "t", state: "closed" });
      await recordMembership(e, { membershipId: "m-1", orgLogin: "denoland", memberLogin: "ry" });
      const cov = await coverage(e);
      expect(cov.repoCount).toBe(1);
      expect(cov.profileCount).toBe(2);
      expect(cov.issueCount).toBe(1);
      expect(cov.membershipCount).toBe(1);
      expect(cov.profilesByType?.organization).toBe(1);
      expect(cov.profilesByType?.user).toBe(1);
    });
  });
});
