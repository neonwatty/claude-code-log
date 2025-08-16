export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface LogEntry {
  id: string;
  userId: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  timestamp: string;
  metadata?: Record<string, any>;
}