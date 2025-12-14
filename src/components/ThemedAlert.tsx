import { useEffect, useState } from "react";
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { UI_COLORS } from "../utils/colors";

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
  isLatest: boolean;
}

function ThemedAlert({ alert, onClose, isLatest }: ThemedAlertProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (alert.type !== "confirm" && alert.duration !== Infinity) {
      const timer = setTimeout(() => {
        handleClose();
      }, alert.duration || 3000);

      return () => clearTimeout(timer);
    }
  }, [alert.duration, alert.type]);

  // Handle Enter key - only for the latest alert
  useEffect(() => {
    if (!isLatest) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (alert.type === "confirm") {
          handleConfirm();
        } else {
          handleClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [alert.type, isLatest]);

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
          bgColor: UI_COLORS.green,
          icon: <CheckCircle size={20} strokeWidth={2.5} />,
        };
      case "error":
        return {
          bgColor: UI_COLORS.red,
          icon: <AlertCircle size={20} strokeWidth={2.5} />,
        };
      case "warning":
        return {
          bgColor: UI_COLORS.orange,
          icon: <AlertTriangle size={20} strokeWidth={2.5} />,
        };
      case "info":
        return {
          bgColor: UI_COLORS.blue,
          icon: <Info size={20} strokeWidth={2.5} />,
        };
      case "confirm":
        return {
          bgColor: UI_COLORS.pink,
          icon: <AlertCircle size={20} strokeWidth={2.5} />,
        };
    }
  };

  const styles = getAlertStyles();

  return (
    <div
      className={`transition-all duration-200 ${
        isExiting
          ? "opacity-0 translate-x-4"
          : "opacity-100 translate-x-0 animate-slideIn"
      }`}
    >
      <Alert
        className="min-w-[300px] max-w-[500px]"
        style={{ backgroundColor: styles.bgColor }}
      >
        {styles.icon}
        <AlertDescription className="font-base text-sm leading-snug">
          {alert.message}
          {alert.type === "confirm" && (
            <div className="flex gap-2 mt-3">
              <Button onClick={handleCancel} variant="neutral" size="sm">
                {alert.cancelText || "Cancel"}
              </Button>
              <Button
                onClick={handleConfirm}
                size="sm"
                style={{ backgroundColor: UI_COLORS.redDelete }}
              >
                {alert.confirmText || "Confirm"}
              </Button>
            </div>
          )}
        </AlertDescription>
        {alert.type !== "confirm" && (
          <button
            onClick={handleClose}
            className="absolute right-2 top-2 p-1 hover:bg-black/10 rounded-base transition"
            title="Close"
          >
            <X size={18} strokeWidth={3} />
          </button>
        )}
      </Alert>
    </div>
  );
}

export default ThemedAlert;
