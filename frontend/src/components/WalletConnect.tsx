import React, { useState } from "react";
import { Button, Text, HStack, Box } from "@chakra-ui/react";

const WalletConnect: React.FC = () => {
  const [account, setAccount] = useState<string | null>(null);

  const connectWallet = async () => {
    if ((window as any).ethereum) {
      const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
    } else {
      alert("MetaMask not detected. Please install MetaMask.");
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
  };

  return (
    <HStack spacing={4}>
      {account ? (
        <>
          <Box fontFamily="mono" fontSize="sm" bg="gray.100" px={3} py={1} borderRadius="md">
            {account.slice(0, 6)}...{account.slice(-4)}
          </Box>
          <Button size="sm" colorScheme="red" variant="outline" onClick={disconnectWallet}>
            Disconnect
          </Button>
        </>
      ) : (
        <Button size="sm" colorScheme="blue" onClick={connectWallet}>
          Connect Wallet
        </Button>
      )}
    </HStack>
  );
};

export default WalletConnect; 