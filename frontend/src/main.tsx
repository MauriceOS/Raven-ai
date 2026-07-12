import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ShellHeaderProvider } from "./context/ShellHeaderContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ShellHeaderProvider>
      <App />
    </ShellHeaderProvider>
  </React.StrictMode>
);