import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-accent/70",
    {
        variants: {
            variant: {
                default: "bg-white text-black hover:bg-zinc-200",
                gold: "bg-accent text-black hover:bg-accent/90",
                ghost: "bg-white/10 text-white hover:bg-white/20 backdrop-blur-md",
                outline: "border border-white/20 bg-black/40 text-white hover:bg-white/10",
                danger: "bg-red-600 text-white hover:bg-red-500",
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
