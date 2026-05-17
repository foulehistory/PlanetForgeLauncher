import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { useNotification, type Notification } from "./Notifications";
import { useI18n } from "./i18n";

const notificationIcons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const notificationColors = {
  success: "var(--color-success)",
  error: "var(--color-danger)",
  info: "var(--accent)",
  warning: "var(--color-warning)",
};

function NotificationItem({ notification }: { notification: Notification }) {
  const { removeNotification } = useNotification();
  const { t } = useI18n();
  const Icon = notificationIcons[notification.type];
  const color = notificationColors[notification.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 400, y: 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 400 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="notification-item"
      style={{
        background: "var(--bg-surface)",
        border: `1px solid ${color}`,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div className="notification-icon" style={{ color }}>
        <Icon size={18} />
      </div>

      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        {notification.message && (
          <div className="notification-message">{notification.message}</div>
        )}
      </div>

      <button
        className="notification-close"
        onClick={() => removeNotification(notification.id)}
        aria-label={t.closeNotificationAria}
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}

export function NotificationManager() {
  const { notifications } = useNotification();

  return (
    <div className="notification-container">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} />
        ))}
      </AnimatePresence>
    </div>
  );
}