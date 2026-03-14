import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Suppress benign ResizeObserver error from Radix UI
const ro = window.onerror;
window.onerror = (msg, ...args) => {
  if (typeof msg === "string" && msg.includes("ResizeObserver")) return true;
  return ro ? ro(msg, ...args) : false;
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
