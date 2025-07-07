import React, { useState } from "react";
import { Box, Button, FormControl, FormLabel, Input, VStack, useToast } from "@chakra-ui/react";

const EventClaimForm: React.FC = () => {
  const [depositId, setDepositId] = useState("");
  const [simProof, setSimProof] = useState("");
  const [code, setCode] = useState("");
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // TODO: Call claimWithSignature contract/relayer function here
    setTimeout(() => {
      setLoading(false);
      toast({ title: "Claim submitted!", status: "success", duration: 3000, isClosable: true });
      setDepositId("");
      setSimProof("");
      setCode("");
      setSignature("");
    }, 1200);
  };

  return (
    <Box bg="white" p={6} borderRadius="lg" boxShadow="md" maxW="md" mx="auto" mt={10}>
      <form onSubmit={handleClaim}>
        <VStack spacing={5} align="stretch">
          <FormControl isRequired>
            <FormLabel>Deposit ID</FormLabel>
            <Input
              placeholder="0x..."
              value={depositId}
              onChange={e => setDepositId(e.target.value)}
              fontFamily="mono"
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>SIM Proof</FormLabel>
            <Input
              placeholder="e.g. MTN-verified"
              value={simProof}
              onChange={e => setSimProof(e.target.value)}
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>6-digit Code</FormLabel>
            <Input
              placeholder="123456"
              value={code}
              onChange={e => setCode(e.target.value)}
              maxLength={6}
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Signature</FormLabel>
            <Input
              placeholder="0x..."
              value={signature}
              onChange={e => setSignature(e.target.value)}
              fontFamily="mono"
            />
          </FormControl>
          <Button type="submit" colorScheme="green" isLoading={loading} w="full">
            Submit Claim
          </Button>
        </VStack>
      </form>
    </Box>
  );
};

export default EventClaimForm; 