import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        info: "border-transparent bg-blue-500 text-white hover:bg-blue-600",
        success:
          "border-transparent bg-green-100 text-green-600 hover:bg-green-300",
        warning:
          "border-transparent bg-yellow-100 text-yellow-600 hover:bg-yellow-500",
        outline: "bg-transparent border-foreground text-foreground",
        outlineInfo: "bg-transparent border-blue-500 text-blue-600",
        outlineSuccess: "bg-transparent border-green-500 text-green-600",
        outlineWarning: "bg-transparent border-yellow-400 text-yellow-700",
        outlineDestructive:
          "bg-transparent border-destructive text-destructive",
        gradientInfo:
          "border-0 bg-gradient-to-r from-blue-400/50 to-blue-600/50 text-blue-900",
        gradientSuccess:
          "border-0 bg-gradient-to-r from-green-400/50 to-green-600/50 text-green-900",
        gradientWarning:
          "border-0 bg-gradient-to-r from-yellow-300/50 to-yellow-500/50 text-yellow-900",
        gradientDestructive:
          "border-0 bg-gradient-to-r from-red-400/50 to-red-600/50 text-red-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
