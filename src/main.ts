import "./style.css";
import { createApp } from "./app/controller";
import { storageSettingsStore } from "./app/persist";
import { mountRenderer } from "./ui/render";
import { fitStage } from "./ui/stage";
import { preloadArt } from "./ui/assets";

const root = document.getElementById("app");
const stage = document.getElementById("stage");
if (!root || !stage) throw new Error("#app / #stage missing");

fitStage(stage);
const app = createApp(Math.random, storageSettingsStore(() => window.localStorage));
mountRenderer(root, stage, app);
preloadArt();
