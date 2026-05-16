export {};

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

declare global {
interface Window {
  api: {
    login:    (data: { email: string; password: string }) => Promise<ApiResponse<AuthResponse>>;
    register: (data: { username: string; email: string; password: string }) => Promise<ApiResponse<AuthResponse>>;
    getLibrary:  () => Promise<unknown>;
    installGame: (id: string) => Promise<unknown>;
  };
}
}