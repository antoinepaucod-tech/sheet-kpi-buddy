import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Suppress benign ResizeObserver error from Radix UI (must use capture to beat React error overlay)
window.addEventListener("error", (e) => {
  if (e.message && e.message.includes("ResizeObserver")) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return;
  }
}, true);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <App />,
);
