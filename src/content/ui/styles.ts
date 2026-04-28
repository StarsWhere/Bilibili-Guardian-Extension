export function createStyles(): string {
  return `
    :root {
      --guardian-bg: #f7f9fb;
      --guardian-bg-solid: #ffffff;
      --guardian-surface: #ffffff;
      --guardian-surface-muted: #f1f5f8;
      --guardian-text: #141a21;
      --guardian-muted: #64707d;
      --guardian-border: rgba(20, 26, 33, 0.12);
      --guardian-border-strong: rgba(20, 26, 33, 0.2);
      --guardian-primary: #0b8fbd;
      --guardian-primary-strong: #056b8f;
      --guardian-primary-soft: rgba(11, 143, 189, 0.1);
      --guardian-danger: #d64545;
      --guardian-warning: #b77800;
      --guardian-success: #168a50;
      --guardian-info: #0b8fbd;
      --guardian-shadow: 0 18px 48px rgba(10, 20, 30, 0.18);
      --guardian-overlay: rgba(14, 18, 24, 0.22);
      --guardian-focus: 0 0 0 3px rgba(11, 143, 189, 0.18);
      --guardian-radius: 8px;
      --guardian-radius-sm: 6px;
      --guardian-control-h: 36px;
    }

    body[data-guardian-theme="dark"] {
      --guardian-bg: #12161b;
      --guardian-bg-solid: #171c22;
      --guardian-surface: #191f26;
      --guardian-surface-muted: #202832;
      --guardian-text: #f3f6f8;
      --guardian-muted: #9aa6b2;
      --guardian-border: rgba(255, 255, 255, 0.12);
      --guardian-border-strong: rgba(255, 255, 255, 0.2);
      --guardian-primary: #42b7e5;
      --guardian-primary-strong: #8ad8f4;
      --guardian-primary-soft: rgba(66, 183, 229, 0.12);
      --guardian-danger: #ff7878;
      --guardian-warning: #f2b84b;
      --guardian-success: #46c77b;
      --guardian-info: #42b7e5;
      --guardian-shadow: 0 20px 52px rgba(0, 0, 0, 0.42);
      --guardian-overlay: rgba(0, 0, 0, 0.32);
      --guardian-focus: 0 0 0 3px rgba(66, 183, 229, 0.2);
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
      position: fixed !important;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.42);
      background: #111820;
      box-shadow: 0 10px 28px rgba(10, 20, 30, 0.24);
      z-index: 2147483647 !important;
      cursor: grab;
      display: flex !important;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      user-select: none;
      opacity: 0.82;
      visibility: visible !important;
      pointer-events: auto;
      transition: opacity 160ms ease, transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
    }

    .guardian-floating-btn[data-route="feed"],
    .guardian-floating-btn[data-route="video"] {
      background: var(--guardian-primary);
    }

    .guardian-floating-btn:hover,
    .guardian-floating-btn:focus-visible,
    .guardian-floating-btn.dragging {
      opacity: 1;
      transform: translateY(-1px);
      box-shadow: 0 14px 34px rgba(10, 20, 30, 0.3);
      outline: none;
    }

    .guardian-floating-btn.dragging {
      cursor: grabbing;
    }

    .guardian-floating-btn-icon {
      font-size: 17px;
      font-weight: 800;
      line-height: 1;
    }

    .guardian-floating-btn-badge {
      position: absolute;
      right: -5px;
      top: -6px;
      min-width: 20px;
      height: 20px;
      padding: 0 5px;
      border-radius: 999px;
      background: var(--guardian-bg-solid);
      color: var(--guardian-primary-strong);
      border: 1px solid var(--guardian-border);
      font-size: 10px;
      font-weight: 800;
      line-height: 18px;
      text-align: center;
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.16);
    }

    .guardian-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483641;
      display: flex;
      justify-content: flex-end;
      align-items: stretch;
      padding: 12px;
      background: var(--guardian-overlay);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 180ms ease, visibility 180ms ease;
    }

    .guardian-overlay.open {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }

    .guardian-modal {
      width: min(420px, calc(100vw - 24px));
      height: calc(100vh - 24px);
      max-height: calc(100vh - 24px);
      min-height: 0;
      overflow: hidden;
      background: var(--guardian-bg);
      color: var(--guardian-text);
      border: 1px solid var(--guardian-border);
      box-shadow: var(--guardian-shadow);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      transform: translateX(24px);
      opacity: 0;
      transition: transform 200ms ease, opacity 200ms ease, box-shadow 200ms ease;
      outline: none;
    }

    .guardian-modal.open {
      transform: translateX(0);
      opacity: 1;
    }

    .guardian-modal-header {
      padding: 16px 16px 12px;
      border-bottom: 1px solid var(--guardian-border);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      background: var(--guardian-surface);
    }

    .guardian-header-copy {
      min-width: 0;
      display: grid;
      gap: 3px;
    }

    .guardian-header-kicker {
      color: var(--guardian-primary-strong);
      font-size: 11px;
      font-weight: 800;
      line-height: 1.4;
    }

    .guardian-title {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      line-height: 1.3;
    }

    .guardian-subtitle {
      margin: 0;
      color: var(--guardian-muted);
      font-size: 12px;
      line-height: 1.55;
    }

    .guardian-header-actions {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }

    .guardian-icon-btn,
    .guardian-icon-text-btn {
      border: 1px solid var(--guardian-border);
      background: var(--guardian-bg-solid);
      color: var(--guardian-text);
      cursor: pointer;
      transition: background 150ms ease, border-color 150ms ease, color 150ms ease, transform 150ms ease;
    }

    .guardian-icon-btn {
      width: 32px;
      height: 32px;
      border-radius: var(--guardian-radius);
      font-size: 15px;
      line-height: 1;
    }

    .guardian-icon-text-btn {
      min-height: 28px;
      padding: 4px 9px;
      border-radius: var(--guardian-radius-sm);
      font-size: 12px;
      font-weight: 800;
    }

    .guardian-icon-btn:hover,
    .guardian-icon-btn:focus-visible,
    .guardian-icon-text-btn:hover,
    .guardian-icon-text-btn:focus-visible {
      background: var(--guardian-primary-soft);
      border-color: rgba(11, 143, 189, 0.32);
      color: var(--guardian-primary-strong);
      outline: none;
    }

    .guardian-tabs {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 4px;
      padding: 10px 12px;
      background: var(--guardian-surface);
      border-bottom: 1px solid var(--guardian-border);
    }

    .guardian-tab {
      border: 1px solid transparent;
      border-radius: var(--guardian-radius);
      padding: 8px 4px;
      background: transparent;
      color: var(--guardian-muted);
      cursor: pointer;
      font-size: 12px;
      font-weight: 800;
      min-height: 34px;
      transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
    }

    .guardian-tab:hover,
    .guardian-tab:focus-visible {
      background: var(--guardian-surface-muted);
      color: var(--guardian-text);
      outline: none;
    }

    .guardian-tab.active {
      background: var(--guardian-primary-soft);
      color: var(--guardian-primary-strong);
      border-color: rgba(11, 143, 189, 0.24);
    }

    .guardian-modal-body {
      flex: 1;
      min-height: 0;
      padding: 12px;
      overflow: auto;
      display: grid;
      align-content: start;
      gap: 10px;
    }

    .guardian-modal-footer {
      padding: 10px 12px;
      border-top: 1px solid var(--guardian-border);
      color: var(--guardian-muted);
      font-size: 11px;
      display: flex;
      justify-content: space-between;
      gap: 10px;
      line-height: 1.5;
      background: var(--guardian-surface);
    }

    .guardian-card,
    .guardian-guide-card,
    .guardian-task-strip {
      background: var(--guardian-surface);
      border: 1px solid var(--guardian-border);
      border-radius: var(--guardian-radius);
      padding: 12px;
      display: grid;
      gap: 10px;
    }

    .guardian-command-panel {
      gap: 12px;
    }

    .guardian-card-title {
      margin: 0;
      font-size: 14px;
      font-weight: 800;
      line-height: 1.35;
    }

    .guardian-note {
      font-size: 12px;
      color: var(--guardian-muted);
      line-height: 1.55;
    }

    .guardian-label,
    .guardian-state-label,
    .guardian-result-label {
      color: var(--guardian-muted);
      font-size: 11px;
      line-height: 1.45;
    }

    .guardian-task-strip {
      grid-template-columns: 1fr;
      background: var(--guardian-surface);
      border-left: 3px solid var(--guardian-primary);
    }

    .guardian-task-copy {
      display: grid;
      gap: 5px;
      min-width: 0;
    }

    .guardian-task-copy strong {
      font-size: 13px;
      line-height: 1.45;
      color: var(--guardian-text);
    }

    .guardian-task-copy span:last-child {
      color: var(--guardian-muted);
      font-size: 12px;
      line-height: 1.55;
    }

    .guardian-task-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .guardian-hero-head,
    .guardian-section-head,
    .guardian-diagnostic-head,
    .guardian-result-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }

    .guardian-status-grid {
      display: grid;
      gap: 8px;
    }

    .guardian-status-item,
    .guardian-overview-meta-item,
    .guardian-result-card,
    .guardian-diagnostic-detail {
      border: 1px solid var(--guardian-border);
      background: var(--guardian-bg-solid);
      border-radius: var(--guardian-radius);
    }

    .guardian-status-item {
      display: grid;
      gap: 5px;
      padding: 10px;
      border-left-width: 3px;
    }

    .guardian-status-item.info {
      border-left-color: var(--guardian-info);
    }

    .guardian-status-item.success {
      border-left-color: var(--guardian-success);
    }

    .guardian-status-item.warning {
      border-left-color: var(--guardian-warning);
    }

    .guardian-status-item.danger {
      border-left-color: var(--guardian-danger);
    }

    .guardian-status-head {
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
    }

    .guardian-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--guardian-info);
      flex: 0 0 auto;
    }

    .guardian-status-dot.success {
      background: var(--guardian-success);
    }

    .guardian-status-dot.warning {
      background: var(--guardian-warning);
    }

    .guardian-status-dot.danger {
      background: var(--guardian-danger);
    }

    .guardian-state-value,
    .guardian-result-value {
      font-size: 14px;
      font-weight: 800;
      color: var(--guardian-text);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .guardian-state-note,
    .guardian-result-note {
      color: var(--guardian-muted);
      font-size: 12px;
      line-height: 1.55;
      overflow-wrap: anywhere;
    }

    .guardian-highlight {
      display: grid;
      gap: 5px;
      border-radius: var(--guardian-radius);
      padding: 10px;
      border: 1px solid var(--guardian-border);
      line-height: 1.55;
      background: var(--guardian-bg-solid);
    }

    .guardian-highlight strong {
      font-size: 13px;
    }

    .guardian-highlight span {
      font-size: 12px;
    }

    .guardian-highlight.info {
      border-left: 3px solid var(--guardian-info);
      color: var(--guardian-primary-strong);
    }

    .guardian-highlight.success {
      border-left: 3px solid var(--guardian-success);
      color: var(--guardian-success);
    }

    .guardian-highlight.warning {
      border-left: 3px solid var(--guardian-warning);
      color: var(--guardian-warning);
    }

    .guardian-highlight.danger {
      border-left: 3px solid var(--guardian-danger);
      color: var(--guardian-danger);
    }

    .guardian-overview-meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .guardian-overview-meta-item {
      display: grid;
      gap: 5px;
      padding: 9px;
    }

    .guardian-overview-meta-value {
      color: var(--guardian-text);
      font-size: 12px;
      font-weight: 800;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    .guardian-stack,
    .guardian-subsection {
      display: grid;
      gap: 8px;
    }

    .guardian-grid-2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .guardian-field,
    .guardian-textarea,
    .guardian-select {
      width: 100%;
      border: 1px solid var(--guardian-border);
      background: var(--guardian-bg-solid);
      color: var(--guardian-text);
      border-radius: var(--guardian-radius);
      padding: 8px 10px;
      min-height: var(--guardian-control-h);
      font-size: 13px;
      transition: border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
    }

    .guardian-field:focus,
    .guardian-textarea:focus,
    .guardian-select:focus {
      outline: none;
      border-color: rgba(11, 143, 189, 0.4);
      box-shadow: var(--guardian-focus);
    }

    .guardian-textarea {
      min-height: 96px;
      resize: vertical;
      line-height: 1.55;
    }

    .guardian-textarea-lg {
      min-height: 168px;
    }

    .guardian-switch-row {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 10px;
      padding: 10px;
      border-radius: var(--guardian-radius);
      background: var(--guardian-bg-solid);
      border: 1px solid var(--guardian-border);
      cursor: pointer;
      transition: border-color 150ms ease, background 150ms ease;
    }

    .guardian-switch-row:hover {
      border-color: var(--guardian-border-strong);
    }

    .guardian-switch-row.disabled {
      opacity: 0.58;
      cursor: not-allowed;
    }

    .guardian-switch-copy {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    .guardian-switch-copy strong {
      font-size: 13px;
      line-height: 1.45;
      color: var(--guardian-text);
    }

    .guardian-switch-copy span {
      font-size: 12px;
      line-height: 1.5;
      color: var(--guardian-muted);
    }

    .guardian-switch-box {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .guardian-switch-state {
      font-size: 11px;
      font-weight: 800;
      color: var(--guardian-primary-strong);
      min-width: 36px;
      text-align: right;
    }

    .guardian-switch-control {
      position: relative;
      width: 40px;
      height: 22px;
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
      background: rgba(100, 112, 125, 0.28);
      transition: background 160ms ease;
    }

    .guardian-switch-thumb {
      position: absolute;
      left: 3px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #ffffff;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18);
      transition: transform 160ms ease;
    }

    .guardian-switch-input:checked + .guardian-switch-track {
      background: rgba(11, 143, 189, 0.36);
    }

    .guardian-switch-input:checked + .guardian-switch-track + .guardian-switch-thumb {
      transform: translateX(18px);
    }

    .guardian-switch-input:focus-visible + .guardian-switch-track {
      box-shadow: var(--guardian-focus);
    }

    .guardian-choice-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .guardian-choice-item {
      position: relative;
      min-height: 36px;
      padding: 8px 10px;
      border-radius: var(--guardian-radius);
      border: 1px solid var(--guardian-border);
      background: var(--guardian-bg-solid);
      color: var(--guardian-text);
      font-size: 12px;
      line-height: 1.5;
      cursor: pointer;
      transition: border-color 150ms ease, background 150ms ease, color 150ms ease;
      overflow: hidden;
    }

    .guardian-choice-item:hover {
      border-color: var(--guardian-border-strong);
    }

    .guardian-choice-item.checked {
      background: var(--guardian-primary-soft);
      border-color: rgba(11, 143, 189, 0.28);
      color: var(--guardian-primary-strong);
      font-weight: 800;
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
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
      width: 100%;
    }

    .guardian-btn {
      border: 1px solid var(--guardian-border);
      background: var(--guardian-bg-solid);
      color: var(--guardian-text);
      border-radius: var(--guardian-radius);
      min-height: var(--guardian-control-h);
      padding: 8px 11px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 800;
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      transition: background 150ms ease, border-color 150ms ease, color 150ms ease, opacity 150ms ease;
    }

    .guardian-btn:hover,
    .guardian-btn:focus-visible {
      border-color: rgba(11, 143, 189, 0.32);
      background: var(--guardian-primary-soft);
      color: var(--guardian-primary-strong);
      outline: none;
    }

    .guardian-btn.primary {
      background: var(--guardian-primary);
      border-color: var(--guardian-primary);
      color: #ffffff;
    }

    .guardian-btn.primary:hover,
    .guardian-btn.primary:focus-visible {
      background: var(--guardian-primary-strong);
      border-color: var(--guardian-primary-strong);
      color: #ffffff;
    }

    .guardian-btn.subtle {
      background: transparent;
    }

    .guardian-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      background: var(--guardian-bg-solid);
      color: var(--guardian-muted);
      border-color: var(--guardian-border);
    }

    .guardian-pill,
    .guardian-guide-badge,
    .guardian-soft-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      width: fit-content;
      line-height: 1.35;
      white-space: nowrap;
    }

    .guardian-soft-badge,
    .guardian-guide-badge,
    .guardian-pill.info {
      background: var(--guardian-primary-soft);
      color: var(--guardian-primary-strong);
    }

    .guardian-pill.success {
      background: rgba(22, 138, 80, 0.12);
      color: var(--guardian-success);
    }

    .guardian-pill.danger {
      background: rgba(214, 69, 69, 0.12);
      color: var(--guardian-danger);
    }

    .guardian-pill.warning {
      background: rgba(183, 120, 0, 0.12);
      color: var(--guardian-warning);
    }

    .guardian-result-card {
      padding: 10px;
      display: grid;
      gap: 10px;
    }

    .guardian-result-range {
      font-size: 12px;
      color: var(--guardian-muted);
      line-height: 1.45;
    }

    .guardian-result-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .guardian-empty,
    .guardian-diagnostics {
      border-radius: var(--guardian-radius);
      background: var(--guardian-surface-muted);
      color: var(--guardian-muted);
      font-size: 12px;
      line-height: 1.6;
    }

    .guardian-empty {
      padding: 10px;
    }

    .guardian-diagnostics {
      padding: 10px;
      max-height: 220px;
      overflow: auto;
      white-space: pre-wrap;
      color: var(--guardian-text);
    }

    .guardian-diagnostics-preview {
      max-height: 180px;
    }

    .guardian-diagnostic-detail {
      display: grid;
      gap: 10px;
      padding: 10px;
    }

    .guardian-diagnostic-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 10px;
      font-size: 11px;
      color: var(--guardian-muted);
    }

    .guardian-diagnostic-message {
      padding: 9px 10px;
      border-radius: var(--guardian-radius);
      background: rgba(214, 69, 69, 0.1);
      color: var(--guardian-danger);
      font-size: 12px;
      line-height: 1.6;
      font-weight: 700;
    }

    .guardian-details {
      border: 1px solid var(--guardian-border);
      border-radius: var(--guardian-radius);
      overflow: hidden;
      background: var(--guardian-surface);
    }

    .guardian-details summary {
      cursor: pointer;
      padding: 11px 12px;
      font-size: 13px;
      font-weight: 800;
      list-style: none;
      transition: background 150ms ease;
    }

    .guardian-details summary::-webkit-details-marker {
      display: none;
    }

    .guardian-details summary:hover,
    .guardian-details summary:focus-visible {
      background: var(--guardian-surface-muted);
      outline: none;
    }

    .guardian-details-body {
      padding: 0 12px 12px;
      display: grid;
      gap: 10px;
    }

    .guardian-video-quick-card,
    .guardian-edge-toast-region {
      position: fixed;
      pointer-events: none;
      width: min(320px, calc(100vw - 24px));
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
      right: 14px;
      bottom: 14px;
      z-index: 2147483643;
    }

    .guardian-video-quick-card-shell {
      display: grid;
      gap: 9px;
      padding: 11px;
      border-radius: var(--guardian-radius);
      border: 1px solid var(--guardian-border);
      background: var(--guardian-surface);
      box-shadow: var(--guardian-shadow);
      color: var(--guardian-text);
      animation: guardianFadeIn 160ms ease;
    }

    .guardian-video-quick-card.collapsed .guardian-video-quick-card-shell {
      padding: 8px 10px;
    }

    .guardian-video-quick-card-head,
    .guardian-video-quick-card-collapsed {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 9px;
    }

    .guardian-video-quick-card-status,
    .guardian-edge-toast-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 7px;
    }

    .guardian-video-quick-card-inline {
      color: var(--guardian-muted);
      font-size: 12px;
      line-height: 1.45;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .guardian-video-quick-card-summary {
      font-size: 12px;
      line-height: 1.55;
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

    .guardian-video-quick-card-actions .guardian-btn {
      width: auto;
      min-width: 112px;
      flex: 1 1 auto;
    }

    .guardian-video-quick-card-switch {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 10px;
      border-radius: var(--guardian-radius);
      background: var(--guardian-surface-muted);
      color: var(--guardian-muted);
      font-size: 12px;
      line-height: 1.45;
    }

    .guardian-video-quick-card-switch input {
      width: 17px;
      height: 17px;
      accent-color: var(--guardian-primary);
    }

    .guardian-video-quick-card-switch.disabled {
      opacity: 0.62;
    }

    .guardian-edge-toast-region {
      display: none;
      top: 14px;
      right: 14px;
      z-index: 2147483644;
      gap: 8px;
    }

    .guardian-edge-toast-region.visible {
      display: grid;
    }

    .guardian-edge-toast {
      display: grid;
      gap: 7px;
      padding: 10px 11px;
      border-radius: var(--guardian-radius);
      border: 1px solid var(--guardian-border);
      border-left-width: 3px;
      background: var(--guardian-surface);
      box-shadow: 0 12px 32px rgba(10, 20, 30, 0.18);
      animation: guardianFadeIn 160ms ease;
    }

    .guardian-edge-toast.info {
      border-left-color: var(--guardian-info);
    }

    .guardian-edge-toast.success {
      border-left-color: var(--guardian-success);
    }

    .guardian-edge-toast.warning {
      border-left-color: var(--guardian-warning);
    }

    .guardian-edge-toast.danger {
      border-left-color: var(--guardian-danger);
    }

    .guardian-edge-toast-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .guardian-edge-toast-badge {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      font-size: 11px;
      font-weight: 800;
      line-height: 1.4;
    }

    .guardian-edge-toast-badge.info {
      color: var(--guardian-primary-strong);
    }

    .guardian-edge-toast-badge.success {
      color: var(--guardian-success);
    }

    .guardian-edge-toast-badge.warning {
      color: var(--guardian-warning);
    }

    .guardian-edge-toast-badge.danger {
      color: var(--guardian-danger);
    }

    .guardian-edge-toast-copy {
      font-size: 12px;
      line-height: 1.55;
      color: var(--guardian-text);
    }

    .guardian-edge-toast-action {
      border: 1px solid var(--guardian-border);
      background: var(--guardian-bg-solid);
      color: var(--guardian-text);
      border-radius: var(--guardian-radius-sm);
      cursor: pointer;
      padding: 5px 9px;
      font-size: 12px;
      font-weight: 800;
      transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
    }

    .guardian-edge-toast-action:hover,
    .guardian-edge-toast-action:focus-visible {
      background: var(--guardian-primary-soft);
      border-color: rgba(11, 143, 189, 0.32);
      color: var(--guardian-primary-strong);
      outline: none;
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

    @media (max-width: 640px) {
      .guardian-overlay {
        padding: 8px;
      }

      .guardian-modal {
        width: calc(100vw - 16px);
        height: calc(100vh - 16px);
        max-height: calc(100vh - 16px);
        border-radius: 10px;
      }

      .guardian-tabs {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .guardian-grid-2,
      .guardian-overview-meta,
      .guardian-choice-grid,
      .guardian-result-grid {
        grid-template-columns: 1fr;
      }

      .guardian-section-head,
      .guardian-hero-head,
      .guardian-result-head,
      .guardian-modal-footer {
        flex-direction: column;
        align-items: flex-start;
      }

      .guardian-switch-row {
        grid-template-columns: 1fr;
      }

      .guardian-switch-box {
        width: 100%;
        justify-content: space-between;
      }

      .guardian-video-quick-card,
      .guardian-edge-toast-region {
        width: calc(100vw - 16px);
      }

      .guardian-video-quick-card {
        left: 8px;
        right: 8px;
        bottom: 8px;
      }

      .guardian-edge-toast-region {
        top: 8px;
        left: 8px;
        right: 8px;
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
