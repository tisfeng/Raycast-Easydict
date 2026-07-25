/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import AIProviderManagementPage from "@/components/pages/AIProviderManagementPage";
import { useAIProviderProfiles } from "@/hooks";

export default function ManageAIProviders() {
  const controller = useAIProviderProfiles();
  return <AIProviderManagementPage controller={controller} />;
}
