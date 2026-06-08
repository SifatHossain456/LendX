import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "LendX — Collateralized Lending Protocol",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "3a8170812b534d0ff9d794f19a901d64",
  chains: [baseSepolia],
  ssr: true,
});
