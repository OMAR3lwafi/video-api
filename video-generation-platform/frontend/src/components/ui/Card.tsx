/**
 * Card Component
 * Flexible card container with header and footer support
 */

import React, { forwardRef } from 'react'
import { clsx } from 'clsx'
import type { CardProps } from '@/types/ui'

const cardVariants = {
  default: 'card',
  elevated: 'card shadow-lg',
  outlined: 'card border-2',
}

const cardPadding = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      interactive = false,
      padding = 'md',
      header,
      footer,
      className,
      children,
      testId,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        data-testid={testId}
        className={clsx(
          cardVariants[variant],
          interactive && 'card-interactive',
          className
        )}
        {...props}
      >
        {header && (
          <div className="px-6 py-4 border-b border-secondary-200">
            {header}
          </div>
        )}
        
        <div className={clsx(cardPadding[padding])}>
          {children}
        </div>
        
        {footer && (
          <div className="px-6 py-4 border-t border-secondary-200 bg-secondary-50">
            {footer}
          </div>
        )}
      </div>
    )
  }
)

Card.displayName = 'Card'

/**
 * Card Header Component
 */
interface CardHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-center justify-between', className)}>
      <div>
        <h3 className="text-lg font-semibold text-secondary-900">{title}</h3>
        {subtitle && (
          <p className="text-sm text-secondary-600 mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

/**
 * Card Footer Component
 */
interface CardFooterProps {
  children: React.ReactNode
  className?: string
  justify?: 'start' | 'center' | 'end' | 'between'
}

export function CardFooter({ 
  children, 
  className, 
  justify = 'end' 
}: CardFooterProps) {
  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
  }

  return (
    <div className={clsx('flex items-center gap-3', justifyClasses[justify], className)}>
      {children}
    </div>
  )
}
