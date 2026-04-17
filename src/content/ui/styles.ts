export function createStyles(): string {
  return `
    :root {
      --guardian-bg: rgba(255,255,255,0.92);
      --guardian-bg-solid: #ffffff;
      --guardian-text: #17202a;
      --guardian-muted: #5b6471;
      --guardian-border: rgba(23, 32, 42, 0.12);
      --guardian-primary: #0f9bd7;
      --guardian-primary-strong: #0878a6;
      --guardian-danger: #e74c3c;
      --guardian-success: #25a55f;
      --guardian-shadow: 0 18px 48px rgba(15, 26, 40, 0.16);
      --guardian-tag: #eef6fb;
    }

    body[data-guardian-theme="dark"] {
      --guardian-bg: rgba(21, 26, 33, 0.9);
      --guardian-bg-solid: #151a21;
      --guardian-text: #f5f7fa;
      --guardian-muted: #a7b0bc;
      --guardian-border: rgba(255,255,255,0.12);
      --guardian-primary: #43c4ff;
      --guardian-primary-strong: #109dd9;
      --guardian-danger: #ff7366;
      --guardian-success: #46d285;
      --guardian-shadow: 0 18px 54px rgba(0, 0, 0, 0.4);
      --guardian-tag: rgba(67, 196, 255, 0.12);
    }

    #guardian-root {
      all: initial;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    }

    #guardian-root * {
      box-sizing: border-box;
      font-family: inherit;
    }

    .guardian-floating-btn {
      position: fixed;
      width: 56px;
      height: 56px;
      border-radius: 18px;
      border: 1px solid var(--guardian-border);
      background:
        radial-gradient(circle at 20% 20%, rgba(255,255,255,0.38), transparent 38%),
        linear-gradient(135deg, var(--guardian-primary), #5cc8ff);
      box-shadow: var(--guardian-shadow);
      z-index: 2147483642;
      cursor: grab;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      user-select: none;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .guardian-floating-btn:hover {
      transform: translateY(-2px) scale(1.02);
    }

    .guardian-floating-btn.dragging {
      cursor: grabbing;
      transform: scale(1.05);
    }

    .guardian-floating-btn-badge {
      position: absolute;
      right: -6px;
      top: -6px;
      min-width: 24px;
      height: 24px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--guardian-bg-solid);
      color: var(--guardian-primary-strong);
      border: 1px solid var(--guardian-border);
      font-size: 11px;
      font-weight: 700;
      line-height: 22px;
      text-align: center;
    }

    .guardian-panel {
      position: fixed;
      width: min(460px, calc(100vw - 32px));
      max-height: min(760px, calc(100vh - 32px));
      overflow: hidden;
      background: var(--guardian-bg);
      color: var(--guardian-text);
      border: 1px solid var(--guardian-border);
      box-shadow: var(--guardian-shadow);
      border-radius: 24px;
      z-index: 2147483641;
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      display: none;
      flex-direction: column;
    }

    .guardian-panel.open {
      display: flex;
    }

    .guardian-panel-header {
      padding: 18px 20px 14px;
      border-bottom: 1px solid var(--guardian-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .guardian-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
    }

    .guardian-subtitle {
      margin: 4px 0 0;
      color: var(--guardian-muted);
      font-size: 12px;
    }

    .guardian-header-actions {
      display: flex;
      gap: 8px;
    }

    .guardian-icon-btn {
      width: 34px;
      height: 34px;
      border-radius: 12px;
      border: 1px solid var(--guardian-border);
      background: transparent;
      color: var(--guardian-text);
      cursor: pointer;
      font-size: 16px;
    }

    .guardian-tabs {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      padding: 12px 16px 0;
    }

    .guardian-tab {
      border: none;
      border-radius: 14px;
      padding: 10px 0;
      background: transparent;
      color: var(--guardian-muted);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    }

    .guardian-tab.active {
      background: var(--guardian-tag);
      color: var(--guardian-primary-strong);
    }

    .guardian-panel-body {
      padding: 16px;
      overflow: auto;
      display: grid;
      gap: 14px;
    }

    .guardian-card {
      background: rgba(255,255,255,0.55);
      border: 1px solid var(--guardian-border);
      border-radius: 18px;
      padding: 14px;
      display: grid;
      gap: 10px;
    }

    body[data-guardian-theme="dark"] .guardian-card {
      background: rgba(255,255,255,0.03);
    }

    .guardian-card-title {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
    }

    .guardian-metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .guardian-metric {
      border-radius: 16px;
      padding: 12px;
      background: var(--guardian-tag);
    }

    .guardian-metric-label {
      color: var(--guardian-muted);
      font-size: 12px;
      margin-bottom: 4px;
    }

    .guardian-metric-value {
      font-size: 17px;
      font-weight: 700;
    }

    .guardian-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .guardian-field,
    .guardian-textarea,
    .guardian-select {
      width: 100%;
      border: 1px solid var(--guardian-border);
      background: var(--guardian-bg-solid);
      color: var(--guardian-text);
      border-radius: 14px;
      padding: 10px 12px;
      font-size: 13px;
    }

    .guardian-textarea {
      min-height: 110px;
      resize: vertical;
      line-height: 1.5;
    }

    .guardian-grid-2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .guardian-label {
      display: grid;
      gap: 6px;
      font-size: 12px;
      color: var(--guardian-muted);
    }

    .guardian-switch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 0;
    }

    .guardian-switch-row strong {
      font-size: 13px;
      color: var(--guardian-text);
    }

    .guardian-checklist {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 12px;
      font-size: 12px;
      color: var(--guardian-text);
    }

    .guardian-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .guardian-btn {
      border: 1px solid var(--guardian-border);
      background: transparent;
      color: var(--guardian-text);
      border-radius: 14px;
      padding: 10px 14px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    }

    .guardian-btn.primary {
      background: var(--guardian-primary);
      border-color: var(--guardian-primary);
      color: white;
    }

    .guardian-btn.danger {
      color: var(--guardian-danger);
    }

    .guardian-status {
      font-size: 12px;
      color: var(--guardian-muted);
      line-height: 1.6;
    }

    .guardian-status strong {
      color: var(--guardian-text);
    }

    .guardian-diagnostics {
      background: rgba(15, 155, 215, 0.08);
      border-radius: 14px;
      padding: 12px;
      max-height: 220px;
      overflow: auto;
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      color: var(--guardian-text);
    }

    .guardian-chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .guardian-chip {
      border-radius: 999px;
      padding: 6px 10px;
      background: var(--guardian-tag);
      font-size: 12px;
      color: var(--guardian-primary-strong);
    }

    .guardian-note {
      font-size: 12px;
      color: var(--guardian-muted);
      line-height: 1.6;
    }

    .guardian-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
    }

    .guardian-pill.success {
      background: rgba(37, 165, 95, 0.12);
      color: var(--guardian-success);
    }

    .guardian-pill.danger {
      background: rgba(231, 76, 60, 0.12);
      color: var(--guardian-danger);
    }

    .guardian-pill.info {
      background: rgba(15, 155, 215, 0.12);
      color: var(--guardian-primary-strong);
    }
  `;
}
