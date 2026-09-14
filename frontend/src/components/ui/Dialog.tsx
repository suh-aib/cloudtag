import * as React from "react"
import { cn } from "../../lib/utils"
import { X } from "lucide-react"

export function Dialog({ open, children }: { open: boolean, onOpenChange?: (open: boolean) => void, children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ children, className, onClose }: { children: React.ReactNode, className?: string, onClose?: () => void }) {
  return (
    <div className={cn("flex items-center justify-between p-6 border-b", className)}>
      <div className="flex flex-col space-y-1.5 text-center sm:text-left">{children}</div>
      {onClose && (
        <button onClick={onClose} className="rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      )}
    </div>
  )
}

export function DialogTitle({ children, className }: { children: React.ReactNode, className?: string }) {
  return <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>{children}</h2>
}

export function DialogContent({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={cn("p-6 overflow-y-auto flex-1", className)}>{children}</div>
}

export function DialogFooter({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6 border-t bg-gray-50", className)}>{children}</div>
}
