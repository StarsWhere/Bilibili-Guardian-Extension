export function createStyles(): string {
  return `
    :root {
      --guardian-bg: rgba(255, 255, 255, 0.94);
      --guardian-bg-solid: #ffffff;
      --guardian-text: #16202a;
      --guardian-muted: #617080;
      --guardian-border: rgba(18, 30, 44, 0.12);
      --guardian-primary: #0f9bd7;
      --guardian-primary-strong: #0878a6;
      --guardian-danger: #e74c3c;
      --guardian-warning: #d48d00;
      --guardian-success: #25a55f;
      --guardian-shadow: 0 24px 60px rgba(15, 26, 40, 0.16);
      --guardian-tag: #eef7fc;
      --guardian-overlay: rgba(14, 18, 24, 0.34);
      --guardian-backdrop-blur: 8px;
      --guardian-card: rgba(255, 255, 255, 0.7);
      --guardian-card-strong: rgba(255, 255, 255, 0.82);
      --guardian-switch-off: rgba(97, 112, 128, 0.24);
      --guardian-switch-on: rgba(15, 155, 215, 0.2);
    }

    body[data-guardian-theme="dark"] {
      --guardian-bg: rgba(18, 24, 31, 0.95);
      --guardian-bg-solid: #151a21;
      --guardian-text: #f4f7fb;
      --guardian-muted: #a7b2bf;
      --guardian-border: rgba(255, 255, 255, 0.1);
      --guardian-primary: #43c4ff;
      --guardian-primary-strong: #94ddff;
      --guardian-danger: #ff7e73;
      --guardian-warning: #ffbd52;
      --guardian-success: #46d285;
      --guardian-shadow: 0 26px 64px rgba(0, 0, 0, 0.45);
      --guardian-tag: rgba(67, 196, 255, 0.12);
      --guardian-overlay: rgba(5, 10, 14, 0.55);
      --guardian-card: rgba(255, 255, 255, 0.05);
      --guardian-card-strong: rgba(255, 255, 255, 0.08);
      --guardian-switch-off: rgba(255, 255, 255, 0.15);
      --guardian-switch-on: rgba(67, 196, 255, 0.2);
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
      border: 1px solid rgba(255, 255, 255, 0.32);
      background:
        radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.42), transparent 38%),
        linear-gradient(135deg, var(--guardian-primary), #5cc8ff);
      box-shadow: var(--guardian-shadow);
      z-index: 2147483642;
      cursor: grab;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      user-select: none;
      opacity: 0.42;
      transition:
        opacity 180ms ease,
        transform 220ms ease,
        box-shadow 220ms ease,
        filter 220ms ease;
      filter: saturate(0.9);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    .guardian-floating-btn:hover,
    .guardian-floating-btn:focus-visible {
      opacity: 0.98;
      transform: translateY(-3px) scale(1.04);
      filter: saturate(1);
      box-shadow: 0 26px 62px rgba(15, 26, 40, 0.26);
      outline: none;
    }

    .guardian-floating-btn.dragging {
      cursor: grabbing;
      opacity: 0.96;
      transform: scale(1.06);
    }

    .guardian-floating-btn-icon {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.08em;
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
      font-weight: 800;
      line-height: 22px;
      text-align: center;
      box-shadow: 0 10px 22px rgba(0, 0, 0, 0.14);
    }

    .guardian-video-quick-card,
    .guardian-edge-toast-region {
      position: fixed;
      pointer-events: none;
      width: min(360px, calc(100vw - 24px));
    }

    .guardian-video-quick-card.visible,
    .guardian-edge-toast-region.visible {
      display: block;
    }

    .guardian-video-quick-card-shell,
    .guardian-edge-toast {
      pointer-events: auto;
    }

    .guardian-video-quick-card {
      display: none;
      right: 20px;
      bottom: 20px;
      z-index: 2147483643;
    }

    .guardian-video-quick-card-shell {
      display: grid;
      gap: 12px;
      padding: 14px;
      border-radius: 20px;
      border: 1px solid var(--guardian-border);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.16), transparent 22%),
        var(--guardian-bg);
      box-shadow: var(--guardian-shadow);
      color: var(--guardian-text);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      animation: guardianFadeIn 180ms ease;
    }

    .guardian-video-quick-card.collapsed .guardian-video-quick-card-shell {
      padding: 10px 12px;
      border-radius: 18px;
    }

    .guardian-video-quick-card-head,
    .guardian-video-quick-card-collapsed {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .guardian-video-quick-card-status,
    .guardian-edge-toast-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .guardian-video-quick-card-inline {
      color: var(--guardian-muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .guardian-video-quick-card-summary {
      font-size: 12px;
      line-height: 1.7;
      color: var(--guardian-text);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .guardian-video-quick-card-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .guardian-video-quick-card-switch {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 14px;
      background: rgba(15, 155, 215, 0.08);
      color: var(--guardian-muted);
      font-size: 12px;
    }

    .guardian-video-quick-card-switch input {
      width: 18px;
      height: 18px;
      accent-color: var(--guardian-primary);
    }

    .guardian-video-quick-card-switch.disabled {
      opacity: 0.62;
    }

    .guardian-video-quick-card-toggle,
    .guardian-edge-toast-action,
    .guardian-edge-toast-dismiss {
      border: 1px solid var(--guardian-border);
      background: rgba(255, 255, 255, 0.12);
      color: var(--guardian-text);
      border-radius: 999px;
      cursor: pointer;
      transition: background 160ms ease, transform 160ms ease, border-color 160ms ease;
    }

    .guardian-video-quick-card-toggle,
    .guardian-edge-toast-action {
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 700;
    }

    .guardian-edge-toast-dismiss {
      width: 30px;
      height: 30px;
      font-size: 16px;
      line-height: 1;
    }

    .guardian-video-quick-card-toggle:hover,
    .guardian-video-quick-card-toggle:focus-visible,
    .guardian-edge-toast-action:hover,
    .guardian-edge-toast-action:focus-visible,
    .guardian-edge-toast-dismiss:hover,
    .guardian-edge-toast-dismiss:focus-visible {
      background: var(--guardian-tag);
      border-color: rgba(15, 155, 215, 0.22);
      transform: translateY(-1px);
      outline: none;
    }

    .guardian-edge-toast-region {
      display: none;
      top: 20px;
      right: 20px;
      z-index: 2147483644;
      gap: 10px;
    }

    .guardian-edge-toast-region.visible {
      display: grid;
    }

    .guardian-edge-toast {
      display: grid;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 18px;
      border: 1px solid transparent;
      background: var(--guardian-bg);
      box-shadow: var(--guardian-shadow);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      animation: guardianFadeIn 180ms ease;
    }

    .guardian-edge-toast-copy {
      font-size: 12px;
      line-height: 1.7;
      color: var(--guardian-text);
    }

    .guardian-edge-toast.info {
      background: rgba(15, 155, 215, 0.1);
      border-color: rgba(15, 155, 215, 0.16);
    }

    .guardian-edge-toast.success {
      background: rgba(37, 165, 95, 0.12);
      border-color: rgba(37, 165, 95, 0.16);
    }

    .guardian-edge-toast.warning {
      background: rgba(212, 141, 0, 0.12);
      border-color: rgba(212, 141, 0, 0.18);
    }

    .guardian-edge-toast.danger {
      background: rgba(231, 76, 60, 0.12);
      border-color: rgba(231, 76, 60, 0.18);
    }

    .guardian-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483641;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: var(--guardian-overlay);
      backdrop-filter: blur(var(--guardian-backdrop-blur));
      -webkit-backdrop-filter: blur(var(--guardian-backdrop-blur));
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 200ms ease, visibility 200ms ease;
    }

    .guardian-overlay.open {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }

    .guardian-modal {
      width: min(760px, calc(100vw - 32px));
      height: min(820px, calc(100vh - 32px));
      max-height: calc(100vh - 32px);
      min-height: min(720px, calc(100vh - 32px));
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.14), transparent 18%),
        var(--guardian-bg);
      color: var(--guardian-text);
      border: 1px solid var(--guardian-border);
      box-shadow: var(--guardian-shadow);
      border-radius: 28px;
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      display: flex;
      flex-direction: column;
      transform: translateY(20px) scale(0.97);
      opacity: 0;
      transition:
        transform 220ms ease,
        opacity 220ms ease,
        box-shadow 220ms ease;
      outline: none;
    }

    .guardian-modal.open {
      transform: translateY(0) scale(1);
      opacity: 1;
    }

    .guardian-modal-header {
      padding: 24px 24px 16px;
      border-bottom: 1px solid var(--guardian-border);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent),
        linear-gradient(90deg, rgba(15, 155, 215, 0.08), transparent 58%);
    }

    .guardian-header-copy {
      min-width: 0;
    }

    .guardian-title {
      margin: 0;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.01em;
    }

    .guardian-subtitle {
      margin: 6px 0 0;
      color: var(--guardian-muted);
      font-size: 13px;
      line-height: 1.65;
    }

    .guardian-header-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .guardian-icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      border: 1px solid var(--guardian-border);
      background: rgba(255, 255, 255, 0.18);
      color: var(--guardian-text);
      cursor: pointer;
      font-size: 17px;
      transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
    }

    .guardian-icon-btn:hover,
    .guardian-icon-btn:focus-visible {
      background: var(--guardian-tag);
      border-color: rgba(15, 155, 215, 0.22);
      transform: translateY(-1px);
      outline: none;
    }

    .guardian-tabs {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      padding: 14px 20px 0;
    }

    .guardian-tab {
      border: none;
      border-radius: 14px;
      padding: 11px 10px;
      background: transparent;
      color: var(--guardian-muted);
      cursor: pointer;
      font-size: 13px;
      font-weight: 800;
      transition:
        background 160ms ease,
        color 160ms ease,
        transform 160ms ease,
        box-shadow 160ms ease;
    }

    .guardian-tab:hover,
    .guardian-tab:focus-visible {
      background: rgba(15, 155, 215, 0.08);
      color: var(--guardian-primary-strong);
      outline: none;
    }

    .guardian-tab.active {
      background: var(--guardian-tag);
      color: var(--guardian-primary-strong);
      box-shadow: inset 0 0 0 1px rgba(15, 155, 215, 0.12);
    }

    .guardian-toast {
      margin: 14px 20px 0;
      padding: 12px 14px;
      border-radius: 16px;
      font-size: 12px;
      line-height: 1.6;
      border: 1px solid transparent;
      animation: guardianFadeIn 180ms ease;
    }

    .guardian-toast.info {
      background: rgba(15, 155, 215, 0.1);
      color: var(--guardian-primary-strong);
      border-color: rgba(15, 155, 215, 0.14);
    }

    .guardian-toast.success {
      background: rgba(37, 165, 95, 0.12);
      color: var(--guardian-success);
      border-color: rgba(37, 165, 95, 0.14);
    }

    .guardian-toast.warning {
      background: rgba(212, 141, 0, 0.12);
      color: var(--guardian-warning);
      border-color: rgba(212, 141, 0, 0.16);
    }

    .guardian-toast.danger {
      background: rgba(231, 76, 60, 0.12);
      color: var(--guardian-danger);
      border-color: rgba(231, 76, 60, 0.16);
    }

    .guardian-modal-body {
      flex: 1;
      min-height: 0;
      padding: 20px;
      overflow: auto;
      display: grid;
      gap: 16px;
    }

    .guardian-modal-footer {
      padding: 14px 20px 18px;
      border-top: 1px solid var(--guardian-border);
      color: var(--guardian-muted);
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      line-height: 1.6;
    }

    .guardian-card,
    .guardian-guide-card {
      background: var(--guardian-card);
      border: 1px solid var(--guardian-border);
      border-radius: 22px;
      padding: 18px;
      display: grid;
      gap: 14px;
      transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
    }

    .guardian-card:hover,
    .guardian-guide-card:hover {
      border-color: rgba(15, 155, 215, 0.18);
    }

    .guardian-card-hero {
      background:
        linear-gradient(180deg, rgba(15, 155, 215, 0.09), transparent 45%),
        var(--guardian-card-strong);
    }

    body[data-guardian-theme="dark"] .guardian-card-hero {
      background:
        linear-gradient(180deg, rgba(67, 196, 255, 0.1), transparent 45%),
        var(--guardian-card-strong);
    }

    .guardian-card-title {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
    }

    .guardian-guide-card {
      background:
        linear-gradient(180deg, rgba(15, 155, 215, 0.08), transparent 46%),
        var(--guardian-card-strong);
    }

    .guardian-guide-badge,
    .guardian-soft-badge {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      padding: 6px 10px;
      border-radius: 999px;
      background: var(--guardian-tag);
      color: var(--guardian-primary-strong);
      font-size: 12px;
      font-weight: 800;
    }

    .guardian-guide-list {
      display: grid;
      gap: 10px;
    }

    .guardian-guide-item {
      display: grid;
      gap: 4px;
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.42);
      border: 1px solid rgba(15, 155, 215, 0.1);
    }

    body[data-guardian-theme="dark"] .guardian-guide-item {
      background: rgba(255, 255, 255, 0.04);
    }

    .guardian-guide-item strong {
      font-size: 13px;
      color: var(--guardian-text);
    }

    .guardian-guide-item span {
      font-size: 12px;
      color: var(--guardian-muted);
      line-height: 1.6;
    }

    .guardian-hero-head,
    .guardian-section-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .guardian-note {
      font-size: 12px;
      color: var(--guardian-muted);
      line-height: 1.7;
    }

    .guardian-state-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .guardian-state-card {
      padding: 14px;
      border-radius: 18px;
      background: var(--guardian-tag);
      box-shadow: inset 0 0 0 1px rgba(15, 155, 215, 0.08);
      display: grid;
      gap: 6px;
    }

    .guardian-state-label,
    .guardian-result-label,
    .guardian-label {
      color: var(--guardian-muted);
      font-size: 12px;
    }

    .guardian-state-value,
    .guardian-result-value {
      font-size: 16px;
      font-weight: 800;
      color: var(--guardian-text);
      line-height: 1.45;
    }

    .guardian-state-note {
      color: var(--guardian-muted);
      font-size: 12px;
      line-height: 1.6;
    }

    .guardian-highlight {
      display: grid;
      gap: 6px;
      border-radius: 18px;
      padding: 14px 16px;
      border: 1px solid transparent;
      line-height: 1.65;
    }

    .guardian-highlight strong {
      font-size: 14px;
    }

    .guardian-highlight span {
      font-size: 12px;
    }

    .guardian-highlight.info {
      background: rgba(15, 155, 215, 0.1);
      border-color: rgba(15, 155, 215, 0.12);
      color: var(--guardian-primary-strong);
    }

    .guardian-highlight.success {
      background: rgba(37, 165, 95, 0.12);
      border-color: rgba(37, 165, 95, 0.14);
      color: var(--guardian-success);
    }

    .guardian-highlight.warning {
      background: rgba(212, 141, 0, 0.12);
      border-color: rgba(212, 141, 0, 0.14);
      color: var(--guardian-warning);
    }

    .guardian-highlight.danger {
      background: rgba(231, 76, 60, 0.12);
      border-color: rgba(231, 76, 60, 0.14);
      color: var(--guardian-danger);
    }

    .guardian-overview-meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .guardian-overview-meta-item {
      display: grid;
      gap: 6px;
      padding: 12px 14px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--guardian-border);
      box-shadow: inset 0 0 0 1px rgba(15, 155, 215, 0.06);
    }

    .guardian-overview-meta-label {
      color: var(--guardian-muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .guardian-overview-meta-value {
      color: var(--guardian-text);
      font-size: 13px;
      font-weight: 700;
      line-height: 1.6;
    }

    .guardian-stack,
    .guardian-subsection {
      display: grid;
      gap: 10px;
    }

    .guardian-grid-2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .guardian-field,
    .guardian-textarea,
    .guardian-select {
      width: 100%;
      border: 1px solid var(--guardian-border);
      background: var(--guardian-bg-solid);
      color: var(--guardian-text);
      border-radius: 14px;
      padding: 11px 12px;
      font-size: 13px;
      transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
    }

    .guardian-field:focus,
    .guardian-textarea:focus,
    .guardian-select:focus {
      outline: none;
      border-color: rgba(15, 155, 215, 0.34);
      box-shadow: 0 0 0 3px rgba(15, 155, 215, 0.12);
    }

    .guardian-textarea {
      min-height: 112px;
      resize: vertical;
      line-height: 1.6;
    }

    .guardian-textarea-lg {
      min-height: 200px;
    }

    .guardian-switch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.34);
      border: 1px solid var(--guardian-border);
      transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
      cursor: pointer;
    }

    body[data-guardian-theme="dark"] .guardian-switch-row {
      background: rgba(255, 255, 255, 0.03);
    }

    .guardian-switch-row:hover {
      border-color: rgba(15, 155, 215, 0.2);
      transform: translateY(-1px);
    }

    .guardian-switch-row.disabled {
      opacity: 0.62;
      cursor: not-allowed;
      transform: none;
    }

    .guardian-switch-copy {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .guardian-switch-copy strong {
      font-size: 13px;
      line-height: 1.5;
      color: var(--guardian-text);
    }

    .guardian-switch-copy span {
      font-size: 12px;
      line-height: 1.6;
      color: var(--guardian-muted);
    }

    .guardian-switch-box {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .guardian-switch-state {
      font-size: 12px;
      font-weight: 800;
      color: var(--guardian-primary-strong);
      min-width: 40px;
      text-align: right;
    }

    .guardian-switch-control {
      position: relative;
      width: 48px;
      height: 28px;
      display: inline-flex;
      align-items: center;
    }

    .guardian-switch-input {
      position: absolute;
      inset: 0;
      opacity: 0;
      margin: 0;
      cursor: pointer;
      z-index: 2;
    }

    .guardian-switch-track {
      position: absolute;
      inset: 0;
      border-radius: 999px;
      background: var(--guardian-switch-off);
      transition: background 180ms ease;
    }

    .guardian-switch-thumb {
      position: absolute;
      left: 4px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: white;
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.16);
      transition: transform 180ms ease;
    }

    .guardian-switch-input:checked + .guardian-switch-track {
      background: var(--guardian-switch-on);
      box-shadow: inset 0 0 0 1px rgba(15, 155, 215, 0.18);
    }

    .guardian-switch-input:checked + .guardian-switch-track + .guardian-switch-thumb {
      transform: translateX(20px);
    }

    .guardian-switch-input:focus-visible + .guardian-switch-track {
      box-shadow: 0 0 0 3px rgba(15, 155, 215, 0.14);
    }

    .guardian-choice-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .guardian-choice-item {
      position: relative;
      padding: 12px 14px;
      border-radius: 16px;
      border: 1px solid var(--guardian-border);
      background: rgba(255, 255, 255, 0.24);
      color: var(--guardian-text);
      font-size: 13px;
      line-height: 1.5;
      cursor: pointer;
      transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
      overflow: hidden;
    }

    body[data-guardian-theme="dark"] .guardian-choice-item {
      background: rgba(255, 255, 255, 0.02);
    }

    .guardian-choice-item:hover {
      transform: translateY(-1px);
      border-color: rgba(15, 155, 215, 0.2);
    }

    .guardian-choice-item.checked {
      background: var(--guardian-tag);
      border-color: rgba(15, 155, 215, 0.2);
      color: var(--guardian-primary-strong);
      box-shadow: inset 0 0 0 1px rgba(15, 155, 215, 0.1);
    }

    .guardian-choice-item input {
      position: absolute;
      inset: 0;
      opacity: 0;
      margin: 0;
      cursor: pointer;
    }

    .guardian-actions {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px;
      width: 100%;
    }

    .guardian-btn {
      border: 1px solid var(--guardian-border);
      background: transparent;
      color: var(--guardian-text);
      border-radius: 14px;
      padding: 10px 14px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 800;
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition:
        transform 160ms ease,
        background 160ms ease,
        border-color 160ms ease,
        box-shadow 160ms ease,
        opacity 160ms ease;
    }

    .guardian-btn:hover,
    .guardian-btn:focus-visible {
      transform: translateY(-1px);
      border-color: rgba(15, 155, 215, 0.28);
      background: rgba(15, 155, 215, 0.06);
      outline: none;
    }

    .guardian-btn.primary {
      background: var(--guardian-primary);
      border-color: var(--guardian-primary);
      color: white;
      box-shadow: 0 10px 24px rgba(15, 155, 215, 0.18);
    }

    .guardian-btn.primary:hover,
    .guardian-btn.primary:focus-visible {
      background: var(--guardian-primary-strong);
      border-color: var(--guardian-primary-strong);
    }

    .guardian-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .guardian-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      width: fit-content;
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

    .guardian-pill.warning {
      background: rgba(212, 141, 0, 0.12);
      color: var(--guardian-warning);
    }

    .guardian-result-card {
      border-radius: 20px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.42);
      border: 1px solid var(--guardian-border);
      display: grid;
      gap: 12px;
    }

    body[data-guardian-theme="dark"] .guardian-result-card {
      background: rgba(255, 255, 255, 0.04);
    }

    .guardian-result-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }

    .guardian-result-range {
      font-size: 12px;
      color: var(--guardian-muted);
    }

    .guardian-result-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .guardian-result-note {
      font-size: 12px;
      color: var(--guardian-muted);
      line-height: 1.7;
    }

    .guardian-empty {
      padding: 14px;
      border-radius: 16px;
      background: rgba(15, 155, 215, 0.08);
      color: var(--guardian-muted);
      font-size: 12px;
      line-height: 1.7;
    }

    .guardian-diagnostics {
      background: rgba(15, 155, 215, 0.08);
      border-radius: 14px;
      padding: 12px;
      max-height: 220px;
      overflow: auto;
      font-size: 12px;
      line-height: 1.6;
      white-space: pre-wrap;
      color: var(--guardian-text);
    }

    .guardian-diagnostics-preview {
      max-height: 180px;
    }

    .guardian-diagnostic-detail {
      display: grid;
      gap: 12px;
      padding: 14px;
      border-radius: 16px;
      border: 1px solid var(--guardian-border);
      background: rgba(255, 255, 255, 0.28);
    }

    body[data-guardian-theme="dark"] .guardian-diagnostic-detail {
      background: rgba(255, 255, 255, 0.03);
    }

    .guardian-diagnostic-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }

    .guardian-diagnostic-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      font-size: 12px;
      color: var(--guardian-muted);
    }

    .guardian-diagnostic-message {
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(231, 76, 60, 0.08);
      color: var(--guardian-danger);
      font-size: 12px;
      line-height: 1.7;
      font-weight: 700;
    }

    .guardian-details {
      border: 1px solid var(--guardian-border);
      border-radius: 18px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.2);
    }

    body[data-guardian-theme="dark"] .guardian-details {
      background: rgba(255, 255, 255, 0.02);
    }

    .guardian-details summary {
      cursor: pointer;
      padding: 14px 16px;
      font-size: 14px;
      font-weight: 800;
      list-style: none;
      transition: background 160ms ease;
    }

    .guardian-details summary::-webkit-details-marker {
      display: none;
    }

    .guardian-details summary:hover {
      background: rgba(15, 155, 215, 0.06);
    }

    .guardian-details-body {
      padding: 0 16px 16px;
      display: grid;
      gap: 14px;
    }

    @keyframes guardianFadeIn {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 760px) {
      .guardian-video-quick-card,
      .guardian-edge-toast-region {
        width: calc(100vw - 24px);
      }

      .guardian-modal {
        width: calc(100vw - 24px);
        height: calc(100vh - 24px);
        min-height: calc(100vh - 24px);
        max-height: calc(100vh - 24px);
        border-radius: 24px;
      }

      .guardian-video-quick-card {
        left: 12px;
        right: 12px;
        bottom: 12px;
      }

      .guardian-edge-toast-region {
        top: 12px;
        left: 12px;
        right: 12px;
      }

      .guardian-tabs,
      .guardian-modal-body {
        padding-left: 16px;
        padding-right: 16px;
      }

      .guardian-tabs {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .guardian-state-grid,
      .guardian-grid-2,
      .guardian-overview-meta,
      .guardian-choice-grid,
      .guardian-result-grid {
        grid-template-columns: 1fr;
      }

      .guardian-switch-row,
      .guardian-section-head,
      .guardian-hero-head,
      .guardian-modal-footer {
        grid-template-columns: 1fr;
        flex-direction: column;
        align-items: flex-start;
      }

      .guardian-switch-box {
        width: 100%;
        justify-content: space-between;
      }

      .guardian-modal-header {
        padding: 18px 16px 14px;
      }

      .guardian-video-quick-card-head,
      .guardian-video-quick-card-collapsed,
      .guardian-edge-toast-actions {
        align-items: flex-start;
      }

      .guardian-video-quick-card-actions {
        flex-direction: column;
      }

      .guardian-video-quick-card-actions .guardian-btn {
        width: 100%;
      }
    }
  `;
}
