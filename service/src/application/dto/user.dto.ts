export interface CreateUserDto {
  username: string;
  password: string;
  email?: string;
  phone?: string;
  status?: 'ACTIVE' | 'LOCKED' | 'DISABLED';
}

export interface UpdateUserDto {
  email?: string;
  phone?: string;
  status?: 'ACTIVE' | 'LOCKED' | 'DISABLED';
}

export interface UserResponse {
  id: string;
  username: string;
  email?: string | null;
  emailVerified: boolean;
  phone?: string | null;
  phoneVerified: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
