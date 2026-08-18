export interface AuthUser {
  id: string; hotelId: string; name: string; email: string; username: string;
  roles: string[]; role: string; permissions: string[];
}
export interface LoginCredentials { identifier: string; password: string }
