export interface AccessTokenPayload {
  sub: string;
  hotelId: string;
  sid: string;
  iat?: number;
  exp?: number;
}

export interface RequestUser {
  id: string;
  hotelId: string;
  sessionId: string;
  email: string;
  username: string;
  fullName: string;
  roles: string[];
  permissions: string[];
}
