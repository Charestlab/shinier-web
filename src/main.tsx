import React from "react";
import { createRoot } from "react-dom/client";
import RoeschMacAdamxyYViewer from "./preview";

import "./styles.css";

const root = document.getElementById("root")!;
createRoot(root).render(
  <React.StrictMode>
    <RoeschMacAdamxyYViewer />
  </React.StrictMode>,
);
