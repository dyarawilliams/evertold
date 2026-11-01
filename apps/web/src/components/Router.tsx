import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { parseRoute, type Route } from "../lib/routes.ts";

type RouterValue = {
  route: Route;
  navigate: (href: string) => void;
};

const RouterContext = createContext<RouterValue | null>(null);

function focusPageTitle(): void {
  window.requestAnimationFrame(() => {
    document.getElementById("page-title")?.focus();
  });
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname, window.location.search));

  useEffect(() => {
    const onPop = () => {
      setRoute(parseRoute(window.location.pathname, window.location.search));
      focusPageTitle();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  const navigate = useCallback((href: string) => {
    const url = new URL(href, window.location.origin);
    const next = `${url.pathname}${url.search}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (next !== current) {
      window.history.pushState(null, "", next);
    }
    setRoute(parseRoute(url.pathname, url.search));
    focusPageTitle();
  }, []);

  return <RouterContext.Provider value={{ route, navigate }}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (!value) {
    throw new Error("Router is missing.");
  }
  return value;
}

export function AppLink({
  href,
  className,
  children,
  current,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  current?: boolean;
}) {
  const { navigate } = useRouter();
  return (
    <a
      href={href}
      className={className}
      aria-current={current ? "page" : undefined}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
          return;
        }
        event.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}
