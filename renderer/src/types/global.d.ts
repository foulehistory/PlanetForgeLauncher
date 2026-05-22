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

export interface InstallProgress {
  stage: "idle" | "downloading" | "extracting" | "finalizing" | "completed" | "failed";
  gameId: number;
  gameTitle: string;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  speedMbps: number;
  drops: number;
  message?: string;
}

declare global {
interface Window {
  api: {
    login:    (data: { email: string; password: string; remember_me: boolean }) => Promise<ApiResponse<AuthResponse>>;
    register: (data: { username: string; email: string; password: string }) => Promise<ApiResponse<AuthResponse>>;
    refresh:  (data: { refresh_token: string }) => Promise<ApiResponse<RefreshResponse>>;
    getLibrary:  () => Promise<unknown>;
    installGame: (data: { gameId: number; gameTitle: string; token: string; version?: string | null }) => Promise<{ success: boolean; cancelled?: boolean; installPath?: string; error?: string }>;
    playGame: (data: { gameId: number; gameTitle: string; token: string; installPath: string; executablePath?: string | null }) => Promise<{ success: boolean; error?: string }>;
    uninstallGame: (data: { gameId: number; token: string; installPath: string }) => Promise<{ success: boolean; error?: string }>;
    isUpdateAvailable: () => Promise<UpdateInfo>;
    installUpdate: () => void;
    onUpdateProgress: (cb: (percent: number) => void) => void;
    onInstallProgress: (cb: (progress: InstallProgress) => void) => () => void;
  };
}
}