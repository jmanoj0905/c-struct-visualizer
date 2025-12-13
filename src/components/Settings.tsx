import { X, BookOpen, Grid3x3 } from "lucide-react";
import { useState } from "react";

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
      <div className="bg-white rounded-none w-full max-w-md mx-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        {/* Header */}
        <div className="bg-[#FFB3D9] px-6 py-4 border-b-4 border-black flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">SETTINGS</h2>
          <button
            onClick={onClose}
            className="hover:bg-black/10 p-2 rounded-none border-2 border-black bg-white transition"
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
                <h3 className="text-sm font-bold tracking-tight">HOW TO USE</h3>
                <button
                  onClick={() => setShowGuide(false)}
                  className="text-sm font-bold hover:underline"
                >
                  Back
                </button>
              </div>
              <div className="bg-yellow-100 border-4 border-black rounded-none p-4 space-y-3 max-h-96 overflow-y-auto">
                <div>
                  <div className="text-sm font-bold mb-1">
                    1. Define Structs
                  </div>
                  <div className="text-sm">
                    Click the code icon in sidebar to define C structs
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold mb-1">2. Add Instances</div>
                  <div className="text-sm">
                    Drag structs from sidebar or double-click to add to canvas
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold mb-1">
                    3. Connect Pointers
                  </div>
                  <div className="text-sm">
                    Drag from right handles (pointers) to left handles (targets)
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold mb-1">4. Quick Connect</div>
                  <div className="text-sm">
                    Drag pointer to empty space, search struct, press Enter
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold mb-1">5. Organize</div>
                  <div className="text-sm">
                    Click sparkle icon to auto-layout your structures
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold mb-1">6. Export</div>
                  <div className="text-sm">
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
                <h3 className="text-sm font-bold tracking-tight mb-3">
                  CANVAS OPTIONS
                </h3>
                <button
                  onClick={() => onSnapToGridChange(!snapToGrid)}
                  className={`w-full px-4 py-3 rounded-none border-4 border-black transition flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 ${
                    snapToGrid ? "bg-[#A5D6A7]" : "bg-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Grid3x3 size={20} strokeWidth={2.5} />
                    <span className="text-sm font-bold">Snap to Grid</span>
                  </div>
                  <div
                    className={`w-12 h-6 rounded-full border-3 border-black relative transition-colors ${
                      snapToGrid ? "bg-green-500" : "bg-gray-400"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white border-2 border-black transition-transform ${
                        snapToGrid ? "translate-x-6" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </button>
              </div>

              {/* How to Use Button */}
              <div>
                <h3 className="text-sm font-bold tracking-tight mb-3">HELP</h3>
                <button
                  onClick={() => setShowGuide(true)}
                  className="w-full bg-[#BAE1FF] border-4 border-black rounded-none p-4 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition active:shadow-none active:translate-x-1 active:translate-y-1 flex items-center gap-3"
                >
                  <BookOpen size={20} strokeWidth={2.5} />
                  <span className="text-sm font-bold">How to Use</span>
                </button>
              </div>

              {/* About Section */}
              <div>
                <h3 className="text-sm font-bold tracking-tight mb-3">ABOUT</h3>
                <div className="bg-[#FFDFBA] border-4 border-black rounded-none p-4 space-y-2">
                  <div className="text-center">
                    <div className="text-lg font-bold mb-1">
                      C Struct Visualizer
                    </div>
                    <div className="text-sm mb-3">
                      Interactive data structure visualization tool
                    </div>
                    <div className="text-sm font-bold pt-3 border-t-4 border-black">
                      Made by <span className="text-purple-600">Manoj</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Version */}
              <div className="text-center">
                <div className="text-xs font-bold opacity-50">v1.0.0</div>
              </div>
            </>
          )}
        </div>

        {/* Close Button */}
        <div className="p-4 border-t-4 border-black">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-[#FFB3D9] hover:bg-[#FF8EC5] rounded-none border-4 border-black transition shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-sm font-bold active:shadow-none active:translate-x-1 active:translate-y-1"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
