import { api } from "@/lib/api";
import type {
  AccountInput,
  AccountingAccount,
  AccountingJournal,
  AccountingSettings,
  AccountingSettingsInput,
  JournalEntryDetail,
  JournalEntryInput,
  JournalInput,
} from "@/types/accounting";

export const accountingService = {
  initialize: async () =>
    (await api.post<{ initialized: boolean; settings: AccountingSettings }>("/accounting/settings/initialize")).data,
  updateSettings: async (input: AccountingSettingsInput) =>
    (await api.patch<AccountingSettings>("/accounting/settings", input)).data,
  createAccount: async (input: AccountInput) =>
    (await api.post<AccountingAccount>("/accounting/accounts", input)).data,
  updateAccount: async (id: string, input: Partial<AccountInput>) =>
    (await api.patch<AccountingAccount>(`/accounting/accounts/${id}`, input)).data,
  createJournal: async (input: JournalInput) =>
    (await api.post<AccountingJournal>("/accounting/journals", input)).data,
  updateJournal: async (id: string, input: Partial<JournalInput>) =>
    (await api.patch<AccountingJournal>(`/accounting/journals/${id}`, input)).data,
  createEntry: async (input: JournalEntryInput) =>
    (await api.post<JournalEntryDetail>("/accounting/journal-entries", input)).data,
  postEntry: async (id: string) =>
    (await api.post<JournalEntryDetail>(`/accounting/journal-entries/${id}/post`)).data,
  reverseEntry: async (id: string, reason: string) =>
    (await api.post<JournalEntryDetail>(`/accounting/journal-entries/${id}/reverse`, { reason })).data,
};
