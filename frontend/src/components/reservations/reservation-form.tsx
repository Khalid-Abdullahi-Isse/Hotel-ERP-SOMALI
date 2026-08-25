"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Controller, type FieldPath, useForm, useWatch } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getApiError } from "@/lib/api-error";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import {
  reservationSchema,
  type ReservationFormValues,
} from "@/schemas/reservation.schema";
import {
  availabilityService,
  reservationService,
} from "@/services/reservation.service";
import type { ReservationRoomTypeOption } from "@/types/reservation";

const steps = [
  { title: "Stay details", icon: CalendarDays },
  { title: "Guest information", icon: UserRound },
  { title: "Review", icon: CheckCircle2 },
] as const;
const stepFields: Array<Array<FieldPath<ReservationFormValues>>> = [
  ["checkIn", "checkOut", "adults", "children", "roomType", "roomNumber"],
  ["guestName", "phone", "email", "nationality", "identification", "notes"],
  [],
];
function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}
function dateInputValue(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function ReservationForm({
  roomTypes,
  currency,
  existingGuest,
  walkIn = false,
  canCheckIn = false,
  canConfirm = false,
}: {
  roomTypes: ReservationRoomTypeOption[];
  currency: "USD" | "SOS";
  existingGuest?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    nationality: string;
  };
  walkIn?: boolean;
  canCheckIn?: boolean;
  canConfirm?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [validated, setValidated] = useState(false);
  const createdReservationId = useRef<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    trigger,
    setValue,
    formState: { errors },
  } = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      checkIn: dateInputValue(walkIn ? 0 : 1),
      checkOut: dateInputValue(walkIn ? 1 : 2),
      adults: 1,
      children: 0,
      roomType: "",
      roomNumber: "",
      guestName: existingGuest?.name ?? "",
      phone: existingGuest?.phone ?? "",
      email: existingGuest?.email ?? "",
      nationality: existingGuest?.nationality ?? "Somali",
      identification: "",
      notes: "",
    },
    mode: "onBlur",
  });
  const values = useWatch({ control });
  const selectedType = roomTypes.find((type) => type.value === values.roomType);
  const availability = useQuery({
    queryKey: queryKeys.availability(
      values.checkIn ?? "",
      values.checkOut ?? "",
      values.roomType ?? "",
      values.adults ?? 1,
      values.children ?? 0,
      walkIn,
    ),
    queryFn: () =>
      availabilityService.search({
        checkInDate: values.checkIn ?? "",
        checkOutDate: values.checkOut ?? "",
        roomTypeId: values.roomType ?? "",
        readyOnly: walkIn,
        adults: values.adults ?? 1,
        children: values.children ?? 0,
      }),
    enabled: Boolean(
      values.checkIn &&
      values.checkOut &&
      values.roomType &&
      values.checkOut > values.checkIn,
    ),
    staleTime: 15_000,
  });
  const availableRooms =
    availability.data?.data.map((room) => ({
      id: room.id,
      number: room.roomNumber,
    })) ?? [];
  const selectedRoom = availableRooms.find(
    (room) => room.id === values.roomNumber,
  );
  const mutation = useMutation({
    mutationFn: async (formValues: ReservationFormValues) => {
      if (!createdReservationId.current) {
        const created = await reservationService.create(
          formValues,
          existingGuest?.id,
        );
        createdReservationId.current = created.id;
        if (!canConfirm) return created;
      }

      if (!canConfirm)
        return reservationService.get(createdReservationId.current);

      try {
        return await reservationService.confirm(createdReservationId.current);
      } catch (error) {
        const reservation = await reservationService
          .get(createdReservationId.current)
          .catch(() => null);
        if (reservation?.status === "CONFIRMED") return reservation;
        throw error;
      }
    },
    onSuccess: () => setValidated(true),
  });
  async function nextStep() {
    const valid = await trigger(stepFields[step], { shouldFocus: true });
    if (valid) setStep((current) => Math.min(current + 1, 2));
  }
  function submit(formValues: ReservationFormValues) {
    mutation.mutate(formValues);
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-primary">
                  Step {step + 1} of 3
                </p>
                <CardTitle className="mt-1 text-lg">
                  {steps[step].title}
                </CardTitle>
              </div>
              <span className="text-xs text-muted-foreground">
                New reservation
              </span>
            </div>
            <ol
              className="mt-5 grid grid-cols-3 gap-2"
              aria-label="Reservation progress"
            >
              {steps.map((item, index) => {
                const Icon = item.icon;
                return (
                  <li key={item.title}>
                    <button
                      type="button"
                      disabled={index > step}
                      onClick={() => index <= step && setStep(index)}
                      className="w-full text-left disabled:cursor-not-allowed"
                    >
                      <span
                        className={cn(
                          "mb-2 block h-1 rounded-full",
                          index <= step ? "bg-primary" : "bg-muted",
                        )}
                      />
                      <span
                        className={cn(
                          "hidden items-center gap-1.5 text-[11px] font-medium sm:flex",
                          index === step
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        <Icon className="size-3.5" />
                        {item.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </CardHeader>
          <CardContent>
            {validated ? (
              <div
                role="status"
                aria-live="polite"
                className="flex min-h-80 flex-col items-center justify-center px-4 py-10 text-center"
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-status-available/10 text-status-available">
                  <CheckCircle2 className="size-7" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight">
                  {canConfirm ? "Reservation confirmed" : "Reservation created"}
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  {canConfirm
                    ? `The booking is confirmed and the room is reserved for ${values.guestName}.`
                    : `The booking for ${values.guestName} is pending confirmation by an authorized user.`}
                </p>
                {mutation.data?.bookingNumber ? (
                  <p className="mt-5 rounded-lg border border-status-available/25 bg-status-available/8 px-4 py-2 font-mono text-sm font-semibold text-status-available">
                    Booking {mutation.data.bookingNumber}
                  </p>
                ) : null}
              </div>
            ) : null}
            {mutation.error ? (
              <Alert variant="destructive" className="mb-6">
                <AlertTitle>Reservation could not be confirmed</AlertTitle>
                <AlertDescription>
                  {getApiError(mutation.error).message}
                </AlertDescription>
              </Alert>
            ) : null}
            {!validated && step === 0 ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Check-in"
                  id="check-in"
                  required
                  error={errors.checkIn?.message}
                >
                  <Input id="check-in" type="date" {...register("checkIn")} />
                </Field>
                <Field
                  label="Check-out"
                  id="check-out"
                  required
                  error={errors.checkOut?.message}
                >
                  <Input id="check-out" type="date" {...register("checkOut")} />
                </Field>
                <Field
                  label="Adults"
                  id="adults"
                  error={errors.adults?.message}
                >
                  <Input
                    id="adults"
                    type="number"
                    min={1}
                    {...register("adults")}
                  />
                </Field>
                <Field
                  label="Children"
                  id="children"
                  error={errors.children?.message}
                >
                  <Input
                    id="children"
                    type="number"
                    min={0}
                    {...register("children")}
                  />
                </Field>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="room-type">Room type *</Label>
                  <Controller
                    name="roomType"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          setValue("roomNumber", "");
                        }}
                      >
                        <SelectTrigger id="room-type" className="w-full">
                          <SelectValue placeholder="Choose room type" />
                        </SelectTrigger>
                        <SelectContent>
                          {roomTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label} · {type.rateLabel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError message={errors.roomType?.message} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="room-number">Available room *</Label>
                  <Controller
                    name="roomNumber"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!selectedType || availability.isFetching}
                      >
                        <SelectTrigger id="room-number" className="w-full">
                          <SelectValue
                            placeholder={
                              availability.isFetching
                                ? "Checking availability..."
                                : "Choose room"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRooms.map((room) => (
                            <SelectItem key={room.id} value={room.id}>
                              Room {room.number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError
                    message={
                      availability.error
                        ? getApiError(availability.error).message
                        : errors.roomNumber?.message
                    }
                  />
                </div>
              </div>
            ) : null}
            {!validated && step === 1 ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {existingGuest ? (
                  <Alert className="border-primary/20 bg-primary/5 sm:col-span-2">
                    <UserRound className="text-primary" />
                    <AlertTitle>Existing guest selected</AlertTitle>
                    <AlertDescription>
                      This reservation will be linked to {existingGuest.name}
                      &apos;s guest account. No duplicate profile will be
                      created.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <Field
                  label="Full name"
                  id="guest-name"
                  required
                  error={errors.guestName?.message}
                  wide
                >
                  <Input
                    id="guest-name"
                    autoComplete="name"
                    {...register("guestName")}
                  />
                </Field>
                <Field
                  label="Phone"
                  id="phone"
                  required
                  error={errors.phone?.message}
                >
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+252 61 000 0000"
                    {...register("phone")}
                  />
                </Field>
                <Field label="Email" id="email" error={errors.email?.message}>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...register("email")}
                  />
                </Field>
                <Field label="Nationality" id="nationality">
                  <Input id="nationality" {...register("nationality")} />
                </Field>
                <Field label="Passport or national ID" id="identification">
                  <Input id="identification" {...register("identification")} />
                </Field>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="notes">Preferences and notes</Label>
                  <Textarea id="notes" rows={4} {...register("notes")} />
                  <p className="text-xs text-muted-foreground">
                    Only record information needed to serve the guest.
                  </p>
                </div>
              </div>
            ) : null}
            {!validated && step === 2 ? (
              <div className="space-y-5">
                <div className="rounded-lg border p-4">
                  <h3 className="font-medium">Review reservation</h3>
                  <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                    <Summary
                      label="Guest"
                      value={values.guestName || "Not provided"}
                    />
                    <Summary
                      label="Phone"
                      value={values.phone || "Not provided"}
                    />
                    <Summary
                      label="Stay"
                      value={`${values.checkIn} to ${values.checkOut}`}
                    />
                    <Summary
                      label="Room"
                      value={`${selectedType?.label ?? "Not selected"} · ${selectedRoom?.number ?? "—"}`}
                    />
                    <Summary
                      label="Guests"
                      value={`${values.adults} adult(s), ${values.children ?? 0} child(ren)`}
                    />
                    <Summary label="Currency" value={currency} />
                  </dl>
                </div>
                <Alert>
                  <AlertTitle>
                    {canConfirm
                      ? "Review before confirmation"
                      : "Review before creation"}
                  </AlertTitle>
                  <AlertDescription>
                    Guest identity, dates, capacity, and room availability are
                    checked by the hotel server when this reservation is saved.
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}
          </CardContent>
          <CardFooter
            className={cn(
              "border-t",
              validated ? "justify-center" : "justify-between",
            )}
          >
            {validated ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild variant="outline">
                  <Link href="/reservations">View reservations</Link>
                </Button>
                {walkIn && canConfirm && canCheckIn && mutation.data?.id ? (
                  <Button asChild>
                    <Link href={`/front-desk/check-in/${mutation.data.id}`}>
                      Continue to check-in
                      <ArrowRight />
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep((current) => Math.max(current - 1, 0))}
                  disabled={step === 0}
                >
                  <ArrowLeft />
                  Back
                </Button>
                {step < 2 ? (
                  <Button type="button" onClick={nextStep}>
                    Continue
                    <ArrowRight />
                  </Button>
                ) : (
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? (
                      <>
                        <LoaderCircle className="animate-spin" />
                        {canConfirm ? "Confirming..." : "Creating..."}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 />
                        {canConfirm
                          ? "Confirm reservation"
                          : "Create reservation"}
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
          </CardFooter>
        </Card>
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Booking summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Summary
                label="Stay"
                value={`${values.checkIn || "Check-in"} → ${values.checkOut || "Check-out"}`}
              />
              <Summary
                label="Room"
                value={`${selectedType?.label ?? "Choose a room"}${selectedRoom ? ` · ${selectedRoom.number}` : ""}`}
              />
              <Summary
                label="Guest"
                value={values.guestName || "Guest information pending"}
              />
              <p className="border-t pt-4 text-[11px] leading-5 text-muted-foreground">
                Final price, discounts, and balance are calculated when the
                reservation is saved.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </form>
  );
}

function Field({
  label,
  id,
  required,
  error,
  wide,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", wide && "sm:col-span-2")}>
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      {children}
      <FieldError message={error} />
    </div>
  );
}
function Summary({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
