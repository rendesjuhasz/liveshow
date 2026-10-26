import type { ReactNode } from "react";

export default function MainPad({ children }: { children: ReactNode }) {
    return <div data-main-pad="1">{children}</div>;
}
