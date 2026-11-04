import React from 'react';

import { cn } from './utils.js';

export function Spinner({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('ui-spinner', className)} aria-hidden="true" {...props} />;
}
