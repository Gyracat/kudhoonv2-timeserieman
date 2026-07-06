import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/measure")({
  component: () => (
    <div className="p-8 text-center text-muted-foreground">
      Measure feature is not available.
    </div>
  ),
});
