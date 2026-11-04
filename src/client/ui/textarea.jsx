import React from 'react';
import { cn } from './utils.js';

export const Textarea = React.forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn('ui-textarea', className)} {...props} />;
});
