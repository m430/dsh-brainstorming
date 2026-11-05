import {
  DEFAULT_FETCH_TIMEOUT_MS,
  DEFAULT_INITIAL_DELAY_MS,
  DEFAULT_INTERVAL_MS,
  DEFAULT_REGISTRY,
  MIN_INTERVAL_MS,
  PACKAGE_NAME,
  VERSION_PATTERN,
} from './constants.js';
import { applyUpgrade, summarizeApplyError } from './apply-upgrade.js';
import { hasHotReload, resolveInstallKind, type InstallKind } from './install-kind.js';
import { fetchLatestVersion } from './registry.js';
import {
  resolvePluginLocation,
  resolveProfileDir,
} from './resolve-profile.js';
import { isNewer, isStrictSemver } from './semver.js';

export interface UpdateCheckConfig {
  enabled: boolean;
  intervalMs: number;
  initialDelayMs: number;
  registry: string;
  fetchTimeoutMs: number;
}

export interface UpdateStatus {
  packageName: string;
  enabled: boolean;
  kind: InstallKind;
  current: string | null;
  latest: string | null;
  available: boolean;
  upgrading: boolean;
  checkedAt: number | null;
  error: string | null;
  hotReload: boolean;
  profileDir: string | null;
}

export interface UpdateApplyResult {
  ok: boolean;
  current: string | null;
  target: string | null;
  message: string;
  needsRestart: boolean;
}

type Logger = { warn?: (message: string) => void; info?: (message: string) => void };

export function resolveUpdateCheckConfig(raw: unknown): UpdateCheckConfig {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const intervalRaw = typeof value.intervalMs === 'number' && Number.isFinite(value.intervalMs)
    ? Math.floor(value.intervalMs)
    : DEFAULT_INTERVAL_MS;
  const timeoutRaw = typeof value.fetchTimeoutMs === 'number' && Number.isFinite(value.fetchTimeoutMs)
    ? Math.floor(value.fetchTimeoutMs)
    : DEFAULT_FETCH_TIMEOUT_MS;
  const delayRaw = typeof value.initialDelayMs === 'number' && Number.isFinite(value.initialDelayMs)
    ? Math.floor(value.initialDelayMs)
    : DEFAULT_INITIAL_DELAY_MS;
  return {
    enabled: value.enabled !== false,
    intervalMs: Math.max(MIN_INTERVAL_MS, intervalRaw),
    initialDelayMs: Math.max(0, delayRaw),
    registry: typeof value.registry === 'string' && value.registry.trim() !== ''
      ? value.registry.trim()
      : DEFAULT_REGISTRY,
    fetchTimeoutMs: Math.max(1_000, timeoutRaw),
  };
}

export class UpdateService {
  private readonly config: UpdateCheckConfig;
  private readonly logger: Logger | undefined;
  private readonly moduleUrl: string;

  private profileDir: string | null = null;
  private kind: InstallKind = 'unknown';
  private current: string | null = null;
  private latest: string | null = null;
  private available = false;
  private upgrading = false;
  private checkedAt: number | null = null;
  private error: string | null = null;
  private hotReload = false;
  private checkTimer: ReturnType<typeof setTimeout> | null = null;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  private checkInFlight: Promise<void> | null = null;

  constructor(options: {
    moduleUrl: string;
    config: UpdateCheckConfig;
    logger?: Logger;
  }) {
    this.moduleUrl = options.moduleUrl;
    this.config = options.config;
    this.logger = options.logger;
  }

  start(): void {
    if (!this.config.enabled) return;
    this.bootstrapLocation();
    if (this.kind === 'local') {
      this.logger?.info?.('dsh-brainstorming: update check skipped (local link/file install)');
      return;
    }
    if (!this.profileDir) {
      this.logger?.warn?.('dsh-brainstorming: update check disabled (profile dir not found)');
      return;
    }
    this.checkTimer = setTimeout(() => {
      void this.check();
      if (this.disposed) return;
      this.intervalTimer = setInterval(() => {
        void this.check();
      }, this.config.intervalMs);
    }, this.config.initialDelayMs);
  }

