import { DEFAULT_CONFIG } from "@/shared/config";
import {
  hasConfiguredRecognitionService,
  toDisplayRoute,
  toProviderLabel,
  toScopeLabel,
  toVideoPhaseLabel
} from "@/content/ui/ControlCenter";

describe("user-facing UI copy helpers", () => {
  it("maps route and phase text into stable Chinese labels", () => {
    expect(toDisplayRoute("feed")).toBe("首页内容过滤中");
    expect(toDisplayRoute("video")).toBe("视频识别已接管");
    expect(toDisplayRoute("idle")).toBe("等待进入支持页面");
    expect(toScopeLabel("ranking")).toBe("排行榜");
    expect(toScopeLabel(null)).toBe("当前页面暂不在首页整理范围内");
    expect(toVideoPhaseLabel("cached")).toBe("已直接使用上次识别结果");
    expect(toVideoPhaseLabel("error")).toBe("这次识别失败了");
  });

  it("converts provider names and checks service readiness", () => {
    expect(toProviderLabel("custom")).toBe("自定义兼容接口");
    expect(toProviderLabel("openai")).toBe("OpenAI");
    expect(hasConfiguredRecognitionService(DEFAULT_CONFIG)).toBe(false);

    expect(
      hasConfiguredRecognitionService({
        ...DEFAULT_CONFIG,
        ai: {
          ...DEFAULT_CONFIG.ai,
          apiKey: "token"
        }
      })
    ).toBe(true);

    expect(
      hasConfiguredRecognitionService({
        ...DEFAULT_CONFIG,
        ai: {
          ...DEFAULT_CONFIG.ai,
          provider: "custom",
          baseUrl: "http://localhost:8000/v1",
          model: "custom-model",
          apiKey: ""
        }
      })
    ).toBe(true);
  });
});
