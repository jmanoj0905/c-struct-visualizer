import {
  Menu,
  Settings as SettingsIcon,
  Save,
  Upload,
  FileImage,
  FileType,
  FileCode,
  Copy,
  X,
  Layers,
} from "lucide-react";
import { useState } from "react";
import { UI_COLORS } from "../utils/colors";

interface HamburgerMenuProps {
  onOpenSettings: () => void;
  onSaveWorkspace: () => void;
  onLoadWorkspace: () => void;
  onOpenTemplates: () => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportPDF: () => void;
  onCopyToClipboard: () => void;
}

const HamburgerMenu = ({
  onOpenSettings,
  onSaveWorkspace,
  onLoadWorkspace,
  onOpenTemplates,
  onExportPNG,
  onExportSVG,
  onExportPDF,
  onCopyToClipboard,
}: HamburgerMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleItemClick = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 border-2 border-black rounded-base hover:translate-x-1 hover:translate-y-1 transition-transform shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
        style={{ backgroundColor: UI_COLORS.purple }}
        title="Menu"
      >
        {isOpen ? (
          <X size={22} strokeWidth={2.5} />
        ) : (
          <Menu size={22} strokeWidth={2.5} />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-2 w-56 bg-white border-3 border-black rounded-base shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden z-20 dropdown-menu">
            {/* Settings */}
            <button
              onClick={() => handleItemClick(onOpenSettings)}
              className="w-full text-left px-4 py-3 font-heading text-sm hover:bg-gray-100 border-b-2 border-black transition-colors flex items-center gap-3"
            >
              <SettingsIcon size={18} strokeWidth={2.5} />
              <span>Settings</span>
            </button>

            {/* Divider */}
            <div className="border-b-2 border-black" />

            {/* Save & Load Section */}
            <div className="py-1">
              <button
                onClick={() => handleItemClick(onSaveWorkspace)}
                className="w-full text-left px-4 py-2.5 font-heading text-sm hover:bg-gray-100 transition-colors flex items-center gap-3"
              >
                <Save size={18} strokeWidth={2.5} />
                <span>Save Workspace</span>
              </button>
              <button
                onClick={() => handleItemClick(onLoadWorkspace)}
                className="w-full text-left px-4 py-2.5 font-heading text-sm hover:bg-gray-100 transition-colors flex items-center gap-3"
              >
                <Upload size={18} strokeWidth={2.5} />
                <span>Load Workspace</span>
              </button>
            </div>

            {/* Divider */}
            <div className="border-b-2 border-black" />

            {/* Templates Section */}
            <div className="py-1">
              <button
                onClick={() => handleItemClick(onOpenTemplates)}
                className="w-full text-left px-4 py-2.5 font-heading text-sm hover:bg-gray-100 transition-colors flex items-center gap-3"
              >
                <Layers size={18} strokeWidth={2.5} />
                <span>Templates</span>
              </button>
            </div>

            {/* Divider */}
            <div className="border-b-2 border-black" />

            {/* Export Section */}
            <div className="py-1">
              <div className="px-4 py-2 text-xs font-heading text-gray-500 uppercase tracking-wider">
                Export As
              </div>
              <button
                onClick={() => handleItemClick(onExportPNG)}
                className="w-full text-left px-4 py-2.5 font-heading text-sm hover:bg-gray-100 transition-colors flex items-center gap-3"
              >
                <FileImage size={18} strokeWidth={2.5} />
                <span>PNG Image</span>
              </button>
              <button
                onClick={() => handleItemClick(onExportSVG)}
                className="w-full text-left px-4 py-2.5 font-heading text-sm hover:bg-gray-100 transition-colors flex items-center gap-3"
              >
                <FileType size={18} strokeWidth={2.5} />
                <span>SVG Vector</span>
              </button>
              <button
                onClick={() => handleItemClick(onExportPDF)}
                className="w-full text-left px-4 py-2.5 font-heading text-sm hover:bg-gray-100 transition-colors flex items-center gap-3"
              >
                <FileCode size={18} strokeWidth={2.5} />
                <span>PDF Document</span>
              </button>
              <button
                onClick={() => handleItemClick(onCopyToClipboard)}
                className="w-full text-left px-4 py-2.5 font-heading text-sm hover:bg-gray-100 transition-colors flex items-center gap-3"
              >
                <Copy size={18} strokeWidth={2.5} />
                <span>Copy to Clipboard</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HamburgerMenu;
