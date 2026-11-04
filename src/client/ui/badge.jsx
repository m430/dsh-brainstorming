import React from 'react';
import { cn } from './utils.js';

export function Badge({ className, ...props }) {
  return <span className={cn('ui-badge', className)} {...props} />;
}
