"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
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
  { title: "Payment", icon: CreditCard },
  { title: "Confirmation", icon: CheckCircle2 },
] as const;
const stepFields: Array<Array<FieldPath<ReservationFormValues>>> = [
  ["checkIn", "checkOut", "adults", "children", "roomType", "roomNumber"],
  ["guestName", "phone", "email", "nationality", "identification", "notes"],
  ["paymentMethod", "deposit"],
  [],
];
function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}
function pretty(value: string) {
  return value
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
function dateInputValue(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function ReservationForm({
  roomTypes,
}: {
  roomTypes: ReservationRoomTypeOption[];
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
      checkIn: dateInputValue(1),
      checkOut: dateInputValue(2),
      adults: 1,
      children: 0,
      roomType: "",
      roomNumber: "",
      guestName: "",
      phone: "",
      email: "",
      nationality: "Somali",
      identification: "",
      paymentMethod: "cash",
      deposit: 0,
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
    ),
    queryFn: () =>
      availabilityService.search({
        checkInDate: values.checkIn ?? "",
        checkOutDate: values.checkOut ?? "",
        roomTypeId: values.roomType ?? "",
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
        const created = await reservationService.create(formValues);
        createdReservationId.current = created.id;
      }

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
    if (valid) setStep((current) => Math.min(current + 1, 3));
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
                  Step {step + 1} of 4
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
              className="mt-5 grid grid-cols-4 gap-2"
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
                <span className="flex size-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-8 ring-emerald-50">
                  <CheckCircle2
                    className="size-14"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                </span>
                <h3 className="mt-7 text-2xl font-semibold tracking-tight text-emerald-800">
                  Reservation confirmed
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  The booking is confirmed and the room is reserved for{" "}
                  {values.guestName}.
                </p>
                {mutation.data?.bookingNumber ? (
                  <p className="mt-5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 font-mono text-sm font-semibold text-emerald-800">
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
                <Alert>
                  <CreditCard />
                  <AlertTitle>Payment plan</AlertTitle>
                  <AlertDescription>
                    Choose how the guest expects to pay. Record the completed
                    payment from the Payments page after confirming the
                    reservation.
                  </AlertDescription>
                </Alert>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="payment-method">Expected method</Label>
                    <Controller
                      name="paymentMethod"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger id="payment-method" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="bank_transfer">
                              Bank transfer
                            </SelectItem>
                            <SelectItem value="mobile_money">
                              Mobile money
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <Field
                    label="Planned deposit (USD)"
                    id="deposit"
                    error={errors.deposit?.message}
                  >
                    <Input
                      id="deposit"
                      type="number"
                      min={0}
                      step="0.01"
                      {...register("deposit")}
                    />
                  </Field>
                </div>
              </div>
            ) : null}
            {!validated && step === 3 ? (
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
                    <Summary
                      label="Payment intent"
                      value={`${pretty(values.paymentMethod ?? "cash")} · $${values.deposit || 0}`}
                    />
                  </dl>
                </div>
                <Alert>
                  <AlertTitle>Review before confirmation</AlertTitle>
                  <AlertDescription>
                    Guest identity, dates, and room availability are checked
                    again when the reservation is confirmed.
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
              <Button asChild>
                <Link href="/reservations">View reservations</Link>
              </Button>
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
                {step < 3 ? (
                  <Button type="button" onClick={nextStep}>
                    Continue
                    <ArrowRight />
                  </Button>
                ) : (
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? (
                      <>
                        <LoaderCircle className="animate-spin" />
                        Confirming...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 />
                        Confirm reservation
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
