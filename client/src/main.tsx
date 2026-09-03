import { createRoot } from "react-dom/client";
import "./index.css";
import { mountCourse360Bootstrap } from "./BootstrapShell";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Course360 could not find the application root.");
}

mountCourse360Bootstrap(
  rootElement,
  () => import("./AppBootstrap"),
);
