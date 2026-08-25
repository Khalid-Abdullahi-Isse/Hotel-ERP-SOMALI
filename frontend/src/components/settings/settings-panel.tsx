"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  Bell,
  BedDouble,
  Building2,
  CalendarClock,
  CreditCard,
  Languages,
  LoaderCircle,
  Plug,
  Save,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import {
  hotelSettingsSchema,
  type HotelSettingsValues,
} from "@/schemas/hotel.schema";
import { hotelService } from "@/services/hotel.service";
import type { ApiHotel } from "@/types/api-contracts";

const sections = [
  { id: "property", label: "Hotel Details", icon: Building2 },
  { id: "localization", label: "General", icon: Languages },
  { id: "users", label: "Users & Permissions", icon: UsersRound },
  { id: "reservations", label: "Reservation Rules", icon: CalendarClock },
  { id: "rooms", label: "Room Configuration", icon: BedDouble },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "integrations", label: "Integrations", icon: Plug },
] as const;

type Section = (typeof sections)[number]["id"];

export function SettingsPanel({ hotel }: { hotel: ApiHotel }) {
  const [section, setSection] = useState<Section>("property");
  const form = useForm<HotelSettingsValues>({
    resolver: zodResolver(hotelSettingsSchema),
    defaultValues: {
      code: hotel.code,
      name: hotel.name,
      phone: hotel.phone ?? "",
      email: hotel.email ?? "",
      address: hotel.address ?? "",
      currencyCode: hotel.currencyCode,
      timezone: hotel.timezone,
    },
  });
  const currencyCode = useWatch({
    control: form.control,
    name: "currencyCode",
  });
  const mutation = useMutation({ mutationFn: hotelService.update });
  const editableSection = section === "property" || section === "localization";

  return (
    <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <nav
          aria-label="Settings sections"
          className="flex gap-2 overflow-x-auto lg:flex-col"
        >
          {sections.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                aria-pressed={section === item.id}
                className={cn(
                  "relative flex h-11 shrink-0 items-center gap-3 rounded-[10px] px-3 text-left text-sm font-medium",
                  section === item.id
                    ? "hudheel-active-rail bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>
              {sections.find((item) => item.id === section)?.label} settings
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Changes are validated locally and saved through the Hotel API.
            </p>
          </CardHeader>
          <CardContent>
            {mutation.error ? (
              <Alert variant="destructive" className="mb-5">
                <AlertTitle>Settings could not be saved</AlertTitle>
                <AlertDescription>
                  {getApiError(mutation.error).message}
                </AlertDescription>
              </Alert>
            ) : null}
            {mutation.isSuccess ? (
              <Alert
                className="mb-5 border-status-success/25 text-status-success"
                aria-live="polite"
              >
                <AlertTitle>Settings saved</AlertTitle>
              </Alert>
            ) : null}

            {section === "property" ? (
              <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
                <InputField
                  id="hotel-name"
                  label="Hotel name"
                  error={form.formState.errors.name?.message}
                >
                  <Input
                    id="hotel-name"
                    aria-invalid={Boolean(form.formState.errors.name)}
                    {...form.register("name")}
                  />
                </InputField>
                <InputField
                  id="property-code"
                  label="Property code"
                  error={form.formState.errors.code?.message}
                >
                  <Input
                    id="property-code"
                    aria-invalid={Boolean(form.formState.errors.code)}
                    {...form.register("code")}
                  />
                </InputField>
                <InputField
                  id="hotel-phone"
                  label="Phone"
                  error={form.formState.errors.phone?.message}
                >
                  <Input
                    id="hotel-phone"
                    type="tel"
                    autoComplete="tel"
                    {...form.register("phone")}
                  />
                </InputField>
                <InputField
                  id="hotel-email"
                  label="Email"
                  error={form.formState.errors.email?.message}
                >
                  <Input
                    id="hotel-email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={Boolean(form.formState.errors.email)}
                    {...form.register("email")}
                  />
                </InputField>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="hotel-address">Address</Label>
                  <Input
                    id="hotel-address"
                    autoComplete="street-address"
                    {...form.register("address")}
                  />
                </div>
              </div>
            ) : null}

            {section === "localization" ? (
              <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="default-language">Default language</Label>
                  <Select defaultValue="en">
                    <SelectTrigger id="default-language" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="so">Somali</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    UI translation persistence requires the Localization API.
                  </p>
                </div>
                <InputField
                  id="timezone"
                  label="Timezone"
                  error={form.formState.errors.timezone?.message}
                >
                  <Input
                    id="timezone"
                    aria-invalid={Boolean(form.formState.errors.timezone)}
                    {...form.register("timezone")}
                  />
                </InputField>
                <div className="space-y-2">
                  <Label htmlFor="currency">Primary currency</Label>
                  <Select
                    value={currencyCode}
                    onValueChange={(value) =>
                      form.setValue("currencyCode", value, {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger id="currency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD — US Dollar</SelectItem>
                      <SelectItem value="SOS">SOS — Somali Shilling</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            {section === "payments" ? (
              <Preview
                message="Manage the payment methods available to hotel staff."
                items={["Cash", "Bank transfer", "Mobile money"]}
                action={<Button asChild variant="outline"><Link href="/payment-methods">Manage payment methods</Link></Button>}
              />
            ) : null}
            {section === "users" ? <Preview message="Invite staff and maintain role-based access from Users & Roles." items={["Administrators", "Front Desk", "Housekeeping", "Finance"]} action={<Button asChild variant="outline"><Link href="/users">Manage users and roles</Link></Button>} /> : null}
            {section === "reservations" ? <Preview message="Reservation rule controls will appear here when supported by the Hotel API." items={["Arrival and departure policy", "Cancellation rules", "Default stay rules"]} /> : null}
            {section === "rooms" ? <Preview message="Room inventory structure is managed in Property Setup." items={["Floors", "Room types", "Room inventory"]} action={<Button asChild variant="outline"><Link href="/property">Open Property Setup</Link></Button>} /> : null}
            {section === "notifications" ? (
              <Preview
                message="Notification preferences require the Notifications API."
                items={[
                  "Reservation alerts",
                  "Arrival reminders",
                  "Balance alerts",
                  "Room readiness",
                ]}
              />
            ) : null}
            {section === "security" ? <Preview message="Security-sensitive account actions remain controlled by role permissions and authentication policy." items={["Session access", "Role enforcement", "Audit logging"]} /> : null}
            {section === "integrations" ? <Preview message="No external integrations are configured for this hotel." items={["Channel managers", "Payment providers", "Messaging services"]} /> : null}

            {editableSection ? (
              <div className="mt-6 border-t pt-5">
                <Button
                  type="submit"
                  disabled={!form.formState.isDirty || mutation.isPending}
                >
                  {mutation.isPending ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Save />
                  )}
                  {mutation.isPending ? "Saving..." : "Save changes"}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function InputField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function Preview({ message, items, action }: { message: string; items: string[]; action?: React.ReactNode }) {
  return (
    <div className="max-w-2xl space-y-4">
      <Alert>
        <AlertTitle>Preview only</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      {items.map((item) => (
        <div key={item} className="rounded-lg border p-4 font-medium">
          {item}
        </div>
      ))}
      {action}
    </div>
  );
}
