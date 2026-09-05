import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExpenseActions, ExpenseStatusBadge } from "@/components/finance/expense-actions";
import { formatCurrency, formatShortDate } from "@/lib/format";
import type { ExpenseRecord } from "@/types/finance";

export type ExpensePermissions = {
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canPay: boolean;
  canReverse: boolean;
};

export function ExpensesTable({
  expenses,
  permissions,
}: {
  expenses: ExpenseRecord[];
  permissions: ExpensePermissions;
}) {
  return (
    <div>
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Recorded by / description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="font-mono text-xs text-primary">{expense.reference}</TableCell>
                <TableCell>{formatShortDate(expense.date)}</TableCell>
                <TableCell className="font-medium">{expense.category}</TableCell>
                <TableCell>
                  <p className="font-medium">{expense.vendor}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{expense.description}</p>
                </TableCell>
                <TableCell>
                  <ExpenseStatusBadge status={expense.status} reversed={expense.reversed} />
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatCurrency(expense.amount, expense.currency)}
                </TableCell>
                <TableCell className="text-right">
                  <ExpenseActions
                    expenseId={expense.id}
                    status={expense.status}
                    reversed={expense.reversed}
                    {...permissions}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="divide-y md:hidden">
        {expenses.map((expense) => (
          <article key={expense.id} className="space-y-3 p-4">
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-medium">{expense.vendor}</p>
                <p className="text-xs text-muted-foreground">
                  {expense.category} · {expense.reference}
                </p>
              </div>
              <p className="font-semibold">
                {formatCurrency(expense.amount, expense.currency)}
              </p>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{expense.description}</p>
            <ExpenseStatusBadge status={expense.status} reversed={expense.reversed} />
            <ExpenseActions
              expenseId={expense.id}
              status={expense.status}
              reversed={expense.reversed}
              {...permissions}
            />
          </article>
        ))}
      </div>
      <div className="border-t px-4 py-3 text-xs text-muted-foreground">
        {expenses.length} expense records
      </div>
    </div>
  );
}
