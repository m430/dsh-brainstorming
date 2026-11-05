import React from 'react';

import type { Translate, UpdateApplyResult, UpdateStatus } from '../../shared/types.js';
import { applyUpdate, getUpdateStatus } from '../api.js';
import { Badge } from '../ui/badge.js';
import { Button } from '../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog.js';

type Phase = 'idle' | 'confirm' | 'applying' | 'done' | 'error';

interface UpdateHintProps {
  t: Translate;
}

export function UpdateHint({ t }: UpdateHintProps) {
  const [status, setStatus] = React.useState<UpdateStatus | null>(null);
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [applyResult, setApplyResult] = React.useState<UpdateApplyResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const next = await getUpdateStatus(controller.signal);
        if (!controller.signal.aborted) setStatus(next);
      } catch {
        // Silent: list page should not surface registry/network noise.
      }
    })();
    return () => controller.abort();
  }, []);

  const available = Boolean(status?.available && status.latest && status.enabled);
  const dialogOpen = phase === 'confirm' || phase === 'applying' || phase === 'done' || phase === 'error';

  const closeDialog = () => {
    if (phase === 'applying') return;
    setPhase('idle');
    setError(null);
    if (phase === 'done' && applyResult?.ok) {
      // Keep badge hidden after success until next mount/check.
      setStatus((prev) => (prev ? { ...prev, available: false, latest: applyResult.target, current: applyResult.target } : prev));
    }
  };

  const onConfirm = async () => {
    if (!status?.latest || phase === 'applying') return;
    setPhase('applying');
    setError(null);
    try {
      const result = await applyUpdate(status.latest);
      setApplyResult(result);
      if (result.ok) {
        setPhase('done');
      } else {
        setError(result.message || t('brainstorm.updateFailed'));
        setPhase('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('brainstorm.updateFailed'));
      setPhase('error');
    }
  };

  if (!available && phase === 'idle') return null;

  const latest = status?.latest || applyResult?.target || '';
  const current = status?.current || applyResult?.current || '';

  return (
    <>
      {available ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="bn-updateHint"
          onClick={() => {
            setPhase('confirm');
            setError(null);
            setApplyResult(null);
          }}
        >
          <Badge className="bn-updateBadge">{t('brainstorm.updateAvailable', { version: latest })}</Badge>
        </Button>
      ) : null}

      {dialogOpen ? (
        <Dialog open onOpenChange={(open) => !open && closeDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {phase === 'done'
                  ? t('brainstorm.updateDoneTitle')
                  : phase === 'error'
                    ? t('brainstorm.updateFailedTitle')
                    : t('brainstorm.updateConfirmTitle')}
              </DialogTitle>
              <DialogDescription>
                {phase === 'confirm' || phase === 'applying'
                  ? t('brainstorm.updateConfirmHint', { current, latest })
                  : phase === 'done'
                    ? (applyResult?.needsRestart
                      ? t('brainstorm.updateDoneRestart')
                      : t('brainstorm.updateDoneReload'))
                    : (error || t('brainstorm.updateFailed'))}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              {phase === 'confirm' ? (
                <>
                  <Button variant="outline" onClick={closeDialog}>{t('brainstorm.cancel')}</Button>
                  <Button variant="default" onClick={() => void onConfirm()}>
                    {t('brainstorm.updateConfirm')}
                  </Button>
                </>
              ) : null}
              {phase === 'applying' ? (
                <Button variant="default" disabled>
                  {t('brainstorm.updateApplying')}
                </Button>
              ) : null}
              {phase === 'done' ? (
                applyResult?.needsRestart ? (
                  <Button variant="default" onClick={closeDialog}>
                    {t('brainstorm.updateGotIt')}
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    onClick={() => {
                      window.location.reload();
                    }}
                  >
                    {t('brainstorm.updateReload')}
                  </Button>
                )
              ) : null}
              {phase === 'error' ? (
                <>
                  <Button variant="outline" onClick={closeDialog}>{t('brainstorm.cancel')}</Button>
                  <Button variant="default" onClick={() => void onConfirm()}>
                    {t('brainstorm.retry')}
                  </Button>
                </>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
