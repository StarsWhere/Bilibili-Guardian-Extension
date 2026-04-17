import { GuardianApp } from "@/app/GuardianApp";
import { createUserscriptPlatformServices } from "./platform";

const app = new GuardianApp(createUserscriptPlatformServices());

function registerMenuCommands(): void {
  if (typeof GM_registerMenuCommand !== "function") {
    return;
  }

  GM_registerMenuCommand("Bilibili Guardian: 打开/关闭面板", () => {
    void app.togglePanel();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    registerMenuCommands();
    void app.init();
  });
} else {
  registerMenuCommands();
  void app.init();
}
