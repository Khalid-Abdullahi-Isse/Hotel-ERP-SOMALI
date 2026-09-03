import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto.js';
import { paginatedResponse, paginationOffset } from './pagination.util.js';

describe('pagination infrastructure', () => {
  it('defaults to page 1 and 30 records', async () => {
    const query = plainToInstance(PaginationQueryDto, {});
    expect(await validate(query)).toHaveLength(0);
    expect(query).toMatchObject({ page: 1, limit: 30 });
  });

  it('calculates the database offset for later pages', () => {
    expect(paginationOffset(2, 30)).toBe(30);
    expect(paginationOffset(3, 30)).toBe(60);
  });

  it.each<Record<string, unknown>>([
    { page: 0 },
    { page: -1 },
    { limit: -1 },
    { limit: 101 },
    { page: 'abc' },
  ])("rejects invalid pagination input %j", async (input) => {
    const query = plainToInstance(PaginationQueryDto, input);
    expect(await validate(query)).not.toHaveLength(0);
  });

  it('creates consistent navigation metadata', () => {
    expect(paginatedResponse([], 2, 30, 61).pagination).toEqual({
      page: 2,
      limit: 30,
      total: 61,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
    expect(paginatedResponse([], 1, 30, 0).pagination).toEqual({
      page: 1,
      limit: 30,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });
});
