"use client";

import React, { useState } from 'react';
import {
  X,
  RotateCcw,
  Pause,
  Play,
  Trash2,
  Download,
  Archive,
  Tag,
  MoreVertical,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface BulkActionsBarProps {
  selectedCount: number;
  onAction: (action: string, options?: any) => Promise<void> | void;
  onClear: () => void;
  className?: string;
  actions?: BulkAction[];
}

interface BulkAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  requireConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationDescription?: string;
  disabled?: boolean;
}

const defaultActions: BulkAction[] = [
  {
    id: 'retry',
    label: 'Retry',
    icon: <RotateCcw className="h-4 w-4" />,
    variant: 'outline'
  },
  {
    id: 'cancel',
    label: 'Cancel',
    icon: <X className="h-4 w-4" />,
    variant: 'outline'
  },
  {
    id: 'pause',
    label: 'Pause',
    icon: <Pause className="h-4 w-4" />,
    variant: 'outline'
  },
  {
    id: 'resume',
    label: 'Resume',
    icon: <Play className="h-4 w-4" />,
    variant: 'outline'
  },
  {
    id: 'download',
    label: 'Download',
    icon: <Download className="h-4 w-4" />,
    variant: 'outline'
  },
  {
    id: 'archive',
    label: 'Archive',
    icon: <Archive className="h-4 w-4" />,
    variant: 'outline'
  },
  {
    id: 'tag',
    label: 'Add Tag',
    icon: <Tag className="h-4 w-4" />,
    variant: 'outline'
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: <Trash2 className="h-4 w-4" />,
    variant: 'destructive',
    requireConfirmation: true,
    confirmationTitle: 'Delete Selected Jobs?',
    confirmationDescription: 'This action cannot be undone. All selected jobs and their associated data will be permanently deleted.'
  }
];

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  onAction,
  onClear,
  className,
  actions = defaultActions
}) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<BulkAction | null>(null);

  const handleAction = async (action: BulkAction) => {
    if (action.requireConfirmation) {
      setConfirmAction(action);
      return;
    }

    await executeAction(action);
  };

  const executeAction = async (action: BulkAction) => {
    setIsProcessing(true);
    
    try {
      await onAction(action.id);
      
      toast({
        title: 'Bulk Action Completed',
        description: `${action.label} action applied to ${selectedCount} jobs.`,
        duration: 3000,
      });
      
      onClear();
    } catch (error) {
      toast({
        title: 'Bulk Action Failed',
        description: `Failed to ${action.label.toLowerCase()} selected jobs. Please try again.`,
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
      setConfirmAction(null);
    }
  };

  const primaryActions = actions.filter(a => 
    ['retry', 'cancel', 'pause', 'resume', 'delete'].includes(a.id)
  );
  const secondaryActions = actions.filter(a => 
    !['retry', 'cancel', 'pause', 'resume', 'delete'].includes(a.id)
  );

  return (
    <>
      <div className={cn(
        "sticky top-0 z-20 bg-white border rounded-lg shadow-lg p-4 transition-all",
        "animate-in slide-in-from-top-2 duration-200",
        className
      )}>
        <div className="flex items-center justify-between">
          {/* Selection Info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-sm">
                {selectedCount} {selectedCount === 1 ? 'job' : 'jobs'} selected
              </span>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-gray-500 hover:text-gray-700"
            >
              Clear selection
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Primary Actions */}
            {primaryActions.map(action => (
              <Button
                key={action.id}
                variant={action.variant}
                size="sm"
                onClick={() => handleAction(action)}
                disabled={isProcessing || action.disabled}
              >
                {action.icon}
                <span className="ml-2 hidden sm:inline">{action.label}</span>
              </Button>
            ))}
            
            {/* Secondary Actions Dropdown */}
            {secondaryActions.length > 0 && (
              <>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isProcessing}
                    >
                      <MoreVertical className="h-4 w-4" />
                      <span className="ml-2 hidden sm:inline">More</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {secondaryActions.map(action => (
                      <DropdownMenuItem
                        key={action.id}
                        onClick={() => handleAction(action)}
                        disabled={action.disabled}
                      >
                        {action.icon}
                        <span className="ml-2">{action.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gray-200 overflow-hidden">
            <div className="h-full bg-blue-600 animate-pulse" />
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              {confirmAction?.confirmationTitle || 'Confirm Action'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.confirmationDescription || 
                `Are you sure you want to ${confirmAction?.label.toLowerCase()} ${selectedCount} selected jobs?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmAction && executeAction(confirmAction)}
              disabled={isProcessing}
              className={cn(
                confirmAction?.variant === 'destructive' && "bg-red-600 hover:bg-red-700"
              )}
            >
              {confirmAction?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};