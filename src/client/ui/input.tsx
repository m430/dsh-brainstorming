import React from 'react';

import { cn } from './utils.js';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = 'text', ...props }, ref) {
    return <input ref={ref} type={type} className={cn('ui-input', className)} {...props} />;
  },
);

Input.displayName = 'Input';
