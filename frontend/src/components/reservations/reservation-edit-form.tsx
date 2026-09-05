"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
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
import { reservationService } from "@/services/reservation.service";
import { getApiError } from "@/lib/api-error";
import {
  reservationEditSchema,
  type ReservationEditValues,
} from "@/schemas/reservation-edit.schema";
import type { ApiReservation } from "@/types/api-contracts";

export function ReservationEditForm({
  reservation,
}: {
  reservation: ApiReservation;
}) {
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: (input: ReservationEditValues) =>
      reservationService.update(reservation.id, input),
    onSuccess: () => {
      router.push(`/reservations/${reservation.id}`);
      router.refresh();
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReservationEditValues>({
    resolver: zodResolver(reservationEditSchema),
    defaultValues: {
      checkInDate: reservation.checkInDate.slice(0, 10),
      checkOutDate: reservation.checkOutDate.slice(0, 10),
      adults: reservation.adults,
      children: reservation.children,
      notes: reservation.notes ?? "",
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
    >
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">Reservation details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          {mutation.error ? (
            <div className="sm:col-span-2">
              <ErrorMessage
                title="Reservation could not be updated"
                message={getApiError(mutation.error).message}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="check-in-date">
              Check-in date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="check-in-date"
              type="date"
              aria-invalid={Boolean(errors.checkInDate)}
              {...register("checkInDate")}
            />
            {errors.checkInDate ? (
              <p className="text-sm text-destructive">
                {errors.checkInDate.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="check-out-date">
              Check-out date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="check-out-date"
              type="date"
              aria-invalid={Boolean(errors.checkOutDate)}
              {...register("checkOutDate")}
            />
            {errors.checkOutDate ? (
              <p className="text-sm text-destructive">
                {errors.checkOutDate.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adults">
              Adults <span className="text-destructive">*</span>
            </Label>
            <Input
              id="adults"
              type="number"
              min={1}
              max={12}
              aria-invalid={Boolean(errors.adults)}
              {...register("adults")}
            />
            {errors.adults ? (
              <p className="text-sm text-destructive">
                {errors.adults.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="children">Children</Label>
            <Input
              id="children"
              type="number"
              min={0}
              max={12}
              {...register("children")}
            />
            {errors.children ? (
              <p className="text-sm text-destructive">
                {errors.children.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Optional notes"
              rows={3}
              {...register("notes")}
            />
            {errors.notes ? (
              <p className="text-sm text-destructive">
                {errors.notes.message}
              </p>
            ) : null}
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
            ) : (
              "Save changes"
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
