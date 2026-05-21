import { createContext, useContext, useCallback, useMemo, useState, type ReactNode } from "react";

export type NotificationType = "success" | "error" | "info" | "warning";

export interface NotificationAction {
  label: string;
  variant?: "primary" | "danger" | "ghost";
  onClick: () => void;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // ms, 0 = no auto-close
  actions?: NotificationAction[];
}

type NotificationContextValue = {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id">) => string;
  removeNotification: (id: string) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, "id">) => {
    const id = `notif-${Date.now()}-${Math.random()}`;
    const fullNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? 4000,
    };

    setNotifications((prev) => [...prev, fullNotification]);

    // Relay to overlay when app is not in focus
    if (!document.hasFocus()) {
      (window as Window & { api?: { overlayShowNotif?: (d: unknown) => void } }).api?.overlayShowNotif?.({
        id,
        type:     fullNotification.type,
        title:    fullNotification.title,
        message:  fullNotification.message,
        duration: fullNotification.duration,
      });
    }

    // Auto-close if duration > 0
    const duration = fullNotification.duration ?? 0;
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    (window as Window & { api?: { overlayRemoveNotif?: (id: string) => void } }).api?.overlayRemoveNotif?.(id);
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      addNotification,
      removeNotification,
    }),
    [notifications, addNotification, removeNotification]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used inside NotificationProvider");
  }
  return context;
}

// Convenience functions for common cases
export function useNotificationHelpers() {
  const { addNotification } = useNotification();

  return {
    success: (title: string, message?: string) =>
      addNotification({ type: "success", title, message }),
    error: (title: string, message?: string) =>
      addNotification({ type: "error", title, message }),
    info: (title: string, message?: string) =>
      addNotification({ type: "info", title, message }),
    warning: (title: string, message?: string) =>
      addNotification({ type: "warning", title, message }),
  };
}