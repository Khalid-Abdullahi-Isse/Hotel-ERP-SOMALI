import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto.js';

/**
 * Common date range used by accounting reports
 * such as Income Statement and other period-based reports.
 */
export class AccountingReportQueryDto {
  /**
   * Beginning of the reporting period.
   *
   * Example:
   * 2026-01-01
   */
  @IsDateString({ strict: true })
  dateFrom!: string;

  /**
   * End of the reporting period.
   *
   * Example:
   * 2026-08-31
   */
  @IsDateString({ strict: true })
  dateTo!: string;
}

/**
 * Balance Sheet Query
 *
 * A Balance Sheet is fundamentally an "as of" report.
 *
 * dateTo is required.
 * dateFrom is optional for compatibility with the existing
 * API contract.
 *
 * IMPORTANT:
 * If dateFrom is omitted, the backend must use the hotel's
 * configured accounting start date.
 *
 * NEVER use:
 * 0001-01-01
 *
 * as a default because strict ISO validation rejects it.
 */
export class BalanceSheetQueryDto {
  /**
   * Optional beginning date.
   *
   * If omitted, the service should use the configured
   * accounting start date.
   */
  @IsOptional()
  @IsDateString({ strict: true })
  dateFrom?: string;

  /**
   * Balance Sheet "as of" date.
   *
   * Example:
   * 2026-08-31
   */
  @IsDateString({ strict: true })
  dateTo!: string;
}

/**
 * General Ledger Query
 *
 * Retrieves posted accounting transactions for a period.
 */
export class GeneralLedgerQueryDto extends PaginationQueryDto {
  /**
   * Beginning of the ledger period.
   */
  @IsDateString({ strict: true })
  dateFrom!: string;

  /**
   * End of the ledger period.
   */
  @IsDateString({ strict: true })
  dateTo!: string;

  /**
   * Filter ledger entries by account.
   *
   * Example:
   * Cash account UUID
   */
  @IsOptional()
  @IsUUID('4')
  accountId?: string;

  /**
   * Filter ledger entries by journal.
   *
   * Example:
   * Manual Journal / Sales Journal / Payment Journal UUID
   */
  @IsOptional()
  @IsUUID('4')
  journalId?: string;

  /**
   * Filter by the source that generated the accounting entry.
   *
   * Examples:
   * BOOKING
   * PAYMENT
   * PURCHASE
   * EXPENSE
   * MANUAL
   * POS
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceType?: string;

  /**
   * Search ledger entries.
   *
   * Can be used for account code, account name,
   * description, reference, etc., depending on the
   * implementation in the service.
   */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}
