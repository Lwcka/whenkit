import { LoaderCircle, type LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './button.css';

export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'ghost'
  | 'danger'
  | 'danger-solid';

export interface ButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  variant?: ButtonVariant;
  /** Lucide icon, at the left of the text (DESIGN, Buttons). */
  icon?: LucideIcon;
  /** Square, icon only; `title` is the tooltip and the accessible name. */
  iconOnly?: boolean;
  /**
   * The action is running: disabled but at full opacity, the icon becomes a
   * spinning loader and `children` should already say what is happening
   * ("Se exportă…").
   */
  busy?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'default',
  icon: Icon,
  iconOnly = false,
  busy = false,
  className,
  type = 'button',
  disabled,
  title,
  'aria-label': ariaLabel,
  children,
  ...rest
}: ButtonProps) {
  const ShownIcon = busy ? LoaderCircle : Icon;
  return (
    <button
      {...rest}
      type={type}
      className={['button', className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-icon-only={iconOnly ? '' : undefined}
      data-busy={busy ? '' : undefined}
      aria-busy={busy ? true : undefined}
      aria-label={ariaLabel ?? (iconOnly ? title : undefined)}
      disabled={disabled === true || busy}
      title={title}
    >
      {ShownIcon !== undefined && (
        <ShownIcon aria-hidden="true" className={busy ? 'spin' : undefined} />
      )}
      {children}
    </button>
  );
}
