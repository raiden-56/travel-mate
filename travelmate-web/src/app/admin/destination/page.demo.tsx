import { Suspense } from "react";
import DestinationEditPage from "@/components/admin/destination-edit-page";

export default function DemoDestinationEdit() {
  return (
    <Suspense>
      <DestinationEditPage />
    </Suspense>
  );
}
