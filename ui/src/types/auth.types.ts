export interface AuthSession {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
}
