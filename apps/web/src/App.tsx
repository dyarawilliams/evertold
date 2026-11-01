import { useEffect } from "react";
import { AppLink, RouterProvider, useRouter } from "./components/Router.tsx";
import { Shell } from "./components/Shell.tsx";
import type { Route } from "./lib/routes.ts";
import { Dashboard } from "./pages/Dashboard.tsx";
import { LibraryPage } from "./pages/LibraryPage.tsx";
import { RecordPage } from "./pages/RecordPage.tsx";
import { StoryPage } from "./pages/StoryPage.tsx";

export default function App() {
  return (
    <RouterProvider>
      <RoutedApp />
    </RouterProvider>
  );
}

function RoutedApp() {
  const { route } = useRouter();
  useEffect(() => {
    document.title = titleFor(route);
  }, [route]);

  return (
    <Shell current={route.name}>
      <Page route={route} />
    </Shell>
  );
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case "dashboard":
      return <Dashboard />;
    case "record":
      return <RecordPage mode={route.mode} />;
    case "library":
      return <LibraryPage />;
    case "story":
      return <StoryPage id={route.id} />;
    case "not-found":
      return <MissingPage />;
    default: {
      const neverRoute: never = route;
      return neverRoute;
    }
  }
}

function MissingPage() {
  return (
    <div className="paper flex flex-col items-start gap-4 p-8">
      <h1 className="font-serif text-4xl">That page is not part of EverTold</h1>
      <AppLink className="btn" href="/">
        Back to the dashboard
      </AppLink>
    </div>
  );
}

function titleFor(route: Route): string {
  switch (route.name) {
    case "dashboard":
      return "EverTold";
    case "record":
      return "Record a story · EverTold";
    case "library":
      return "Library · EverTold";
    case "story":
      return "Story · EverTold";
    case "not-found":
      return "Not found · EverTold";
    default: {
      const neverRoute: never = route;
      return neverRoute;
    }
  }
}
