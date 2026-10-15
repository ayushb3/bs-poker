import "./style.css";
import { createApp } from "./app/controller";
import { mountRenderer } from "./ui/render";
import { startEmbers } from "./ui/particles";

const root = document.getElementById("app");
if (!root) throw new Error("#app root missing");

const app = createApp();
mountRenderer(root, app);
startEmbers(document.getElementById("embers"));
