"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorMessage } from "@/components/shared/error-message";
import { guestService } from "@/services/guest.service";
import { getApiError } from "@/lib/api-error";
import { queryKeys } from "@/lib/query-keys";
import { guestSchema, type GuestFormValues } from "@/schemas/guest.schema";
import type { ApiGuest } from "@/types/api-contracts";

export function GuestForm({ guest }: { guest?: ApiGuest }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = Boolean(guest);

  const mutation = useMutation({
    mutationFn: (input: GuestFormValues) =>
      isEditing
        ? guestService.update(guest!.id, input)
        : guestService.create(input),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.guests.detail(saved.id), saved);
      queryClient.invalidateQueries({ queryKey: queryKeys.guests.all });
      router.push(`/guests/${saved.id}`);
      router.refresh();
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GuestFormValues>({
    resolver: zodResolver(guestSchema),
    defaultValues: guest
      ? {
          fullName: guest.fullName,
          phone: guest.phone ?? "",
          email: guest.email ?? "",
          passportNumber: guest.passportNumber ?? "",
          nationalId: guest.nationalId ?? "",
          nationality: guest.nationality ?? "",
          address: guest.address ?? "",
          notes: guest.notes ?? "",
        }
      : {
          fullName: "",
          phone: "",
          email: "",
          passportNumber: "",
          nationalId: "",
          nationality: "",
          address: "",
          notes: "",
        },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
    >
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">
            {isEditing ? "Edit guest information" : "Guest information"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          {mutation.error ? (
            <div className="sm:col-span-2">
              <ErrorMessage
                title={
                  isEditing
                    ? "Guest could not be updated"
                    : "Guest could not be created"
                }
                message={getApiError(mutation.error).message}
              />
            </div>
          ) : null}

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="full-name">
              Full name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="full-name"
              placeholder="e.g. Amina Hassan"
              aria-invalid={Boolean(errors.fullName)}
              {...register("fullName")}
            />
            {errors.fullName ? (
              <p className="text-sm text-destructive">
                {errors.fullName.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              placeholder="e.g. +252611234567"
              {...register("phone")}
            />
            {errors.phone ? (
              <p className="text-sm text-destructive">
                {errors.phone.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="guest@example.com"
              {...register("email")}
            />
            {errors.email ? (
              <p className="text-sm text-destructive">
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nationality">Nationality</Label>
            <Input
              id="nationality"
              placeholder="e.g. Somali"
              {...register("nationality")}
            />
            {errors.nationality ? (
              <p className="text-sm text-destructive">
                {errors.nationality.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="passport-number">Passport number</Label>
            <Input
              id="passport-number"
              placeholder="Optional"
              {...register("passportNumber")}
            />
            {errors.passportNumber ? (
              <p className="text-sm text-destructive">
                {errors.passportNumber.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="national-id">National ID</Label>
            <Input
              id="national-id"
              placeholder="Optional"
              {...register("nationalId")}
            />
            {errors.nationalId ? (
              <p className="text-sm text-destructive">
                {errors.nationalId.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="Optional"
              {...register("address")}
            />
            {errors.address ? (
              <p className="text-sm text-destructive">
                {errors.address.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Optional notes about this guest"
              rows={4}
              {...register("notes")}
            />
            {errors.notes ? (
              <p className="text-sm text-destructive">
                {errors.notes.message}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Do not store sensitive financial information here.
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <LoaderCircle className="animate-spin" />
                Saving...
              </>
            ) : isEditing ? (
              "Save changes"
            ) : (
              "Create guest"
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
