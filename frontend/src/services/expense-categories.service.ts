import { api } from "@/lib/api";
import type { ApiExpenseCategory } from "@/types/api-contracts";

export const expenseCategoryService = {
  create: async (input: { name: string; expenseAccountId?: string }) => (await api.post<ApiExpenseCategory>("/expense-categories", input)).data,
  update: async (id: string, input: { name: string; expenseAccountId?: string }) => (await api.patch<ApiExpenseCategory>(`/expense-categories/${id}`, input)).data,
  setActive: async (id: string, active: boolean) => (await (active ? api.patch<ApiExpenseCategory>(`/expense-categories/${id}/restore`) : api.delete<ApiExpenseCategory>(`/expense-categories/${id}`))).data,
};
