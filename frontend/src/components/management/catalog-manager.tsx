"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, LoaderCircle, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getApiError } from "@/lib/api-error";
import {
  floorService,
  paymentMethodService,
  roomTypeService,
  serviceCatalogService,
  type RoomTypeInput,
  type ServiceInput,
} from "@/services/catalog.service";
import type { ApiFloor, ApiPaymentMethod, ApiRoomType, ApiService } from "@/types/api-contracts";

type CatalogProps =
  | { kind: "floors"; items: ApiFloor[]; canManage: boolean }
  | { kind: "room-types"; items: ApiRoomType[]; canManage: boolean }
  | { kind: "services"; items: ApiService[]; canManage: boolean }
  | { kind: "payment-methods"; items: ApiPaymentMethod[]; canManage: boolean };

export function CatalogManager(props: CatalogProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const mutation = useMutation({
    mutationFn: async (operation: () => Promise<unknown>) => operation(),
    onSuccess: () => {
      setEditingId(null);
      setShowForm(false);
      router.refresh();
    },
  });

  const editItem = props.items.find((item) => item.id === editingId);
  const beginEdit = (id: string) => { setEditingId(id); setShowForm(true); mutation.reset(); };
  const beginCreate = () => { setEditingId(null); setShowForm(true); mutation.reset(); };
  const cancel = () => { setEditingId(null); setShowForm(false); mutation.reset(); };

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="overflow-hidden py-0">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="font-semibold">{catalogTitle(props.kind)}</p>
            <p className="text-xs text-muted-foreground">{props.items.length} configured</p>
          </div>
          {props.canManage ? <Button onClick={beginCreate}><Plus />Add {singular(props.kind)}</Button> : null}
        </div>
        {props.items.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-muted-foreground">
            No {catalogTitle(props.kind).toLowerCase()} have been configured yet.
          </div>
        ) : (
          <CatalogTable
            props={props}
            pending={mutation.isPending}
            onEdit={beginEdit}
            onToggle={(id, active) => mutation.mutate(() => toggleResource(props.kind, id, active))}
            onDelete={(id) => mutation.mutate(() => floorService.remove(id))}
          />
        )}
      </Card>

      {showForm ? (
        <CatalogForm
          kind={props.kind}
          item={editItem}
          pending={mutation.isPending}
          error={mutation.error}
          onCancel={cancel}
          onSubmit={(operation) => mutation.mutate(operation)}
        />
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex min-h-40 flex-col items-center justify-center text-center">
            <p className="font-medium">Manage {catalogTitle(props.kind).toLowerCase()}</p>
            <p className="mt-1 max-w-64 text-sm text-muted-foreground">
              {props.canManage ? "Create a new record or select an existing row to edit it." : "You have read-only access to this catalog."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CatalogTable({ props, pending, onEdit, onToggle, onDelete }: {
  props: CatalogProps; pending: boolean; onEdit: (id: string) => void;
  onToggle: (id: string, active: boolean) => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          {props.kind === "floors" ? <><TableHead>Floor</TableHead><TableHead>Name</TableHead><TableHead>Rooms</TableHead></> : null}
          {props.kind === "room-types" ? <><TableHead>Code / name</TableHead><TableHead>Capacity</TableHead><TableHead>Base price</TableHead><TableHead>Status</TableHead></> : null}
          {props.kind === "services" ? <><TableHead>Service</TableHead><TableHead>Default price</TableHead><TableHead>Status</TableHead></> : null}
          {props.kind === "payment-methods" ? <><TableHead>Payment method</TableHead><TableHead>Status</TableHead></> : null}
          <TableHead className="text-right">Actions</TableHead>
        </TableRow></TableHeader>
        <TableBody>{props.items.map((item) => (
          <TableRow key={item.id}>
            {props.kind === "floors" ? <FloorCells item={item as ApiFloor} /> : null}
            {props.kind === "room-types" ? <RoomTypeCells item={item as ApiRoomType} /> : null}
            {props.kind === "services" ? <ServiceCells item={item as ApiService} /> : null}
            {props.kind === "payment-methods" ? <PaymentMethodCells item={item as ApiPaymentMethod} /> : null}
            <TableCell><div className="flex justify-end gap-1">
              {props.canManage ? <Button variant="ghost" size="icon-sm" onClick={() => onEdit(item.id)} aria-label="Edit"><Pencil /></Button> : null}
              {props.canManage && props.kind === "floors" ? (
                <Button variant="ghost" size="icon-sm" disabled={pending || (item as ApiFloor)._count?.rooms !== 0} onClick={() => onDelete(item.id)} aria-label="Delete floor"><Trash2 /></Button>
              ) : null}
              {props.canManage && props.kind !== "floors" ? (
                <Button variant="ghost" size="icon-sm" disabled={pending} onClick={() => onToggle(item.id, !(item as ApiRoomType | ApiService | ApiPaymentMethod).isActive)} aria-label={(item as ApiRoomType).isActive ? "Deactivate" : "Restore"}>
                  {(item as ApiRoomType).isActive ? <X /> : <RotateCcw />}
                </Button>
              ) : null}
            </div></TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
    </div>
  );
}

function FloorCells({ item }: { item: ApiFloor }) {
  return <><TableCell className="font-mono font-semibold">{item.number}</TableCell><TableCell>{item.name || "—"}</TableCell><TableCell>{item._count?.rooms ?? 0}</TableCell></>;
}
function RoomTypeCells({ item }: { item: ApiRoomType }) {
  return <><TableCell><p className="font-medium">{item.name}</p><p className="font-mono text-xs text-muted-foreground">{item.code}</p></TableCell><TableCell>{item.capacityAdults} adults · {item.capacityChildren} children</TableCell><TableCell className="font-mono">{item.basePrice}</TableCell><TableCell><ActiveBadge active={item.isActive} /></TableCell></>;
}
function ServiceCells({ item }: { item: ApiService }) {
  return <><TableCell><p className="font-medium">{item.name}</p><p className="max-w-md truncate text-xs text-muted-foreground">{item.description || "No description"}</p></TableCell><TableCell className="font-mono">{item.defaultPrice}</TableCell><TableCell><ActiveBadge active={item.isActive} /></TableCell></>;
}
function PaymentMethodCells({ item }: { item: ApiPaymentMethod }) {
  return <><TableCell className="font-medium">{item.name}</TableCell><TableCell><ActiveBadge active={item.isActive} /></TableCell></>;
}
function ActiveBadge({ active }: { active: boolean }) { return <Badge variant={active ? "default" : "secondary"}>{active ? "Active" : "Inactive"}</Badge>; }

function CatalogForm({ kind, item, pending, error, onCancel, onSubmit }: {
  kind: CatalogProps["kind"]; item?: CatalogProps["items"][number]; pending: boolean; error: unknown;
  onCancel: () => void; onSubmit: (operation: () => Promise<unknown>) => void;
}) {
  const floor = kind === "floors" ? item as ApiFloor | undefined : undefined;
  const roomType = kind === "room-types" ? item as ApiRoomType | undefined : undefined;
  const service = kind === "services" ? item as ApiService | undefined : undefined;
  const method = kind === "payment-methods" ? item as ApiPaymentMethod | undefined : undefined;
  return (
    <Card>
      <CardHeader><CardTitle>{item ? "Edit" : "Add"} {singular(kind)}</CardTitle></CardHeader>
      <CardContent>
        {error ? <Alert variant="destructive" className="mb-4"><AlertTitle>Could not save</AlertTitle><AlertDescription>{getApiError(error).message}</AlertDescription></Alert> : null}
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault(); const data = new FormData(event.currentTarget);
          onSubmit(() => submitResource(kind, item?.id, data));
        }}>
          {floor !== undefined || kind === "floors" ? <>
            <Field label="Floor number" name="number" type="number" required defaultValue={floor?.number ?? ""} min={-20} max={300} />
            <Field label="Display name" name="name" defaultValue={floor?.name ?? ""} placeholder="e.g. Ground floor" />
          </> : null}
          {roomType !== undefined || kind === "room-types" ? <>
            <div className="grid grid-cols-2 gap-3"><Field label="Code" name="code" required defaultValue={roomType?.code ?? ""} placeholder="STD" /><Field label="Name" name="name" required defaultValue={roomType?.name ?? ""} /></div>
            <div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" defaultValue={roomType?.description ?? ""} rows={3} /></div>
            <div className="grid grid-cols-2 gap-3"><Field label="Adults" name="capacityAdults" type="number" min={1} max={50} required defaultValue={roomType?.capacityAdults ?? 2} /><Field label="Children" name="capacityChildren" type="number" min={0} max={50} required defaultValue={roomType?.capacityChildren ?? 0} /></div>
            <Field label="Base nightly price" name="basePrice" inputMode="decimal" required defaultValue={roomType?.basePrice ?? ""} placeholder="100.00" />
          </> : null}
          {service !== undefined || kind === "services" ? <>
            <Field label="Service name" name="name" required defaultValue={service?.name ?? ""} />
            <div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" defaultValue={service?.description ?? ""} rows={3} /></div>
            <Field label="Default price" name="defaultPrice" inputMode="decimal" required defaultValue={service?.defaultPrice ?? ""} placeholder="25.00" />
          </> : null}
          {method !== undefined || kind === "payment-methods" ? <Field label="Method name" name="name" required defaultValue={method?.name ?? ""} placeholder="e.g. Cash" /> : null}
          <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <Check />}{pending ? "Saving..." : "Save"}</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field(props: React.ComponentProps<typeof Input> & { label: string }) {
  const { label, ...inputProps } = props;
  return <div className="space-y-2"><Label htmlFor={inputProps.name}>{label}</Label><Input id={inputProps.name} {...inputProps} /></div>;
}

function submitResource(kind: CatalogProps["kind"], id: string | undefined, data: FormData) {
  const text = (name: string) => String(data.get(name) ?? "").trim();
  if (kind === "floors") {
    const input = { number: Number(text("number")), name: text("name") || undefined };
    return id ? floorService.update(id, input) : floorService.create(input);
  }
  if (kind === "room-types") {
    const input: RoomTypeInput = { code: text("code").toUpperCase(), name: text("name"), description: text("description") || undefined, capacityAdults: Number(text("capacityAdults")), capacityChildren: Number(text("capacityChildren")), basePrice: text("basePrice") };
    return id ? roomTypeService.update(id, input) : roomTypeService.create(input);
  }
  if (kind === "services") {
    const input: ServiceInput = { name: text("name"), description: text("description") || undefined, defaultPrice: text("defaultPrice") };
    return id ? serviceCatalogService.update(id, input) : serviceCatalogService.create(input);
  }
  return id ? paymentMethodService.update(id, text("name")) : paymentMethodService.create(text("name"));
}

function toggleResource(kind: CatalogProps["kind"], id: string, active: boolean) {
  if (kind === "room-types") return roomTypeService.setActive(id, active);
  if (kind === "services") return serviceCatalogService.setActive(id, active);
  if (kind === "payment-methods") return paymentMethodService.setActive(id, active);
  return Promise.resolve();
}
function catalogTitle(kind: CatalogProps["kind"]) { return ({ floors: "Floors", "room-types": "Room types", services: "Guest services", "payment-methods": "Payment methods" })[kind]; }
function singular(kind: CatalogProps["kind"]) { return ({ floors: "floor", "room-types": "room type", services: "service", "payment-methods": "payment method" })[kind]; }
