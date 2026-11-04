import React from 'react';
import { Menu as BaseMenu } from '@base-ui/react/menu';

import { cn } from './utils.js';

export const DropdownMenu = BaseMenu.Root;
export const DropdownMenuTrigger = BaseMenu.Trigger;

type MenuPopupProps = React.ComponentPropsWithoutRef<typeof BaseMenu.Popup>;
type MenuItemProps = React.ComponentPropsWithoutRef<typeof BaseMenu.Item>;
type PositionerProps = React.ComponentPropsWithoutRef<typeof BaseMenu.Positioner>;

export interface DropdownMenuContentProps extends MenuPopupProps {
  align?: PositionerProps['align'];
  sideOffset?: number;
}

export function DropdownMenuContent({
  className,
  children,
  align = 'end',
  sideOffset = 6,
  ...props
}: DropdownMenuContentProps) {
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

export interface DropdownMenuItemProps extends MenuItemProps {
  danger?: boolean;
}

export function DropdownMenuItem({ className, danger, ...props }: DropdownMenuItemProps) {
  return <BaseMenu.Item className={cn('ui-menu-item', danger && 'ui-menu-item-danger', className)} {...props} />;
}
