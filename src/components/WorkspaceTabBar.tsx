import { useState, useRef, useEffect } from "react";
import { X, Plus, Copy, Edit2 } from "lucide-react";
import { useCanvasStore } from "../store/canvasStore";
import { UI_COLORS } from "../utils/colors";

const WorkspaceTabBar = () => {
  const {
    workspaceTabs,
    activeWorkspaceId,
    switchWorkspace,
    addWorkspace,
    removeWorkspace,
    renameWorkspace,
    duplicateWorkspace,
  } = useCanvasStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);

  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu]);

  const startRename = (tabId: string, currentName: string) => {
    setRenamingId(tabId);
    setRenameValue(currentName);
    setContextMenu(null);
  };

  const confirmRename = () => {
    if (renamingId && renameValue.trim()) {
      renameWorkspace(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ tabId, x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div className="fixed top-0 left-0 w-full h-10 z-40 flex items-stretch border-b-2 border-black bg-white">
        {/* Tabs area */}
        <div className="flex-1 flex items-stretch overflow-x-auto no-scrollbar">
          {workspaceTabs.map((tab) => {
            const isActive = tab.id === activeWorkspaceId;
            const isRenaming = tab.id === renamingId;

            return (
              <div
                key={tab.id}
                onClick={() => {
                  if (!isRenaming) switchWorkspace(tab.id);
                }}
                onDoubleClick={() => startRename(tab.id, tab.name)}
                onContextMenu={(e) => handleContextMenu(e, tab.id)}
                className={`group flex items-center gap-1 px-3 min-w-[120px] max-w-[200px] border-r-2 border-black cursor-pointer select-none transition-colors ${
                  isActive
                    ? "-mb-[2px] border-b-0 pb-[2px]"
                    : "hover:bg-gray-50"
                }`}
                style={{
                  backgroundColor: isActive ? UI_COLORS.cyan : undefined,
                }}
              >
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmRename();
                      if (e.key === "Escape") cancelRename();
                    }}
                    onBlur={confirmRename}
                    className="flex-1 min-w-0 bg-transparent border-b-2 border-black outline-none font-heading text-xs px-0 py-0.5"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 truncate font-heading text-xs">
                    {tab.name}
                  </span>
                )}

                {/* Close button - hidden when only 1 tab */}
                {workspaceTabs.length > 1 && !isRenaming && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeWorkspace(tab.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded-sm hover:bg-black/10 transition-opacity flex-shrink-0"
                    title="Close tab"
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Add tab button */}
        <button
          onClick={addWorkspace}
          className="flex items-center justify-center w-10 border-l-0 border-black hover:brightness-95 transition-all flex-shrink-0"
          style={{ backgroundColor: UI_COLORS.green }}
          title="New workspace"
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white border-2 border-black rounded-base shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] py-1 min-w-[140px] animate-scaleIn"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-xs font-heading hover:bg-gray-100 flex items-center gap-2"
            onClick={() => {
              const tab = workspaceTabs.find((t) => t.id === contextMenu.tabId);
              if (tab) startRename(tab.id, tab.name);
            }}
          >
            <Edit2 size={12} /> Rename
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs font-heading hover:bg-gray-100 flex items-center gap-2"
            onClick={() => {
              duplicateWorkspace(contextMenu.tabId);
              setContextMenu(null);
            }}
          >
            <Copy size={12} /> Duplicate
          </button>
          <button
            className={`w-full text-left px-3 py-1.5 text-xs font-heading flex items-center gap-2 ${
              workspaceTabs.length <= 1
                ? "text-gray-400 cursor-not-allowed"
                : "hover:bg-gray-100"
            }`}
            onClick={() => {
              if (workspaceTabs.length > 1) {
                removeWorkspace(contextMenu.tabId);
                setContextMenu(null);
              }
            }}
            disabled={workspaceTabs.length <= 1}
          >
            <X size={12} /> Close
          </button>
        </div>
      )}
    </>
  );
};

export default WorkspaceTabBar;
