export {};

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface UpdateInfo {
  available:      boolean;
  currentVersion: string;
  latestVersion:  string;
  releaseNotes:   string | null;
}

declare global {
interface Window {
  api: {
    login:    (data: { email: string; password: string }) => Promise<ApiResponse<AuthResponse>>;
    register: (data: { username: string; email: string; password: string }) => Promise<ApiResponse<AuthResponse>>;
    getLibrary:  () => Promise<unknown>;
    installGame: (id: string) => Promise<unknown>;
    isUpdateAvailable: () => Promise<UpdateInfo>;
    installUpdate: () => void;
    onUpdateProgress: (cb: (percent: number) => void) => void;
  };
}
}