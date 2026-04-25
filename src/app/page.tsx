import { redirect } from "next/navigation";
import { getCurrentUser, redirectIfNoSessionButMaybeRefreshable } from "@/lib/session";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirectIfNoSessionButMaybeRefreshable();
  redirect("/swipe");
}
