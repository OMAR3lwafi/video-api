/**
 * Button Component
 * Reusable button component with multiple variants and states
 */

import React, { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { Loader2, type LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import type { ButtonProps } from '@/types/ui'

const buttonVariants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  success: 'btn-success',
}

const buttonSizes = {
  xs: 'btn-xs',
  sm: 'btn-sm',
  md: '', // default
  lg: 'btn-lg',
  xl: 'btn-xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      icon: Icon,
      iconPosition = 'left',
      fullWidth = false,
      type = 'button',
      className,
      children,
      onClick,
      testId,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (isDisabled) {
        event.preventDefault()
        return
      }
      onClick?.()
    }

    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={isDisabled}
        onClick={handleClick}
        data-testid={testId}
        whileTap={!isDisabled ? { scale: 0.98 } : undefined}
        whileHover={!isDisabled ? { scale: 1.02 } : undefined}
        className={clsx(
          'btn',
          buttonVariants[variant],
          buttonSizes[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading && (
          <Loader2 className="w-4 h-4 animate-spin" />
        )}
        
        {!loading && Icon && iconPosition === 'left' && (
          <Icon className="w-4 h-4" />
        )}
        
        {children && (
          <span className={clsx(
            (loading || (Icon && iconPosition === 'left')) && 'ml-2',
            (Icon && iconPosition === 'right') && 'mr-2'
          )}>
            {children}
          </span>
        )}
        
        {!loading && Icon && iconPosition === 'right' && (
          <Icon className="w-4 h-4" />
        )}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'

/**
 * Icon-only button variant
 */
export const IconButton = forwardRef<HTMLButtonElement, 
  Omit<ButtonProps, 'icon' | 'iconPosition'> & { icon: LucideIcon }
>(
  ({ icon: Icon, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={clsx('!p-2 aspect-square', className)}
        {...props}
      >
        <Icon className="w-4 h-4" />
      </Button>
    )
  }
)

IconButton.displayName = 'IconButton'

/**
 * Button group for related actions
 */
interface ButtonGroupProps {
  children: React.ReactNode
  className?: string
  orientation?: 'horizontal' | 'vertical'
  size?: ButtonProps['size']
  variant?: ButtonProps['variant']
}

export function ButtonGroup({ 
  children, 
  className, 
  orientation = 'horizontal',
  size,
  variant
}: ButtonGroupProps) {
  const childrenArray = React.Children.toArray(children)

  return (
    <div
      className={clsx(
        'inline-flex',
        orientation === 'horizontal' ? 'flex-row' : 'flex-col',
        className
      )}
      role="group"
    >
      {childrenArray.map((child, index) => {
        if (!React.isValidElement(child)) return child

        const isFirst = index === 0
        const isLast = index === childrenArray.length - 1
        const isMiddle = !isFirst && !isLast

        return React.cloneElement(child as React.ReactElement<ButtonProps>, {
          key: index,
          size: size || child.props.size,
          variant: variant || child.props.variant,
          className: clsx(
            child.props.className,
            orientation === 'horizontal' && [
              isFirst && 'rounded-r-none',
              isMiddle && 'rounded-none border-l-0',
              isLast && 'rounded-l-none border-l-0',
            ],
            orientation === 'vertical' && [
              isFirst && 'rounded-b-none',
              isMiddle && 'rounded-none border-t-0',
              isLast && 'rounded-t-none border-t-0',
            ]
          ),
        })
      })}
    </div>
  )
}
