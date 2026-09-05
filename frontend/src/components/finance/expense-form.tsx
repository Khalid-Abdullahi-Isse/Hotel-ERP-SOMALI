"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorMessage } from "@/components/shared/error-message";
import { expensesService } from "@/services/expenses.service";
import { getApiError } from "@/lib/api-error";
import { z } from "zod";
import { useState } from "react";
import type {
  ApiExpenseCategory,
  ApiPaymentMethod,
} from "@/types/api-contracts";

const expenseSchema = z.object({
  categoryId: z.string().min(1, "Select a category."),
  amount: z
    .string()
    .min(1, "Amount is required.")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Amount must be greater than zero."),
  expenseDate: z.string().min(1, "Date is required."),
  description: z
    .string()
    .trim()
    .min(2, "Description is required.")
    .max(500, "Description is too long."),
  paymentMethodId: z.string().optional(),
  reference: z.string().trim().max(100).optional(),
  invoiceNumber: z.string().trim().max(100).optional(),
  dueDate: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function ExpenseForm({
  categories,
  paymentMethods,
}: {
  categories: ApiExpenseCategory[];
  paymentMethods: ApiPaymentMethod[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: (input: ExpenseFormValues) =>
      expensesService.create({
        categoryId: input.categoryId,
        amount: input.amount,
        expenseDate: input.expenseDate,
        description: input.description,
        requestKey: generateUUID(),
        paymentMethodId: input.paymentMethodId || undefined,
        reference: input.reference || undefined,
        invoiceNumber: input.invoiceNumber || undefined,
        dueDate: input.dueDate || undefined,
      }),
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      categoryId: "",
      amount: "",
      expenseDate: new Date().toISOString().split("T")[0],
      description: "",
      paymentMethodId: "",
      reference: "",
      invoiceNumber: "",
      dueDate: "",
    },
  });

  function handleOpenChange(value: boolean) {
    setOpen(value);
    if (!value) {
      reset();
      mutation.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          New expense
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create expense</DialogTitle>
          <DialogDescription>
            Record a new expense. It will be saved as a draft and can be
            submitted for approval.
          </DialogDescription>
        </DialogHeader>
        <form
          id="expense-form"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="grid gap-4"
          noValidate
        >
          {mutation.error ? (
            <ErrorMessage message={getApiError(mutation.error).message} />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="expense-category">
              Category <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="expense-category"
                    aria-invalid={Boolean(errors.categoryId)}
                  >
                    <SelectValue placeholder="Choose category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.categoryId ? (
              <p className="text-sm text-destructive">
                {errors.categoryId.message}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expense-amount">
                Amount <span className="text-destructive">*</span>
              </Label>
              <Input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                aria-invalid={Boolean(errors.amount)}
                {...register("amount")}
              />
              {errors.amount ? (
                <p className="text-sm text-destructive">
                  {errors.amount.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-date">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="expense-date"
                type="date"
                aria-invalid={Boolean(errors.expenseDate)}
                {...register("expenseDate")}
              />
              {errors.expenseDate ? (
                <p className="text-sm text-destructive">
                  {errors.expenseDate.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="expense-description"
              placeholder="What was this expense for?"
              rows={3}
              aria-invalid={Boolean(errors.description)}
              {...register("description")}
            />
            {errors.description ? (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-payment-method">Payment method</Label>
            <Controller
              name="paymentMethodId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || "none"}
                  onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                >
                  <SelectTrigger id="expense-payment-method">
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {paymentMethods.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        {pm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expense-reference">Reference</Label>
              <Input
                id="expense-reference"
                placeholder="Optional"
                {...register("reference")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-invoice-number">Invoice number</Label>
              <Input
                id="expense-invoice-number"
                placeholder="Optional"
                {...register("invoiceNumber")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-due-date">Due date</Label>
            <Input id="expense-due-date" type="date" {...register("dueDate")} />
          </div>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="expense-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <LoaderCircle className="animate-spin" />
                Creating...
              </>
            ) : (
              "Create expense"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
