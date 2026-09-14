import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "../../lib/utils"

export function Spinner({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <Loader2 className={cn("animate-spin text-blue-600", className)} {...props} />
  )
}
