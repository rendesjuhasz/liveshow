"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during SSR and the hydration render; true after mount. */
export function useMounted() {
    return useSyncExternalStore(subscribe, () => true, () => false);
}
