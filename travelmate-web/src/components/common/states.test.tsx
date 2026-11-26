import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api-client";
import { EmptyState, ErrorState } from "./states";
import { SourceLabel } from "./labels";

describe("ErrorState", () => {
  it("offers retry for generic errors", async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={new ApiError({ status: 500 })} onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("explains permission errors without a retry", () => {
    render(<ErrorState error={new ApiError({ status: 403, code: "FORBIDDEN" })} onRetry={() => {}} />);
    expect(screen.getByText("You don't have access")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });

  it("shows a not-found message with a way home", () => {
    render(<ErrorState error={new ApiError({ status: 404 })} />);
    expect(screen.getByRole("link", { name: /go home/i })).toHaveAttribute("href", "/home");
  });
});

describe("EmptyState", () => {
  it("renders title, description and action", () => {
    render(<EmptyState title="Nothing here" description="Add one" action={<button>Add</button>} />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });
});

describe("SourceLabel", () => {
  it("labels simulated data honestly", () => {
    render(<SourceLabel provenance={{ source: "deterministic", approximate: false, simulated: true }} />);
    expect(screen.getByText(/Simulated/)).toBeInTheDocument();
  });
  it("labels approximate data", () => {
    render(<SourceLabel provenance={{ source: "straight-line", approximate: true, simulated: false }} />);
    expect(screen.getByText(/Approximate · straight-line/)).toBeInTheDocument();
  });
});
