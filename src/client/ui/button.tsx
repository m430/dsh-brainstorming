import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from './utils.js';

const buttonVariants = cva('ui-btn', {
  variants: {
    variant: {
      default: 'ui-btn-default',
      outline: 'ui-btn-outline',
      ghost: 'ui-btn-ghost',
      danger: 'ui-btn-danger',
    },
    size: {
      default: 'ui-btn-md',
      sm: 'ui-btn-sm',
      xs: 'ui-btn-xs',
      icon: 'ui-btn-icon',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});

Button.displayName = 'Button';

export { buttonVariants };
