import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "LendX — Collateralized Lending Protocol",
  projectId: "lendx_demo_project_id",
  chains: [baseSepolia],
  ssr: true,
});
