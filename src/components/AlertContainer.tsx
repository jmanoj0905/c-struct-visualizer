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
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none">
      {alerts.map((alert) => (
        <div key={alert.id} className="pointer-events-auto">
          <ThemedAlert alert={alert} onClose={removeAlert} />
        </div>
      ))}
    </div>
  );
}

export default AlertContainer;
