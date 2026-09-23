import React from "react";
import { createRoot } from "react-dom/client";
import Game from "./Game";
import "./mobile.css";
createRoot(document.getElementById("root")!).render(
  <Game native={location.pathname.startsWith("/pocket-native/")} />,
);
