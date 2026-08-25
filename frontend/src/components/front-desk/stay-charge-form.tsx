"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ConciergeBell, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { getApiError } from "@/lib/api-error";
import { formatCurrency } from "@/lib/format";
import { reservationService } from "@/services/reservation.service";

type Currency = "USD" | "SOS";

interface StayChargeFormProps {
  reservationId: string;
  currency?: Currency;
  canCreate: boolean;
  disabled?: boolean;
  onChargePosted: () => Promise<void>;
}

function money(value: number, currency?: Currency) {
  return currency
    ? formatCurrency(value, currency)
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function StayChargeForm({
  reservationId,
  currency,
  canCreate,
  disabled = false,
  onChargePosted,
}: StayChargeFormProps) {
  const [serviceId, setServiceId] = useState("");
  const [quantity, setQuantity] = useState("1.00");
  const [announcement, setAnnouncement] = useState("");
  const services = useQuery({
    queryKey: ["services", "active"],
    queryFn: reservationService.services,
    enabled: canCreate && !disabled,
    select: (items) => items.filter((item) => item.isActive),
  });
  const selectedService = services.data?.find((item) => item.id === serviceId);
  const quantityError = useMemo(() => {
    if (!quantity) return "Enter a quantity.";
    if (!/^(?!0+(\.0{1,2})?$)\d{1,8}(\.\d{1,2})?$/.test(quantity))
      return "Use a positive quantity with up to two decimal places.";
    return null;
  }, [quantity]);

  const charge = useMutation({
    mutationFn: () =>
      reservationService.addServiceCharge(reservationId, {
        serviceId,
        quantity,
      }),
    onSuccess: async (created) => {
      await onChargePosted();
      setQuantity("1.00");
      setAnnouncement(`${created.description} was added to the folio.`);
    },
  });

  const estimatedTotal = selectedService
    ? Number(selectedService.defaultPrice) * Number(quantity || 0)
    : 0;

  return (
    <Card aria-labelledby="stay-charge-title">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
            <ConciergeBell className="size-4" aria-hidden="true" />
          </span>
          <div>
            <CardTitle id="stay-charge-title">Post a service charge</CardTitle>
            <CardDescription>Add an item from the hotel service catalog.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {disabled ? (
          <p className="text-sm text-muted-foreground">This stay is closed; no new charges can be posted.</p>
        ) : canCreate ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setAnnouncement("");
              if (serviceId && !quantityError) charge.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <div className="space-y-2">
                <Label htmlFor="stay-charge-service">Service</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger id="stay-charge-service" className="w-full">
                    <SelectValue placeholder={services.isLoading ? "Loading services…" : "Select service"} />
                  </SelectTrigger>
                  <SelectContent>
                    {services.data?.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} · {money(Number(service.defaultPrice), currency)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stay-charge-quantity">Quantity</Label>
                <Input
                  id="stay-charge-quantity"
                  inputMode="decimal"
                  autoComplete="off"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  aria-invalid={Boolean(quantity && quantityError)}
                  required
                />
              </div>
            </div>

            {services.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Services unavailable</AlertTitle>
                <AlertDescription>{getApiError(services.error).message}</AlertDescription>
              </Alert>
            ) : null}
            {charge.error ? (
              <Alert variant="destructive">
                <AlertTitle>Unable to post charge</AlertTitle>
                <AlertDescription>{getApiError(charge.error).message}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              type="submit"
              disabled={!serviceId || Boolean(quantityError) || services.isError || charge.isPending}
              aria-busy={charge.isPending}
            >
              <Plus />
              {charge.isPending
                ? "Posting charge…"
                : selectedService && !quantityError
                  ? `Post ${money(estimatedTotal, currency)}`
                  : "Post charge"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            You do not have permission to post service charges.
          </p>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      </CardContent>
    </Card>
  );
}
