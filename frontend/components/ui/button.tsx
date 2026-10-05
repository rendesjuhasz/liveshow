import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-accent/70",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-[#0b1220] shadow-[0_8px_20px_rgba(0,194,255,0.18)] hover:bg-accent hover:shadow-[0_8px_24px_rgba(77,203,255,0.28)]",
                gold: "bg-primary text-[#0b1220] shadow-[0_8px_20px_rgba(0,194,255,0.18)] hover:bg-accent hover:shadow-[0_8px_24px_rgba(77,203,255,0.28)]",
                ghost: "bg-white/10 text-white backdrop-blur-md hover:bg-white/20 hover:shadow-[0_8px_24px_rgba(77,203,255,0.15)]",
                outline:
                    "border border-white/10 bg-card text-white shadow-md hover:border-accent/40 hover:shadow-[0_8px_24px_rgba(77,203,255,0.15)]",
                danger: "bg-danger text-white hover:bg-danger/90",
            },
            size: {
                default: "h-11 px-5",
                lg: "h-12 px-7 text-base",
                sm: "h-9 px-3 text-xs",
                icon: "size-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

function Button({
    className,
    variant,
    size,
    asChild = false,
    ...props
}: React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
