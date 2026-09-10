import { vi } from "vitest";

vi.mock("@workspace/db", () => {
  const createMock = () => vi.fn();

  const mockQuery = {
    usersTable: { findFirst: createMock(), findMany: createMock() },
    leadsTable: { findFirst: createMock(), findMany: createMock() },
    customersTable: { findFirst: createMock(), findMany: createMock() },
    plansTable: { findFirst: createMock(), findMany: createMock() },
    paymentsTable: { findFirst: createMock(), findMany: createMock() },
    subscriptionsTable: { findFirst: createMock(), findMany: createMock() },
    settingsTable: { findFirst: createMock(), findMany: createMock() },
  };

  const chainable = () => {
    const m = {
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
      then: (resolve: any) => resolve([]),
    };
    return m;
  };

  return {
    db: {
      query: mockQuery,
      select: vi.fn(() => chainable()),
      insert: vi.fn(() => chainable()),
      update: vi.fn(() => chainable()),
      delete: vi.fn(() => chainable()),
      $count: vi.fn().mockResolvedValue(0),
    },
  };
});

vi.mock("@workspace/api-zod", () => ({
  HealthCheckResponse: {
    parse: (data: { status: string }) => data,
  },
}));
