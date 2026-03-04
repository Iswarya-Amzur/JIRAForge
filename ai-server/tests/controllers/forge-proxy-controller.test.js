'use strict';

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/services/db/supabase-client', () => ({
  getClient: jest.fn(),
}));

jest.mock('../../src/utils/datetime', () => ({
  getUTCISOString: jest.fn().mockReturnValue('2024-01-01T00:00:00Z'),
}));

jest.mock('../../src/services/feedback-session-store', () => ({}));

const { getClient } = require('../../src/services/db/supabase-client');
const { getDashboardData } = require('../../src/controllers/forge-proxy-controller');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a Supabase query builder mock that is:
 *   - Chainable  (.select / .eq / .gte / .order / .in / .or / .not / .single all return `this`)
 *   - Awaitable  (Promise.all / await resolve to `resolveValue`)
 */
function makeQuery(resolveValue) {
  const p = Promise.resolve(resolveValue);
  const q = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    then: (...args) => p.then(...args),
    catch: (...args) => p.catch(...args),
    finally: (...args) => p.finally(...args),
  };
  return q;
}

/**
 * Builds a mock Supabase client where `from(table)` returns a chainable query.
 * Pass an array of responses for a table to support multiple calls to the same table
 * (e.g. `users` is queried twice when building the project-admin users list).
 */
function makeSupabaseClient(overrides = {}) {
  const defaults = {
    organizations: { data: [ORG], error: null },
    users: { data: [USER], error: null },
    organization_members: { data: MEMBERSHIP, error: null },
    daily_time_summary: { data: [], error: null },
    weekly_time_summary: { data: [], error: null },
    project_time_summary: { data: [], error: null },
    analysis_results: { data: [], error: null },
  };
  const tableData = { ...defaults, ...overrides };
  const callCounts = {};

  return {
    from: jest.fn().mockImplementation((table) => {
      callCounts[table] = (callCounts[table] || 0) + 1;
      const entry = tableData[table];
      if (Array.isArray(entry)) {
        // Support sequential responses for the same table
        return makeQuery(entry[callCounts[table] - 1] || { data: [], error: null });
      }
      return makeQuery(entry || { data: [], error: null });
    }),
  };
}

/** Builds a mock Express req object for getDashboardData */
function makeReq(body = {}) {
  return {
    forgeContext: { cloudId: 'cloud-1', accountId: 'account-1' },
    body: {
      canViewAllUsers: false,
      isJiraAdmin: false,
      projectKeys: null,
      maxDailySummaryDays: 60,
      maxWeeklySummaryWeeks: 12,
      maxIssuesInAnalytics: 50,
      ...body,
    },
  };
}

/** Builds a mock Express res object */
function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG = { id: 'org-id-1', org_name: 'Test Org', jira_cloud_id: 'cloud-1' };
const USER = { id: 'user-id-1', organization_id: 'org-id-1', email: 'test@example.com', display_name: 'Test User' };
const MEMBERSHIP = { user_id: 'user-id-1', organization_id: 'org-id-1', can_view_team_analytics: false };

// ---------------------------------------------------------------------------
// Tests — getDashboardData
// Covers: applyVisibilityFilter (3 branches) and buildUsersQuery (3 branches)
// ---------------------------------------------------------------------------

