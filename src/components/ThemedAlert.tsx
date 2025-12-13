import { useEffect, useState } from "react";
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";

export type AlertType = "success" | "error" | "info" | "warning" | "confirm";

export interface AlertConfig {
  type: AlertType;
  message: string;
  duration?: number;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface ThemedAlertProps {
  alert: AlertConfig & { id: string };
  onClose: (id: string) => void;
}

function ThemedAlert({ alert, onClose }: ThemedAlertProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (alert.type !== "confirm" && alert.duration !== Infinity) {
      const timer = setTimeout(() => {
        handleClose();
      }, alert.duration || 3000);

      return () => clearTimeout(timer);
    }
  }, [alert.duration, alert.type]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(alert.id);
    }, 200);
  };

  const handleConfirm = () => {
    alert.onConfirm?.();
    handleClose();
  };

  const handleCancel = () => {
    alert.onCancel?.();
    handleClose();
  };

  const getAlertStyles = () => {
    switch (alert.type) {
      case "success":
        return {
          bg: "bg-[#A5D6A7]",
          icon: <CheckCircle size={20} strokeWidth={2.5} />,
        };
      case "error":
        return {
          bg: "bg-[#EF9A9A]",
          icon: <AlertCircle size={20} strokeWidth={2.5} />,
        };
      case "warning":
        return {
          bg: "bg-[#FFCC80]",
          icon: <AlertTriangle size={20} strokeWidth={2.5} />,
        };
      case "info":
        return {
          bg: "bg-[#90CAF9]",
          icon: <Info size={20} strokeWidth={2.5} />,
        };
      case "confirm":
        return {
          bg: "bg-[#FFE5D9]",
          icon: <AlertCircle size={20} strokeWidth={2.5} />,
        };
    }
  };

  const styles = getAlertStyles();

  return (
    <div
      className={`${styles.bg} border-4 border-black rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4 min-w-[300px] max-w-[500px] transition-all duration-200 ${
        isExiting
          ? "opacity-0 translate-x-4"
          : "opacity-100 translate-x-0 animate-slideIn"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{styles.icon}</div>
        <div className="flex-1">
          <p className="font-bold text-sm leading-snug text-black">
            {alert.message}
          </p>
          {alert.type === "confirm" && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-bold bg-gray-200 hover:bg-gray-300 border-3 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition"
              >
                {alert.cancelText || "Cancel"}
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-bold bg-[#EF9A9A] hover:bg-[#E57373] border-3 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition"
              >
                {alert.confirmText || "Confirm"}
              </button>
            </div>
          )}
        </div>
        {alert.type !== "confirm" && (
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-1 hover:bg-black/10 rounded-none transition"
            title="Close"
          >
            <X size={18} strokeWidth={3} />
          </button>
        )}
      </div>
    </div>
  );
}

export default ThemedAlert;
