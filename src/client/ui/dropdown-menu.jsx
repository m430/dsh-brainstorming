import React from 'react';
import { Menu as BaseMenu } from '@base-ui/react/menu';
import { cn } from './utils.js';

export const DropdownMenu = BaseMenu.Root;
export const DropdownMenuTrigger = BaseMenu.Trigger;

export function DropdownMenuContent({ className, children, align = 'end', sideOffset = 6, ...props }) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner align={align} sideOffset={sideOffset} className="ui-menu-positioner">
        <BaseMenu.Popup className={cn('ui-menu-content', className)} {...props}>
          {children}
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

export function DropdownMenuItem({ className, danger, ...props }) {
  return <BaseMenu.Item className={cn('ui-menu-item', danger && 'ui-menu-item-danger', className)} {...props} />;
}