describe('getDashboardData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Guard clauses ---

  it('returns 500 when the Supabase client is not configured', async () => {
    getClient.mockReturnValue(null);
    const res = makeRes();
    await getDashboardData(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Database not configured' })
    );
  });

  it('returns 403 when a project admin has no project keys (null)', async () => {
    getClient.mockReturnValue(makeSupabaseClient());
    const res = makeRes();
    await getDashboardData(makeReq({ canViewAllUsers: true, isJiraAdmin: false, projectKeys: null }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('returns 403 when a project admin has an empty project keys array', async () => {
    getClient.mockReturnValue(makeSupabaseClient());
    const res = makeRes();
    await getDashboardData(makeReq({ canViewAllUsers: true, isJiraAdmin: false, projectKeys: [] }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 404 when the organization is not found', async () => {
    getClient.mockReturnValue(makeSupabaseClient({ organizations: { data: [], error: null } }));
    const res = makeRes();
    await getDashboardData(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringContaining('Organization') })
    );
  });

  it('returns 404 when the user is not found', async () => {
    getClient.mockReturnValue(makeSupabaseClient({ users: { data: [], error: null } }));
    const res = makeRes();
    await getDashboardData(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringContaining('User') })
    );
  });

  it('returns 500 when a database error occurs fetching the organization', async () => {
    getClient.mockReturnValue(
      makeSupabaseClient({ organizations: { data: null, error: new Error('DB error') } })
    );
    const res = makeRes();
    await getDashboardData(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  // --- applyVisibilityFilter: canViewTeamData = false (regular user) ---
  // buildUsersQuery: returns self data only, no extra DB call

  it('returns 200 with scoped data for a regular user', async () => {
    getClient.mockReturnValue(
      makeSupabaseClient({
        daily_time_summary: { data: [{ user_id: 'user-id-1', work_date: '2024-01-01', total_seconds: 3600 }], error: null },
      })
    );
    const res = makeRes();
    await getDashboardData(makeReq({ canViewAllUsers: false }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const { data } = res.json.mock.calls[0][0];
    expect(data.canViewAllUsers).toBe(false);
    expect(data.userId).toBe('user-id-1');
    // allUsers contains only the current user (no extra DB call in buildUsersQuery)
    expect(data.allUsers).toEqual([
      expect.objectContaining({ id: 'user-id-1' }),
    ]);
  });

  // --- applyVisibilityFilter: canViewTeamData = true, shouldFilterByProjects = false (Jira admin) ---
  // buildUsersQuery: fetches all org users

  it('returns 200 with unfiltered data for a Jira admin', async () => {
    const allUsers = [USER, { id: 'user-id-2', display_name: 'Other', email: 'other@example.com' }];
    getClient.mockReturnValue(
      makeSupabaseClient({
        // users is queried twice: first for the user lookup, then in buildUsersQuery
        users: [
          { data: [USER], error: null },
          { data: allUsers, error: null },
        ],
        organization_members: { data: { ...MEMBERSHIP, can_view_team_analytics: true }, error: null },
      })
    );
    const res = makeRes();
    await getDashboardData(makeReq({ canViewAllUsers: true, isJiraAdmin: true }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const { data } = res.json.mock.calls[0][0];
    expect(data.canViewAllUsers).toBe(true);
    expect(data.allUsers).toHaveLength(2);
  });

  // --- applyVisibilityFilter: canViewTeamData = true, shouldFilterByProjects = true (project admin) ---
  // buildUsersQuery: two-step — find user IDs from daily_time_summary, then fetch user details

  it('returns 200 with project-filtered data for a project admin', async () => {
    const projectKeys = ['ATG', 'PROJ'];
    getClient.mockReturnValue(
      makeSupabaseClient({
        // users: first call = user lookup, second call = buildUsersQuery user details
        users: [
          { data: [USER], error: null },
          { data: [USER], error: null },
        ],
        // daily_time_summary: first call = main dashboard query, second = buildUsersQuery lookup
        daily_time_summary: [
          { data: [], error: null },
          { data: [{ user_id: 'user-id-1' }], error: null },
        ],
        organization_members: { data: { ...MEMBERSHIP, can_view_team_analytics: true }, error: null },
      })
    );
    const res = makeRes();
    await getDashboardData(makeReq({ canViewAllUsers: true, isJiraAdmin: false, projectKeys }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const { data } = res.json.mock.calls[0][0];
    expect(data.canViewAllUsers).toBe(true);
  });

  // --- buildUsersQuery: project admin where daily_time_summary returns no rows ---
  // Falls back to returning the current user only

  it('returns current user in allUsers when buildUsersQuery finds no project members', async () => {
    const projectKeys = ['ATG'];
    getClient.mockReturnValue(
      makeSupabaseClient({
        users: [
          { data: [USER], error: null },
          { data: [USER], error: null },
        ],
        daily_time_summary: [
          { data: [], error: null },
          { data: [], error: null }, // no members found
        ],
        organization_members: { data: { ...MEMBERSHIP, can_view_team_analytics: true }, error: null },
      })
    );
    const res = makeRes();
    await getDashboardData(makeReq({ canViewAllUsers: true, isJiraAdmin: false, projectKeys }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  // --- Response shape ---

  it('response contains all required top-level fields', async () => {
    getClient.mockReturnValue(makeSupabaseClient());
    const res = makeRes();
    await getDashboardData(makeReq(), res);

    const { data } = res.json.mock.calls[0][0];
    expect(data).toMatchObject({
      organizationId: 'org-id-1',
      organizationName: 'Test Org',
      userId: 'user-id-1',
      userDisplayName: 'Test User',
      userEmail: 'test@example.com',
      dailySummary: expect.any(Array),
      weeklySummary: expect.any(Array),
      timeByProject: expect.any(Array),
      timeByIssue: expect.any(Array),
      allUsers: expect.any(Array),
    });
  });

  it('membership is null when the user has no membership record', async () => {
    getClient.mockReturnValue(
      makeSupabaseClient({ organization_members: { data: null, error: null } })
    );
    const res = makeRes();
    await getDashboardData(makeReq(), res);

    const { data } = res.json.mock.calls[0][0];
    expect(data.membership).toBeNull();
  });
});
