import { X, BookOpen, Grid3x3 } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { UI_COLORS } from "../utils/colors";

interface SettingsProps {
  onClose: () => void;
  snapToGrid: boolean;
  onSnapToGridChange: (snap: boolean) => void;
}

const Settings = ({
  onClose,
  snapToGrid,
  onSnapToGridChange,
}: SettingsProps) => {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-base w-full max-w-md mx-4 border-2 border-black shadow-shadow">
        {/* Header */}
        <div
          className="px-6 py-4 border-b-2 border-black flex items-center justify-between"
          style={{ backgroundColor: UI_COLORS.pink }}
        >
          <h2 className="text-lg font-heading tracking-tight">SETTINGS</h2>
          <button
            onClick={onClose}
            className="hover:bg-black/10 p-2 rounded-base border-2 border-black bg-white transition"
          >
            <X size={20} strokeWidth={3} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {showGuide ? (
            /* Guide Section */
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-heading tracking-tight">
                  HOW TO USE
                </h3>
                <button
                  onClick={() => setShowGuide(false)}
                  className="text-sm font-heading hover:underline"
                >
                  Back
                </button>
              </div>
              <div
                className="border-2 border-black rounded-base p-4 space-y-3 max-h-96 overflow-y-auto"
                style={{ backgroundColor: UI_COLORS.yellow }}
              >
                <div>
                  <div className="text-sm font-heading mb-1">
                    1. Define Structs
                  </div>
                  <div className="text-sm font-base">
                    Click the code icon in sidebar to define C structs
                  </div>
                </div>
                <div>
                  <div className="text-sm font-heading mb-1">
                    2. Add Instances
                  </div>
                  <div className="text-sm font-base">
                    Drag structs from sidebar or double-click to add to canvas
                  </div>
                </div>
                <div>
                  <div className="text-sm font-heading mb-1">
                    3. Connect Pointers
                  </div>
                  <div className="text-sm font-base">
                    Drag from right handles (pointers) to left handles (targets)
                  </div>
                </div>
                <div>
                  <div className="text-sm font-heading mb-1">
                    4. Quick Connect
                  </div>
                  <div className="text-sm font-base">
                    Drag pointer to empty space, search struct, press Enter
                  </div>
                </div>
                <div>
                  <div className="text-sm font-heading mb-1">5. Organize</div>
                  <div className="text-sm font-base">
                    Click sparkle icon to auto-layout your structures
                  </div>
                </div>
                <div>
                  <div className="text-sm font-heading mb-1">6. Export</div>
                  <div className="text-sm font-base">
                    Click download icon in sidebar to save as PNG
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Main Settings */
            <>
              {/* Snap to Grid Toggle */}
              <div>
                <h3 className="text-sm font-heading tracking-tight mb-3">
                  CANVAS OPTIONS
                </h3>
                <div
                  className="w-full px-4 py-3 rounded-base border-2 border-black flex items-center justify-between"
                  style={{
                    backgroundColor: snapToGrid
                      ? UI_COLORS.green
                      : UI_COLORS.lime,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Grid3x3 size={20} strokeWidth={2.5} />
                    <span className="text-sm font-heading">Snap to Grid</span>
                  </div>
                  <button
                    onClick={() => onSnapToGridChange(!snapToGrid)}
                    className={`w-12 h-6 rounded-full border-2 border-black relative transition-all focus:outline-none hover:scale-105`}
                    style={{
                      backgroundColor: snapToGrid ? "#4ade80" : "#9ca3af",
                    }}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white border-2 border-black transition-transform ${
                        snapToGrid ? "translate-x-6" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* How to Use Button */}
              <div>
                <h3 className="text-sm font-heading tracking-tight mb-3">
                  HELP
                </h3>
                <Button
                  onClick={() => setShowGuide(true)}
                  className="w-full"
                  style={{ backgroundColor: UI_COLORS.cyan }}
                >
                  <BookOpen size={20} strokeWidth={2.5} />
                  <span>How to Use</span>
                </Button>
              </div>

              {/* About Section */}
              <div>
                <h3 className="text-sm font-heading tracking-tight mb-3">
                  ABOUT
                </h3>
                <div
                  className="border-2 border-black rounded-base p-4 space-y-2"
                  style={{ backgroundColor: UI_COLORS.orange }}
                >
                  <div className="text-center">
                    <div className="text-lg font-heading mb-1">
                      C Struct Visualizer
                    </div>
                    <div className="text-sm font-base mb-3">
                      Interactive data structure visualization tool
                    </div>
                    <div className="text-sm font-heading pt-3 border-t-2 border-black">
                      Made by <span className="text-purple-600">Manoj</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Version */}
              <div className="text-center">
                <div className="text-xs font-heading opacity-50">v1.2.0</div>
              </div>
            </>
          )}
        </div>

        {/* Close Button */}
        <div className="p-4 border-t-2 border-black">
          <Button
            onClick={onClose}
            className="w-full"
            style={{ backgroundColor: UI_COLORS.pink }}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
