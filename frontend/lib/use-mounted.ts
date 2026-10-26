"use client";

import { useEffect, useState } from "react";

/** False during SSR and the hydration render; true after mount. */
export function useMounted() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);
    return mounted;
}
