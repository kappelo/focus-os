import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Focus OS — Study & Focus",
    short_name: "Focus OS",
    description: "Local-first Study & Focus OS",
    id: "/",
    lang: "pl",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    background_color: "#f5f6f2",
    theme_color: "#65724b",
    orientation: "any",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Rozpocznij skupienie", short_name: "Skupienie", url: "/?view=focus" },
      { name: "Zadania", short_name: "Zadania", url: "/?view=tasks" },
      { name: "Nauka i fiszki", short_name: "Nauka", url: "/?view=learn" },
      { name: "Plan tygodnia", short_name: "Plan", url: "/?view=planner" },
    ],
  };
}
