import { GuardianApp } from "@/app/GuardianApp";
import { createChromePlatformServices } from "@/extension/platform";

const app = new GuardianApp(createChromePlatformServices());

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void app.init();
  });
} else {
  void app.init();
}
