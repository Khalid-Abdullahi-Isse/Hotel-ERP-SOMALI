import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchAvailabilityQueryDto } from './search-availability-query.dto.js';

describe('SearchAvailabilityQueryDto', () => {
  it('accepts the ready-only filter used by immediate check-in searches', async () => {
    const query = plainToInstance(SearchAvailabilityQueryDto, {
      checkInDate: '2026-08-23',
      checkOutDate: '2026-08-24',
      roomTypeId: '22222222-2222-4222-8222-222222222222',
      readyOnly: 'true',
      adults: '1',
      children: '0',
    });

    expect(await validate(query)).toEqual([]);
    expect(query.readyOnly).toBe(true);
  });

  it('does not enable the ready-only filter for a false query value', async () => {
    const query = plainToInstance(SearchAvailabilityQueryDto, {
      checkInDate: '2026-08-23',
      checkOutDate: '2026-08-24',
      readyOnly: 'false',
      adults: '1',
      children: '0',
    });

    expect(await validate(query)).toEqual([]);
    expect(query.readyOnly).toBe(false);
  });
});
