import { api } from "@/lib/api";
import type { ApiHotel } from "@/types/api-contracts";
export const hotelService = { async update(input: Pick<ApiHotel, "code" | "name" | "phone" | "email" | "address" | "currencyCode" | "timezone">) { const { data } = await api.patch<ApiHotel>("/hotels/current", input); return data; } };
