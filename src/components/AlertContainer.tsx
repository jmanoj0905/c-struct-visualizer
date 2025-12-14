import { useState, useEffect } from "react";
import ThemedAlert, { type AlertConfig } from "./ThemedAlert";

interface AlertWithId extends AlertConfig {
  id: string;
}

let alertIdCounter = 0;
let addAlertCallback: ((alert: AlertConfig) => void) | null = null;

export const showAlert = (alert: AlertConfig) => {
  if (addAlertCallback) {
    addAlertCallback(alert);
  }
};

function AlertContainer() {
  const [alerts, setAlerts] = useState<AlertWithId[]>([]);

  useEffect(() => {
    addAlertCallback = (alert: AlertConfig) => {
      const newAlert: AlertWithId = {
        ...alert,
        id: `alert-${alertIdCounter++}`,
      };
      setAlerts((prev) => [...prev, newAlert]);
    };

    return () => {
      addAlertCallback = null;
    };
  }, []);

  const removeAlert = (id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  };

  return (
    <>
      {/* Regular alerts (top-right) */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        {alerts
          .filter((a) => a.type !== "confirm")
          .map((alert, index) => (
            <div key={alert.id} className="pointer-events-auto">
              <ThemedAlert
                alert={alert}
                onClose={removeAlert}
                isLatest={
                  index ===
                  alerts.filter((a) => a.type !== "confirm").length - 1
                }
              />
            </div>
          ))}
      </div>

      {/* Confirmation dialogs (centered) */}
      {alerts
        .filter((a) => a.type === "confirm")
        .map((alert, index, arr) => (
          <div
            key={alert.id}
            className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto">
              <ThemedAlert
                alert={alert}
                onClose={removeAlert}
                isLatest={index === arr.length - 1}
              />
            </div>
          </div>
        ))}
    </>
  );
}

export default AlertContainer;
