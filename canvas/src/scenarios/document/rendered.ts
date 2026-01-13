// Document Rendered Scenario - Full-width formatted markdown view

import type { ScenarioDefinition } from "../types";
import type { DocumentConfig } from "../../canvases/document/types";

export const documentRenderedScenario: ScenarioDefinition<DocumentConfig, void> = {
  name: "rendered",
  description: "Full-width rendered markdown view with formatted output",
  canvasKind: "document",
  interactionMode: "view-only",
  closeOn: "escape",
  defaultConfig: {
    content: "",
    readOnly: true,
    fullWidth: true,
    renderer: "rendered",
  },
};
