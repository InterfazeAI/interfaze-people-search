import {
  createSystem,
  defaultConfig,
  defineConfig,
  defineRecipe,
} from "@chakra-ui/react";

// Mirrors the Interfaze landing page: Lora headings, Geist Mono body, zinc neutrals,
// compact 36px controls with 4px corners, teal used sparingly for state.
const themeConfig = defineConfig({
  globalCss: {
    html: { colorScheme: "light" },
    body: { bg: "bg.500", color: "primary.900", fontSize: "sm" },
  },
  theme: {
    recipes: {
      button: defineRecipe({
        base: {
          borderRadius: "sm",
          transitionDuration: "160ms",
          fontWeight: 500,
          _active: { transform: "scale(0.98)" },
        },
        variants: {
          size: {
            sm: {
              h: 9,
              minW: 9,
              px: 3,
              gap: 1.5,
              textStyle: "xs",
              _icon: { width: "3", height: "3" },
            },
          },
        },
        defaultVariants: { size: "sm" },
      }),
    },
    tokens: {
      fonts: {
        heading: { value: "var(--font-lora), Georgia, serif" },
        body: { value: "var(--font-geist-mono), monospace" },
        mono: { value: "var(--font-geist-mono), monospace" },
      },
      colors: {
        graphic: { highlight: { value: "#007A6A" } },
        comparison: {
          accentSurface: { value: "#EAF8F5" },
          subtleSurface: { value: "#F7F7FA" },
        },
        primary: {
          50: { value: "#F3F3F8" },
          100: { value: "#EEEEF3" },
          200: { value: "#DDDDE8" },
          300: { value: "#AEAEBA" },
          400: { value: "#64646E" },
          500: { value: "#18181B" },
          900: { value: "#09090B" },
        },
        bg: {
          50: { value: "#FAFAFA" },
          200: { value: "#E4E4E7" },
          500: { value: "#FFFFFF" },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, themeConfig);
