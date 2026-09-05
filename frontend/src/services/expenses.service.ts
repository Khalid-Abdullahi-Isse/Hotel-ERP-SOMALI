import { api } from "@/lib/api";

export interface CreateExpenseInput {
  categoryId: string;
  paymentMethodId?: string;
  requestKey: string;
  amount: string;
  expenseDate: string;
  reference?: string;
  invoiceNumber?: string;
  dueDate?: string;
}

export const expensesService = {
  async create(input: CreateExpenseInput) {
    const { data } = await api.post("/expenses", input);
    return data;
  },
  async submit(id: string) {
    const { data } = await api.post(`/expenses/${id}/submit`);
    return data;
  },
  async approve(id: string) {
    const { data } = await api.post(`/expenses/${id}/approve`);
    return data;
  },
  async reject(id: string, reason: string) {
    const { data } = await api.post(`/expenses/${id}/reject`, { reason });
    return data;
  },
  async pay(id: string, input: { paymentMethodId?: string; reference?: string } = {}) {
    const { data } = await api.post(`/expenses/${id}/pay`, input);
    return data;
  },
  async reverse(id: string, reason: string) {
    const { data } = await api.post(`/expenses/${id}/reverse`, { reason });
    return data;
  },
};
