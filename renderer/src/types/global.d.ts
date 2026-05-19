export {};

interface AuthResponse {
  user_id: string;
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  refresh_expires_at: string;
}

interface RefreshResponse {
  access_token: string;
  access_expires_at: string;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string | null;
  error: string | null;
}

declare global {
interface Window {
  api: {
    login:    (data: { email: string; password: string; remember_me: boolean }) => Promise<ApiResponse<AuthResponse>>;
    register: (data: { username: string; email: string; password: string }) => Promise<ApiResponse<AuthResponse>>;
    refresh:  (data: { refresh_token: string }) => Promise<ApiResponse<RefreshResponse>>;
    getLibrary:  () => Promise<unknown>;
    installGame: (id: string) => Promise<unknown>;
    isUpdateAvailable: () => Promise<UpdateInfo>;
    installUpdate: () => void;
    onUpdateProgress: (cb: (percent: number) => void) => void;
  };
}
}