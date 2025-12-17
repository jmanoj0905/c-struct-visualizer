import { useState } from "react";
import { X, Layers, Save, Trash2, Download, AlertCircle } from "lucide-react";
import { templates, loadTemplate } from "./Sidebar";
import { useCanvasStore } from "../store/canvasStore";
import { UI_COLORS } from "../utils/colors";
import { showAlert } from "./AlertContainer";

interface TemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CustomTemplate {
  id: string;
  name: string;
  description: string;
  workspace: {
    structDefinitions: any[];
    instances: any[];
    connections: any[];
  };
  createdAt: string;
}

const TemplateManager = ({ isOpen, onClose }: TemplateManagerProps) => {
  const { structDefinitions, instances, connections } = useCanvasStore();
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(() => {
    const saved = localStorage.getItem("customTemplates");
    return saved ? JSON.parse(saved) : [];
  });
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");

  if (!isOpen) return null;

  const handleLoadTemplate = (templateKey: keyof typeof templates) => {
    loadTemplate(templateKey);
    onClose();
  };

  const handleLoadCustomTemplate = (template: CustomTemplate) => {
    const { addStructDefinition, addInstance, addConnection, clearAll } =
      useCanvasStore.getState();

    showAlert({
      type: "confirm",
      message: `Load template "${template.name}"?\n\nThis will clear your current workspace.`,
      confirmText: "Load Template",
      cancelText: "Cancel",
      onConfirm: () => {
        clearAll();

        // Add struct definitions
        template.workspace.structDefinitions.forEach((structDef) => {
          addStructDefinition({
            name: structDef.name,
            typedef: structDef.typedef,
            fields: structDef.fields,
          });
        });

        // Add instances
        setTimeout(() => {
          template.workspace.instances.forEach((inst) => {
            addInstance(
              { name: inst.structName, typedef: "", fields: [] },
              inst.position,
              inst.label,
            );
          });

          // Add connections
          setTimeout(() => {
            template.workspace.connections.forEach((conn) => {
              addConnection({
                sourceInstanceId: conn.sourceInstanceId,
                sourceFieldName: conn.sourceFieldName,
                targetInstanceId: conn.targetInstanceId,
              });
            });
          }, 100);
        }, 100);

        showAlert({
          type: "success",
          message: `Template "${template.name}" loaded successfully!`,
          duration: 2000,
        });
        onClose();
      },
    });
  };

  const handleSaveAsTemplate = () => {
    if (!templateName.trim()) {
      showAlert({
        type: "error",
        message: "Please enter a template name",
        duration: 2000,
      });
      return;
    }

    if (structDefinitions.length === 0 && instances.length === 0) {
      showAlert({
        type: "error",
        message: "Cannot save empty workspace as template. Please add some struct definitions and instances first.",
        duration: 3000,
      });
      return;
    }

    if (instances.length === 0) {
      showAlert({
        type: "confirm",
        message: "Your workspace has no instances. Save anyway?",
        confirmText: "Save Anyway",
        cancelText: "Cancel",
        onConfirm: () => saveTemplate(),
      });
      return;
    }

    saveTemplate();
  };

  const saveTemplate = () => {

    const newTemplate: CustomTemplate = {
      id: `custom-${Date.now()}`,
      name: templateName.trim(),
      description: templateDescription.trim() || "Custom template",
      workspace: {
        structDefinitions: structDefinitions.map((s) => ({
          name: s.name,
          typedef: s.typedef,
          fields: s.fields,
        })),
        instances: instances.map((inst) => ({
          id: inst.id,
          structName: inst.structName,
          position: inst.position,
          label: inst.label,
        })),
        connections: connections.map((conn) => ({
          sourceInstanceId: conn.sourceInstanceId,
          sourceFieldName: conn.sourceFieldName,
          targetInstanceId: conn.targetInstanceId,
        })),
      },
      createdAt: new Date().toISOString(),
    };

    const updatedTemplates = [...customTemplates, newTemplate];
    setCustomTemplates(updatedTemplates);
    localStorage.setItem("customTemplates", JSON.stringify(updatedTemplates));

    showAlert({
      type: "success",
      message: `Template "${templateName}" saved successfully!`,
      duration: 2000,
    });

    setTemplateName("");
    setTemplateDescription("");
    setShowSaveForm(false);
  };

  const handleDeleteCustomTemplate = (templateId: string) => {
    const template = customTemplates.find((t) => t.id === templateId);
    if (!template) return;

    showAlert({
      type: "confirm",
      message: `Delete template "${template.name}"?`,
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: () => {
        const updatedTemplates = customTemplates.filter((t) => t.id !== templateId);
        setCustomTemplates(updatedTemplates);
        localStorage.setItem("customTemplates", JSON.stringify(updatedTemplates));

        showAlert({
          type: "success",
          message: "Template deleted",
          duration: 2000,
        });
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white border-4 border-black rounded-base shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col m-4">
        {/* Header */}
        <div
          className="p-4 border-b-4 border-black flex items-center justify-between"
          style={{ backgroundColor: UI_COLORS.purple }}
        >
          <div className="flex items-center gap-3">
            <Layers size={24} strokeWidth={2.5} />
            <h2 className="text-xl font-heading font-bold">Templates</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-black/10 rounded transition-colors"
          >
            <X size={24} strokeWidth={2.5} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Save Current Workspace Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading font-bold">Save Current Workspace</h3>
              <button
                onClick={() => setShowSaveForm(!showSaveForm)}
                className="px-4 py-2 border-2 border-black rounded-base font-heading font-bold hover:translate-x-boxShadowX hover:translate-y-boxShadowY transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none flex items-center gap-2"
                style={{ backgroundColor: showSaveForm ? UI_COLORS.red : UI_COLORS.green }}
              >
                {showSaveForm ? <X size={18} strokeWidth={2.5} /> : <Save size={18} strokeWidth={2.5} />}
                <span>{showSaveForm ? "Cancel" : "Save as Template"}</span>
              </button>
            </div>

            {showSaveForm && (
              <div
                className="p-4 border-3 border-black rounded-base"
                style={{ backgroundColor: UI_COLORS.cyan }}
              >
                {/* Workspace Status */}
                {(structDefinitions.length === 0 || instances.length === 0) && (
                  <div
                    className="mb-4 p-3 border-2 border-black rounded-base flex items-start gap-3"
                    style={{ backgroundColor: UI_COLORS.yellow }}
                  >
                    <AlertCircle size={20} strokeWidth={2.5} className="flex-shrink-0 mt-0.5" />
                    <div className="text-sm font-base">
                      {structDefinitions.length === 0 && instances.length === 0 ? (
                        <p><strong>Warning:</strong> Your workspace is empty. Add some struct definitions and instances before saving.</p>
                      ) : instances.length === 0 ? (
                        <p><strong>Warning:</strong> Your workspace has no instances. Consider adding instances to make the template more useful.</p>
                      ) : (
                        <p><strong>Note:</strong> Your workspace has struct definitions but no instances yet.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Workspace Info */}
                {(structDefinitions.length > 0 || instances.length > 0) && (
                  <div className="mb-4 p-3 border-2 border-black rounded-base bg-white">
                    <p className="text-sm font-base text-gray-700">
                      <strong>Current workspace:</strong> {structDefinitions.length} struct{structDefinitions.length !== 1 ? 's' : ''}, {instances.length} instance{instances.length !== 1 ? 's' : ''}, {connections.length} connection{connections.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-heading font-bold mb-1">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="My Awesome Data Structure"
                      className="w-full px-3 py-2 border-2 border-black rounded-base font-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-heading font-bold mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="Brief description of this template"
                      className="w-full px-3 py-2 border-2 border-black rounded-base font-base"
                    />
                  </div>
                  <button
                    onClick={handleSaveAsTemplate}
                    className="px-6 py-2.5 border-3 border-black rounded-base font-heading font-bold text-base hover:translate-x-boxShadowX hover:translate-y-boxShadowY transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none flex items-center gap-2"
                    style={{ backgroundColor: UI_COLORS.green }}
                  >
                    <Save size={20} strokeWidth={2.5} />
                    <span>Save Template</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Built-in Templates */}
          <div className="mb-8">
            <h3 className="text-lg font-heading font-bold mb-4">Built-in Templates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(templates).map(([key, template], index) => {
                const Icon = template.icon;
                // Cycle through pastel colors for variety
                const pastelColors = [
                  UI_COLORS.pink,
                  UI_COLORS.cyan,
                  UI_COLORS.yellow,
                  UI_COLORS.green,
                  UI_COLORS.purple,
                  UI_COLORS.orange,
                  UI_COLORS.blue,
                  UI_COLORS.lime,
                ];
                const bgColor = pastelColors[index % pastelColors.length];

                return (
                  <button
                    key={key}
                    onClick={() => handleLoadTemplate(key as keyof typeof templates)}
                    className="w-full inline-flex flex-col items-start justify-start rounded-base text-sm font-base ring-offset-white transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none p-4 text-left group"
                    style={{ backgroundColor: bgColor }}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div
                        className="p-2 border-2 border-black rounded-base flex items-center justify-center"
                        style={{ backgroundColor: UI_COLORS.yellow }}
                      >
                        <Icon size={20} strokeWidth={2.5} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-heading font-bold text-base">{template.name}</h4>
                        <p className="text-xs text-gray-700 font-base mt-0.5">
                          {template.description}
                        </p>
                      </div>
                      <Download size={18} strokeWidth={2.5} className="text-gray-500 group-hover:text-black transition-colors flex-shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Templates */}
          {customTemplates.length > 0 && (
            <div>
              <h3 className="text-lg font-heading font-bold mb-4">My Templates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customTemplates.map((template, index) => {
                  // Alternate pastel colors for custom templates
                  const customColors = [
                    UI_COLORS.emerald,
                    UI_COLORS.indigo,
                    UI_COLORS.teal,
                    UI_COLORS.pink,
                  ];
                  const bgColor = customColors[index % customColors.length];

                  return (
                  <div
                    key={template.id}
                    className="w-full inline-flex flex-col items-start justify-start rounded-base text-sm font-base border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4"
                    style={{ backgroundColor: bgColor }}
                  >
                    <div className="flex items-center gap-3 mb-3 w-full">
                      <div
                        className="p-2 border-2 border-black rounded-base flex items-center justify-center"
                        style={{ backgroundColor: UI_COLORS.cyan }}
                      >
                        <Layers size={20} strokeWidth={2.5} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-heading font-bold text-base">{template.name}</h4>
                        <p className="text-xs text-gray-700 font-base mt-0.5">
                          {template.description}
                        </p>
                        <p className="text-xs text-gray-600 font-base mt-1">
                          {new Date(template.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full">
                      <button
                        onClick={() => handleLoadCustomTemplate(template)}
                        className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-base text-sm font-base transition-all gap-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none h-9 px-3"
                        style={{ backgroundColor: UI_COLORS.green }}
                      >
                        <Download size={16} strokeWidth={2.5} />
                        <span className="font-heading font-bold">Load</span>
                      </button>
                      <button
                        onClick={() => handleDeleteCustomTemplate(template.id)}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-base text-sm font-base transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none h-9 w-9"
                        style={{ backgroundColor: UI_COLORS.red }}
                      >
                        <Trash2 size={16} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateManager;
