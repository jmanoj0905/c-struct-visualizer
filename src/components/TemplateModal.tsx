import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { UI_COLORS } from "../utils/colors";

interface Template {
  name: string;
  icon: LucideIcon;
  description: string;
}

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (templateKey: string) => void;
  templates: Record<string, Template>;
}

const TemplateModal = ({
  isOpen,
  onClose,
  onSelectTemplate,
  templates,
}: TemplateModalProps) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto bg-white border-4 border-black rounded-base shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-2xl w-full animate-scaleIn">
          {/* Header */}
          <div
            className="flex items-center justify-between p-4 border-b-4 border-black"
            style={{ backgroundColor: UI_COLORS.cyan }}
          >
            <h2 className="text-xl font-heading tracking-wider uppercase">
              Quick Start Templates
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 border-2 border-black rounded-base hover:translate-x-1 hover:translate-y-1 transition-transform shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none bg-white"
              title="Close"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          {/* Template Grid */}
          <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Object.entries(templates).map(([key, template]) => {
              const Icon = template.icon;
              return (
                <button
                  key={key}
                  onClick={() => {
                    onSelectTemplate(key);
                    onClose();
                  }}
                  className="group flex flex-col items-center gap-3 p-4 border-2 border-black rounded-base hover:translate-x-1 hover:translate-y-1 transition-transform shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
                  style={{ backgroundColor: UI_COLORS.cyan }}
                >
                  <div className="p-3 bg-white border-2 border-black rounded-base">
                    <Icon size={32} strokeWidth={2.5} />
                  </div>
                  <div className="text-center">
                    <div className="font-heading text-sm font-bold">
                      {template.name}
                    </div>
                    <div className="text-xs text-gray-700 mt-1">
                      {template.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-4 border-t-2 border-black bg-gray-50">
            <p className="text-xs text-gray-600 text-center font-heading">
              Click any template to instantly create a sample data structure
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default TemplateModal;
