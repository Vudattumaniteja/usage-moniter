import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AntigravityLogo, AntigravityLogoGradient, OpenAILogo, ClaudeLogo, GeminiLogo } from "./icons";

describe("Official Brand Icons", () => {
  it("renders official AntigravityLogo with SVG element", () => {
    const { container } = render(<AntigravityLogo className="w-5 h-5 text-white" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("viewBox", "0 0 180 180");
  });

  it("renders official AntigravityLogoGradient with linear gradient", () => {
    const { container } = render(<AntigravityLogoGradient className="w-5 h-5" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    const grad = container.querySelector("linearGradient");
    expect(grad).toBeInTheDocument();
  });

  it("renders official OpenAILogo with SVG element", () => {
    const { container } = render(<OpenAILogo className="w-5 h-5 text-white" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
  });

  it("renders official ClaudeLogo with SVG element", () => {
    const { container } = render(<ClaudeLogo className="w-5 h-5 text-white" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders official GeminiLogo with SVG element", () => {
    const { container } = render(<GeminiLogo className="w-5 h-5 text-white" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});
