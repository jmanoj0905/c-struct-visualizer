import { useState, useRef, useEffect } from "react";
import { X, Plus, Copy, Edit2, XCircle, ChevronRight } from "lucide-react";
import { useCanvasStore } from "../store/canvasStore";
import { UI_COLORS } from "../utils/colors";
import { showAlert } from "./AlertContainer";

const WS_KEY = "c-struct-workspace-";

const WorkspaceTabBar = () => {
  const {
    workspaceTabs,
    activeWorkspaceId,
    switchWorkspace,
    addWorkspace,
    removeWorkspace,
    renameWorkspace,
    duplicateWorkspace,
    reorderWorkspaces,
    closeOtherWorkspaces,
    closeRightWorkspaces,
    instances,
    structDefinitions,
    pointerInstances,
    pointerDefinitions,
  } = useCanvasStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);

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

  const tabHasContent = (tabId: string): boolean => {
    if (tabId === activeWorkspaceId) {
      return (
        instances.length > 0 ||
        structDefinitions.length > 0 ||
        pointerInstances.length > 0 ||
        pointerDefinitions.length > 0
      );
    }
    try {
      const raw = localStorage.getItem(WS_KEY + tabId);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return (
        (data.instances?.length ?? 0) > 0 ||
        (data.structDefinitions?.length ?? 0) > 0 ||
        (data.pointerInstances?.length ?? 0) > 0 ||
        (data.pointerDefinitions?.length ?? 0) > 0
      );
    } catch {
      return false;
    }
  };

  const handleCloseTab = (tabId: string) => {
    if (workspaceTabs.length <= 1) return;
    if (tabHasContent(tabId)) {
      const tab = workspaceTabs.find((t) => t.id === tabId);
      showAlert({
        type: "confirm",
        message: `Close "${tab?.name ?? "workspace"}"? It has content that will be lost.`,
        onConfirm: () => removeWorkspace(tabId),
        confirmText: "Close",
        cancelText: "Cancel",
      });
    } else {
      removeWorkspace(tabId);
    }
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
    setDragSourceIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      reorderWorkspaces(fromIndex, toIndex);
    }
    setDragOverIndex(null);
    setDragSourceIndex(null);
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
    setDragSourceIndex(null);
  };

  return (
    <>
      <div className="fixed top-0 left-0 w-full h-7 z-40 flex items-stretch border-b-2 border-black bg-white">
        {/* Tabs area + inline add button */}
        <div className="flex-1 flex items-stretch overflow-x-auto no-scrollbar">
          {workspaceTabs.map((tab, index) => {
            const isActive = tab.id === activeWorkspaceId;
            const isRenaming = tab.id === renamingId;
            const isDragOver = dragOverIndex === index && dragSourceIndex !== index;

            return (
              <div
                key={tab.id}
                draggable={!isRenaming}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                onClick={() => {
                  if (!isRenaming) switchWorkspace(tab.id);
                }}
                onDoubleClick={() => startRename(tab.id, tab.name)}
                onContextMenu={(e) => handleContextMenu(e, tab.id)}
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    handleCloseTab(tab.id);
                  }
                }}
                className={`group relative flex items-center gap-1 px-2 min-w-[100px] max-w-[200px] border-r-2 border-black cursor-pointer select-none transition-colors ${
                  isActive ? "bg-white" : "hover:bg-gray-50"
                } ${isDragOver ? "border-l-[3px] border-l-blue-500" : ""}`}
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
                    className="flex-1 min-w-0 bg-transparent border-b border-black outline-none font-heading text-[11px] px-0 py-0.5"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 truncate font-heading text-[11px]">
                    {tab.name}
                  </span>
                )}

                {/* Close button - hidden when only 1 tab */}
                {workspaceTabs.length > 1 && !isRenaming && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTab(tab.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded-sm hover:bg-black/10 transition-opacity flex-shrink-0"
                    title="Close tab"
                  >
                    <X size={10} strokeWidth={2.5} />
                  </button>
                )}

                {/* Active tab underline indicator */}
                {isActive && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-[3px]"
                    style={{ backgroundColor: UI_COLORS.cyan }}
                  />
                )}
              </div>
            );
          })}

          {/* Inline add tab button */}
          <button
            onClick={addWorkspace}
            className="w-7 h-full flex-shrink-0 flex items-center justify-center hover:bg-gray-100 transition-colors"
            title="New workspace"
          >
            <Plus size={14} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white border-2 border-black rounded-base shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] py-1 min-w-[160px] animate-scaleIn"
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
                handleCloseTab(contextMenu.tabId);
                setContextMenu(null);
              }
            }}
            disabled={workspaceTabs.length <= 1}
          >
            <X size={12} /> Close
          </button>

          {/* Divider */}
          <div className="border-t border-gray-200 my-1" />

          <button
            className={`w-full text-left px-3 py-1.5 text-xs font-heading flex items-center gap-2 ${
              workspaceTabs.length <= 1
                ? "text-gray-400 cursor-not-allowed"
                : "hover:bg-gray-100"
            }`}
            onClick={() => {
              if (workspaceTabs.length > 1) {
                closeOtherWorkspaces(contextMenu.tabId);
                setContextMenu(null);
              }
            }}
            disabled={workspaceTabs.length <= 1}
          >
            <XCircle size={12} /> Close Others
          </button>
          <button
            className={`w-full text-left px-3 py-1.5 text-xs font-heading flex items-center gap-2 ${
              workspaceTabs.findIndex((t) => t.id === contextMenu.tabId) >=
              workspaceTabs.length - 1
                ? "text-gray-400 cursor-not-allowed"
                : "hover:bg-gray-100"
            }`}
            onClick={() => {
              const idx = workspaceTabs.findIndex(
                (t) => t.id === contextMenu.tabId,
              );
              if (idx < workspaceTabs.length - 1) {
                closeRightWorkspaces(contextMenu.tabId);
                setContextMenu(null);
              }
            }}
            disabled={
              workspaceTabs.findIndex((t) => t.id === contextMenu.tabId) >=
              workspaceTabs.length - 1
            }
          >
            <ChevronRight size={12} /> Close to Right
          </button>
        </div>
      )}
    </>
  );
};

export default WorkspaceTabBar;
