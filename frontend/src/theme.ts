import { extendTheme } from "@chakra-ui/react";

// Sika₵hain Data-Driven Color Palette
// red: high risk/impact, debt
// white: neutral/low impact
// blue: current price indicator
// green: equilibrium, healthy, NAV midpoint
// purple: Net Asset Value (NAV)
// Use these tokens in all charts, sliders, and status indicators

const theme = extendTheme({
  colors: {
    sika: {
      red: "#FF3B30",      // High risk/impact, debt
      white: "#FFFFFF",    // Neutral/low impact
      blue: "#007AFF",     // Current price indicator
      green: "#34C759",    // Equilibrium, healthy, NAV midpoint
      purple: "#AF52DE",   // NAV
      gradient: "linear(to-r, #FF3B30, #FFFFFF)", // Red-to-white gradient
    },
  },
  fonts: {
    heading: 'Inter, sans-serif',
    body: 'Inter, sans-serif',
    mono: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
});

export default theme; 