  stop(): void {
    this.disposed = true;
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  getStatus(): UpdateStatus {
    return {
      packageName: PACKAGE_NAME,
      enabled: this.config.enabled && this.kind !== 'local' && Boolean(this.profileDir),
      kind: this.kind,
      current: this.current,
      latest: this.latest,
      available: this.available,
      upgrading: this.upgrading,
      checkedAt: this.checkedAt,
      error: this.error,
      hotReload: this.hotReload,
      profileDir: this.profileDir,
    };
  }

  async refreshStatus(): Promise<UpdateStatus> {
    if (this.config.enabled && this.kind !== 'local' && this.profileDir) {
      await this.check();
    }
    return this.getStatus();
  }

  async apply(requestedVersion?: string): Promise<UpdateApplyResult> {
    if (this.upgrading) {
      return {
        ok: false,
        current: this.current,
        target: null,
        message: '升级正在进行中，请稍候。',
        needsRestart: false,
      };
    }
    if (this.kind === 'local') {
      return {
        ok: false,
        current: this.current,
        target: null,
        message: '本地 link/file 安装不支持一键升级。',
        needsRestart: false,
      };
    }
    if (!this.profileDir) {
      return {
        ok: false,
        current: this.current,
        target: null,
        message: '无法定位 profile 目录，升级已取消。',
        needsRestart: false,
      };
    }

    await this.check();
    const target = requestedVersion?.trim() || this.latest;
    if (!target || !VERSION_PATTERN.test(target) || !isStrictSemver(target)) {
      return {
        ok: false,
        current: this.current,
        target: target || null,
        message: '没有可用的目标版本。',
        needsRestart: false,
      };
    }
    if (this.latest && target !== this.latest) {
      return {
        ok: false,
        current: this.current,
        target,
        message: '目标版本与当前检测结果不一致，请刷新后再试。',
        needsRestart: false,
      };
    }
    if (!this.current || !isNewer(target, this.current)) {
      return {
        ok: false,
        current: this.current,
        target,
        message: '已是最新版本，无需升级。',
        needsRestart: false,
      };
    }

    this.upgrading = true;
    try {
      const result = await applyUpgrade(this.profileDir, target);
      if (!result.ok) {
        const detail = summarizeApplyError(result);
        this.logger?.warn?.(`dsh-brainstorming: upgrade failed: ${detail}`);
        return {
          ok: false,
          current: this.current,
          target,
          message: detail,
          needsRestart: false,
        };
      }
      const previous = this.current;
      this.current = target;
      this.latest = target;
      this.available = false;
      this.error = null;
      this.hotReload = hasHotReload(this.profileDir);
      return {
        ok: true,
        current: previous,
        target,
        message: this.hotReload
          ? '升级完成。若已安装 dsh-hot-reload，刷新页面即可加载新版本。'
          : '升级完成。请重启 DeepSeek Harness 后生效。',
        needsRestart: !this.hotReload,
      };
    } finally {
      this.upgrading = false;
    }
  }

  private bootstrapLocation(): void {
    const location = resolvePluginLocation(this.moduleUrl);
    this.current = location?.currentVersion ?? null;
    this.profileDir = location ? resolveProfileDir(location.packageRoot) : null;
    this.kind = resolveInstallKind(this.profileDir);
    this.hotReload = hasHotReload(this.profileDir);
  }

  private async check(): Promise<void> {
    if (this.checkInFlight) {
      await this.checkInFlight;
      return;
    }
    this.checkInFlight = this.runCheck().finally(() => {
      this.checkInFlight = null;
    });
    await this.checkInFlight;
  }

  private async runCheck(): Promise<void> {
    if (this.disposed || this.kind === 'local' || !this.profileDir) return;
    // Refresh current version from disk in case of external upgrade.
    const location = resolvePluginLocation(this.moduleUrl);
    if (location?.currentVersion) this.current = location.currentVersion;
    this.hotReload = hasHotReload(this.profileDir);

    try {
      const latest = await fetchLatestVersion(
        this.config.registry,
        this.config.fetchTimeoutMs,
      );
      this.latest = latest;
      this.checkedAt = Date.now();
      this.error = null;
      this.available = Boolean(
        this.current
        && isStrictSemver(this.current)
        && isStrictSemver(latest)
        && isNewer(latest, this.current),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error = message;
      this.checkedAt = Date.now();
      this.available = false;
      this.logger?.warn?.(`dsh-brainstorming: update check failed: ${message}`);
    }
  }
}
