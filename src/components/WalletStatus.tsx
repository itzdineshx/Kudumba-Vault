/**
 * Wallet connection status component for the sidebar/header
 * Shows MetaMask connection state, address, and balance
 */

import { useBlockchain } from "@/context/BlockchainContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Wallet, Unplug, ExternalLink, Loader2 } from "lucide-react";
import { formatHash } from "@/services/crypto";

const WalletStatus = () => {
  const { status, wallet, error, contractAddress, connectWallet, disconnectWallet } = useBlockchain();

  if (status === "disconnected" || status === "error") {
    return (
      <div className="space-y-2">
        <Button
          onClick={connectWallet}
          size="sm"
          variant="outline"
          className="w-full gap-2 border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300"
        >
          <Wallet className="h-3.5 w-3.5" /> Connect Wallet
        </Button>
        {error && (
          <p className="text-[10px] text-destructive px-1">{error}</p>
        )}
      </div>
    );
  }

  if (status === "connecting" || status === "deploying") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--sidebar-accent))] px-3 py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        <span className="text-[11px]">
          {status === "connecting" ? "Connecting..." : "Deploying..."}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="rounded-lg bg-[hsl(var(--sidebar-accent))] px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-medium text-green-400">Connected</span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={disconnectWallet} className="text-[hsl(var(--sidebar-foreground))]/40 hover:text-destructive transition-colors">
                <Unplug className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Disconnect wallet</TooltipContent>
          </Tooltip>
        </div>
        {wallet && (
          <div className="mt-1.5 space-y-0.5">
            <p className="font-mono text-[10px] text-[hsl(var(--sidebar-foreground))]/70">
              {formatHash(wallet.address, 6)}
            </p>
            <p className="text-[10px] text-[hsl(var(--sidebar-foreground))]/50">
              {parseFloat(wallet.balance).toFixed(4)} ETH · {wallet.network}
            </p>
          </div>
        )}
      </div>
      {contractAddress && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="w-full justify-center gap-1 text-[9px] border-primary/30 text-primary/70">
              <ExternalLink className="h-2.5 w-2.5" />
              Contract: {formatHash(contractAddress, 4)}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="font-mono text-[10px]">{contractAddress}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};

export default WalletStatus;
