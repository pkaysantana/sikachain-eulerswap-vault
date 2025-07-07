import React from "react";
import { ChakraProvider, Box, Heading, Text, Flex } from "@chakra-ui/react";
import theme from "./theme";
import WalletConnect from "./components/WalletConnect";
import DepositForm from "./components/DepositForm";
import EventClaimForm from "./components/EventClaimForm";

function SikaCediLogo() {
  return (
    <Heading as="h1" size="lg" fontWeight="bold" letterSpacing="tight">
      Sika
      <Box as="span" color="sika.red" fontWeight="extrabold" fontSize="2xl" verticalAlign="middle">
        ₵
      </Box>
      hain
    </Heading>
  );
}

function App() {
  return (
    <ChakraProvider theme={theme}>
      <Flex as="header" align="center" justify="space-between" p={6} bg="sika.white" boxShadow="sm">
        <SikaCediLogo />
        <Flex align="center" gap={6}>
          <Text fontSize="sm" color="gray.500">DeFi-native remittance vault</Text>
          <WalletConnect />
        </Flex>
      </Flex>
      <Box as="main" p={8} minH="80vh" bg="gray.50">
        {/* Main content and flows will go here */}
        <Text color="gray.400" fontSize="xl" mt={20} textAlign="center">
          Welcome to Sika₵hain – Secure, data-driven remittance for Ghana and beyond.
        </Text>
        <DepositForm />
        <EventClaimForm />
      </Box>
    </ChakraProvider>
  );
}

export default App; 