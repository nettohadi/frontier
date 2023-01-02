import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import Renderer from "./components/Renderer";
export default Renderer;
export {
  registerElements,
  getAllRegisteredElements,
  getDropAndNonDropElements,
  removeNonCSSProps,
} from "./utils";
export type { ElementType, ParentType } from "./types";

// const root = ReactDOM.createRoot(
//   document.getElementById("root") as HTMLElement
// );
// root.render(<App />);
