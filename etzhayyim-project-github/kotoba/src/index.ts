/**
 * github kotoba — barrel.
 *
 * Per ADR-2606011400. Public GitHub-data catalog on the etzhayyim substrate
 * (AT PDS records; no RW).
 *
 *   repo       : ingestRepo (uint stars/forks) / getRepo / listRepos (fullName+desc search)
 *   profile    : ingestProfile (accountType enum) / listProfiles (login+name search)
 *   issue      : ingestIssue (FK→repo, state enum) / listIssues
 *   membership : recordMembership (org+member FK→profile) / listMemberships
 *   coverage
 *
 * (c) MIXED SPLIT: the public crawled GitHub data (repos/profiles/issues/org
 * graph — open-data, external authority = github.com) migrates. Authenticated
 * `github-sync` of PRIVATE repos (token custody + private code) and
 * `commit-analysis` compute STAY etzhayyim via consent-capability — NOT in this package.
 */

export * from "./types.js";
export {
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
} from "./registry.js";
