import { useEffect, useRef } from "react";
import {
  X,
  Settings as SettingsIcon,
  HelpCircle,
  Save,
  Upload,
  Layers,
  FileImage,
  FileType,
  FileCode,
  Copy,
} from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "free" | "visualizer";
  onOpenSettings: () => void;
  onShowHowToUse: () => void;
  // Free mode only:
  onSaveWorkspace?: () => void;
  onLoadWorkspace?: () => void;
  onOpenTemplates?: () => void;
  // Both modes:
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportPDF: () => void;
  onCopyToClipboard: () => void;
}

interface PaletteItem {
  label: string;
  icon: React.ReactNode;
  action: () => void;
}

const CommandPalette = ({
  isOpen,
  onClose,
  mode,
  onOpenSettings,
  onShowHowToUse,
  onSaveWorkspace,
  onLoadWorkspace,
  onOpenTemplates,
  onExportPNG,
  onExportSVG,
  onExportPDF,
  onCopyToClipboard,
}: CommandPaletteProps) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClick = (action: () => void) => {
    action();
    onClose();
  };

  const iconSize = 18;
  const iconStroke = 2.5;

  const workspaceItems: PaletteItem[] =
    mode === "free"
      ? [
          {
            label: "Save Workspace",
            icon: <Save size={iconSize} strokeWidth={iconStroke} />,
            action: () => handleClick(onSaveWorkspace!),
          },
          {
            label: "Load Workspace",
            icon: <Upload size={iconSize} strokeWidth={iconStroke} />,
            action: () => handleClick(onLoadWorkspace!),
          },
          {
            label: "Templates",
            icon: <Layers size={iconSize} strokeWidth={iconStroke} />,
            action: () => handleClick(onOpenTemplates!),
          },
        ]
      : [];

  const exportPrefix = mode === "visualizer" ? "Export Heap as " : "";
  const clipboardLabel =
    mode === "visualizer" ? "Copy Heap to Clipboard" : "Copy to Clipboard";

  const exportItems: PaletteItem[] = [
    {
      label: `${exportPrefix}PNG Image`,
      icon: <FileImage size={iconSize} strokeWidth={iconStroke} />,
      action: () => handleClick(onExportPNG),
    },
    {
      label: `${exportPrefix}SVG Vector`,
      icon: <FileType size={iconSize} strokeWidth={iconStroke} />,
      action: () => handleClick(onExportSVG),
    },
    {
      label: `${exportPrefix}PDF Document`,
      icon: <FileCode size={iconSize} strokeWidth={iconStroke} />,
      action: () => handleClick(onExportPDF),
    },
    {
      label: clipboardLabel,
      icon: <Copy size={iconSize} strokeWidth={iconStroke} />,
      action: () => handleClick(onCopyToClipboard),
    },
  ];

  const bottomItems: PaletteItem[] = [
    {
      label: "Settings",
      icon: <SettingsIcon size={iconSize} strokeWidth={iconStroke} />,
      action: () => handleClick(onOpenSettings),
    },
    {
      label: "How to Use",
      icon: <HelpCircle size={iconSize} strokeWidth={iconStroke} />,
      action: () => handleClick(onShowHowToUse),
    },
  ];

  const renderItem = (item: PaletteItem, idx: number) => (
    <button
      key={idx}
      onClick={item.action}
      className="w-full text-left px-4 py-2.5 font-heading text-sm hover:bg-gray-100 transition-colors flex items-center gap-3"
    >
      {item.icon}
      <span>{item.label}</span>
    </button>
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={(e) => {
        if (cardRef.current && !cardRef.current.contains(e.target as HTMLElement)) {
          onClose();
        }
      }}
    >
      <div
        ref={cardRef}
        className="bg-white border-2 border-black rounded-base shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] w-72 max-h-[80vh] overflow-y-auto animate-scaleIn"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-black">
          <span className="font-heading text-sm font-bold">Menu</span>
          <button
            onClick={onClose}
            className="p-0.5 rounded-sm hover:bg-black/10 transition-colors"
            title="Close"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Workspace section (free mode only) */}
        {workspaceItems.length > 0 && (
          <>
            <div className="px-4 py-2 text-xs font-heading text-gray-500 uppercase tracking-wider">
              Workspace
            </div>
            {workspaceItems.map(renderItem)}
            <div className="border-b-2 border-black" />
          </>
        )}

        {/* Export section */}
        <div className="px-4 py-2 text-xs font-heading text-gray-500 uppercase tracking-wider">
          Export
        </div>
        {exportItems.map(renderItem)}
        <div className="border-b-2 border-black" />

        {/* Bottom items */}
        {bottomItems.map(renderItem)}
      </div>
    </div>
  );
};

export default CommandPalette;
