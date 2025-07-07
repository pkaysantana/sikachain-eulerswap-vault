import React, { useState } from "react";
import { Box, Button, FormControl, FormLabel, Input, InputGroup, InputLeftAddon, VStack, useToast } from "@chakra-ui/react";

const DepositForm: React.FC = () => {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // TODO: Call deposit contract function here
    setTimeout(() => {
      setLoading(false);
      toast({ title: "Deposit submitted!", status: "success", duration: 3000, isClosable: true });
      setRecipient("");
      setAmount("");
    }, 1200);
  };

  return (
    <Box bg="white" p={6} borderRadius="lg" boxShadow="md" maxW="md" mx="auto" mt={10}>
      <form onSubmit={handleDeposit}>
        <VStack spacing={5} align="stretch">
          <FormControl isRequired>
            <FormLabel>Recipient Address</FormLabel>
            <Input
              placeholder="0x..."
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
              fontFamily="mono"
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Amount</FormLabel>
            <InputGroup>
              <InputLeftAddon color="sika.red" fontWeight="bold">₵</InputLeftAddon>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min={0}
                step={0.01}
              />
            </InputGroup>
          </FormControl>
          {/* Token selection could go here if multi-token is supported */}
          <Button type="submit" colorScheme="blue" isLoading={loading} w="full">
            Deposit
          </Button>
        </VStack>
      </form>
    </Box>
  );
};

export default DepositForm; 