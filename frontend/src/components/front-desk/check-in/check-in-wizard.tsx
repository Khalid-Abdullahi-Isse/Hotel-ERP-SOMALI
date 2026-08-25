"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { getApiError } from "@/lib/api-error";
import { reservationService } from "@/services/reservation.service";
import type { CheckInInitialData, CheckInPermissions, CheckInStep } from "@/types/check-in";
import type { ApiReservation } from "@/types/api-contracts";
import { CheckInStepper, CHECK_IN_STEPS } from "./check-in-stepper";
import { ReservationStep } from "./reservation-step";
import { GuestStep } from "./guest-step";
import { RoomStep } from "./room-step";
import { PaymentStep } from "./payment-step";
import { ConfirmationStep } from "./confirmation-step";
import { CheckInSuccess } from "./check-in-success";

export function CheckInWizard({ initialData, permissions, currency }: { initialData: CheckInInitialData; permissions: CheckInPermissions; currency?: "USD" | "SOS" }) {
  const [step, setStep] = useState<CheckInStep>("reservation");
  const [completed, setCompleted] = useState<ApiReservation | null>(initialData.reservation.status === "CHECKED_IN" ? initialData.reservation : null);
  const queryClient = useQueryClient();
  const reservationQuery = useQuery({ queryKey: ["reservation", initialData.reservation.id], queryFn: () => reservationService.get(initialData.reservation.id), initialData: initialData.reservation });
  const guestQuery = useQuery({ queryKey: ["guest", initialData.guest.id], queryFn: () => reservationService.getGuest(initialData.guest.id), initialData: initialData.guest });
  const folioQuery = useQuery({ queryKey: ["folio", initialData.reservation.id], queryFn: () => reservationService.folio(initialData.reservation.id), initialData: initialData.folio });
  const paymentsQuery = useQuery({ queryKey: ["reservation-payments", initialData.reservation.id], queryFn: () => reservationService.payments(initialData.reservation.id), initialData: initialData.payments });
  const reservation = reservationQuery.data;
  const guest = guestQuery.data;
  const go = (offset: number) => setStep(CHECK_IN_STEPS[Math.max(0, Math.min(CHECK_IN_STEPS.length - 1, CHECK_IN_STEPS.findIndex((item) => item.id === step) + offset))].id);
  const checkIn = useMutation({
    mutationFn: () => reservationService.checkIn(reservation.id),
    onSuccess: (result) => {
      const updated: ApiReservation = {
        ...reservation,
        ...result.reservation,
        guest: { ...reservation.guest, ...result.reservation.guest },
        rooms: reservation.rooms.map((entry) => ({ ...entry, room: { ...entry.room, status: "OCCUPIED" } })),
      };
      setCompleted(updated);
      queryClient.setQueryData(["reservation", reservation.id], updated);
      void queryClient.invalidateQueries({ queryKey: ["front-desk"] });
    },
    onError: async (error) => {
      const apiError = getApiError(error);
      if (["ROOM_NOT_READY_FOR_CHECK_IN", "ROOM_ALREADY_BOOKED", "ROOM_NOT_RESERVABLE", "TRANSACTION_CONFLICT"].includes(apiError.code ?? "")) {
        await Promise.all([reservationQuery.refetch(), queryClient.invalidateQueries({ queryKey: ["availability"] })]);
      }
    },
  });
  const updateReservation = (updated: ApiReservation) => {
    queryClient.setQueryData(["reservation", updated.id], updated);
    void Promise.all([folioQuery.refetch(), paymentsQuery.refetch()]);
  };

  if (completed) return <CheckInSuccess reservation={completed} />;
  return <div className="mx-auto max-w-4xl space-y-5"><Card><CardContent className="py-5"><CheckInStepper current={step} /></CardContent></Card><Card><CardContent className="py-6 sm:py-7">{step === "reservation" ? <ReservationStep reservation={reservation} onContinue={() => go(1)} /> : step === "guest" ? <GuestStep guest={guest} reservation={reservation} canEdit={permissions.canUpdateGuest} onGuestChange={(updated) => queryClient.setQueryData(["guest", updated.id], updated)} onBack={() => go(-1)} onContinue={() => go(1)} /> : step === "room" ? <RoomStep reservation={reservation} currency={currency} canReplace={permissions.canReplaceRooms} canViewAvailability={permissions.canViewAvailability} onReservationChange={updateReservation} onBack={() => go(-1)} onContinue={() => go(1)} /> : step === "payment" ? <PaymentStep reservationId={reservation.id} folio={folioQuery.data} payments={paymentsQuery.data} currency={currency} canPay={permissions.canCreatePayment} onPaymentRecorded={async () => { await Promise.all([folioQuery.refetch(), paymentsQuery.refetch()]); }} onBack={() => go(-1)} onContinue={() => go(1)} /> : <ConfirmationStep reservation={reservation} guest={guest} payments={paymentsQuery.data} currency={currency} canCheckIn={permissions.canCheckIn} error={checkIn.error ? getApiError(checkIn.error) : null} isPending={checkIn.isPending} onBack={() => go(-1)} onConfirm={() => checkIn.mutate()} onChangeRoom={() => setStep("room")} />}</CardContent></Card></div>;
}
