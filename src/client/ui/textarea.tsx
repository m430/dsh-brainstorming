import React from 'react';

import { cn } from './utils.js';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn('ui-textarea', className)} {...props} />;
  },
);

Textarea.displayName = 'Textarea';
